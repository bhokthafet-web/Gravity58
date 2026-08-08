import { test, expect } from "@playwright/test";
import { monitorPageErrors, prepareOffline } from "./helpers.js";

const routes = [
  "/", "/about/", "/admin/", "/advertise/", "/business/",
  "/business/dreamspace-interiors-gachibowli-hyderabad/",
  "/business/quickfix-plumbing-kukatpally-hyderabad/",
  "/business/telangana/hyderabad/", "/category/carpentry/",
  "/category/digital-marketing/", "/category/electrical/",
  "/category/interior-design/", "/category/painting/", "/category/plumbing/",
  "/contact/", "/dashboard/", "/digital-menu/", "/jobs/",
  "/jobs/emergency-plumbing-repair-kondapur-hyderabad/",
  "/jobs/need-modular-kitchen-installation-madhapur-hyderabad/",
  "/pos/", "/privacy-policy/", "/reset-password/", "/team-admin/", "/terms/",
];

for (const route of routes) {
  test(`route ${route} loads without a JavaScript crash`, async ({ page }) => {
    await prepareOffline(page);
    const assertNoErrors = monitorPageErrors(page);
    const response = await page.goto(route, { waitUntil: "domcontentloaded" });
    expect(response?.status(), route).toBeLessThan(400);
    await expect(page.locator("body")).toBeVisible();
    expect((await page.title()).trim(), route).not.toBe("");
    await page.waitForTimeout(250);
    await assertNoErrors();
  });
}
