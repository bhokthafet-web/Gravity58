import { test, expect } from "@playwright/test";
import { monitorPageErrors, prepareMockApi } from "./helpers.js";

const routes = [
  "/", "/about/", "/admin/", "/advertise/", "/contact/", "/dashboard/",
  "/digit58/", "/digital-menu-guide/", "/digital-menu/", "/pos/",
  "/pricing/", "/privacy-policy/", "/refer/", "/refills-guide/",
  "/reset-password/", "/support/", "/team-admin/", "/templates/",
  "/terms/",
];

for (const route of routes) {
  test(`route ${route} loads without a JavaScript crash`, async ({ page }) => {
    await prepareMockApi(page);
    const assertNoErrors = monitorPageErrors(page);
    const response = await page.goto(route, { waitUntil: "domcontentloaded" });
    expect(response?.status(), route).toBeLessThan(400);
    await expect(page.locator("body")).toBeVisible();
    expect((await page.title()).trim(), route).not.toBe("");
    await page.waitForTimeout(250);
    await assertNoErrors();
  });
}
