import { test, expect, type BrowserContext } from "@playwright/test";
import { readFileSync } from "node:fs";

// This suite provisions staff and changes demo-student access. Isolated DB only.
test.skip(
  process.env.E2E_PERMISSIONS_TESTS !== "1",
  "Requires an explicitly selected isolated database",
);
test("superadmin manages staff; curators can only access assigned students", async ({
  browser,
}) => {
  test.setTimeout(180000);
  const origin = process.env.E2E_BASE_URL!;
  const credentials = readFileSync(process.env.E2E_CREDENTIALS!, "utf8");
  const password = (name: string) =>
    credentials.match(
      new RegExp(name.replaceAll(".", "\\.") + "\\r?\\nПароль: (\\S+)"),
    )![1];
  const post = (
    ctx: BrowserContext,
    action: string,
    data: Record<string, unknown>,
  ) =>
    ctx.request.post(`${origin}/api/platform`, {
      headers: { Origin: origin },
      data: { action, ...data },
    });
  const get = (ctx: BrowserContext, action: string) =>
    ctx.request.get(`${origin}/api/platform?action=${action}`);
  async function login(username: string, pw: string) {
    const ctx = await browser.newContext();
    expect(
      (
        await ctx.request.post(`${origin}/api/auth/sign-in/username`, {
          headers: { Origin: origin },
          data: { username, password: pw },
        })
      ).ok(),
    ).toBeTruthy();
    return ctx;
  }
  const admin = await login("admin", password("admin"));
  const me = await (await get(admin, "me")).json();
  expect(me.role).toBe("SUPER_ADMIN");
  const stamp = Date.now().toString();
  const accounts = [];
  for (const suffix of ["a", "b"]) {
    const response = await post(admin, "createStaff", {
      name: `Куратор ${suffix}`,
      username: `curator-${stamp}-${suffix}`,
      role: "ADMIN",
    });
    expect(response.ok()).toBeTruthy();
    accounts.push(await response.json());
  }
  const a = await login(accounts[0].username, accounts[0].password);
  const b = await login(accounts[1].username, accounts[1].password);
  for (const [i, ctx] of [a, b].entries()) {
    expect((await get(ctx, "admin")).status()).toBe(403);
    expect(
      (
        await post(ctx, "password", {
          currentPassword: accounts[i].password,
          newPassword: `Isolated-curator-${stamp}-${i}`,
        })
      ).ok(),
    ).toBeTruthy();
    expect((await (await get(ctx, "students")).json()).total).toBe(0);
  }
  const students = (await (await get(admin, "students")).json()).rows;
  const ru = students.find(
    (row: { username: string }) => row.username === "student.ru",
  );
  const kk = students.find(
    (row: { username: string }) => row.username === "student.kk",
  );
  expect(
    (
      await post(admin, "assignStudent", {
        curatorId: accounts[0].id,
        studentId: ru.id,
        assigned: true,
      })
    ).ok(),
  ).toBeTruthy();
  expect(
    (
      await post(admin, "assignStudent", {
        curatorId: accounts[1].id,
        studentId: kk.id,
        assigned: true,
      })
    ).ok(),
  ).toBeTruthy();
  expect(
    (await (await get(a, "students")).json()).rows.map(
      (row: { id: string }) => row.id,
    ),
  ).toEqual([ru.id]);
  expect((await (await get(a, "students&q=student.kk")).json()).total).toBe(0);
  expect((await get(a, `student&id=${kk.id}`)).status()).toBe(404);
  expect((await get(a, `student&id=${ru.id}`)).ok()).toBeTruthy();
  for (const [action, payload] of [
    ["studentStatus", { id: kk.id, status: "BLOCKED" }],
    ["resetPassword", { id: kk.id }],
    ["enrollment", { id: kk.enrollments[0].id, status: "REVOKED" }],
    ["bonusAttempt", { userId: kk.id, homeworkId: "kk-02-hw" }],
    [
      "createStaff",
      { name: "Escalation", username: "escalation", role: "SUPER_ADMIN" },
    ],
    [
      "assignStudent",
      { curatorId: accounts[0].id, studentId: kk.id, assigned: true },
    ],
    ["staffRole", { id: accounts[0].id, role: "SUPER_ADMIN" }],
    ["staffStatus", { id: me.id, status: "BLOCKED" }],
    ["staffPassword", { id: me.id }],
  ] as const)
    expect((await post(a, action, payload)).status(), action).toBe(403);
  expect((await get(a, "staff")).status()).toBe(403);
  expect(
    (await get(a, `assignments&curatorId=${accounts[0].id}`)).status(),
  ).toBe(403);
  const lesson = await (await get(a, "editor&id=ru-01")).json();
  expect(
    (await post(a, "lesson", { ...lesson, videoId: lesson.videoId })).ok(),
  ).toBeTruthy();
  expect(
    (await post(a, "studentStatus", { id: ru.id, status: "BLOCKED" })).ok(),
  ).toBeTruthy();
  expect(
    (await post(a, "studentStatus", { id: ru.id, status: "ACTIVE" })).ok(),
  ).toBeTruthy();
  const student = await login("student.ru", password("student.ru"));
  expect((await get(student, "staff")).status()).toBe(403);
  expect((await get(student, "admin")).status()).toBe(403);
  expect(
    (
      await post(student, "assignStudent", {
        curatorId: accounts[0].id,
        studentId: kk.id,
        assigned: true,
      })
    ).status(),
  ).toBe(403);
  await post(student, "viewed", { lessonId: "ru-02" });
  const hw = (await (await get(student, "lesson&id=ru-02")).json()).homework;
  const submitted = await post(student, "submit", {
    lessonId: "ru-02",
    revision: hw.revision,
    requestId: crypto.randomUUID(),
    answers: Object.fromEntries(
      hw.questions.map((q: { id: string }) => [q.id, "A"]),
    ),
  });
  expect(submitted.ok()).toBeTruthy();
  const aOverview = await (await get(a, "admin")).json();
  const bOverview = await (await get(b, "admin")).json();
  expect(aOverview.students).toBe(1);
  expect(aOverview.submissions).toBe(1);
  expect(bOverview.students).toBe(1);
  expect(bOverview.submissions).toBe(0);
  expect(bOverview.averageScore).toBeNull();
  expect(
    bOverview.cohorts.find((c: { id: string }) => c.id === "preview-ru")._count
      .enrollments,
  ).toBe(0);
  expect(
    bOverview.lessons.find((l: { id: string }) => l.id === "ru-02").homework
      ._count.submissions,
  ).toBe(0);
  expect(
    (
      await post(a, "bonusAttempt", { userId: ru.id, homeworkId: "ru-02-hw" })
    ).ok(),
  ).toBeTruthy();
  const csv = `name,username\nИмпорт Куратора,import-${stamp}`;
  const nameOnly = await post(a, "importPreview", {
    csv: "name\nУченик Без Логина",
    cohortId: "preview-ru",
  });
  expect(nameOnly.ok()).toBeTruthy();
  expect((await nameOnly.json())[0]).toMatchObject({
    name: "Ученик Без Логина",
    cohortId: "preview-ru",
    error: "",
  });
  const preview = await post(a, "importPreview", {
    csv,
    cohortId: "preview-ru",
  });
  expect(preview.ok()).toBeTruthy();
  expect((await preview.json())[0]).toMatchObject({
    cohortId: "preview-ru",
    error: "",
  });
  expect((await post(a, "importPreview", { csv })).status()).toBe(400);
  expect(
    (
      await post(a, "importPreview", {
        csv:
          "name\n" +
          Array.from({ length: 101 }, (_, i) => `Ученик ${i}`).join("\n"),
        cohortId: "preview-ru",
      })
    ).status(),
  ).toBe(400);
  const imported = await (
    await post(a, "importCommit", { csv, cohortId: "preview-ru" })
  ).json();
  expect(imported.created).toHaveLength(1);
  expect(imported.failed).toHaveLength(0);
  expect(
    (await get(a, `student&id=${imported.created[0].id}`)).ok(),
  ).toBeTruthy();
  expect((await get(b, `student&id=${imported.created[0].id}`)).status()).toBe(
    404,
  );
  const forged = await (
    await post(a, "createStudent", {
      name: "Тест роли ученика",
      username: `forged-${stamp}`,
      cohortId: "preview-ru",
      role: "SUPER_ADMIN",
    })
  ).json();
  expect(
    (await (await get(a, `student&id=${forged.id}`)).json()).student.role,
  ).toBe("STUDENT");
  expect(
    (
      await post(admin, "assignStudent", {
        curatorId: accounts[0].id,
        studentId: ru.id,
        assigned: false,
      })
    ).ok(),
  ).toBeTruthy();
  expect((await get(a, `student&id=${ru.id}`)).status()).toBe(404);
  expect((await post(a, "resetPassword", { id: ru.id })).status()).toBe(403);
  expect((await (await get(a, "admin")).json()).submissions).toBe(0);
  for (const action of ["staffRole", "staffStatus", "staffPassword"])
    expect(
      (
        await post(admin, action, {
          id: me.id,
          role: "ADMIN",
          status: "BLOCKED",
        })
      ).status(),
    ).toBe(400);

  const page = await admin.newPage();
  await page.goto(origin + "/admin/staff");
  await expect(
    page.getByRole("heading", { name: "Администраторы", exact: true }),
  ).toBeVisible();
  await page
    .locator("article")
    .filter({ hasText: "Куратор a" })
    .getByRole("button", { name: "Назначить учеников", exact: true })
    .click();
  await page.getByRole("checkbox", { name: /student.ru/ }).check();
  await expect(
    page.getByRole("checkbox", { name: /student.ru/ }),
  ).toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: /student.ru/ }),
  ).toBeEnabled();
  expect((await get(a, `student&id=${ru.id}`)).ok()).toBeTruthy();
  const curatorPage = await a.newPage();
  await curatorPage.goto(origin + "/admin");
  await expect(
    curatorPage.getByRole("link", { name: "Администраторы", exact: true }),
  ).toHaveCount(0);
  await curatorPage.goto(origin + "/admin/staff");
  await expect(curatorPage.locator("main").getByRole("alert")).toContainText(
    "Недостаточно прав",
  );
  expect(
    (
      await post(admin, "staffRole", {
        id: accounts[1].id,
        role: "SUPER_ADMIN",
      })
    ).ok(),
  ).toBeTruthy();
  expect((await get(b, "me")).status()).toBe(401);
  const promoted = await login(
    accounts[1].username,
    `Isolated-curator-${stamp}-1`,
  );
  expect((await (await get(promoted, "me")).json()).role).toBe("SUPER_ADMIN");
  expect((await get(promoted, `student&id=${ru.id}`)).ok()).toBeTruthy();
  expect((await get(promoted, "staff")).ok()).toBeTruthy();
  expect(
    (
      await post(admin, "staffStatus", {
        id: accounts[0].id,
        status: "BLOCKED",
      })
    ).ok(),
  ).toBeTruthy();
  expect((await get(a, "me")).status()).toBe(401);
  for (const ctx of [admin, a, b, student, promoted]) await ctx.close();
});
