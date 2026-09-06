import { test, expect } from "@playwright/test";
import { monitorPageErrors, prepareMockApi, prepareOffline } from "./helpers.js";

test("homepage exposes business tools without public posting controls", async ({ page }) => {
  await prepareOffline(page);
  const assertNoErrors = monitorPageErrors(page);
  await page.goto("/");

  await expect(page.locator("#myPostsButton")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Post Requirement/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Create Business Card/i })).toHaveCount(0);
  await expect(page.locator("#contentArea")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Explore Refills/i }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Explore Digital Menu/i }).first()).toBeVisible();
  await expect(page.locator("script[src*='/js/app.js']")).toHaveCount(0);
  await assertNoErrors();
});

test("retired business-wall routes return visitors to G58 home", async ({ page }) => {
  await prepareOffline(page);
  await page.goto("/business/");
  await page.waitForURL("/");
  await expect(page.locator("body")).toBeVisible();
  await expect(page.locator("#myPostsButton")).toHaveCount(0);
});

test("login stays simple and forgot-password reports success", async ({ page }) => {
  await prepareMockApi(page);
  const assertNoErrors = monitorPageErrors(page);
  await page.goto("/");
  await page.locator("#siteLoginButton").click();

  await expect(page.locator("#siteAuthModal")).toHaveClass(/show/);
  await expect(page.locator("#authEmail")).toBeVisible();
  await expect(page.locator("#authPassword")).toBeVisible();
  await expect(page.locator("#authFullName")).toBeHidden();
  await expect(page.locator("#authPhone")).toBeHidden();

  await page.locator("#authEmail").fill("customer@example.com");
  await page.locator("#authForgot").click();
  await expect(page.locator("#authSuccessModal")).toHaveClass(/show/);
  await expect(page.locator("#authSuccessText")).toContainText("sent to your email");
  const recoveries = await page.evaluate(() => window.__g58Mock.recoveries);
  expect(recoveries).toHaveLength(1);
  await assertNoErrors();
});

test("referrals remain on their dedicated page without a floating control", async ({ page }) => {
  await prepareOffline(page);
  const assertNoErrors = monitorPageErrors(page);
  await page.goto("/");
  await expect(page.locator(".g58-refer-section")).toHaveCount(0);
  await expect(page.locator(".g58-referral-float")).toHaveCount(0);

  await page.goto("/refer/");
  await expect(page.getByRole("heading", { name: "Share G58. Earn ₹399." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "How you earn the reward" })).toBeVisible();
  await expect(page.getByText("A free trial alone does not qualify.")).toBeVisible();
  await assertNoErrors();
});
