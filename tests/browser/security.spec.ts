import { test, expect, type APIRequestContext } from "@playwright/test";
import { readFileSync } from "node:fs";

test.skip(
  process.env.E2E_SECURITY_TESTS !== "1",
  "Isolated security test database required",
);
const origin = process.env.E2E_BASE_URL || "http://localhost:3001";
const post = (client: APIRequestContext, action: string, data = {}) =>
  client.post(`${origin}/api/platform`, {
    headers: { Origin: origin },
    data: { action, ...data },
  });
async function adminLogin(client: APIRequestContext) {
  const credentials = readFileSync(process.env.E2E_CREDENTIALS!, "utf8");
  const password = credentials.match(/admin\r?\nПароль: (\S+)/)![1];
  const response = await client.post(`${origin}/api/auth/sign-in/username`, {
    headers: { Origin: origin },
    data: { username: "admin", password },
  });
  expect(response.ok()).toBeTruthy();
  return response;
}

test("anonymous, CSRF, unexpected auth routes, secrets and CSP", async ({
  request,
  page,
}) => {
  expect(
    (await request.get(`${origin}/api/platform?action=admin`)).status(),
  ).toBe(401);
  expect((await request.get(`${origin}/api/platform?action=me`, {
    headers: { Cookie: "better-auth.session_token=forged.invalid-signature" },
  })).status()).toBe(401);
  for (const path of [
    "update-user",
    "change-password",
    "sign-up/email",
    "sign-in/email",
    "delete-user",
    "request-password-reset",
  ])
    expect(
      (
        await request.post(`${origin}/api/auth/${path}`, {
          headers: { Origin: origin },
          data: {},
        })
      ).status(),
    ).toBe(404);
  for (const headers of [
    {},
    { Origin: "https://attacker.example" },
    { Origin: "null" },
  ] as Record<string, string>[])
    expect(
      (
        await request.post(`${origin}/api/auth/sign-in/username`, {
          headers,
          data: { username: "admin", password: "fake" },
        })
      ).status(),
    ).toBe(403);
  const login = await adminLogin(request);
  const cookie = login.headers()["set-cookie"];
  expect(cookie).toMatch(/HttpOnly/i);
  expect(cookie).toMatch(/SameSite=Lax/i);
  expect(
    (
      await request.post(`${origin}/api/platform`, {
        headers: { Origin: "https://attacker.example" },
        data: { action: "createStaff" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post(`${origin}/api/platform`, {
        headers: { Origin: origin, "Content-Type": "text/plain" },
        data: "{}",
      })
    ).status(),
  ).toBe(415);
  expect(
    (
      await request.post(`${origin}/api/platform`, {
        headers: { Origin: origin },
        data: null,
      })
    ).status(),
  ).toBeGreaterThanOrEqual(400);
  for (const file of [
    "/.env",
    "/.env.neon",
    "/credentials.local.txt",
    "/.git/config",
    "/content/homeworks.json",
  ])
    expect((await request.get(origin + file)).status()).not.toBe(200);
  const response = await page.goto(origin + "/login");
  const csp = response!.headers()["content-security-policy"];
  expect(csp).toContain("'nonce-");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp.split(";").find((s) => s.includes("script-src"))).not.toContain(
    "unsafe-inline",
  );
  if (process.env.E2E_PRODUCTION === "1")
    expect(csp).not.toContain("unsafe-eval");
  expect(response!.headers()["x-content-type-options"]).toBe("nosniff");
  const next = await request.get(origin + "/login");
  expect(next.headers()["content-security-policy"]).not.toBe(csp);
  // The browser must actually enforce the policy and hydrate the login page.
  await expect(
    page.getByRole("button", { name: "Войти", exact: true }),
  ).toBeVisible();
  await page.route("**/login", async (route) => {
    const response = await route.fetch();
    const html = await response.text();
    await route.fulfill({
      response,
      body: html.replace(
        "</head>",
        "<script>window.__securityInjected = true</script></head>",
      ),
    });
  });
  await page.reload();
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __securityInjected?: boolean })
          .__securityInjected,
    ),
  ).toBeUndefined();
});

test("login throttling cannot be bypassed by spoofing forwarded IP or username case", async ({
  request,
}) => {
  const username = `absent-${Date.now()}`;
  for (let i = 0; i < 9; i++) {
    const response = await request.post(`${origin}/api/auth/sign-in/username`, {
      headers: {
        Origin: origin,
        "x-forwarded-for": `192.0.2.${i + 1}`,
        "x-real-ip": `192.0.2.${i + 1}`,
      },
      data: {
        username: i % 2 ? username.toUpperCase() : username,
        password: "not-a-real-password",
      },
    });
    if (i < 8) expect([401, 422]).toContain(response.status());
    else expect(response.status()).toBe(429);
  }
});

test("temporary password, role injection, session revocation and concurrent attempt limits", async ({
  browser,
  request,
}) => {
  test.setTimeout(120000);
  await adminLogin(request);
  const issued = await (
    await post(request, "createStudent", {
      name: "Security test",
      username: `security-${Date.now()}`,
      cohortId: "preview-ru",
      role: "SUPER_ADMIN",
    })
  ).json();
  const student = await browser.newContext();
  const login = () =>
    student.request.post(`${origin}/api/auth/sign-in/username`, {
      headers: { Origin: origin },
      data: { username: issued.username, password: issued.password },
    });
  expect((await login()).ok()).toBeTruthy();
  expect(
    (
      await (
        await student.request.get(`${origin}/api/platform?action=me`)
      ).json()
    ).role,
  ).toBe("STUDENT");
  expect(
    (
      await student.request.get(`${origin}/api/platform?action=catalog`)
    ).status(),
  ).toBe(403);
  expect(
    (
      await post(student.request, "password", {
        currentPassword: issued.password,
        newPassword: "Қ".repeat(40),
      })
    ).status(),
  ).toBe(400);
  const newPassword = `Security-test-${Date.now()}`;
  expect(
    (
      await post(student.request, "password", {
        currentPassword: issued.password,
        newPassword: newPassword,
      })
    ).ok(),
  ).toBeTruthy();
  expect(
    (await student.request.get(`${origin}/api/platform?action=admin`)).status(),
  ).toBe(403);
  expect(
    (
      await student.request.get(`${origin}/api/platform?action=editor&id=ru-02`)
    ).status(),
  ).toBe(403);
  expect(
    (
      await post(student.request, "draft", { lessonId: "ru-02", answers: {} })
    ).status(),
  ).toBe(409);
  expect(
    (await post(student.request, "viewed", { lessonId: "ru-02" })).ok(),
  ).toBeTruthy();
  const lesson = await (
    await student.request.get(`${origin}/api/platform?action=lesson&id=ru-02`)
  ).json();
  expect(JSON.stringify(lesson)).not.toMatch(
    /correctAnswer|acceptableAnswers|tolerance/,
  );
  const answers = Object.fromEntries(
    lesson.homework.questions.map((q: { id: string }) => [q.id, "A"]),
  );
  const results = await Promise.all(
    Array.from({ length: 5 }, () =>
      post(student.request, "submit", {
        lessonId: "ru-02",
        answers,
        revision: lesson.homework.revision,
        requestId: crypto.randomUUID(),
        score: 100,
        attempt: 0,
      }),
    ),
  );
  expect(results.filter((r) => r.ok()).length).toBe(3);
  for (const r of results) expect([200, 409]).toContain(r.status());
  const after = await (
    await student.request.get(`${origin}/api/platform?action=lesson&id=ru-02`)
  ).json();
  expect(after.homework.progress.attemptCount).toBe(3);
  expect(after.homework.progress.bestScore).toBeLessThan(80);
  await post(request, "studentStatus", { id: issued.id, status: "BLOCKED" });
  expect(
    (await student.request.get(`${origin}/api/platform?action=me`)).ok(),
  ).toBe(false);
  const blocked = await student.request.post(
    `${origin}/api/auth/sign-in/username`,
    {
      headers: { Origin: origin },
      data: { username: issued.username, password: newPassword },
    },
  );
  expect(blocked.ok()).toBe(false);
  expect(blocked.headers()["set-cookie"] || "").not.toContain("session_token=");
  await student.close();
});
