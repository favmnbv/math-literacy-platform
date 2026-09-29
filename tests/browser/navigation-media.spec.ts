import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

async function login(page: Page, username: string) {
  const credentials = readFileSync(
    process.env.E2E_CREDENTIALS || "credentials.local.txt",
    "utf8",
  );
  const password = credentials.match(
    new RegExp(`${username.replaceAll(".", "\\.")}\\r?\\nПароль: (\\S+)`),
  )![1];
  await page.goto("/login");
  await page.getByLabel("Логин", { exact: true }).fill(username);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page.locator(".sidebar")).toBeVisible();
}

test("navigation preserves the workspace while session refresh is delayed; password visibility is independent", async ({
  page,
}) => {
  await login(page, "admin");
  await page
    .locator(".sidebar")
    .evaluate((el) => el.setAttribute("data-persistent", "yes"));
  await page.route("**/api/platform?action=me", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.continue();
  });
  for (const path of ["/admin/students", "/admin/groups", "/profile"]) {
    await page.locator(`.sidebar a[href="${path}"]`).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.locator('.sidebar[data-persistent="yes"]')).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Математическая грамотность",
        exact: true,
      }),
    ).toHaveCount(0);
  }
  const current = page.locator('input[name="currentPassword"]');
  const next = page.locator('input[name="newPassword"]');
  await current.fill("Sample-current-123");
  await next.fill("Sample-new-456");
  await page
    .getByRole("button", { name: "Показать пароль", exact: true })
    .first()
    .click();
  await expect(current).toHaveAttribute("type", "text");
  await expect(next).toHaveAttribute("type", "password");
  await page
    .getByRole("button", { name: "Показать пароль", exact: true })
    .click();
  await expect(next).toHaveAttribute("type", "text");
  await page
    .getByRole("button", { name: "Скрыть пароль", exact: true })
    .first()
    .click();
  await expect(current).toHaveAttribute("type", "password");
  await expect(current).toHaveValue("Sample-current-123");
  await page.getByRole("button", { name: "ҚАЗ", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Құпиясөзді көрсету", exact: true }),
  ).toBeVisible();
});

test("video expands natively and on phones without fullscreen, preserves iframe and restores scroll", async ({
  page,
}) => {
  // Test our controls independently of third-party player availability.
  await page.route("https://drive.google.com/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<p>Player fixture</p>",
    }),
  );
  await login(page, "student.ru");
  await page.goto("/course/ru-02");
  const frame = page.locator("iframe");
  await expect(frame).toBeVisible();
  await frame.evaluate((el) => el.setAttribute("data-preserved", "yes"));
  await page
    .getByRole("button", { name: "На весь экран", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => !!document.fullscreenElement))
    .toBe(true);
  await page.getByRole("button", { name: "Свернуть", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => !!document.fullscreenElement))
    .toBe(false);
  await page.evaluate(() =>
    Object.defineProperty(document, "fullscreenEnabled", {
      configurable: true,
      get: () => false,
    }),
  );
  for (const size of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(size);
    await page
      .getByRole("button", { name: "На весь экран", exact: true })
      .click();
    await expect(page.locator("dialog:modal")).toBeVisible();
    await expect(frame).toHaveAttribute("data-preserved", "yes");
    const bounds = await page.locator("dialog").boundingBox();
    expect(bounds!.width).toBeCloseTo(size.width, 0);
    expect(bounds!.height).toBeCloseTo(size.height, 0);
    await expect(
      page.getByRole("link", { name: "Открыть видео в Google Drive" }),
    ).toHaveAttribute("target", "_blank");
    await page.screenshot({
      path: `../../work/video-expanded-${size.width}.png`,
    });
    await page.getByRole("button", { name: "Свернуть", exact: true }).click();
    await expect(page.locator("dialog:modal")).toHaveCount(0);
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
      "hidden",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page
    .getByRole("button", { name: "На весь экран", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog:modal")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "На весь экран", exact: true }),
  ).toBeFocused();
});
