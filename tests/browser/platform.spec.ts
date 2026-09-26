import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import bank from "../../content/homeworks.json";
const credentials = readFileSync("credentials.local.txt", "utf8");
function password(username: string) {
  const escaped = username.replace(".", "\\.");
  return credentials.match(new RegExp(`${escaped}\\r?\\nПароль: (\\S+)`))![1];
}
async function login(page: import("@playwright/test").Page, username: string) {
  await page.goto("/login");
  await page.getByLabel("Логин", { exact: true }).fill(username);
  await page.getByLabel("Пароль", { exact: true }).fill(password(username));
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await page.waitForURL(/dashboard|admin/);
  await expect(page.locator(".sidebar")).toBeVisible();
}
test("student: catalog, no key leak, schedule and curriculum isolation, drafts survive refresh, language/theme/mobile", async ({
  page,
}) => {
  await login(page, "student.ru");
  await expect(
    page.getByRole("heading", {
      name: "Математическая грамотность",
      exact: true,
    }),
  ).toBeVisible();
  const catalog = await page.request.get("/api/platform?action=catalog");
  const courses = await catalog.json();
  expect(courses).toHaveLength(1);
  expect(courses[0].lessons).toHaveLength(32);
  expect(JSON.stringify(courses)).not.toContain("videoId");
  expect(
    (await page.request.get("/api/platform?action=lesson&id=ru-32")).status(),
  ).toBe(403);
  expect(
    (await page.request.get("/api/platform?action=lesson&id=kk-02")).status(),
  ).toBe(403);
  expect((await page.request.get("/api/platform?action=admin")).status()).toBe(
    403,
  );
  const response = await page.request.get(
    "/api/platform?action=lesson&id=ru-02",
  );
  const lesson = await response.json();
  expect(JSON.stringify(lesson)).not.toMatch(
    /correctAnswer|acceptableAnswers|tolerance/,
  );
  await page.goto("/course/ru-02");
  await expect(
    page.getByRole("heading", { name: "Теория вероятности", exact: true }),
  ).toBeVisible();
  const mark = page.getByRole("button", {
    name: "Я посмотрел(а) урок",
    exact: true,
  });
  if (await mark.count()) await mark.click();
  await page.locator("input[type=radio][value=C]").check();
  await expect(page.getByText("Сохранено", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator("input[type=radio][value=C]")).toBeChecked();
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "ҚАЗ", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Математическая грамотность",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Оқуды жалғастыру", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Қараңғы", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    page.getByRole("heading", {
      name: "Математическая грамотность",
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: "../../work/dashboard-dark.png",
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page
        .locator(".sidebar")
        .evaluate((el) => el.getBoundingClientRect().right),
    )
    .toBeLessThanOrEqual(1);
  await page.screenshot({
    path: "../../work/dashboard-mobile.png",
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("kazakh content contains equations and no untranslated fallback curriculum", async ({
  page,
}) => {
  await login(page, "student.kk");
  await page.goto("/course/kk-02");
  await expect(
    page.getByRole("heading", { name: "Теңдеу мен есептеулер", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".question-card .katex").first()).toBeVisible();
  await page.screenshot({ path: "../../work/lesson-kk.png", fullPage: true });
  await page
    .getByRole("button", { name: "Я посмотрел(а) урок", exact: true })
    .click();
  for (let i = 0; i < 8; i++) {
    await page.locator(".question-navigation button").nth(i).click();
    await page
      .locator(
        `input[type=radio][value="${i === 7 ? "B" : bank[1].questions[i].correctAnswer}"]`,
      )
      .check();
  }
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Сдать домашнее задание", exact: true })
    .click();
  await expect(
    page.getByText("Домашнее задание зачтено", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Домашнее задание зачтено", { exact: true }),
  ).toBeVisible();
});
test("admin student provisioning, server validation and lesson editor", async ({
  page,
}) => {
  await login(page, "admin");
  await page.goto("/admin/students");
  await page
    .getByRole("button", { name: "Добавить ученика", exact: true })
    .click();
  await page.getByLabel("ФИО", { exact: true }).fill("Проверка интерфейса");
  await page.getByRole("button", { name: "Создать", exact: true }).click();
  await expect(page.locator(".credentials")).toBeVisible();
  await page.goto("/admin/lesson/ru-02");
  await expect(page.getByLabel("Название", { exact: true })).toHaveValue(
    "Теория вероятности",
  );
  await page.screenshot({
    path: "../../work/admin-editor.png",
    fullPage: true,
  });
});
test("three whole-homework submissions; retries idempotent; fourth rejected; grades and keys protected", async ({
  browser,
}) => {
  const admin = await browser.newPage();
  await login(admin, "admin");
  const issued = await (
    await admin.request.post("/api/platform", {
      headers: { Origin: "http://localhost:3000" },
      data: {
        action: "createStudent",
        name: "Проверка попыток",
        cohortId: "preview-ru",
      },
    })
  ).json();
  const student = await browser.newContext();
  const r = await student.request.post("/api/auth/sign-in/username", {
    headers: { Origin: "http://localhost:3000" },
    data: { username: issued.username, password: issued.password },
  });
  expect(r.ok()).toBe(true);
  let result = await student.request.post("/api/platform", {
    headers: { Origin: "http://localhost:3000" },
    data: {
      action: "password",
      currentPassword: issued.password,
      newPassword: "Test-only-Strong-Password-2026",
    },
  });
  expect(result.ok()).toBe(true);
  const post = (data: Record<string, unknown>) =>
    student.request.post("/api/platform", {
      headers: { Origin: "http://localhost:3000" },
      data,
    });
  await post({ action: "viewed", lessonId: "ru-02" });
  const lesson = await (
    await student.request.get("/api/platform?action=lesson&id=ru-02")
  ).json();
  const wrong = Object.fromEntries(
    lesson.homework.questions.map((q: { id: string }) => [q.id, "A"]),
  );
  const requestId = crypto.randomUUID(),
    data = {
      action: "submit",
      lessonId: "ru-02",
      answers: wrong,
      requestId,
      revision: lesson.homework.revision,
      score: 100,
      isCorrect: true,
    };
  result = await post(data);
  expect(result.ok()).toBe(true);
  const one = await result.json();
  expect(one.attempt).toBe(1);
  expect(one.score).toBe(12);
  const retry = await (await post(data)).json();
  expect(retry.id).toBe(one.id);
  expect(retry.attempt).toBe(1);
  const before = await (
    await student.request.get("/api/platform?action=lesson&id=ru-02")
  ).json();
  expect(before.homework.solutions).toHaveLength(0);
  const csrf = await student.request.post("/api/platform", {
    headers: { Origin: "https://untrusted.example" },
    data: { action: "viewed", lessonId: "ru-02" },
  });
  expect(csrf.status()).toBe(403);
  const simultaneous = await Promise.all([
    post({ ...data, requestId: crypto.randomUUID() }),
    post({ ...data, requestId: crypto.randomUUID() }),
  ]);
  expect(simultaneous.map((r) => r.status())).toEqual([200, 200]);
  expect(
    (await post({ ...data, requestId: crypto.randomUUID() })).status(),
  ).toBe(409);
  const after = await (
    await student.request.get("/api/platform?action=lesson&id=ru-02")
  ).json();
  expect(after.homework.progress.attemptCount).toBe(3);
  expect(
    after.homework.solutions
      .map((s: { correctAnswer: string }) => s.correctAnswer)
      .join(""),
  ).toBe("CDACBBEB");
  await admin.close();
  await student.close();
});
