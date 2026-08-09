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
  expect(bookings[0]).toMatchObject({ status: "Requested", hours: 3, restaurantKey: "Test Restaurant|Hyderabad", title: "Regression Offer" });
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

test("team admin reviews bookings, activates campaigns, moderates posts and blocks accounts", async ({ page }) => {
  const future = new Date(Date.now() + 3_600_000).toISOString();
  const seed = {
    slots,
    profiles: [{ id: "profile-1", userId: "customer-1", name: "Customer One", email: "customer@example.com", phone: "9876543210", state: "Telangana", district: "Hyderabad", blocked: false }],
    bookings: [
      { id: "booking-requested", customerName: "Customer One", customerEmail: "customer@example.com", restaurantKey: "Test Restaurant|Hyderabad", slotId: "right_rail", hours: 3, amount: 300, title: "Requested Ad", description: "Waiting for link", status: "Requested" },
      { id: "booking-proof", customerName: "Customer Two", customerEmail: "two@example.com", restaurantKey: "Test Restaurant|Hyderabad", slotId: "right_rail", hours: 1, amount: 100, title: "Proof Ad", description: "Ready to activate", status: "Proof Sent" },
    ],
    advertisements: [{ id: "ad-live", bookingId: "old", restaurantKey: "Test Restaurant|Hyderabad", slotId: "right_rail", title: "Live Ad", description: "Existing", active: true, status: "Live", expiresAt: future }],
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
  await page.locator('#activateForm input[name="buttonLabel"]').fill("View Test Offer");
  await page.locator("#activateForm").getByRole("button", { name: "Activate advertisement" }).click();
  const activated = await page.evaluate(() => window.__g58Mock.store.bookings.find((row) => row.id === "booking-proof"));
  expect(activated.status).toBe("Live");
  const generatedCampaign = await page.evaluate(() => window.__g58Mock.store.advertisements.find((row) => row.bookingId === "booking-proof"));
  expect(generatedCampaign).toMatchObject({ active: true, status: "Live", buttonLabel: "View Test Offer" });

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
  await page.locator('[data-toggle="ad-live"]').click();
  const paused = await page.evaluate(() => window.__g58Mock.store.advertisements.find((row) => row.id === "ad-live"));
  expect(paused).toMatchObject({ active: false, status: "Paused" });
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
