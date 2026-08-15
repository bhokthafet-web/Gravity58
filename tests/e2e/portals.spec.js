import { test, expect } from "@playwright/test";
import { monitorPageErrors, prepareMockApi } from "./helpers.js";

const slots = [
  { id: "slot-1", restaurantKey: "Test Restaurant|Hyderabad", name: "Test Restaurant", city: "Hyderabad", active: true },
];

test("advertising user can register, book a timed placement and view the request", async ({ page }) => {
  await prepareMockApi(page, { seed: { slots } });
  const assertNoErrors = monitorPageErrors(page);
  await page.goto("/advertise/?restaurant=Test%20Restaurant%7CHyderabad");
  await page.locator("#showRegister").click();
  await page.locator('#register input[name="name"]').fill("Ad Customer");
  await page.locator('#register input[name="phone"]').fill("9876543210");
  await page.locator('#register input[name="email"]').fill("ads@example.com");
  await page.locator('#register input[name="password"]').fill("testing123");
  await page.locator("#register").getByRole("button", { name: "Create Account" }).click();
  await expect(page.getByText("Welcome, Ad Customer")).toBeVisible();

  await page.locator("#newBooking").click();
  await expect(page.getByRole("heading", { name: "Book Advertisement Space" })).toBeVisible();
  await expect(page.locator("#restaurantKey")).toHaveValue("Test Restaurant|Hyderabad");
  await page.locator('[data-slot="right_rail"]').click();
  await expect(page.locator('[data-slot="right_rail"]')).toContainText("1080 × 1350 px");
  await expect(page.locator("#bookingImageSize")).toContainText("1080 × 1350 px");
  await page.locator("#hours").selectOption("3");
  await page.locator("#title").fill("Regression Offer");
  await page.locator("#description").fill("Three-hour automated test campaign.");
  await page.locator("#submit").click();
  await expect(page.getByText("Request sent", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Current Advertisements" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Advertising History" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Regression Offer" })).toBeVisible();
  const bookings = await page.evaluate(() => window.__g58Mock.store.bookings);
  expect(bookings).toHaveLength(1);
  expect(bookings[0]).toMatchObject({ status: "Requested", hours: 3, restaurantKey: "Test Restaurant|Hyderabad", title: "Regression Offer", imageSize: "1080 × 1350 px", imageRatio: "4:5" });
  await assertNoErrors();
});

test("advertising dashboard separates live ads, expiry and history", async ({ page }) => {
  const future = "2030-08-09T12:30:00.000Z";
  await prepareMockApi(page, {
    initialUser: { $id: "mock-user", email: "advertiser@example.com", name: "Sample Advertiser" },
    seed: {
      bookings: [
        { id: "live-booking", customerId: "mock-user", restaurantKey: "Test Restaurant|Hyderabad", slotId: "right_rail", hours: 3, amount: 360, title: "Live Offer", status: "Live", expiresAt: future },
        { id: "old-booking", customerId: "mock-user", restaurantKey: "Test Restaurant|Hyderabad", slotId: "preparing", hours: 1, amount: 80, title: "Previous Offer", status: "Expired", expiresAt: "2026-01-01T00:00:00.000Z" },
      ],
    },
  });
  const assertNoErrors = monitorPageErrors(page);
  await page.goto("/advertise/");
  await expect(page.getByRole("heading", { name: "Current Advertisements" })).toBeVisible();
  const liveCard = page.locator(".booking-grid .card", { hasText: "Live Offer" });
  await expect(liveCard).toBeVisible();
  await expect(liveCard).toContainText("Expires:");
  await expect(page.getByRole("heading", { name: "Advertising History" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Previous Offer" })).toBeVisible();
  await assertNoErrors();
});

test("advertiser creative studio supplies animated copy and uploaded media to booking", async ({ page }) => {
  await prepareMockApi(page, {
    initialUser: { $id: "mock-user", email: "creative@example.com", name: "Creative Owner" },
    seed: { slots },
  });
  const assertNoErrors = monitorPageErrors(page);
  await page.goto("/advertise/");
  await page.getByRole("button", { name: "Creative Studio" }).click();
  await page.locator('[data-sample="pulse"]').click();
  await page.locator("#studioTitle").fill("Animated Restaurant Offer");
  await page.locator("#studioMedia").setInputFiles({ name: "offer.gif", mimeType: "image/gif", buffer: Buffer.from("gif") });
  await page.getByRole("button", { name: "Use Creative in Booking" }).click();
  await expect(page.locator("#title")).toHaveValue("Animated Restaurant Offer");
  await page.locator("#submit").click();
  const booking = await page.evaluate(() => window.__g58Mock.store.bookings[0]);
  expect(booking).toMatchObject({ title: "Animated Restaurant Offer", creativeStyle: "pulse", mediaType: "image/gif", status: "Requested" });
  await assertNoErrors();
});

test("advertiser submits payment reference and proof inside the portal", async ({ page }) => {
  await prepareMockApi(page, {
    initialUser: { $id: "mock-user", email: "advertiser@example.com", name: "Sample Advertiser" },
    seed: {
      bookings: [{ id: "payment-booking", customerId: "mock-user", restaurantKey: "Test Restaurant|Hyderabad", slotId: "right_rail", hours: 1, amount: 120, title: "Paid Offer", status: "Payment Link Sent", paymentLink: "https://rzp.io/test-link" }],
    },
  });
  const assertNoErrors = monitorPageErrors(page);
  await page.goto("/advertise/");
  await page.getByRole("button", { name: "Submit Payment Proof" }).click();
  await page.locator('#proofForm input[name="paymentReference"]').fill("UTR-123456");
  await page.locator('#proofForm input[name="proofFile"]').setInputFiles({ name: "proof.png", mimeType: "image/png", buffer: Buffer.from("proof") });
  await page.getByRole("button", { name: "Submit for Verification" }).click();
  const booking = await page.evaluate(() => window.__g58Mock.store.bookings.find((row) => row.id === "payment-booking"));
  expect(booking).toMatchObject({ status: "Proof Sent", paymentReference: "UTR-123456", proofMediaType: "image/png" });
  await expect(page.getByText("Payment submitted for admin verification.")).toBeVisible();
  await assertNoErrors();
});

test("advertiser receives an extension payment link and submits extension proof", async ({ page }) => {
  await prepareMockApi(page, {
    initialUser: { $id: "mock-user", email: "advertiser@example.com", name: "Sample Advertiser" },
    seed: {
      bookings: [{
        id: "extension-booking", customerId: "mock-user", restaurantKey: "Test Restaurant|Hyderabad",
        slotId: "right_rail", hours: 3, amount: 360, title: "Live Offer",
        status: "Extension Payment Link Sent", expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        extensionHours: 2, extensionAmount: 240, extensionPaymentLink: "https://rzp.io/extension-link",
      }],
    },
  });
  const assertNoErrors = monitorPageErrors(page);
  await page.goto("/advertise/");
  await expect(page.getByRole("link", { name: "Pay Extension ₹240" })).toHaveAttribute("href", "https://rzp.io/extension-link");
  await page.getByRole("button", { name: "Submit Extension Payment Proof" }).click();
  await page.locator('#proofForm input[name="paymentReference"]').fill("EXT-UTR-1234");
  await page.locator('#proofForm input[name="proofFile"]').setInputFiles({ name: "extension-proof.png", mimeType: "image/png", buffer: Buffer.from("proof") });
  await page.getByRole("button", { name: "Submit for Verification" }).click();
  const booking = await page.evaluate(() => window.__g58Mock.store.bookings.find((row) => row.id === "extension-booking"));
  expect(booking).toMatchObject({ status: "Extension Proof Sent", extensionPaymentReference: "EXT-UTR-1234", extensionProofMediaType: "image/png" });
  await expect(page.getByText("Extension payment submitted", { exact: false })).toBeVisible();
  await assertNoErrors();
});

test("team admin reviews bookings, activates campaigns, moderates posts and blocks accounts", async ({ page }) => {
  const future = new Date(Date.now() + 3_600_000).toISOString();
  const past = new Date(Date.now() - 3_600_000).toISOString();
  const seed = {
    slots,
    profiles: [{ id: "profile-1", userId: "customer-1", name: "Customer One", email: "customer@example.com", phone: "9876543210", state: "Telangana", district: "Hyderabad", blocked: false }],
    bookings: [
      { id: "booking-requested", customerName: "Customer One", customerEmail: "customer@example.com", restaurantKey: "Test Restaurant|Hyderabad", slotId: "right_rail", hours: 3, amount: 300, title: "Requested Ad", description: "Waiting for link", status: "Requested" },
      { id: "booking-proof", customerName: "Customer Two", customerEmail: "two@example.com", restaurantKey: "Test Restaurant|Hyderabad", slotId: "right_rail", hours: 1, amount: 100, title: "Proof Ad", description: "Ready to activate", status: "Proof Sent" },
    ],
    advertisements: [
      { id: "ad-live", bookingId: "old", restaurantKey: "Test Restaurant|Hyderabad", slotId: "right_rail", title: "Live Ad", description: "Existing", active: true, status: "Live", expiresAt: future },
      { id: "ad-expired", restaurantKey: "Old Restaurant|Hyderabad", slotId: "right_rail", title: "Expired Ad", description: "Past campaign", active: true, status: "Live", expiresAt: past },
    ],
    posts: [
      { id: "post-customer", recordKey: "C-TEST", postType: "customer", userId: "customer-1", payload: JSON.stringify({ id: "C-TEST", title: "Customer Test Post", description: "Test", state: "Telangana", district: "Hyderabad", userId: "customer-1" }) },
      { id: "post-business", recordKey: "B-TEST", postType: "business", userId: "customer-1", payload: JSON.stringify({ id: "B-TEST", title: "Business Test Card", description: "Test", state: "Telangana", district: "Hyderabad", userId: "customer-1" }) },
    ],
  };
  await prepareMockApi(page, { admin: true, seed, state: null });
  const assertNoErrors = monitorPageErrors(page);
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/team-admin/");
  await page.locator('#login input[name="email"]').fill("admin@g58.in");
  await page.locator('#login input[name="password"]').fill("testing123");
  await page.locator("#login").getByRole("button", { name: "Secure Login" }).click();
  await expect(page.getByRole("heading", { name: "Unified Administration" })).toBeVisible();

  await page.locator('[data-view="bookings"]').click();
  await page.locator('[data-payment="booking-requested"]').click();
  await page.locator('#payForm input[name="paymentLink"]').fill("https://rzp.io/test-link");
  await page.locator("#payForm").getByRole("button", { name: "Send to customer portal" }).click();
  await expect(page.locator("#page")).toContainText("Payment Link Sent");

  await page.locator('[data-activate="booking-proof"]').click();
  await expect(page.locator('#activateSlot option[value="right_rail"]')).toBeDisabled();
  await expect(page.locator("#activateSlot")).toHaveValue("preparing");
  await expect(page.locator("#slotAvailability")).toContainText("Available now");
  await page.locator('#activateForm input[name="buttonLabel"]').fill("View Test Offer");
  await page.locator("#activateForm").getByRole("button", { name: "Publish for 1 hours" }).click();
  const activated = await page.evaluate(() => window.__g58Mock.store.bookings.find((row) => row.id === "booking-proof"));
  expect(activated.status).toBe("Live");
  const generatedCampaign = await page.evaluate(() => window.__g58Mock.store.advertisements.find((row) => row.bookingId === "booking-proof"));
  expect(generatedCampaign).toMatchObject({ active: true, status: "Live", slotId: "preparing", imageSize: "1200 × 628 px", buttonLabel: "View Test Offer" });

  await page.locator('[data-view="marketplace"]').click();
  await expect(page.locator("#marketTable")).toContainText("Customer Test Post");
  await page.locator('[data-edit-post="C-TEST"]').click();
  await page.locator('#editPostForm input[name="title"]').fill("Updated Customer Post");
  await page.locator("#editPostForm").getByRole("button", { name: "Save Changes" }).click();
  await expect(page.locator("#marketTable")).toContainText("Updated Customer Post");

  await page.locator('[data-view="accounts"]').click();
  await page.locator('[data-block="profile-1"]').click();
  const profile = await page.evaluate(() => window.__g58Mock.store.profiles.find((row) => row.id === "profile-1"));
  expect(profile.blocked).toBe(true);

  await page.locator('[data-view="campaigns"]').click();
  await expect(page.locator("#page")).toContainText("Live Ad");
  const expiredCard = page.locator('[data-campaign-id="ad-expired"]');
  await expect(expiredCard).toContainText("Expired");
  await expect(expiredCard).toContainText("Extend to republish");
  await expect(expiredCard.locator('[data-toggle="ad-expired"]')).toHaveCount(0);
  await page.locator("#campaignStatus").selectOption("Expired");
  await expect(page.locator("#campaignGrid")).toContainText("Expired Ad");
  await expect(page.locator("#campaignGrid")).not.toContainText("Live Ad");
  await page.locator("#campaignStatus").selectOption("All");
  await page.locator("#campaignSearch").fill("Live Ad");
  await expect(page.locator("#campaignGrid")).toContainText("Live Ad");
  await expect(page.locator("#campaignGrid")).not.toContainText("Expired Ad");
  await page.locator("#campaignSearch").fill("");
  await page.locator('[data-toggle="ad-live"]').click();
  const paused = await page.evaluate(() => window.__g58Mock.store.advertisements.find((row) => row.id === "ad-live"));
  expect(paused).toMatchObject({ active: false, status: "Paused" });

  await page.getByRole("button", { name: "+ Manual campaign" }).click();
  await page.getByLabel("Restaurant placement key").fill("Sample Restaurant|Hyderabad");
  await page.getByLabel("Placement", { exact: true }).selectOption("preparing");
  await expect(page.locator("#manualImageSize")).toContainText("1200 × 628 px");
  await page.getByLabel("Title").fill("Sample Preparing Offer");
  await page.getByLabel("Description").fill("A production-safe sample advertisement.");
  await page.getByLabel("Hours").fill("24");
  await page.getByLabel("Animation style").selectOption("pulse");
  await page.getByRole("button", { name: "Publish campaign" }).click();
  const manual = await page.evaluate(() => window.__g58Mock.store.advertisements.find((row) => row.title === "Sample Preparing Offer"));
  expect(manual).toMatchObject({ restaurantKey: "Sample Restaurant|Hyderabad", slotId: "preparing", imageSize: "1200 × 628 px", imageRatio: "1.91:1", hours: 24, creativeStyle: "pulse", active: true, status: "Live" });
  await assertNoErrors();
});

test("admin requests a paid extension, confirms it, and permanently deletes all ad records and media", async ({ page }) => {
  const originalExpiry = new Date(Date.now() + 3_600_000).toISOString();
  await prepareMockApi(page, {
    admin: true,
    state: null,
    seed: {
      slots,
      bookings: [{
        id: "paid-booking", customerId: "customer-1", customerName: "Customer One", customerEmail: "customer@example.com",
        restaurantKey: "Test Restaurant|Hyderabad", slotId: "right_rail", hours: 1, rate: 100, amount: 100,
        title: "Paid Campaign", description: "Live campaign", status: "Live", expiresAt: originalExpiry,
        mediaFileId: "creative-file", proofMediaFileId: "initial-proof-file",
      }],
      advertisements: [{
        id: "paid-ad", bookingId: "paid-booking", restaurantKey: "Test Restaurant|Hyderabad", slotId: "right_rail",
        hours: 1, rate: 100, amount: 100, title: "Paid Campaign", description: "Live campaign",
        active: true, status: "Live", expiresAt: originalExpiry, mediaFileId: "creative-file",
      }],
    },
  });
  const assertNoErrors = monitorPageErrors(page);
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/team-admin/");
  await page.locator('#login input[name="email"]').fill("admin@g58.in");
  await page.locator('#login input[name="password"]').fill("testing123");
  await page.locator("#login").getByRole("button", { name: "Secure Login" }).click();

  await page.locator('[data-view="campaigns"]').click();
  await page.locator('[data-campaign-id="paid-ad"] [data-extend="paid-ad"]').click();
  await page.locator("#extensionHours").fill("2");
  await page.locator("#extensionRate").fill("75");
  await expect(page.locator("#extensionAmount")).toHaveText("₹150");
  await page.locator('#extendForm input[name="paymentLink"]').fill("https://rzp.io/paid-extension");
  await page.getByRole("button", { name: "Send extension payment link" }).click();
  let booking = await page.evaluate(() => window.__g58Mock.store.bookings.find((row) => row.id === "paid-booking"));
  expect(booking).toMatchObject({ status: "Extension Payment Link Sent", extensionHours: 2, extensionRate: 75, extensionAmount: 150, extensionPaymentLink: "https://rzp.io/paid-extension" });

  await page.evaluate(async () => {
    await window.Gravity58Ads.update("bookings", "paid-booking", {
      status: "Extension Proof Sent",
      extensionPaymentReference: "EXT-PAID-123",
      extensionProofMediaFileId: "extension-proof-file",
      extensionProofFileIds: ["extension-proof-file"],
    });
  });
  await page.locator('[data-view="overview"]').click();
  await page.locator("#refresh").click();
  await page.locator('[data-view="bookings"]').click();
  await page.locator('[data-confirm-extension="paid-booking"]').click();
  booking = await page.evaluate(() => window.__g58Mock.store.bookings.find((row) => row.id === "paid-booking"));
  const campaign = await page.evaluate(() => window.__g58Mock.store.advertisements.find((row) => row.id === "paid-ad"));
  expect(booking).toMatchObject({ status: "Live", hours: 3, amount: 250, lastExtensionHours: 2, lastExtensionAmount: 150 });
  expect(new Date(booking.expiresAt).getTime()).toBe(new Date(originalExpiry).getTime() + 2 * 3_600_000);
  expect(campaign).toMatchObject({ status: "Live", active: true, hours: 3, amount: 250 });

  await page.locator('[data-view="campaigns"]').click();
  await page.locator('[data-campaign-id="paid-ad"] [data-delete="paid-ad"]').click();
  const remaining = await page.evaluate(() => ({
    bookings: window.__g58Mock.store.bookings,
    advertisements: window.__g58Mock.store.advertisements,
    removedMedia: window.__g58Mock.removedMedia,
  }));
  expect(remaining.bookings).toHaveLength(0);
  expect(remaining.advertisements).toHaveLength(0);
  expect(new Set(remaining.removedMedia)).toEqual(new Set(["creative-file", "initial-proof-file", "extension-proof-file"]));
  await assertNoErrors();
});

test("password recovery rejects mismatches and completes a valid reset", async ({ page }) => {
  await prepareMockApi(page, { state: null });
  const assertNoErrors = monitorPageErrors(page);
  await page.goto("/reset-password/?userId=test-user&secret=test-secret");
  await expect(page.locator("#savePassword")).toBeEnabled();
  await page.locator("#newPassword").fill("newpassword123");
  await page.locator("#confirmPassword").fill("different123");
  await page.locator("#savePassword").click();
  await expect(page.locator("#resetMessage")).toContainText("match");
  await page.locator("#confirmPassword").fill("newpassword123");
  await page.locator("#savePassword").click();
  await expect(page.locator("#resetMessage")).toContainText(/updated|success/i);
  await assertNoErrors();
});

test("team admin login can request its own password reset link", async ({ page }) => {
  await prepareMockApi(page, { state: null });
  const assertNoErrors = monitorPageErrors(page);
  await page.goto("/team-admin/");
  await page.locator("#forgotAdminPassword").click();
  await page.locator('#adminRecoveryForm input[name="email"]').fill("admin@g58.in");
  await page.locator("#adminRecoveryForm").getByRole("button", { name: "Send Reset Link" }).click();
  await expect(page.locator("#toast")).toContainText("Password reset link sent");
  const recoveries = await page.evaluate(() => window.__g58Mock.recoveries);
  expect(recoveries).toEqual([{ email: "admin@g58.in", url: "http://127.0.0.1:4173/reset-password/" }]);
  await assertNoErrors();
});

test("Refills customer reorders from history into a fresh store-owner request", async ({ page }) => {
  const ownerId = "refill_owner";
  const customerId = "refill_customer";
  const storeId = "refill_store";
  const orderKind = `digit58_order_${ownerId}`;
  await prepareMockApi(page, {
    state: null,
    initialUser: { $id: customerId, email: "customer@example.com", name: "Refill Customer" },
    seed: {
      [`digit58_store_${ownerId}`]: [{ id: storeId, ownerId, name: "Health Refills", category: "Pharmacy", city: "Hyderabad", upiId: "health@upi" }],
      [`digit58_customer_${ownerId}`]: [{ id: "customer_link", ownerId, storeId, customerAccountId: customerId, customerName: "Refill Customer", customerEmail: "customer@example.com", phone: "9876543210" }],
      [orderKind]: [{ id: "history_order", ownerId, storeId, customerAccountId: customerId, customerName: "Refill Customer", customerEmail: "customer@example.com", phone: "9876543210", items: [{ name: "Monthly medicine", qty: 2 }], amount: 480, status: "Delivered", createdAt: "2026-08-01T08:00:00.000Z", updatedAt: "2026-08-01T09:00:00.000Z" }],
    },
  });
  const assertNoErrors = monitorPageErrors(page);
  await page.goto(`/digit58/#store&owner=${ownerId}&store=${storeId}`);
  const history = page.getByRole("heading", { name: "Order History" }).locator("..");
  await expect(history).toBeVisible();
  await page.getByRole("button", { name: "Reorder" }).click();
  await expect(page.getByRole("heading", { name: "Reorder Previous Items" })).toBeVisible();
  await expect(page.locator("#reorderForm")).toContainText("Monthly medicine");
  await page.locator('#reorderForm input[name="phone"]').fill("9888888888");
  await page.getByRole("button", { name: "Send Reorder Request" }).click();
  await expect(page.locator("#toast")).toContainText("store will review the amount");
  await expect(page.getByText("Waiting for the store to review and set the amount.")).toBeVisible();
  const orders = await page.evaluate((kind) => window.__g58Mock.store[kind], orderKind);
  expect(orders).toHaveLength(2);
  expect(orders[0]).toMatchObject({ status: "Requested", amount: 0, reorderedFrom: "history_order", phone: "9888888888" });
  await assertNoErrors();
});

test("Refills owner reviews a reordered request and sends the normal payment QR", async ({ page }) => {
  const ownerId = "refill_owner";
  const storeId = "refill_store";
  const orderKind = `digit58_order_${ownerId}`;
  await prepareMockApi(page, {
    state: null,
    initialUser: { $id: ownerId, email: "owner@example.com", name: "Store Owner" },
    seed: {
      digit58_entitlements: [{ id: "entitlement_1", ownerId, active: true, paused: false, lifetime: true, policyAcceptedAt: "2026-08-01T08:00:00.000Z" }],
      [`digit58_store_${ownerId}`]: [{ id: storeId, ownerId, name: "Health Refills", category: "Pharmacy", city: "Hyderabad", upiId: "health@upi" }],
      [`digit58_customer_${ownerId}`]: [{ id: "customer_link", ownerId, storeId, customerAccountId: "refill_customer", customerName: "Refill Customer", phone: "9888888888" }],
      [orderKind]: [{ id: "reorder_1", ownerId, storeId, customerAccountId: "refill_customer", customerName: "Refill Customer", phone: "9888888888", items: [{ name: "Monthly medicine", qty: 2 }], amount: 0, upiUri: "", reorderedFrom: "history_order", status: "Requested", messages: [], createdAt: "2026-08-15T08:00:00.000Z", updatedAt: "2026-08-15T08:00:00.000Z" }],
    },
  });
  const assertNoErrors = monitorPageErrors(page);
  await page.goto("/digit58/");
  await page.getByRole("button", { name: /Orders/ }).click();
  await expect(page.locator(".order-item-card")).toContainText("Monthly medicine");
  await page.getByRole("button", { name: "Set Amount" }).click();
  await page.locator("#amountInput").fill("525");
  await page.locator("#upiIdInput").fill("health@upi");
  await expect(page.locator("#amountQrPreview [data-testid='qr-rendered']")).toBeVisible();
  await page.locator("#setAmountForm").getByRole("button", { name: "Set Amount" }).click();
  await expect(page.locator(".order-item-card")).toContainText("Priced");
  const order = await page.evaluate((kind) => window.__g58Mock.store[kind][0], orderKind);
  expect(order.status).toBe("Priced");
  expect(order.amount).toBe(525);
  expect(order.upiUri).toContain("pa=health%40upi");
  expect(order.upiUri).toContain("am=525.00");
  await assertNoErrors();
});
