import { test, expect } from "@playwright/test";
import { monitorPageErrors, prepareMockApi, prepareOffline } from "./helpers.js";

test("public walls, location filters, guides and short-link tools work", async ({ page }) => {
  await prepareOffline(page);
  const assertNoErrors = monitorPageErrors(page);
  await page.goto("/");

  await page.locator(".catalogue-btn.jobs").click();
  await expect(page.getByRole("heading", { name: "Customer Requirements" })).toBeVisible();
  await page.locator("#categoryFilter").selectOption({ label: "Plumbing" });
  await expect(page.getByRole("heading", { name: "Emergency Plumbing Repair", exact: true })).toBeVisible();

  await page.locator("#businessTab").click();
  await expect(page.getByRole("heading", { name: "Business Owners" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "QuickFix Plumbing", exact: true })).toBeVisible();

  await page.locator("#browseGuideButton").click();
  await expect(page.locator("#browseGuideModal")).toHaveClass(/show/);
  await page.locator("#browseGuideModal").getByRole("button", { name: "Close" }).click();
  await expect(page.locator("#browseGuideModal")).not.toHaveClass(/show/);

  await page.evaluate(() => openShortTool("whatsapp"));
  await page.locator("#shortToolInput").fill("9876543210");
  await page.locator("#shortToolMessage").fill("Hello Gravity58");
  await page.getByRole("button", { name: "Generate Link" }).click();
  await expect(page.locator("#shortToolOutput")).toHaveValue(/wa\.me\/919876543210/);
  await assertNoErrors();
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

test("account signup, authenticated customer post and My Posts view work", async ({ page }) => {
  await prepareMockApi(page);
  const assertNoErrors = monitorPageErrors(page);
  await page.goto("/");
  await page.locator("#siteLoginButton").click();
  await page.locator("#authSignup").click();
  await expect(page.locator("#authFullName")).toBeVisible();
  await page.locator("#authFullName").fill("Regression Customer");
  await page.locator("#authPhone").fill("9876543210");
  await page.locator("#authEmail").fill("regression@example.com");
  await page.locator("#authPassword").fill("testing123");
  await page.locator("#authState").fill("Telangana");
  await page.locator("#authDistrict").fill("Hyderabad");
  await page.locator("#authSignup").click();
  await expect(page.locator("#authSuccessModal")).toHaveClass(/show/);
  await page.locator("#authSuccessClose").click();
  await expect(page.locator("#siteUserName")).toContainText("Regression Customer");

  await page.locator(".customer-promo-card").click();
  await expect(page.locator("#createModal")).toHaveClass(/show/);
  await page.locator("#postTitle").fill("Test electrical installation");
  await page.locator("#postCategory").selectOption("Electrical");
  await page.locator("#postDescription").fill("Need complete electrical installation for a new office.");
  await page.locator("#postDistrict").fill("Hyderabad");
  await page.locator("#postArea").fill("Madhapur");
  await page.locator("#postFullAddress").fill("Madhapur, Hyderabad, Telangana");
  await page.locator("#postPrice").fill("5000");
  await page.locator("#postMaxPrice").fill("7500");
  await page.locator("#postName").fill("Regression Customer");
  await page.locator("#postWhatsapp").fill("9876543210");
  await page.locator("#postPhone").fill("9876543210");
  await page.getByRole("button", { name: "Publish Post" }).click();
  await expect(page.locator("#publishSuccessModal")).toHaveClass(/show/);
  await expect(page.locator("#publishSuccessTitle")).toContainText("live");
  await page.locator("#publishSuccessModal").getByRole("button", { name: "Close" }).click();

  await page.locator("#myPostsButton").click();
  await expect(page.locator("#myPostsModal")).toHaveClass(/show/);
  await expect(page.locator("#myPostsModal")).toContainText("Test electrical installation");
  await page.locator("#myPostsModal").getByRole("button", { name: "View" }).click();
  await expect(page.getByRole("heading", { name: "Test electrical installation", exact: true })).toBeVisible();
  await page.waitForTimeout(300);
  const stored = await page.evaluate(() => window.G58GetPostState().customers.some((row) => row.title === "Test electrical installation"));
  expect(stored).toBe(true);
  await assertNoErrors();
});

test("business QR, rating and customer bid workflows persist", async ({ page }) => {
  await prepareOffline(page, { blockSiteAuth: true });
  const assertNoErrors = monitorPageErrors(page);
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/");

  await page.evaluate(() => openBusinessQr("B2001"));
  await expect(page.locator("#businessQrModal")).toHaveClass(/show/);
  await expect(page.locator("#businessQrLink")).toHaveValue(/\/business\/dreamspace-interiors-gachibowli-hyderabad\//);
  await page.locator("#businessQrModal").getByRole("button", { name: "×" }).click();
  await expect(page.locator("#businessQrModal")).not.toHaveClass(/show/);

  await page.evaluate(() => openBusinessRating("B2001"));
  await page.locator('[data-rating="5"]').click();
  await page.locator("#ratingName").fill("Test Reviewer");
  await page.locator("#ratingComment").fill("Excellent service and quality.");
  await page.getByRole("button", { name: "Submit Rating" }).click();
  const ratingCount = await page.evaluate(() => window.G58GetPostState().businesses.find((row) => row.id === "B2001").reviews.length);
  expect(ratingCount).toBe(1);
  await page.locator("#businessRatingModal .close").click();

  await page.evaluate(() => openBidModal("C1002"));
  await page.locator("#bidBusiness").fill("Regression Services");
  await page.locator("#bidAmount").fill("1800");
  await page.locator("#bidTime").fill("Today");
  await page.locator("#bidWhatsapp").fill("+91 98765 43210");
  await page.locator("#bidProposal").fill("We can complete the repair today.");
  await page.getByRole("button", { name: "Submit My Bid" }).click();
  await expect(page.locator("#bidSuccessModal")).toHaveClass(/show/);
  const bids = await page.evaluate(() => window.G58GetPostState().customers.find((row) => row.id === "C1002").bids);
  expect(bids).toHaveLength(1);
  expect(bids[0].whatsapp).toBe("919876543210");
  await assertNoErrors();
});
