import { test, expect } from "@playwright/test";
import { monitorPageErrors, prepareMockApi, prepareOffline } from "./helpers.js";

test("public walls, location filters, guides and short-link tools work", async ({ page }) => {
  await prepareOffline(page);
  const assertNoErrors = monitorPageErrors(page);
  await page.goto("/");

  await expect(page.locator(".left-side .side-title")).toContainText("Recent Jobs");
  await expect(page.locator(".left-side .recent-menu-launch")).toHaveAttribute("href", "/digital-menu/");
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

  await page.evaluate(() => openCustomerPostCreator());
  await expect(page.locator("#createModal")).toHaveClass(/show/);
  await page.locator("#postTitle").fill("Test electrical installation");
  await page.locator("#postCategory").selectOption("Electrical");
  await page.locator("#postDescription").fill("Need complete electrical installation for a new office.");
  await page.locator("#postDistrict").fill("Hyderabad");
  await page.locator("#postArea").fill("Madhapur");
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
  await expect(page.getByRole("button", { name: "Unlock Post", exact: true })).toBeVisible();
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

  await page.evaluate(() => {
    sessionStorage.setItem("g58BusinessOwner_B2001", "true");
    openBidModal("C1002");
  });
  await expect(page.locator("#bidBusiness")).toHaveValue("DreamSpace Interiors");
  await expect(page.locator("#bidBusiness")).toHaveJSProperty("readOnly", true);
  await page.locator("#bidAmount").fill("1800");
  await page.locator("#bidTime").fill("Today");
  await expect(page.locator("#bidWhatsapp")).toHaveValue("919999999991");
  await page.locator("#bidProposal").fill("We can complete the repair today.");
  await page.getByRole("button", { name: /Submit Offer/ }).click();
  await expect(page.locator("#bidSuccessModal")).toHaveClass(/show/);
  const bids = await page.evaluate(() => window.G58GetPostState().customers.find((row) => row.id === "C1002").bids);
  expect(bids).toHaveLength(1);
  expect(bids[0].whatsapp).toBe("919999999991");
  expect(bids[0].businessId).toBe("B2001");
  await assertNoErrors();
});

test("Business Wall cards stay compact while the full profile remains available", async ({ page }) => {
  await prepareOffline(page, { blockSiteAuth: true });
  const assertNoErrors = monitorPageErrors(page);
  await page.goto("/");
  await page.evaluate(() => selectMode("business"));

  const card = page.locator(".biz-card-wall-item .biz-card-glass").first();
  await expect(card).toBeVisible();
  const bounds = await card.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds.width).toBeLessThanOrEqual(342);
  expect(bounds.height).toBeLessThan(410);
  await expect(card.locator(".biz-card-qr-img")).toBeVisible();
  await expect(card.locator(".biz-card-primary-actions")).toBeVisible();
  await expect(card.locator(".biz-card-quickrow")).toBeHidden();

  await card.getByRole("button", { name: "View", exact: true }).click();
  await expect(page.locator("#floatingBusinessWrap")).toHaveClass(/show/);
  await expect(page.locator("#floatingBusinessCard .biz-card-quickrow")).toBeHidden();
  await expect(page.locator("#floatingBusinessCard .biz-popup-side-action")).toHaveCount(4);
  await expect(
    page.locator("#floatingBusinessCard .biz-popup-view-services"),
  ).toHaveAttribute("href", /instagram\.com|https?:\/\//);
  expect(
    await page.evaluate(() =>
      businessServicesUrl({
        title: "ARAKODI",
        socialUrl: "https://instagram.com/arakodi5/",
      }),
    ),
  ).toBe("https://www.arakodi.com/");
  const popupBounds = await page
    .locator("#floatingBusinessCard .biz-card-glass")
    .boundingBox();
  expect(popupBounds).not.toBeNull();
  expect(popupBounds.y + popupBounds.height).toBeLessThanOrEqual(
    page.viewportSize().height,
  );
  await expect(page.locator("#floatingBusinessCard .biz-popup-lock-art")).toBeVisible();
  await expect(page.locator("#floatingBusinessCard .biz-fav-btn-glass")).toHaveCount(0);
  const popupClose = page.locator("#floatingBusinessCard .biz-popup-card-close");
  await expect(popupClose).toBeVisible();
  await popupClose.click();
  await expect(page.locator("#floatingBusinessWrap")).not.toHaveClass(/show/);
  await card.getByRole("button", { name: "View", exact: true }).click();
  await expect(page.locator("#floatingBusinessCard .biz-card-glass")).toHaveCSS(
    "color",
    "rgb(248, 250, 252)",
  );
  await expect(page.locator("#floatingBusinessCard .biz-profile-more")).toHaveCount(0);
  const ownerUnlock = page.locator("#floatingBusinessCard .biz-popup-lock-art");
  await expect(ownerUnlock).toBeVisible();
  await ownerUnlock.click();
  await expect(page.locator("#cardUnlockModal")).toHaveClass(/open/);
  await assertNoErrors();
});

test("customer cards expose owner-only unlock, clear bid and readable expiry", async ({ page }) => {
  await prepareOffline(page, { blockSiteAuth: true });
  const assertNoErrors = monitorPageErrors(page);
  await page.goto("/");
  await page.evaluate(() => {
    const first = window.G58GetPostState().customers[0];
    first.userId = "test-user";
    first.accountEmail = "test@example.com";
    selectMode("customer");
    renderWall();
  });

  const ownerCard = page.locator('.req-card[data-post-id="C1001"]');
  await expect(ownerCard.getByRole("button", { name: "Unlock Post" })).toBeVisible();
  await expect(ownerCard.getByRole("button", { name: /View Offers/ })).toBeVisible();
  const publicCard = page.locator('.req-card[data-post-id="C1002"]');
  await expect(publicCard.getByRole("button", { name: "Bid", exact: true })).toBeVisible();
  await expect(publicCard.getByRole("button", { name: "Unlock Post" })).toHaveCount(0);
  const [status, expiry] = await Promise.all([
    ownerCard.locator(".req-status").boundingBox(),
    ownerCard.locator(".req-expiry-badge").boundingBox(),
  ]);
  expect(status).not.toBeNull();
  expect(expiry).not.toBeNull();
  expect(status.y + status.height).toBeLessThanOrEqual(expiry.y + 1);
  await ownerCard.getByRole("button", { name: "Unlock Post" }).click();
  await expect(page.locator("#reqDetailPanel")).toHaveClass(/open/);
  await assertNoErrors();
});

test("visiting-card camera scan autofills business-card details", async ({ page }) => {
  await prepareOffline(page, { blockSiteAuth: true });
  await page.addInitScript(() => {
    window.Tesseract = {
      recognize: async (_file, _language, options) => {
        options?.logger?.({ status: "recognizing text", progress: 1 });
        return {
          data: {
            text: "ARAKODI CATERING\nRajesh Gurram\n+91 98765 43210\nhello@arakodi.com\nwww.arakodi.com\nManikonda, Hyderabad, Telangana 500089",
          },
        };
      },
    };
  });
  const assertNoErrors = monitorPageErrors(page);
  await page.goto("/");
  await page.evaluate(() => openBusinessCardCreator());
  await expect(page.locator(".visiting-card-scan")).toBeVisible();
  await page.locator("#businessCardCameraInput").setInputFiles({
    name: "visiting-card.png",
    mimeType: "image/png",
    buffer: Buffer.from("mock-image"),
  });
  await expect(page.locator("#visitingCardScanTitle")).toHaveText(
    "Business details filled",
  );
  await expect(page.locator("#postTitle")).toHaveValue("ARAKODI CATERING");
  await expect(page.locator("#postPhone")).toHaveValue("+91 98765 43210");
  await expect(page.locator("#postEmail")).toHaveValue("hello@arakodi.com");
  await expect(page.locator("#postWebsiteUrl")).toHaveValue(
    "https://www.arakodi.com",
  );
  await expect(page.locator("#postCategory")).toHaveValue("Catering");
  await assertNoErrors();
});
