import { test, expect } from "@playwright/test";
import { monitorPageErrors, prepareMockApi, prepareOffline } from "./helpers.js";

test("homepage uses a single floating rupee link for the dedicated referral page", async ({ page }) => {
  await prepareOffline(page);
  const assertNoErrors = monitorPageErrors(page);
  await page.goto("/");
  await expect(page.locator(".g58-refer-section")).toHaveCount(0);
  const referralLink = page.locator(".g58-referral-float");
  await expect(referralLink).toHaveText("₹");
  await expect(referralLink).toHaveAttribute("href", "/refer/");

  await page.goto("/refer/");
  await expect(page.getByRole("heading", { name: "Share G58. Earn ₹399." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "How you earn the reward" })).toBeVisible();
  await expect(page.getByText("A free trial alone does not qualify.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign In & Get My Link" })).toBeVisible();
  await expect(page.locator("body.refer-page")).toHaveCSS("background-color", "rgb(246, 243, 236)");
  await expect(page.getByRole("heading", { name: "How you earn the reward" })).toHaveCSS("color", "rgb(17, 24, 32)");
  await assertNoErrors();
});

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

test("business cards can be created without login and receive a permanent direct link", async ({ page }) => {
  await prepareMockApi(page);
  const assertNoErrors = monitorPageErrors(page);
  await page.goto("/");

  await page.evaluate(() => openBusinessCardCreator());
  await expect(page.locator("#createModal")).toHaveClass(/show/);
  await expect(page.locator("#siteAuthModal")).not.toHaveClass(/show/);
  await expect(page.locator("#postType")).toHaveValue("business");

  await page.locator("#postTitle").fill("Guest Bakery");
  await page.locator("#postCategory").selectOption("Catering");
  await page.locator("#postDescription").fill("Fresh cakes and bakery orders.");
  await page.locator("#postDistrict").fill("Hyderabad");
  await page.locator("#postArea").fill("Jubilee Hills");
  await page.locator("#postFullAddress").fill("Jubilee Hills, Hyderabad");
  await page.locator("#postPrice").fill("500");
  await page.locator("#postName").fill("Guest Owner");
  await page.locator("#postWhatsapp").fill("9876543210");
  await page.locator("#postPhone").fill("9876543210");
  await page.getByRole("button", { name: "Publish Post" }).click();

  await expect(page.locator("#publishSuccessModal")).toHaveClass(/show/);
  const published = await page.evaluate(() => {
    const state = window.G58GetPostState();
    const business = state.businesses.find((item) => item.id === state.lastPublishedPostId);
    return {
      business,
      link: businessShareUrl(business.id),
      signedInHeader: !document.getElementById("siteLoginButton")?.classList.contains("hidden"),
    };
  });
  expect(published.business.userId).toMatch(/^anon-/);
  expect(published.business.popupExpiresAt).toBeGreaterThan(Date.now() + 29 * 86400000);
  expect(published.link).toBe(`http://127.0.0.1:4173/?business=${published.business.id}`);
  expect(published.signedInHeader).toBe(true);
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
  await expect(page.locator("#businessQrLink")).toHaveValue("http://127.0.0.1:4173/?business=B2001");
  await expect(page.locator("#businessQrImage")).toHaveAttribute("src", /business%3DB2001/);
  await expect(page.locator("#businessQrWhatsapp .biz-brand-logo")).toBeVisible();
  await expect(page.locator("#businessQrSocial .biz-brand-logo")).toBeVisible();
  await page.locator("#businessQrModal").getByRole("button", { name: "×" }).click();
  await expect(page.locator("#businessQrModal")).not.toHaveClass(/show/);

  await page.evaluate(() => selectMode("business"));
  await page
    .locator('.biz-card-wall-item[data-post-id="B2001"] .biz-card-rating')
    .click();
  await expect(page.locator("#businessRatingModal")).toHaveClass(/show/);
  await page.locator('[data-rating="5"]').click();
  await page.locator("#ratingName").fill("Test Reviewer");
  await page.locator("#ratingComment").fill("Excellent service and quality.");
  await page.getByRole("button", { name: "Submit Rating" }).click();
  await expect(page.locator("#ratingFormStatus")).toContainText(
    "rating was submitted",
  );
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
  await page.evaluate(() => {
    const business = window.G58GetPostState().businesses.find((item) => item.id === "B2001");
    business.lastPopupOpenedAt = 0;
    business.popupExpiresAt = Date.now() + 5 * 86400000;
    renderWall();
  });

  const card = page.locator('.biz-card-wall-item[data-post-id="B2001"] .biz-card-glass');
  await expect(card).toBeVisible();
  const bounds = await card.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds.width).toBeLessThanOrEqual(342);
  expect(bounds.height).toBeLessThan(410);
  await expect(card.locator(".biz-card-qr-img")).toBeVisible();
  await expect(card.locator(".biz-card-primary-actions")).toBeVisible();
  await expect(card.locator(".biz-card-quickrow")).toBeHidden();
  await expect(card.locator(".biz-card-popup-retention")).toContainText("Popup card not opened · 5 days left");
  await expect(card.locator(".biz-card-popup-retention small")).toHaveText("(will delete in 30d if not opened)");
  await expect(card.locator(".biz-card-cta-whatsapp .biz-brand-logo")).toBeVisible();
  await expect(card.locator(".biz-card-cta-instagram .biz-brand-logo")).toBeVisible();

  const viewButton = card.getByRole("button", { name: "View", exact: true });
  await expect(viewButton).toHaveCSS("font-size", "15px");
  await expect(viewButton).toHaveCSS("font-weight", "900");
  expect(
    await viewButton.evaluate((button) =>
      getComputedStyle(button, "::before").animationName,
    ),
  ).toBe("bizViewLightTravel");

  await viewButton.click();
  await expect(page.locator("#floatingBusinessWrap")).toHaveClass(/show/);
  await expect(page.locator("#floatingBusinessCard .biz-card-popup-retention")).toContainText("30 days left");
  await expect(page.locator("#floatingBusinessCard .biz-card-popup-retention small")).toHaveText("(will delete in 30d if not opened)");
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
  await expect(page.locator("#floatingBusinessCard .biz-popup-lock-art")).toHaveCount(0);
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
  const ownerUnlock = page
    .locator("#floatingBusinessCard")
    .getByRole("button", { name: "Unlock if you're the owner" });
  await expect(ownerUnlock).toBeVisible();
  await ownerUnlock.click();
  await expect(page.locator("#cardUnlockModal")).toHaveClass(/open/);
  await page.evaluate(() => {
    closeCardUnlockModal();
    sessionStorage.setItem("g58BusinessOwner_B2001", "true");
    hideFloatingBusiness();
    renderWall();
    showFloatingBusiness("B2001");
  });
  const manageButton = page
    .locator("#floatingBusinessCard")
    .getByRole("button", { name: "Manage your business" });
  await manageButton.click();
  await expect(page.locator("#businessEditModal")).toHaveClass(/show/);
  const editLayer = await page.locator("#businessEditModal").evaluate((element) =>
    Number(getComputedStyle(element).zIndex),
  );
  const popupLayer = await page.locator("#floatingBusinessWrap").evaluate((element) =>
    Number(getComputedStyle(element).zIndex),
  );
  expect(editLayer).toBeGreaterThan(popupLayer);
  await page.evaluate(() => closeModal("businessEditModal"));
  await page.locator("#floatingBusinessCard .biz-card-rating").click();
  await expect(page.locator("#businessRatingModal")).toHaveClass(/show/);
  const ratingLayer = await page.locator("#businessRatingModal").evaluate((element) =>
    Number(getComputedStyle(element).zIndex),
  );
  expect(ratingLayer).toBeGreaterThan(popupLayer);
  await page.evaluate(() => closeBusinessRating());
  await page.evaluate(() => {
    const expired = window.G58GetPostState().businesses.find((item) => item.id === "B2002");
    expired.popupExpiresAt = Date.now() - 1;
    renderWall();
  });
  await expect(page.locator('.biz-card-wall-item[data-post-id="B2002"]')).toHaveCount(0);
  await assertNoErrors();
});

test("landing explains Refills and Digital Menu with matching visual workflows", async ({ page }) => {
  await prepareOffline(page, { blockSiteAuth: true });
  const assertNoErrors = monitorPageErrors(page);
  await page.goto("/");
  const section = page.locator(".product-workflow-section");
  await expect(section.getByRole("heading", { name: "See how G58 products work" })).toBeVisible();
  await expect(section.locator(".workflow-refills .product-flow-node")).toHaveCount(3);
  await expect(section.locator(".workflow-menu .product-flow-node")).toHaveCount(3);
  await expect(section.getByRole("link", { name: /Explore Refills/ })).toHaveAttribute("href", "/digit58/");
  await expect(section.getByRole("link", { name: /Explore Digital Menu/ })).toHaveAttribute("href", "/digital-menu/");
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
    first.bids = [];
    first.bidHistory = [];
    sessionStorage.setItem("g58BusinessOwner_B2001", "true");
    selectMode("customer");
    renderWall();
  });

  const ownerCard = page.locator('.req-card[data-post-id="C1001"]');
  await expect(ownerCard.getByRole("button", { name: "Unlock Post" })).toBeVisible();
  await ownerCard.getByRole("button", { name: "Bids (0) →" }).click();
  await expect(page.locator("#bidModal")).toHaveClass(/show/);
  await expect(page.locator("#bidBusiness")).toHaveValue("DreamSpace Interiors");
  await page.locator("#bidAmount").fill("175000");
  await page.locator("#bidTime").fill("20 days");
  await page.locator("#bidProposal").fill("Complete supply and installation included.");
  await page.getByRole("button", { name: /Submit Offer/ }).click();
  await expect(page.locator("#bidSuccessModal")).toHaveClass(/show/);
  await page.locator("#bidSuccessModal .close").click();
  await expect(ownerCard.getByRole("button", { name: "Bids (1) →" })).toBeVisible();
  const publicCard = page.locator('.req-card[data-post-id="C1002"]');
  await expect(publicCard.getByRole("button", { name: "Bids (0)" })).toBeVisible();
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
