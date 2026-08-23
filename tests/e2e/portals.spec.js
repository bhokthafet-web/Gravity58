import { test, expect } from "@playwright/test";
import { monitorPageErrors, prepareMockApi } from "./helpers.js";

const slots = [
  { id: "slot-1", restaurantKey: "Test Restaurant|Hyderabad", name: "Test Restaurant", city: "Hyderabad", active: true },
];
const indiaDate = (value = new Date()) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};
async function slideCustomerAlertOpen(page) {
  const overlay = page.locator(".incoming-call-overlay"), track = overlay.locator(".slide-to-view-track"), thumb = overlay.locator(".slide-to-view-thumb");
  await expect(overlay).toBeVisible();
  const trackBox = await track.boundingBox(), thumbBox = await thumb.boundingBox();
  if (!trackBox || !thumbBox) throw new Error("Slide-to-open control is not measurable");
  await page.mouse.move(thumbBox.x + thumbBox.width / 2, thumbBox.y + thumbBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(trackBox.x + trackBox.width - thumbBox.width / 2 - 5, thumbBox.y + thumbBox.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(overlay).toHaveCount(0);
}

test("every G58 page reports a backend outage and recovers after retry", async ({ page }) => {
  let serverAvailable = false;
  await page.addInitScript(() => { window.__G58_TEST_SERVER_STATUS__ = true; });
  await page.route(/sgp\.cloud\.appwrite\.io\/v1\/account\?g58-status=/, (route) => {
    if (!serverAvailable) return route.abort("failed");
    return route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "Authentication required" }) });
  });
  await page.goto("/about/");
  const status = page.locator("#g58ServerStatus");
  await expect(status).toBeVisible();
  await expect(status).toContainText("G58 server is temporarily unavailable");
  serverAvailable = true;
  await status.getByRole("button", { name: "Retry" }).click();
  await expect(status).toBeHidden();
});

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

test("G58 admin manages Refills stores independently for the same owner", async ({ page }) => {
  const ownerId = "shared_refills_owner";
  await prepareMockApi(page, {
    admin: true,
    state: null,
    seed: {
      digit58_entitlements: [{ id: "shared-entitlement", ownerId, ownerEmail: "owner@example.com", active: true, paused: false, lifetime: true, storeSlots: 2, policyAcceptedAt: "2026-08-14T08:00:00.000Z" }],
      digit58_owners: [
        { id: "owner-test2", ownerId, ownerEmail: "owner@example.com", storeId: "test2", storeName: "test2", category: "Medical store", city: "Hyderabad", createdAt: "2026-08-14T08:00:00.000Z" },
      ],
      [`digit58_store_${ownerId}`]: [
        { id: "test2", ownerId, name: "test2", category: "Medical store", city: "Hyderabad", suspended: false, createdAt: "2026-08-14T08:00:00.000Z" },
        { id: "amruth", ownerId, name: "Amruth Medicals", category: "Medical store", city: "Hyderabad", highlightText: "20% Off", suspended: false, createdAt: "2026-08-15T08:00:00.000Z" },
      ],
    },
  });
  const assertNoErrors = monitorPageErrors(page);
  await page.goto("/team-admin/");
  await page.locator('#login input[name="email"]').fill("admin@g58.in");
  await page.locator('#login input[name="password"]').fill("testing123");
  await page.locator("#login").getByRole("button", { name: "Secure Login" }).click();
  await page.locator('[data-view="digit58"]').click();

  const test2Row = page.locator('[data-digit58-store-row="shared_refills_owner:test2"]');
  const amruthRow = page.locator('[data-digit58-store-row="shared_refills_owner:amruth"]');
  await expect(test2Row).toContainText("test2");
  await expect(amruthRow).toContainText("Amruth Medicals");
  await expect(amruthRow).toContainText("20% Off");
  await expect(page.locator(".entitlement-store-list").getByRole("button", { name: /test2/ })).toBeVisible();
  await expect(page.locator(".entitlement-store-list").getByRole("button", { name: /Amruth Medicals/ })).toBeVisible();
  await amruthRow.getByRole("button", { name: "Manage" }).click();
  await expect(page.getByRole("heading", { name: "Manage Amruth Medicals" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Customer Store" })).toHaveAttribute("href", /owner=shared_refills_owner&store=amruth/);
  await page.getByRole("button", { name: "Pause This Store" }).click();

  await expect(page.locator('[data-digit58-store-row="shared_refills_owner:amruth"]')).toContainText("Paused");
  await expect(page.locator('[data-digit58-store-row="shared_refills_owner:test2"]')).toContainText("Active");
  const statuses = await page.evaluate((kind) => Object.fromEntries(window.__g58Mock.store[kind].map((row) => [row.id, Boolean(row.suspended)])), `digit58_store_${ownerId}`);
  expect(statuses).toEqual({ test2: false, amruth: true });
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
      [orderKind]: [{ id: "history_order", ownerId, storeId, customerAccountId: customerId, customerName: "Refill Customer", customerEmail: "customer@example.com", phone: "9876543210", items: [{ name: "Monthly medicine", qty: 2 }], amount: 480, status: "Delivered", createdAt: new Date(Date.now()-3600000).toISOString(), updatedAt: new Date().toISOString() }],
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
  expect(orders[0]).toMatchObject({ status: "Requested", amount: 0, previousAmount: 480, reorderedFrom: "history_order", phone: "9888888888" });
  await assertNoErrors();
});

test("Refills owner header links to G58 and stores a customer highlight message", async ({ page }) => {
  const ownerId = "highlight_owner", storeId = "highlight_store";
  await prepareMockApi(page, {
    state: null,
    initialUser: { $id: ownerId, email: "owner@example.com", name: "Store Owner" },
    seed: {
      digit58_entitlements: [{ id: "highlight_entitlement", ownerId, active: true, paused: false, lifetime: true, policyAcceptedAt: new Date().toISOString() }],
      [`digit58_store_${ownerId}`]: [{ id: storeId, ownerId, name: "Amruth Medicals", category: "Medical store", city: "Hyderabad", description: "Your Trusted Local Store" }],
    },
  });
  const assertNoErrors = monitorPageErrors(page);
  await page.goto("/digit58/");
  const homeLink = page.locator(".g58-topbar-home");
  await expect(homeLink).toHaveText("www.g58.in");
  await expect(homeLink).toHaveAttribute("href", "https://www.g58.in/");
  expect(await homeLink.evaluate((node) => getComputedStyle(node).animationName)).toBe("g58TopbarBlink");
  await expect(page.locator(".floating-support-btn")).toBeVisible();

  await page.getByRole("button", { name: /My Stores/ }).click();
  await page.getByRole("button", { name: "Edit" }).click();
  await page.locator('#storeForm input[name="highlightText"]').fill("20% Off");
  await page.getByRole("button", { name: "Save Store" }).click();
  await expect(page.locator(".store-grid")).toContainText("20% Off");

  await page.goto(`/digit58/#store&owner=${ownerId}&store=${storeId}`);
  await expect(page.locator(".store-hero .store-highlight-text")).toHaveText("20% Off");
  const highlightPosition = await page.locator(".store-hero .store-highlight-text").evaluate((node) => {
    const nodeBox = node.getBoundingClientRect(), heroBox = node.parentElement.getBoundingClientRect();
    return { rightGap: heroBox.right - nodeBox.right, left: nodeBox.left, heroMid: heroBox.left + heroBox.width / 2 };
  });
  expect(highlightPosition.rightGap).toBeLessThan(35);
  expect(highlightPosition.left).toBeGreaterThan(highlightPosition.heroMid);
  await assertNoErrors();
});

test("Service owner enables doorstep booking and forwards the customer location to the selected expert", async ({ page, context }) => {
  const ownerId = "doorstep_owner", customerId = "doorstep_customer", storeId = "doorstep_store", expertId = "doorstep_expert";
  await context.grantPermissions(["geolocation"], { origin: "http://127.0.0.1:4173" });
  await context.setGeolocation({ latitude: 17.4065, longitude: 78.4772 });
  await prepareMockApi(page, {
    state: null,
    initialUser: { $id: ownerId, email: "service-owner@example.com", name: "Service Owner" },
    seed: {
      digit58_entitlements: [{ id: "doorstep_entitlement", ownerId, active: true, paused: false, lifetime: true, policyAcceptedAt: new Date().toISOString() }],
      [`digit58_store_${ownerId}`]: [{ id: storeId, ownerId, name: "G58 Home Services", businessType: "services", category: "Home services", city: "Hyderabad", slotStartTime: "00:00", slotEndTime: "23:59", slotDurationMinutes: 30, preBookingWindowDays: 30 }],
      [`digit58_expert_${ownerId}`]: [{ id: expertId, ownerId, storeId, name: "Ravi Expert", phone: "919876543210", active: true }],
    },
  });
  const assertNoErrors = monitorPageErrors(page);
  await page.goto("/digit58/");
  await page.getByRole("button", { name: /Services/ }).click();
  await page.getByRole("button", { name: "+ Add Service" }).click();
  await page.locator('#serviceForm input[name="name"]').fill("Doorstep AC Repair");
  await page.locator('#serviceForm input[name="price"]').fill("500");
  await page.locator('#serviceForm input[name="durationMinutes"]').fill("30");
  await page.locator('#serviceForm input[name="prepaymentPercent"]').fill("0");
  await page.getByRole("checkbox", { name: /Enable Doorstep Service/ }).check();
  await page.getByRole("button", { name: "Add Service", exact: true }).click();
  await expect(page.locator(".catalog-item-card", { hasText: "Doorstep AC Repair" })).toContainText("Doorstep Service enabled");

  const serviceId = await page.evaluate((kind) => window.__g58Mock.store[kind][0].id, `digit58_service_${ownerId}`);
  await page.evaluate(({ customerId, ownerId, storeId }) => {
    window.stopOwnerRealtime?.();
    window.__g58Mock.setUser({ $id: customerId, email: "doorstep-customer@example.com", name: "Doorstep Customer" });
    window.__g58Mock.store[`digit58_customer_${ownerId}`] = [{ id: "doorstep_link", ownerId, storeId, customerAccountId: customerId, customerName: "Doorstep Customer", customerEmail: "doorstep-customer@example.com", phone: "9876500000", agreementAcceptedAt: new Date().toISOString() }];
  }, { customerId, ownerId, storeId });
  await page.goto(`/digit58/#store&owner=${ownerId}&store=${storeId}`);
  await page.getByRole("button", { name: "+ Book a Service" }).click();
  await expect(page.locator("#doorstepLocationField")).toBeVisible();
  await page.locator("#bookingExpertSelect").selectOption(expertId);
  await page.getByRole("button", { name: /Share Service Location/ }).click();
  await expect(page.locator("#bookingLocationStatus")).toContainText("Location captured");
  await page.locator(".slot-btn.available").first().click();
  await page.getByRole("button", { name: "Request Booking" }).click();
  await expect(page.locator(".order-item-card", { hasText: "Doorstep AC Repair" })).toContainText("Doorstep Service");
  const booking = await page.evaluate((kind) => window.__g58Mock.store[kind][0], `digit58_booking_${ownerId}`);
  expect(booking).toMatchObject({ serviceId, expertId, expertPhone: "919876543210", doorstepServiceEnabled: true, locationLat: 17.4065, locationLng: 78.4772 });

  await page.evaluate((ownerId) => { window.stopCustomerRealtime?.(); window.__g58Mock.setUser({ $id: ownerId, email: "service-owner@example.com", name: "Service Owner" }); location.hash = ""; }, ownerId);
  await expect(page.getByRole("button", { name: /Bookings/ })).toBeVisible();
  await page.getByRole("button", { name: /Bookings/ }).click();
  await page.getByRole("button", { name: "All upcoming" }).click();
  const ownerCard = page.locator(".order-item-card", { hasText: "Doorstep AC Repair" });
  await expect(ownerCard).toContainText("View doorstep location");
  await page.evaluate(() => { window.__openedDoorstepShare = ""; window.open = (url) => { window.__openedDoorstepShare = String(url); return null; }; });
  await ownerCard.getByRole("button", { name: /Send to Ravi Expert/ }).click();
  const shareUrl = await page.evaluate(() => window.__openedDoorstepShare);
  expect(shareUrl).toContain("wa.me/919876543210");
  expect(decodeURIComponent(shareUrl)).toContain("https://www.google.com/maps?q=17.4065,78.4772");
  await assertNoErrors();
});

test("customer cancellation charge blocks only that store until the owner confirms payment", async ({ page }) => {
  const ownerId = "cancel_owner", customerId = "cancel_customer", storeId = "cancel_store", bookingId = "cancel_booking";
  const bookingKind = `digit58_booking_${ownerId}`, today = indiaDate(), tomorrow = indiaDate(new Date(Date.now() + 86400000));
  await prepareMockApi(page, {
    state: null,
    initialUser: { $id: customerId, email: "cancel-customer@example.com", name: "Cancel Customer" },
    seed: {
      digit58_entitlements: [{ id: "cancel_entitlement", ownerId, active: true, paused: false, lifetime: true, policyAcceptedAt: new Date().toISOString() }],
      [`digit58_store_${ownerId}`]: [{ id: storeId, ownerId, name: "Cancel Fee Services", businessType: "services", category: "Home services", city: "Hyderabad", upiId: "cancelstore@upi" }],
      [`digit58_customer_${ownerId}`]: [{ id: "cancel_customer_link", ownerId, storeId, customerAccountId: customerId, customerName: "Cancel Customer", customerEmail: "cancel-customer@example.com", phone: "9876543210", agreementAcceptedAt: new Date().toISOString() }],
      [`digit58_service_${ownerId}`]: [{ id: "cancel_service", ownerId, storeId, name: "Deep Cleaning", price: 800, prepaymentPercent: 0, cancellationChargeEnabled: true, cancellationChargeAmount: 150, active: true }],
      [bookingKind]: [{ id: bookingId, ownerId, storeId, serviceId: "cancel_service", serviceName: "Deep Cleaning", customerAccountId: customerId, customerName: "Cancel Customer", phone: "9876543210", date: tomorrow, startTime: "10:00", durationMinutes: 60, price: 800, cancellationChargeAmount: 150, cancellationChargeMode: "post-cancel", status: "Confirmed", messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
    },
  });
  const assertNoErrors = monitorPageErrors(page);
  await page.goto(`/digit58/#store&owner=${ownerId}&store=${storeId}`);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Cancel Booking" }).click();
  await expect(page.getByRole("heading", { name: "Cancellation payment required" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Payment Required" })).toBeDisabled();
  await expect(page.locator(".cancellation-payment-card")).toContainText("₹150");

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "I have paid — notify store" }).click();
  await expect(page.locator(".cancellation-payment-card")).toContainText("Payment sent for verification");
  await expect(page.getByRole("button", { name: "Payment Required" })).toBeDisabled();

  await page.evaluate((ownerId) => { window.stopCustomerRealtime?.(); window.__g58Mock.setUser({ $id: ownerId, email: "cancel-owner@example.com", name: "Cancel Owner" }); location.hash = ""; }, ownerId);
  await expect(page.getByRole("button", { name: /Booking History/ })).toBeVisible();
  await page.getByRole("button", { name: /Booking History/ }).click();
  await expect(page.locator("#bookingHistoryFrom")).toHaveValue(today);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Payment Received" }).click();
  await expect(page.locator("tbody")).toContainText("Paid");

  await page.evaluate(({ customerId, ownerId, storeId }) => { window.stopOwnerRealtime?.(); window.__g58Mock.setUser({ $id: customerId, email: "cancel-customer@example.com", name: "Cancel Customer" }); location.hash = `store&owner=${ownerId}&store=${storeId}`; }, { customerId, ownerId, storeId });
  await expect(page.getByRole("button", { name: "+ Book a Service" })).toBeEnabled();
  await assertNoErrors();
});

test("Refills customer gets one incoming order alert and continues with the card actions", async ({ page }) => {
  const ownerId = "slide_order_owner", customerId = "slide_order_customer", storeId = "slide_order_store", orderId = "slide_order";
  const orderKind = `digit58_order_${ownerId}`;
  await page.addInitScript(() => {
    const nativeSetInterval = window.setInterval.bind(window);
    window.__g58IntervalDelays = [];
    window.setInterval = (callback, delay, ...args) => {
      window.__g58IntervalDelays.push(Number(delay));
      return nativeSetInterval(callback, delay, ...args);
    };
  });
  await prepareMockApi(page, {
    state: null,
    initialUser: { $id: customerId, email: "slide-order@example.com", name: "Slide Customer" },
    seed: {
      [`digit58_store_${ownerId}`]: [{ id: storeId, ownerId, name: "Slide Refills", category: "General store", city: "Hyderabad" }],
      [`digit58_customer_${ownerId}`]: [{ id: "slide_order_link", ownerId, storeId, customerAccountId: customerId, customerName: "Slide Customer", customerEmail: "slide-order@example.com", phone: "9876543210", agreementAcceptedAt: new Date().toISOString() }],
      [orderKind]: [{ id: orderId, ownerId, storeId, customerAccountId: customerId, customerName: "Slide Customer", phone: "9876543210", items: [{ name: "Monthly essentials", qty: 1 }], amount: 0, status: "Pending Customer Acceptance", messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
    },
  });
  const assertNoErrors = monitorPageErrors(page);
  await page.goto(`/digit58/#store&owner=${ownerId}&store=${storeId}`);
  await expect(page.getByRole("heading", { name: "Incoming order!" })).toBeVisible();
  await expect(page.locator(".slide-to-view-label")).toHaveText("Slide to open order");
  expect(await page.evaluate(() => window.__g58IntervalDelays.filter((delay) => delay === 1900).length)).toBe(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), `g58-customer-incoming-alert:${customerId}:order:${orderId}`)).toBe("1");
  await slideCustomerAlertOpen(page);
  const card = page.locator(`#customer-order-${orderId}`);
  await expect(card).toHaveClass(/slide-open-highlight/);
  await expect(card.getByRole("button", { name: "Accept Order" })).toBeVisible();
  await expect(card.getByRole("button", { name: "Reject" })).toBeVisible();
  await card.getByRole("button", { name: "Accept Order" }).click();
  await expect(card).toContainText("Requested");
  await expect(page.locator(".incoming-call-overlay")).toHaveCount(0);
  await page.evaluate(({ kind, id }) => {
    const order = window.__g58Mock.store[kind].find((row) => row.id === id);
    Object.assign(order, { status: "Accepted", acceptedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    window.dispatchEvent(new CustomEvent("g58-ad-data-changed", { detail: { kind, row: order } }));
  }, { kind: orderKind, id: orderId });
  await expect(card).toContainText("The store has accepted your order");
  await expect(page.locator(".incoming-call-overlay")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".incoming-call-overlay")).toHaveCount(0);
  await assertNoErrors();
});

test("Refills customer gets one incoming booking alert and sees booking status icons", async ({ page }) => {
  const ownerId = "slide_booking_owner", customerId = "slide_booking_customer", storeId = "slide_booking_store", bookingId = "slide_booking";
  const bookingKind = `digit58_booking_${ownerId}`, tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  await prepareMockApi(page, {
    state: null,
    initialUser: { $id: customerId, email: "slide-booking@example.com", name: "Booking Customer" },
    seed: {
      [`digit58_store_${ownerId}`]: [{ id: storeId, ownerId, name: "Slide Services", businessType: "services", category: "Home services", city: "Hyderabad" }],
      [`digit58_customer_${ownerId}`]: [{ id: "slide_booking_link", ownerId, storeId, customerAccountId: customerId, customerName: "Booking Customer", customerEmail: "slide-booking@example.com", phone: "9876543210", agreementAcceptedAt: new Date().toISOString() }],
      [bookingKind]: [{ id: bookingId, ownerId, storeId, serviceId: "service_one", serviceName: "Home cleaning", customerAccountId: customerId, customerName: "Booking Customer", phone: "9876543210", date: tomorrow, startTime: "10:00", durationMinutes: 60, price: 500, upfrontAmount: 100, status: "Pending Customer Acceptance", messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
    },
  });
  const assertNoErrors = monitorPageErrors(page);
  await page.goto(`/digit58/#store&owner=${ownerId}&store=${storeId}`);
  await expect(page.getByRole("heading", { name: "Incoming booking!" })).toBeVisible();
  await expect(page.locator(".slide-to-view-label")).toHaveText("Slide to open booking");
  expect(await page.evaluate((key) => localStorage.getItem(key), `g58-customer-incoming-alert:${customerId}:booking:${bookingId}`)).toBe("1");
  await slideCustomerAlertOpen(page);
  const card = page.locator(`#customer-booking-${bookingId}`);
  await expect(card).toHaveClass(/slide-open-highlight/);
  await expect(card.getByRole("button", { name: "Accept Booking" })).toBeVisible();
  await expect(card.getByRole("button", { name: "Reject" })).toBeVisible();
  await expect(card.locator(".booking-stepper .order-step-icon")).toHaveCount(1);
  await card.getByRole("button", { name: "Accept Booking" }).click();
  await expect(card).toContainText("Payment");
  await expect(card.locator(".booking-stepper .order-step-icon")).toHaveCount(4);
  await expect(page.locator(".incoming-call-overlay")).toHaveCount(0);
  await page.evaluate(({ kind, id }) => {
    const booking = window.__g58Mock.store[kind].find((row) => row.id === id);
    Object.assign(booking, { status: "Confirmed", confirmedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    window.dispatchEvent(new CustomEvent("g58-ad-data-changed", { detail: { kind, row: booking } }));
  }, { kind: bookingKind, id: bookingId });
  await expect(card).toContainText("Your service slot is confirmed");
  await expect(page.locator(".incoming-call-overlay")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".incoming-call-overlay")).toHaveCount(0);
  await assertNoErrors();
});

test("one Refills customer portal switches between every linked store and keeps chat Send visible", async ({ page }) => {
  const customerId = "shared_customer", firstOwner = "owner_a", secondOwner = "owner_b", firstStore = "amruth", secondStore = "test2";
  await page.setViewportSize({ width: 390, height: 844 });
  await prepareMockApi(page, {
    state: null,
    initialUser: { $id: customerId, email: "shared@example.com", name: "Shared Customer" },
    seed: {
      [`digit58_store_${firstOwner}`]: [{ id: firstStore, ownerId: firstOwner, name: "Amruth Medicals", category: "Medical store", city: "Hyderabad", minimumOrderEnabled: true, minimumOrderValue: 500 }],
      [`digit58_store_${secondOwner}`]: [{ id: secondStore, ownerId: secondOwner, name: "test2", category: "General store", city: "Hyderabad" }],
      [`digit58_customer_${firstOwner}`]: [{ id: "customer_a", ownerId: firstOwner, storeId: firstStore, customerAccountId: customerId, customerName: "Shared Customer", customerEmail: "shared@example.com", phone: "9876543210" }],
      [`digit58_customer_${secondOwner}`]: [{ id: "customer_b", ownerId: secondOwner, storeId: secondStore, customerAccountId: customerId, customerName: "Shared Customer", customerEmail: "shared@example.com", phone: "9876543210" }],
      [`digit58_order_${firstOwner}`]: [{ id: "refill_chat_order", ownerId: firstOwner, storeId: firstStore, customerAccountId: customerId, customerName: "Shared Customer", phone: "9876543210", items: [{ name: "Monthly tablets", qty: 1 }], amount: 0, status: "Requested", messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
      [`digit58_card_${firstOwner}`]: [{ id: "anytime_card", ownerId: firstOwner, storeId: firstStore, customerAccountId: customerId, productName: "Vitamin tablets", price: 99, reminderDays: 30, dueAt: new Date(Date.now() + 20 * 86400000).toISOString(), status: "Active" }],
    },
  });
  const assertNoErrors = monitorPageErrors(page);
  await page.goto(`/digit58/#store&owner=${firstOwner}&store=${firstStore}`);
  await expect(page.locator("#customerStoreSwitch option")).toHaveCount(2);
  await expect(page.locator(".customer-store-hub")).toContainText("2 linked stores");
  const chatForm = page.locator('[data-order-chat="refill_chat_order"]');
  await expect(chatForm.getByRole("button", { name: "Send" })).toBeVisible();
  const sendBox = await chatForm.getByRole("button", { name: "Send" }).boundingBox();
  expect(sendBox.x + sendBox.width).toBeLessThanOrEqual(390);
  await chatForm.locator('input[name="message"]').fill("Please confirm availability");
  await chatForm.getByRole("button", { name: "Send" }).click();
  await expect(page.locator(".order-item-card", { hasText: "Monthly tablets" }).locator(".order-chat-log")).toContainText("Please confirm availability");

  const reminder = page.locator("#customerCardGrid .reminder-card");
  await expect(reminder).toContainText("20 day(s) left");
  await reminder.getByRole("button", { name: "Refill" }).click();
  await page.getByRole("button", { name: "Send Refill Request" }).click();
  await expect(page.locator("#toast")).toContainText("Refill order sent");

  await page.locator("#customerStoreSwitch").selectOption(`${secondOwner}:${secondStore}`);
  await expect(page.locator(".store-hero")).toContainText("test2");
  await expect(page).toHaveURL(new RegExp(`owner=${secondOwner}&store=${secondStore}`));

  await expect(page.locator(".floating-support-btn")).toHaveCount(0);
  await assertNoErrors();
});

test("Refills minimum criteria supports customer approval, owner rejection reasons and an owner off switch", async ({ page }) => {
  const ownerId = "minimum_owner", storeId = "minimum_store", customerId = "minimum_customer", orderKind = `digit58_order_${ownerId}`;
  const owner = { $id: ownerId, email: "minimum-owner@example.com", name: "Minimum Store Owner" };
  const customer = { $id: customerId, email: "minimum-customer@example.com", name: "Minimum Customer" };
  await prepareMockApi(page, {
    state: null,
    initialUser: owner,
    seed: {
      digit58_entitlements: [{ id: "minimum_entitlement", ownerId, active: true, paused: false, lifetime: true, policyAcceptedAt: new Date().toISOString() }],
      [`digit58_store_${ownerId}`]: [{ id: storeId, ownerId, name: "Minimum Medicals", category: "Medical store", city: "Hyderabad", phone: "9876543210", minimumOrderEnabled: true, minimumOrderValue: 500 }],
      [`digit58_customer_${ownerId}`]: [{ id: "minimum_link", ownerId, storeId, customerAccountId: customerId, customerName: customer.name, customerEmail: customer.email, phone: "9876543210" }],
      [orderKind]: [],
    },
  });
  const assertNoErrors = monitorPageErrors(page);
  await page.goto("/digit58/");
  await page.getByRole("button", { name: /My Stores/ }).click();
  await page.getByRole("button", { name: "Edit" }).click();
  await expect(page.locator("#minimumOrderEnabled")).toBeChecked();
  await page.locator('#storeForm input[name="minimumOrderValue"]').fill("600");
  await page.getByRole("button", { name: "Save Store" }).click();
  await page.getByRole("button", { name: /Logout/ }).click();
  await expect(page.locator("#ownerAuthForm")).toBeVisible();

  await page.evaluate((nextUser) => window.__g58Mock.setUser(nextUser), customer);
  await page.evaluate(({ ownerId: nextOwnerId, storeId: nextStoreId }) => {
    location.hash = `store&owner=${encodeURIComponent(nextOwnerId)}&store=${encodeURIComponent(nextStoreId)}`;
  }, { ownerId, storeId });
  await expect(page.locator(".store-minimum-order")).toContainText("₹600");
  await page.getByRole("button", { name: "+ Place New Order" }).click();
  await page.locator('#placeOrderForm input[name="itemName[]"]').fill("Monthly health products");
  await page.locator("#customerOrderValue").fill("300");
  await page.locator('#placeOrderForm input[name="phone"]').fill("9876543210");
  await page.getByRole("button", { name: "Submit Order", exact: true }).click();
  await expect(page.locator("#toast")).toContainText("Minimum new order value is ₹600");
  await page.getByRole("button", { name: "Request Owner Approval" }).click();
  await expect(page.locator("#toast")).toContainText("approval requested");
  let orders = await page.evaluate((kind) => window.__g58Mock.store[kind], orderKind);
  expect(orders).toHaveLength(1);
  expect(orders[0]).toMatchObject({ status: "Minimum Approval Requested", customerOrderValue: 300, minimumOrderValueAtOrder: 600 });

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.locator("#customerAuthForm")).toBeVisible();
  await page.evaluate((nextUser) => window.__g58Mock.setUser(nextUser), owner);
  await page.evaluate(() => { location.hash = ""; });
  orders = await page.evaluate((kind) => window.__g58Mock.store[kind] || [], orderKind);
  expect(orders, "the approval request must remain in the shared mock cloud after switching accounts").toHaveLength(1);
  await page.getByRole("button", { name: /Orders/ }).click();
  const approvalCard = page.locator(".order-item-card", { hasText: "Below-minimum approval requested" });
  await expect(approvalCard).toContainText("Customer estimate ₹300");
  await approvalCard.getByRole("button", { name: "Approve Below-Minimum Order" }).click();
  await expect(page.locator("#toast")).toContainText("Below-minimum order approved");
  orders = await page.evaluate((kind) => window.__g58Mock.store[kind], orderKind);
  expect(orders[0]).toMatchObject({ status: "Requested", minimumApprovalStatus: "Approved" });

  const approvedCard = page.locator(".order-item-card", { hasText: "Monthly health products" });
  await approvedCard.getByRole("button", { name: "Reject" }).click();
  await page.locator('#rejectOrderForm textarea[name="rejectionReason"]').fill("Requested product is unavailable today.");
  await page.getByRole("button", { name: "Reject Order" }).click();
  orders = await page.evaluate((kind) => window.__g58Mock.store[kind], orderKind);
  expect(orders[0]).toMatchObject({ status: "Rejected", rejectionReason: "Requested product is unavailable today." });

  await page.getByRole("button", { name: /My Stores/ }).click();
  await page.getByRole("button", { name: "Edit" }).click();
  await page.locator("#minimumOrderEnabled").uncheck();
  await page.getByRole("button", { name: "Save Store" }).click();
  await page.getByRole("button", { name: /Logout/ }).click();
  await expect(page.locator("#ownerAuthForm")).toBeVisible();

  await page.evaluate((nextUser) => window.__g58Mock.setUser(nextUser), customer);
  await page.evaluate(({ ownerId: nextOwnerId, storeId: nextStoreId }) => {
    location.hash = `store&owner=${encodeURIComponent(nextOwnerId)}&store=${encodeURIComponent(nextStoreId)}`;
  }, { ownerId, storeId });
  await expect(page.getByRole("heading", { name: "Order Rejected" })).toBeVisible();
  await expect(page.locator(".rejection-reason")).toContainText("Requested product is unavailable today.");
  await expect(page.getByRole("button", { name: "View Order History" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Call Minimum Medicals" })).toHaveAttribute("href", "tel:9876543210");
  await page.getByRole("button", { name: "Revise & Resubmit" }).click();
  await expect(page.getByRole("heading", { name: "Revise Rejected Order" })).toBeVisible();
  await expect(page.locator('#placeOrderForm input[name="itemName[]"]')).toHaveValue("Monthly health products");
  await expect(page.locator(".rejection-history-reason")).toContainText("Requested product is unavailable today.");
  await expect(page.locator(".store-minimum-order")).toHaveCount(0);

  await expect(page.locator("#customerOrderValue")).toHaveCount(0);
  await page.locator('#placeOrderForm input[name="itemName[]"]').fill("Small urgent replacement");
  await page.locator('#placeOrderForm input[name="phone"]').fill("9876543210");
  await page.getByRole("button", { name: "Resubmit Order", exact: true }).click();
  await expect(page.locator("#toast")).toContainText("Order sent to the store");
  orders = await page.evaluate((kind) => window.__g58Mock.store[kind], orderKind);
  expect(orders[0]).toMatchObject({ status: "Requested", customerOrderValue: 0 });
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
      [orderKind]: [{ id: "reorder_1", ownerId, storeId, customerAccountId: "refill_customer", customerName: "Refill Customer", phone: "9888888888", items: [{ name: "Monthly medicine", qty: 2 }], amount: 0, previousAmount: 480, upiUri: "", reorderedFrom: "history_order", status: "Requested", messages: [], createdAt: "2026-08-15T08:00:00.000Z", updatedAt: "2026-08-15T08:00:00.000Z" }],
    },
  });
  const assertNoErrors = monitorPageErrors(page);
  await page.goto("/digit58/");
  await page.getByRole("button", { name: /Orders/ }).click();
  await expect(page.locator(".order-item-card")).toContainText("Monthly medicine");
  await expect(page.locator(".order-item-card")).toContainText("Previous order amount");
  await expect(page.locator(".order-item-card")).toContainText("₹480");
  await page.getByRole("button", { name: "Set Amount" }).click();
  await expect(page.locator("#amountInput")).toHaveValue("480");
  await page.locator("#amountInput").fill("525");
  await page.locator("#upiIdInput").fill("health@upi");
  await expect(page.locator("#amountQrPreview [data-testid='qr-rendered']")).toBeVisible();
  await page.locator("#setAmountForm").getByRole("button", { name: "Approve Amount & Send Payment" }).click();
  await expect(page.locator(".order-item-card")).toContainText("Priced");
  const order = await page.evaluate((kind) => window.__g58Mock.store[kind][0], orderKind);
  expect(order.status).toBe("Priced");
  expect(order.amount).toBe(525);
  expect(order.upiUri).toContain("pa=health%40upi");
  expect(order.upiUri).toContain("am=525.00");
  await assertNoErrors();
});

test("Refills becomes available when the reminder period ends and creates a regular owner order", async ({ page }) => {
  const ownerId = "cycle_owner", customerId = "cycle_customer", storeId = "cycle_store", cardId = "cycle_card";
  const cardKind = `digit58_card_${ownerId}`, orderKind = `digit58_order_${ownerId}`;
  await prepareMockApi(page, {
    state: null,
    initialUser: { $id: customerId, email: "customer@example.com", name: "Refill Customer" },
    seed: {
      [`digit58_store_${ownerId}`]: [{ id: storeId, ownerId, name: "Cycle Pharmacy", category: "Pharmacy", city: "Hyderabad", upiId: "cycle@upi" }],
      [`digit58_customer_${ownerId}`]: [{ id: "cycle_customer_link", ownerId, storeId, customerAccountId: customerId, customerName: "Refill Customer", customerEmail: "customer@example.com", phone: "9876543210" }],
      [cardKind]: [{ id: cardId, ownerId, storeId, customerAccountId: customerId, productName: "Thyroid medicine", price: 199, reminderDays: 30, phone: "9876543210", status: "Active", timesDelivered: 1, purchasedAt: new Date(Date.now() - 31 * 86400000).toISOString() }],
      [orderKind]: [],
    },
  });
  const assertNoErrors = monitorPageErrors(page);
  await page.goto(`/digit58/#store&owner=${ownerId}&store=${storeId}`);
  const reminder = page.locator("#customerCardGrid .reminder-card");
  await expect(reminder).toContainText("Due now");
  await reminder.getByRole("button", { name: "Refill" }).click();
  await page.locator('#buyAgainForm input[name="phone"]').fill("9888888888");
  await page.getByRole("button", { name: "Send Refill Request" }).click();
  await expect(page.locator("#toast")).toContainText("store can now review and process it");
  await expect(page.locator(".order-item-card")).toContainText("Thyroid medicine");
  await expect(page.locator(".order-item-card")).toContainText("Waiting for the store to review and set the amount");
  await expect(reminder).toContainText("Refill order sent");
  await expect(reminder.getByRole("button", { name: "Refill" })).toBeDisabled();
  const result = await page.evaluate(({ orderKind, cardKind, cardId }) => ({
    orders: window.__g58Mock.store[orderKind],
    card: window.__g58Mock.store[cardKind].find((row) => row.id === cardId),
  }), { orderKind, cardKind, cardId });
  expect(result.orders).toHaveLength(1);
  expect(result.orders[0]).toMatchObject({ status: "Requested", refillCardId: cardId, previousAmount: 199, phone: "9888888888", items: [{ name: "Thyroid medicine", qty: 1 }] });
  expect(result.card).toMatchObject({ status: "Refill Requested", activeOrderId: result.orders[0].id });
  await assertNoErrors();
});

test("Refills reminder cards default to swipe view and can switch temporarily to a list", async ({ page }) => {
  const ownerId = "view_owner", customerId = "view_customer", storeId = "view_store", cardKind = `digit58_card_${ownerId}`;
  const purchasedAt = new Date().toISOString();
  await prepareMockApi(page, {
    state: null,
    initialUser: { $id: customerId, email: "customer@example.com", name: "View Customer" },
    seed: {
      [`digit58_store_${ownerId}`]: [{ id: storeId, ownerId, name: "Swipe Pharmacy", category: "Pharmacy", city: "Hyderabad" }],
      [`digit58_customer_${ownerId}`]: [{ id: "view_customer_link", ownerId, storeId, customerAccountId: customerId, customerName: "View Customer", customerEmail: "customer@example.com", phone: "9876543210" }],
      [cardKind]: [
        { id: "view_card_1", ownerId, storeId, customerAccountId: customerId, productName: "Vitamin tablets", price: 99, reminderDays: 30, purchasedAt, status: "Active" },
        { id: "view_card_2", ownerId, storeId, customerAccountId: customerId, productName: "Protein powder", price: 499, reminderDays: 20, purchasedAt, status: "Active" },
        { id: "view_card_3", ownerId, storeId, customerAccountId: customerId, productName: "Health drink", price: 149, reminderDays: 15, purchasedAt, status: "Active" },
      ],
    },
  });
  const assertNoErrors = monitorPageErrors(page);
  await page.goto(`/digit58/#store&owner=${ownerId}&store=${storeId}`);
  const grid = page.locator("#customerCardGrid"), cards = grid.locator(".reminder-card");
  await expect(grid).toHaveClass(/reminder-view-swipe/);
  await expect(page.getByRole("button", { name: "Swipe", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(cards).toHaveCount(3);
  await expect(cards.getByRole("button", { name: "Refill" })).toHaveCount(3);
  for (const button of await cards.getByRole("button", { name: "Refill" }).all()) await expect(button).toBeEnabled();
  const swipeGeometry = await page.evaluate(() => {
    const grid = document.querySelector("#customerCardGrid"), items = [...grid.querySelectorAll(".reminder-card")];
    const rail = grid.getBoundingClientRect(), first = items[0].getBoundingClientRect(), second = items[1].getBoundingClientRect();
    return { railRight: rail.right, firstWidth: first.width, railWidth: rail.width, secondLeft: second.left, secondRight: second.right };
  });
  expect(swipeGeometry.firstWidth).toBeLessThan(swipeGeometry.railWidth);
  expect(swipeGeometry.secondLeft).toBeLessThan(swipeGeometry.railRight);
  expect(swipeGeometry.secondRight).toBeGreaterThan(swipeGeometry.railRight);

  await page.getByRole("button", { name: "List", exact: true }).click();
  await expect(grid).toHaveClass(/reminder-view-list/);
  await expect(page.getByRole("button", { name: "List", exact: true })).toHaveAttribute("aria-pressed", "true");
  const listGeometry = await page.evaluate(() => [...document.querySelectorAll("#customerCardGrid .reminder-card")].map((card) => ({ x: card.getBoundingClientRect().x, y: card.getBoundingClientRect().y })));
  expect(listGeometry[1].y).toBeGreaterThan(listGeometry[0].y);
  expect(Math.abs(listGeometry[1].x - listGeometry[0].x)).toBeLessThan(2);

  await page.reload();
  await expect(page.locator("#customerCardGrid")).toHaveClass(/reminder-view-swipe/);
  await expect(page.getByRole("button", { name: "Swipe", exact: true })).toHaveAttribute("aria-pressed", "true");
  await assertNoErrors();
});

test("Refills delivery completion resets the reminder for its next cycle", async ({ page }) => {
  const ownerId = "reset_owner", customerId = "reset_customer", storeId = "reset_store", cardId = "reset_card", orderId = "reset_order";
  const cardKind = `digit58_card_${ownerId}`, orderKind = `digit58_order_${ownerId}`;
  await prepareMockApi(page, {
    state: null,
    initialUser: { $id: ownerId, email: "owner@example.com", name: "Store Owner" },
    seed: {
      digit58_entitlements: [{ id: "reset_entitlement", ownerId, active: true, paused: false, lifetime: true, policyAcceptedAt: new Date().toISOString() }],
      [`digit58_store_${ownerId}`]: [{ id: storeId, ownerId, name: "Cycle Pharmacy", category: "Pharmacy", city: "Hyderabad", upiId: "cycle@upi" }],
      [`digit58_customer_${ownerId}`]: [{ id: "reset_customer_link", ownerId, storeId, customerAccountId: customerId, customerName: "Refill Customer", phone: "9876543210" }],
      [cardKind]: [{ id: cardId, ownerId, storeId, customerAccountId: customerId, productName: "Thyroid medicine", price: 199, reminderDays: 30, status: "Refill Requested", timesDelivered: 1, dueAt: new Date(Date.now() - 86400000).toISOString(), activeOrderId: orderId }],
      [orderKind]: [{ id: orderId, ownerId, storeId, customerAccountId: customerId, customerName: "Refill Customer", phone: "9876543210", items: [{ name: "Thyroid medicine", qty: 1 }], amount: 210, previousAmount: 199, refillCardId: cardId, status: "Out for Delivery", messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
    },
  });
  const assertNoErrors = monitorPageErrors(page);
  await page.goto("/digit58/");
  await page.getByRole("button", { name: /Orders/ }).click();
  await expect(page.locator(".order-item-card")).toContainText("Refill order");
  await page.getByRole("button", { name: "Mark Delivered" }).click();
  await expect(page.locator("#toast")).toContainText("Order delivered");
  const result = await page.evaluate(({ orderKind, cardKind, orderId, cardId }) => ({
    order: window.__g58Mock.store[orderKind].find((row) => row.id === orderId),
    card: window.__g58Mock.store[cardKind].find((row) => row.id === cardId),
  }), { orderKind, cardKind, orderId, cardId });
  expect(result.order.status).toBe("Delivered");
  expect(result.card.status).toBe("Active");
  expect(result.card.activeOrderId).toBe("");
  expect(result.card.timesDelivered).toBe(2);
  expect(new Date(result.card.dueAt).getTime()).toBeGreaterThan(Date.now() + 29 * 86400000);
  await assertNoErrors();
});

test("Refills customer history defaults to today, filters a date range and exports CSV", async ({ page }) => {
  const ownerId = "history_owner", customerId = "history_customer", storeId = "history_store";
  const today = new Date(), older = new Date(Date.now() - 3 * 86400000), todayValue = indiaDate(today), olderValue = indiaDate(older);
  await prepareMockApi(page, {
    state: null,
    initialUser: { $id: customerId, email: "customer@example.com", name: "Refill Customer" },
    seed: {
      [`digit58_store_${ownerId}`]: [{ id: storeId, ownerId, name: "History Refills", category: "Pharmacy", city: "Hyderabad" }],
      [`digit58_customer_${ownerId}`]: [{ id: "customer_link", ownerId, storeId, customerAccountId: customerId, customerName: "Refill Customer", phone: "9876543210" }],
      [`digit58_order_${ownerId}`]: [
        { id: "today_order", ownerId, storeId, customerAccountId: customerId, items: [{ name: "Today's tablets", qty: 1 }], amount: 120, status: "Delivered", createdAt: today.toISOString(), updatedAt: today.toISOString() },
        { id: "older_order", ownerId, storeId, customerAccountId: customerId, items: [{ name: "Older refill", qty: 2 }], amount: 240, status: "Delivered", createdAt: older.toISOString(), updatedAt: older.toISOString() },
      ],
    },
  });
  const assertNoErrors = monitorPageErrors(page);
  await page.goto(`/digit58/#store&owner=${ownerId}&store=${storeId}`);
  await expect(page.locator("#customerHistoryFrom")).toHaveValue(todayValue);
  await expect(page.locator("#customerHistoryTo")).toHaveValue(todayValue);
  await expect(page.locator(".table-wrap thead th").nth(1)).toHaveText("Reorder");
  const reorderCell = page.locator(".table-wrap tbody tr").first().locator("td").nth(1);
  await expect(reorderCell.getByRole("button", { name: "Reorder" })).toBeVisible();
  await expect(reorderCell.getByRole("button", { name: "Reorder" })).toHaveClass(/reorder-btn/);
  await expect(page.locator(".table-wrap")).toContainText("Today's tablets");
  await expect(page.locator(".table-wrap")).not.toContainText("Older refill");
  await page.locator("#customerHistoryFrom").fill(olderValue);
  await page.locator("#customerHistoryFrom").press("Tab");
  await page.locator("#customerHistoryTo").fill(olderValue);
  await page.locator("#customerHistoryTo").press("Tab");
  await expect(page.locator(".table-wrap")).toContainText("Older refill");
  await expect(page.locator(".table-wrap")).not.toContainText("Today's tablets");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export CSV" }).click()]);
  expect(download.suggestedFilename()).toMatch(/^history-refills-my-orders-\d{4}-\d{2}-\d{2}\.csv$/);
  await assertNoErrors();
});

test("Refills owner history defaults to today, filters a date range and exports CSV", async ({ page }) => {
  const ownerId = "owner_history", customerId = "owner_history_customer", storeId = "owner_history_store";
  const today = new Date(), older = new Date(Date.now() - 4 * 86400000), todayValue = indiaDate(today), olderValue = indiaDate(older);
  await prepareMockApi(page, {
    state: null,
    initialUser: { $id: ownerId, email: "owner@example.com", name: "Store Owner" },
    seed: {
      digit58_entitlements: [{ id: "entitlement_history", ownerId, active: true, paused: false, lifetime: true, policyAcceptedAt: today.toISOString() }],
      [`digit58_store_${ownerId}`]: [{ id: storeId, ownerId, name: "Owner History", category: "General", city: "Hyderabad" }],
      [`digit58_customer_${ownerId}`]: [{ id: "customer_link", ownerId, storeId, customerAccountId: customerId, customerName: "History Customer", phone: "9876543210" }],
      [`digit58_order_${ownerId}`]: [
        { id: "today_owner_order", ownerId, storeId, customerAccountId: customerId, customerName: "History Customer", phone: "9876543210", items: [{ name: "Today's owner item", qty: 1 }], amount: 150, status: "Delivered", deliveredAt: today.toISOString(), createdAt: today.toISOString(), updatedAt: today.toISOString() },
        { id: "older_owner_order", ownerId, storeId, customerAccountId: customerId, customerName: "History Customer", phone: "9876543210", items: [{ name: "Older owner item", qty: 3 }], amount: 450, status: "Rejected", rejectedAt: older.toISOString(), createdAt: older.toISOString(), updatedAt: older.toISOString() },
      ],
    },
  });
  const assertNoErrors = monitorPageErrors(page);
  await page.goto("/digit58/");
  await page.getByRole("button", { name: /Order History/ }).click();
  await expect(page.locator("#historyFrom")).toHaveValue(todayValue);
  await expect(page.locator("#historyTo")).toHaveValue(todayValue);
  await expect(page.locator(".table-wrap")).toContainText("Today's owner item");
  await expect(page.locator(".table-wrap")).not.toContainText("Older owner item");
  await page.locator("#historyFrom").fill(olderValue);
  await page.locator("#historyFrom").press("Tab");
  await page.locator("#historyTo").fill(olderValue);
  await page.locator("#historyTo").press("Tab");
  await expect(page.locator(".table-wrap")).toContainText("Older owner item");
  await expect(page.locator(".table-wrap")).not.toContainText("Today's owner item");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export CSV" }).click()]);
  expect(download.suggestedFilename()).toMatch(/^owner-history-orders-\d{4}-\d{2}-\d{2}\.csv$/);
  await assertNoErrors();
});

test("Refills owner publishes a promotion and enables the optional Razorpay store link", async ({ page }) => {
  const ownerId = "promo_owner";
  const storeId = "promo_store";
  await prepareMockApi(page, {
    state: null,
    initialUser: { $id: ownerId, email: "owner@example.com", name: "Store Owner" },
    seed: {
      digit58_entitlements: [{ id: "entitlement_1", ownerId, active: true, paused: false, lifetime: true, policyAcceptedAt: "2026-08-01T08:00:00.000Z" }],
      [`digit58_store_${ownerId}`]: [{ id: storeId, ownerId, name: "Nature Refills", category: "Organic Store", city: "Hyderabad", upiId: "nature@upi" }],
      [`digit58_order_${ownerId}`]: [{ id: "paid_order", ownerId, storeId, customerAccountId: "customer_1", customerName: "Refill Customer", items: [{ name: "Organic Honey", qty: 1 }], amount: 525, upiUri: "upi://pay?pa=nature%40upi&am=525", status: "Priced", paymentMethod: "Razorpay link", paymentStatus: "Awaiting store verification", paymentMarkedAt: "2026-08-15T09:00:00.000Z", createdAt: "2026-08-15T08:00:00.000Z", updatedAt: "2026-08-15T09:00:00.000Z" }],
      [`digit58_promo_${ownerId}`]: [{ id: "expired_promo", ownerId, storeId, name: "Expired Offer", offerText: "Must be deleted", price: 55, endsOn: "2000-01-01", active: true }],
    },
  });
  const assertNoErrors = monitorPageErrors(page);
  await page.goto("/digit58/");
  expect(await page.evaluate((kind) => window.__g58Mock.store[kind].some((row) => row.id === "expired_promo"), `digit58_promo_${ownerId}`)).toBe(false);
  await page.getByRole("button", { name: /My Stores/ }).click();
  await page.getByRole("button", { name: "Edit" }).click();
  await page.locator("#razorpayEnabled").check();
  await page.locator('#storeForm input[name="razorpayLink"]').fill("razorpay.me/@naturerefills");
  await expect(page.locator(".razorpay-link-note")).toContainText("Razorpay.me has no return-URL setting");
  await expect(page.locator("#razorpayReturnUrl")).toHaveCount(0);
  await page.getByRole("button", { name: "Save Store" }).click();
  const updatedStore = await page.evaluate((kind) => window.__g58Mock.store[kind][0], `digit58_store_${ownerId}`);
  expect(updatedStore).toMatchObject({ razorpayEnabled: true, razorpayLink: "https://razorpay.me/@naturerefills" });

  await page.getByRole("button", { name: /Promotions/ }).click();
  await page.getByRole("button", { name: "+ New Promotion" }).click();
  await page.locator('#promotionForm input[name="name"]').fill("Organic Honey");
  await page.locator('#promotionForm input[name="offerText"]').fill("Pure 500g jar · limited stock");
  await page.locator('#promotionForm input[name="price"]').fill("299");
  await page.locator('#promotionForm input[name="endsOn"]').fill("2026-08-30");
  await page.getByRole("button", { name: "Publish Promotion" }).click();
  await expect(page.locator(".promotion-owner-grid")).toContainText("Organic Honey");
  await expect(page.locator(".promotion-owner-grid")).toContainText("₹299/- only");
  const promotions = await page.evaluate((kind) => window.__g58Mock.store[kind], `digit58_promo_${ownerId}`);
  expect(promotions).toHaveLength(1);
  expect(promotions[0]).toMatchObject({ storeId, name: "Organic Honey", price: 299, endsOn: "2026-08-30", badge: "Special Offer", active: true });

  await page.getByRole("button", { name: "🧾 Orders", exact: true }).click();
  await expect(page.getByText("Razorpay payment submitted")).toBeVisible();
  await expect(page.getByRole("button", { name: "Payment Received — Accept" })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Payment Not Received" }).click();
  const reopenedOrder = await page.evaluate((kind) => window.__g58Mock.store[kind].find((row) => row.id === "paid_order"), `digit58_order_${ownerId}`);
  expect(reopenedOrder).toMatchObject({ status: "Priced", paymentStatus: "Payment required", paymentMarkedAt: "" });
  await assertNoErrors();
});

test("Refills customer confirms a reusable Razorpay.me payment and adds promotion tickets", async ({ page }) => {
  const ownerId = "promo_owner";
  const customerId = "promo_customer";
  const storeId = "promo_store";
  const orderKind = `digit58_order_${ownerId}`;
  await prepareMockApi(page, {
    state: null,
    initialUser: { $id: customerId, email: "customer@example.com", name: "Refill Customer" },
    seed: {
      [`digit58_store_${ownerId}`]: [{ id: storeId, ownerId, name: "Nature Refills", category: "Organic Store", city: "Hyderabad", upiId: "nature@upi", razorpayEnabled: true, razorpayLink: "https://razorpay.me/@naturerefills" }],
      [`digit58_customer_${ownerId}`]: [{ id: "customer_link", ownerId, storeId, customerAccountId: customerId, customerName: "Refill Customer", customerEmail: "customer@example.com", phone: "9876543210", agreementAcceptedAt: "2026-08-01T08:00:00.000Z" }],
      [`digit58_promo_${ownerId}`]: [{ id: "promo_honey", ownerId, storeId, name: "Organic Honey", offerText: "Pure 500g jar · limited stock", price: 299, endsOn: "2026-08-30", badge: "Weekend Special", imageUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='500'%3E%3Crect width='400' height='500' fill='%23f59e0b'/%3E%3Ctext x='200' y='250' text-anchor='middle' font-size='42'%3EOrganic Honey%3C/text%3E%3C/svg%3E", active: true }],
      [orderKind]: [{ id: "priced_order", ownerId, storeId, customerAccountId: customerId, customerName: "Refill Customer", phone: "9876543210", items: [{ name: "Monthly medicine", qty: 1 }], amount: 525, upiUri: "upi://pay?pa=nature%40upi&am=525", status: "Priced", messages: [], createdAt: "2026-08-15T08:00:00.000Z", updatedAt: "2026-08-15T08:00:00.000Z" }],
    },
  });
  const assertNoErrors = monitorPageErrors(page);
  await page.goto(`/digit58/#store&owner=${ownerId}&store=${storeId}`);
  const promotionStrip = page.locator(".promotion-strip");
  const promotionTicket = promotionStrip.locator('.customer-ticket[aria-label="Organic Honey"]').first();
  await expect(promotionTicket).toBeVisible();
  await expect(promotionTicket.locator(".promotion-ticket-image img")).toBeVisible();
  await expect(promotionStrip).toContainText("₹299/- only");
  await expect(promotionStrip).not.toContainText("Special Offer");
  await expect(promotionStrip).not.toContainText("Limited-time store offer");
  await expect(promotionStrip).toContainText("Offer ends 30 Aug");
  await expect(page.locator("#promotionRail")).toHaveClass(/is-auto-scrolling/);
  const ticketMotion = await page.evaluate(() => {
    const card = document.querySelector(".customer-ticket");
    const track = document.querySelector(".promotion-track");
    const buy = card.querySelector(".promotion-add");
    const price = card.querySelector(".promotion-offer-price");
    const cardBox = card.getBoundingClientRect(), buyBox = buy.getBoundingClientRect();
    const cardStyle=getComputedStyle(card),priceStyle=getComputedStyle(price);
    return { width: cardBox.width, buyFits: buyBox.left >= cardBox.left && buyBox.right <= cardBox.right, animation: getComputedStyle(track).animationName, duration: getComputedStyle(track).animationDuration, priceAnimation: priceStyle.animationName, priceColor: priceStyle.color, cardBackground: cardStyle.backgroundImage, cardShadow: cardStyle.boxShadow };
  });
  expect(ticketMotion.width).toBeLessThanOrEqual(158);
  expect(ticketMotion).toMatchObject({ buyFits: true, animation: "promotionMarquee", duration: "42s", priceAnimation: "none", priceColor: "rgb(220, 38, 38)", cardBackground: "none", cardShadow: "none" });
  const razorpayLink = page.getByRole("link", { name: /Open Razorpay & Pay/ });
  await expect(razorpayLink).toHaveAttribute("href", "https://razorpay.me/@naturerefills");
  await razorpayLink.evaluate((link) => link.addEventListener("click", (event) => event.preventDefault(), { once: true }));
  await razorpayLink.click();
  await expect(page.locator('[data-razorpay-return="priced_order"]')).toBeVisible();
  await page.getByRole("button", { name: "Payment not completed" }).click();
  await expect(page.locator('[data-razorpay-return="priced_order"]')).toBeHidden();
  await razorpayLink.evaluate((link) => link.addEventListener("click", (event) => event.preventDefault(), { once: true }));
  await razorpayLink.click();
  await page.getByRole("button", { name: "Payment completed" }).click();
  await expect(page.getByText("Payment submitted for verification")).toBeVisible();
  const paidOrder = await page.evaluate((kind) => window.__g58Mock.store[kind].find((row) => row.id === "priced_order"), orderKind);
  expect(paidOrder).toMatchObject({ status: "Priced", paymentStatus: "Awaiting store verification", paymentMethod: "Razorpay link" });
  expect(paidOrder.paymentMarkedAt).toBeTruthy();
  const placement = await page.evaluate(() => ({ promotions: document.querySelector(".promotion-strip").getBoundingClientRect().top, orders: document.querySelector(".public-store > .section-head").getBoundingClientRect().top }));
  expect(placement.promotions).toBeLessThan(placement.orders);

  await promotionStrip.getByRole("button", { name: "Buy" }).click({ force: true });
  await expect(page.locator("#promotionRail")).toHaveClass(/is-paused/);
  await promotionStrip.getByRole("button", { name: "Add one" }).click();
  await expect(promotionStrip.locator(".promotion-stepper strong").first()).toHaveText("2");
  await page.getByRole("button", { name: "+ Place New Order" }).click();
  await expect(page.locator('#placeOrderForm input[name="itemName[]"]').first()).toHaveValue("Organic Honey");
  await expect(page.locator('#placeOrderForm input[name="itemQty[]"]').first()).toHaveValue("2");
  await page.locator('#placeOrderForm textarea[name="address"]').fill("12 Market Road, Hyderabad");
  await page.getByRole("button", { name: "Submit Order" }).click();
  await expect.poll(async () => page.evaluate((kind) => window.__g58Mock.store[kind].filter((row) => row.status === "Requested").length, orderKind)).toBe(1);
  const orders = await page.evaluate((kind) => window.__g58Mock.store[kind], orderKind);
  expect(orders.find((row) => row.status === "Requested")).toMatchObject({ status: "Requested", items: [{ name: "Organic Honey", qty: 2 }] });
  await assertNoErrors();
});
