import { test, expect } from "@playwright/test";
import { prepareOffline, mockApiScript, monitorPageErrors } from "./helpers.js";

const configPattern = /\/(?:js|advertise|digital-menu|team-admin)\/config\.js(?:\?.*)?$/;
const adapterPattern = /\/js\/appwrite-ads\.js(?:\?.*)?$/;

async function prepareProductionMock(page, options) {
  await prepareOffline(page);
  await page.unroute(configPattern);
  await page.route(configPattern, (route) => route.fulfill({
    contentType: "application/javascript",
    body: "window.GRAVITY58_CONFIG={testMode:false,gravity58Url:'/',adBookingPortalUrl:'/advertise/',appwrite:{endpoint:'mock',projectId:'mock',databaseId:'mock'}};window.GRAVITY58_AD_ADMIN_CONFIG=window.GRAVITY58_CONFIG;",
  }));
  await page.route(adapterPattern, (route) => route.fulfill({ contentType: "application/javascript", body: mockApiScript(options) }));
}

function menuRecord(ownerId = "owner-1") {
  return {
    id: "restaurant-one", ownerId,
    restaurant: { id: "restaurant-one", name: "Plan Test Kitchen", type: "Restaurant", city: "Hyderabad", description: "Plan test menu", open: true, accepting: true, ordersEnabled: true, premiumFeatures: false, subscriptionPlans: [] },
    categories: [{ id: "cat-one", name: "Meals" }],
    items: [{ id: "item-one", categoryId: "cat-one", name: "Meal One", description: "Fresh meal", price: 199, type: "Veg", available: true, prep: 10 }],
  };
}

test("free restaurant account receives orders and pricing shows every discounted period", async ({ page }) => {
  const assertNoErrors = monitorPageErrors(page);
  await prepareProductionMock(page, { initialUser: { $id: "owner-1", email: "free@restaurant.test", name: "Free Owner" }, seed: { "digital_menu_owner-1": [menuRecord()] } });
  await page.goto("/digital-menu/");
  await expect(page.getByRole("heading", { name: /Plan Test Kitchen/ })).toBeVisible();
  await expect(page.locator(".plan-badge")).toContainText("Free Digital Menu");
  await page.locator('[data-view="orders"]').click();
  await expect(page.getByRole("heading", { name: /Live Orders/ })).toContainText("orders reset in");
  await page.locator('[data-view="pricing"]').click();
  await expect(page.getByRole("heading", { name: "Digital Menu Pricing" })).toBeVisible();
  await expect(page.locator("#page")).toContainText("₹699");
  await expect(page.locator("#page")).toContainText("₹3,775");
  await expect(page.locator("#page")).toContainText("₹6,710");
  await expect(page.locator("#page")).toContainText("₹17,615");
  await page.locator("#addRestaurant").click();
  await expect(page.getByRole("heading", { name: "Digital Menu Pricing" })).toBeVisible();
  await assertNoErrors();
});

test("creating the first free restaurant submits its onboarding request", async ({ page }) => {
  const assertNoErrors = monitorPageErrors(page);
  await prepareProductionMock(page, { initialUser: { $id: "new-owner", email: "new@restaurant.test", name: "New Owner" } });
  await page.goto("/digital-menu/");
  await page.getByRole("button", { name: "Add Restaurant" }).click();
  await page.locator('#restaurantForm input[name="name"]').fill("New Free Kitchen");
  await page.locator('#restaurantForm input[name="city"]').fill("Hyderabad");
  await page.getByRole("button", { name: "Save Restaurant" }).click();
  await expect(page.getByRole("heading", { name: /New Free Kitchen/ })).toBeVisible();
  const requests = await page.evaluate(() => window.__g58Mock.store.digital_menu_requests || []);
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({ ownerId: "new-owner", restaurantName: "New Free Kitchen", plan: "free", status: "Requested", amount: 0 });
  await assertNoErrors();
});

test("standard orders reset at India midnight and carry a processing order for one day", async ({ page }) => {
  const assertNoErrors = monitorPageErrors(page);
  const indiaStart = new Date(); indiaStart.setHours(0, 0, 0, 0);
  const createdAt = new Date(indiaStart.getTime() - 2 * 3600000).toISOString();
  const completedAt = new Date(indiaStart.getTime() - 3600000).toISOString();
  const orderBase = { restaurantId: "restaurant-one", ownerId: "owner-1", cloudOwnerId: "owner-1", items: [{ id: "item-one", name: "Meal One", qty: 1, price: 199 }], total: 199, createdAt, orderDay: "previous" };
  await prepareProductionMock(page, {
    initialUser: { $id: "owner-1", email: "standard@restaurant.test", name: "Standard Owner" },
    seed: {
      "digital_menu_owner-1": [menuRecord()],
      digital_menu_entitlements: [{ id: "ent-standard", ownerId: "owner-1", plan: "standard", maxRestaurants: 5, expiresAt: "2027-08-12T00:00:00.000Z" }],
      "digital_order_owner-1": [
        { id: "old-complete", ...orderBase, status: "Completed", completedAt },
        { id: "old-processing", ...orderBase, status: "Preparing" },
      ],
    },
  });
  await page.goto("/digital-menu/");
  await expect(page.getByRole("heading", { name: /Plan Test Kitchen/ })).toBeVisible();
  await page.locator('[data-view="orders"]').click();
  await expect(page.getByRole("heading", { name: /Live Orders/ })).toContainText("orders reset in");
  await expect(page.locator("#ordersGrid")).toContainText("Preparing");
  await expect(page.locator("#ordersGrid")).not.toContainText("old-complete");
  const cloud = await page.evaluate(() => window.__g58Mock.store["digital_order_owner-1"]);
  expect(cloud).toHaveLength(1);
  expect(cloud[0]).toMatchObject({ id: "old-processing", retentionReason: "processing-at-midnight" });
  await assertNoErrors();
});

test("G58 admin edits Digital Menu pricing and grants lifetime Premium access", async ({ page }) => {
  const assertNoErrors = monitorPageErrors(page);
  await prepareProductionMock(page, {
    initialUser: { $id: "admin-1", email: "admin@g58.test", name: "Admin" }, admin: true,
    seed: {
      digital_menu_requests: [
        { id: "request-1", ownerId: "owner-1", ownerEmail: "owner@restaurant.test", ownerName: "Restaurant Owner", plan: "premium", periodId: "1m", periodLabel: "1 Month", months: 1, amount: 1299, status: "Requested", createdAt: new Date().toISOString() },
        { id: "request-free", ownerId: "free-owner", ownerEmail: "free@restaurant.test", ownerName: "Free Owner", restaurantId: "free-restaurant", restaurantName: "Free Kitchen", plan: "free", periodId: "free", periodLabel: "Free Account", amount: 0, status: "Requested", createdAt: new Date().toISOString() },
      ],
    },
  });
  await page.goto("/team-admin/");
  await page.locator('[data-view="digitalMenus"]').click();
  await expect(page.getByRole("heading", { name: "Digital Menu Plans" })).toBeVisible();
  await page.locator("#editMenuPricing").click();
  await page.locator('#menuPricingForm input[name="standardMonthly"]').fill("749");
  await page.locator('#menuPricingForm input[name="premium_1m"]').fill("https://pay.example.com/premium-month");
  await page.getByRole("button", { name: "Publish Pricing" }).click();
  await page.locator('[data-activate-menu="request-1"]').click();
  await page.locator('#activateMenuPlan input[name="lifetime"]').check();
  await page.getByRole("button", { name: "Activate Account" }).click();
  await page.locator('[data-approve-free="request-free"]').click();
  const result = await page.evaluate(() => ({ pricing: window.__g58Mock.store.digital_menu_pricing[0], entitlement: window.__g58Mock.store.digital_menu_entitlements[0], requests: window.__g58Mock.store.digital_menu_requests }));
  expect(result.pricing.standardMonthly).toBe(749);
  expect(result.pricing.links.premium_1m).toBe("https://pay.example.com/premium-month");
  expect(result.entitlement).toMatchObject({ ownerId: "owner-1", plan: "premium", lifetime: true, expiresAt: "" });
  expect(result.requests.find((row) => row.id === "request-1").status).toBe("Activated");
  expect(result.requests.find((row) => row.id === "request-free").status).toBe("Activated");
  await assertNoErrors();
});

test("restaurant owner creates a branded 3D subscription plan with editable colours and cover image", async ({ page }) => {
  const assertNoErrors = monitorPageErrors(page);
  const premiumMenu = menuRecord();
  premiumMenu.restaurant.premiumFeatures = true;
  await prepareProductionMock(page, {
    initialUser: { $id: "owner-1", email: "owner@restaurant.test", name: "Plan Owner" },
    seed: {
      "digital_menu_owner-1": [premiumMenu],
      digital_menu_entitlements: [{ id: "premium-owner", ownerId: "owner-1", plan: "premium", lifetime: true, maxRestaurants: 5 }],
    },
  });
  await page.goto("/digital-menu/");
  await page.locator('[data-view="subscriptions"]').click();
  await page.getByRole("button", { name: "Create Subscription Card" }).click();
  await page.locator('#mealPlanForm input[name="planType"]').fill("Performance");
  await page.locator('#mealPlanForm input[name="name"]').fill("High Protein 30");
  await page.locator('#mealPlanForm input[name="price"]').fill("3299");
  await page.locator('#mealPlanForm input[name="meals"]').fill("30");
  await page.locator('#mealPlanForm input[name="themeColor"]').fill("#3b1220");
  await page.locator('#mealPlanForm input[name="accentColor"]').fill("#ffb000");
  await page.locator('#mealPlanForm input[name="deliveryTime"]').fill("13:15");
  await page.locator('#mealPlanForm input[name="deliveryDays"]').evaluateAll((boxes) => boxes.forEach((box) => { box.checked = ["1", "3", "5"].includes(box.value); }));
  await page.locator('#mealPlanForm input[name="paymentLink"]').fill("https://pay.example.com/high-protein");
  await page.locator('#mealPlanForm textarea[name="description"]').fill("Thirty protein-focused meals.");
  await page.locator('#mealPlanForm input[name="planImage"]').setInputFiles({ name: "plan.jpg", mimeType: "image/jpeg", buffer: Buffer.from("small-plan-cover") });
  await page.getByRole("button", { name: "Save Subscription Card" }).click();
  await expect(page.locator(".subscription-plan-3d")).toContainText("Performance");
  await expect(page.locator(".subscription-plan-3d .meal-plan-image")).toBeVisible();
  const plan = await page.evaluate(() => window.__g58Mock.store["digital_menu_owner-1"][0].restaurant.subscriptionPlans[0]);
  expect(plan).toMatchObject({ planType: "Performance", name: "High Protein 30", themeColor: "#3b1220", accentColor: "#ffb000", meals: 30, price: 3299, deliveryDays: [1, 3, 5], deliveryTime: "13:15" });
  expect(plan.imageUrl).toContain("plan.jpg");
  await assertNoErrors();
});

test("restaurant owner sends the payment link and confirms subscription proof", async ({ page }) => {
  const assertNoErrors = monitorPageErrors(page);
  const premiumMenu = menuRecord();
  Object.assign(premiumMenu.restaurant, { premiumFeatures: true, subscriptionPlans: [{ id: "plan-flow", planType: "Protein", name: "Weekday Protein", price: 2999, meals: 20, paymentLink: "https://pay.example.com/weekday", deliveryDays: [1, 3, 5], deliveryTime: "12:30", active: true }] });
  const request = { id: "subscription-flow", ownerId: "owner-1", restaurantId: "restaurant-one", customerAccountId: "customer-1", customerName: "Meal Customer", customerEmail: "meal@example.com", planId: "plan-flow", planType: "Protein", planName: "Weekday Protein", paymentLink: "https://pay.example.com/weekday", deliveryDays: [1, 3, 5], deliveryTime: "12:30", totalMeals: 20, mealsDelivered: 0, status: "Requested" };
  await prepareProductionMock(page, { initialUser: { $id: "owner-1", email: "owner@example.com", name: "Owner" }, seed: { "digital_menu_owner-1": [premiumMenu], "digital_subscription_owner-1": [request], digital_menu_entitlements: [{ id: "premium-owner", ownerId: "owner-1", plan: "premium", lifetime: true }] } });
  await page.goto("/digital-menu/");
  await page.locator('[data-view="subscriptions"]').click();
  const activationLink = page.locator('[data-sub-link-input="subscription-flow"]');
  await expect(activationLink).toBeVisible();
  await activationLink.fill("https://pay.example.com/customer-specific-activation");
  await page.getByRole("button", { name: "Send Payment Link" }).click();
  await expect(page.locator(".subscriber-management-card")).toContainText("Payment Link Sent");
  await expect.poll(() => page.evaluate(() => window.__g58Mock.store["digital_subscription_owner-1"][0].paymentLink)).toBe("https://pay.example.com/customer-specific-activation");
  await page.evaluate(() => { const row = window.__g58Mock.store["digital_subscription_owner-1"][0]; Object.assign(row, { status: "Payment Proof Submitted", paymentReceiptFileId: "receipt-proof", paymentReceiptUrl: "https://example.com/proof.png" }); window.dispatchEvent(new CustomEvent("g58-ad-data-changed", { detail: { kind: "digital_subscription_owner-1", row } })); });
  await page.locator('[data-view="subscriptions"]').click();
  await page.getByRole("button", { name: "Confirm payment" }).click();
  const result = await page.evaluate(() => ({ row: window.__g58Mock.store["digital_subscription_owner-1"][0], removed: window.__g58Mock.removedMedia }));
  expect(result.row.status).toBe("Active");
  expect(result.row.nextScheduledMeal).toBeTruthy();
  expect(result.row.paymentReceiptFileId).toBe("");
  expect(result.removed).toContain("receipt-proof");
  await assertNoErrors();
});

test("customer dashboard opens owner payment link and sends receipt proof", async ({ page }) => {
  const assertNoErrors = monitorPageErrors(page);
  const premiumMenu = menuRecord();
  Object.assign(premiumMenu.restaurant, { premiumFeatures: true, subscriptionPlans: [{ id: "plan-flow", planType: "Protein", name: "Weekday Protein", price: 2999, meals: 20, paymentLink: "https://pay.example.com/weekday", deliveryDays: [1, 3, 5], deliveryTime: "12:30", active: true }] });
  const request = { id: "subscription-flow", ownerId: "owner-1", restaurantId: "restaurant-one", customerAccountId: "customer-1", customerName: "Meal Customer", customerEmail: "meal@example.com", planId: "plan-flow", planType: "Protein", planName: "Weekday Protein", paymentLink: "https://pay.example.com/weekday", deliveryDays: [1, 3, 5], deliveryTime: "12:30", totalMeals: 20, mealsDelivered: 0, status: "Payment Link Sent" };
  await prepareProductionMock(page, { initialUser: { $id: "customer-1", email: "meal@example.com", name: "Meal Customer" }, seed: { "digital_menu_owner-1": [premiumMenu], "digital_subscription_owner-1": [request] } });
  await page.goto("/digital-menu/#subscriptions&cloud=restaurant-one&owner=owner-1");
  const payment = page.getByRole("link", { name: "Open Payment Link" });
  await expect(payment).toHaveAttribute("href", "https://pay.example.com/weekday");
  await expect(payment).toHaveCSS("background-color", "rgb(0, 0, 0)");
  await page.locator('[data-subscription-proof="subscription-flow"]').setInputFiles({ name: "subscription-proof.png", mimeType: "image/png", buffer: Buffer.from("subscription-proof") });
  await page.getByRole("button", { name: "Send Receipt to Restaurant" }).click();
  await expect(page.locator(".customer-active-plan")).toContainText("Payment Proof Submitted");
  const updated = await page.evaluate(() => window.__g58Mock.store["digital_subscription_owner-1"][0]);
  expect(updated.paymentReceiptFileId).toMatch(/^mock-receipt-/);
  await assertNoErrors();
});

test("signed-out customer places an immediate receipt-backed order without login", async ({ page }) => {
  const assertNoErrors = monitorPageErrors(page);
  const premiumMenu = menuRecord();
  Object.assign(premiumMenu.restaurant, {
    premiumFeatures: true, paymentEnabled: true, upiId: "guestorder@upi", upiPayeeName: "Guest Order Kitchen",
  });
  await prepareProductionMock(page, { seed: { "digital_menu_owner-1": [premiumMenu] } });
  await page.goto("/digital-menu/#menu&cloud=restaurant-one&owner=owner-1");
  await page.getByRole("textbox", { name: "Enter your name" }).fill("Walk-in Guest");
  await page.getByRole("button", { name: "Continue to Menu" }).click();
  await page.locator('.poster-menu-item [data-qty-action="plus"]').click();
  await page.locator("#openCart").click();
  await expect(page.locator("#checkoutPanel").getByText("Login / Create Account", { exact: true })).toHaveCount(0);
  await page.locator("#paymentReceipt").setInputFiles({ name: "guest-receipt.png", mimeType: "image/png", buffer: Buffer.from("guest-receipt-image") });
  await page.locator("#confirmPlaceOrder").click();
  await expect(page).toHaveURL(/#track&order=/);
  const result = await page.evaluate(() => ({ user: window.__g58Mock.user, orders: window.__g58Mock.store["digital_order_owner-1"] || [] }));
  expect(result.user.$id).toMatch(/^anon-/);
  expect(result.user.email).toBe("");
  expect(result.orders).toHaveLength(1);
  expect(result.orders[0]).toMatchObject({ customerName: "Walk-in Guest", status: "Payment Verification" });
  await assertNoErrors();
});

test("Premium customer creates a meal subscription and schedules a receipt-backed UPI order", async ({ page }) => {
  const assertNoErrors = monitorPageErrors(page);
  const premiumMenu = menuRecord();
  Object.assign(premiumMenu.restaurant, {
    ordersEnabled: true, premiumFeatures: true, paymentEnabled: true, upiId: "plantest@upi", upiPayeeName: "Plan Test Foods Private Limited", phone: "+91 98765 43210",
    subscriptionPlans: [{ id: "meal-plan-1", planType: "Fitness Meals", name: "Healthy Monthly Meals", description: "Daily restaurant meals", price: 2499, meals: 30, periodLabel: "1 Month", paymentLink: "", themeColor: "#4b1b0d", accentColor: "#ff8a25", active: true }],
  });
  await prepareProductionMock(page, { seed: { "digital_menu_owner-1": [premiumMenu] } });
  page.on("popup", (popup) => popup.close());
  await page.goto("/digital-menu/#menu&cloud=restaurant-one&owner=owner-1");
  await page.getByRole("textbox", { name: "Enter your name" }).fill("Premium Customer");
  await page.getByRole("button", { name: "Continue to Menu" }).click();
  await expect(page.locator(".premium-customer-access-card")).toHaveCount(0);
  await expect(page.locator("#openMealSubscriptions")).toBeHidden();
  await page.locator('.poster-menu-item[data-search*="meal one"] [data-qty-action="plus"]').click();
  await page.locator("#openCart").click();
  await expect(page.getByText("Pay & send receipt for approval")).toBeVisible();
  await expect(page.locator("#checkoutPremiumLogin")).toHaveCount(0);
  await expect(page.locator("#checkoutPanel").getByText("Login / Create Account", { exact: true })).toHaveCount(0);
  await expect(page.locator("#scheduleOrderToggle")).toBeVisible();
  await page.locator("#scheduleOrderToggle").click();
  await expect(page.getByRole("heading", { name: "Schedule Meal Account" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Login", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create Account", exact: true })).toBeVisible();
  await expect(page.locator("#mealCustomerLogin")).toBeHidden();
  await expect(page.locator("#mealCustomerRegister")).toBeHidden();
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page.locator("#mealCustomerLogin")).toBeVisible();
  await expect(page.locator('#mealCustomerLogin input[name="email"]')).toBeVisible();
  await expect(page.locator('#mealCustomerLogin input[name="password"]')).toBeVisible();
  await page.locator("#mealLoginPanel").getByRole("button", { name: "Back" }).click();
  await page.getByRole("button", { name: "Create Account", exact: true }).click();
  await expect(page.locator("#mealCustomerRegister")).toBeVisible();
  await page.locator('#mealCustomerRegister input[name="name"]').fill("Premium Customer");
  await page.locator('#mealCustomerRegister input[name="email"]').fill("premium.customer@example.com");
  await page.locator('#mealCustomerRegister input[name="password"]').fill("secret123");
  await page.locator("#mealCustomerRegister").getByRole("button", { name: "Create Account" }).click();
  await expect(page.getByRole("heading", { name: "Your Cart" })).toBeVisible();
  await expect(page.locator("#scheduleOrderToggle")).toBeChecked();
  await expect(page.locator('#checkoutPanel input[value="counter"]')).toHaveCount(0);
  const upiUri = await page.locator("#amountQr").getAttribute("data-qr-text");
  expect(upiUri).toMatch(/^upi:\/\/pay\?/);
  const upiParams = new URL(upiUri).searchParams;
  expect(upiParams.get("pa")).toBe("plantest@upi");
  expect(upiParams.get("pn")).toBe("Plan Test Foods Private Limited");
  expect(upiParams.get("tr")).toMatch(/^\d{3,35}$/);
  expect(upiParams.get("am")).toBe("199.00");
  await expect(page.locator('a[href^="phonepe://"], a[href^="paytmmp://"]')).toHaveCount(0);
  await expect(page.locator("#transactionId")).toHaveCount(0);
  await page.locator("#paymentReceipt").setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: Buffer.from("receipt-image") });
  const schedule = await page.evaluate(() => { const date = new Date(Date.now() + 10 * 60000); const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString(); return { date: local.slice(0, 10), time: local.slice(11, 16) }; });
  await page.locator("#scheduledDate").fill(schedule.date);
  await page.locator("#scheduledTime").fill(schedule.time);
  await page.locator("#confirmPlaceOrder").click();
  await expect(page).toHaveURL(/#track&order=/);
  await expect(page.getByRole("heading", { name: "Verifying Your Payment" })).toBeVisible();
  await expect(page.locator(".customer-chat-toggle")).toBeVisible();
  const result = await page.evaluate(() => ({ orders: window.__g58Mock.store["digital_order_owner-1"] }));
  expect(result.orders[0].transactionId).toBe("");
  expect(result.orders[0].paymentReceiptUrl).toContain("receipt.png");
  expect(result.orders[0].scheduledFor).toBeTruthy();
  await page.goto("/digital-menu/#menu&cloud=restaurant-one&owner=owner-1");
  await expect(page.locator("#openMealSubscriptions")).toBeVisible();
  await page.locator("#openMealSubscriptions").click();
  await expect(page.getByRole("heading", { name: "Your meal subscriptions" })).toBeVisible();
  await expect(page.locator('.subscription-plan-3d')).toContainText("Fitness Meals");
  await page.locator('[data-customer-subscribe="meal-plan-1"]').click();
  await expect(page.locator(".customer-subscription-history")).toContainText("Healthy Monthly Meals");
  const subscription = await page.evaluate(() => window.__g58Mock.store["digital_subscription_owner-1"][0]);
  expect(subscription).toMatchObject({ planId: "meal-plan-1", customerEmail: "premium.customer@example.com", status: "Requested" });
  await expect(page.locator(".customer-dashboard-stats")).toContainText("1");
  await expect(page.locator(".customer-scheduled-orders")).toContainText("Payment Verification");
  await expect(page.locator(".customer-scheduled-orders")).toContainText("Meal One");
  await expect(page.locator('[data-track-customer-order]')).toBeVisible();
  await assertNoErrors();
});

test("restaurant owner sees a customer's paid scheduled order in the Schedule board", async ({ page }) => {
  const assertNoErrors = monitorPageErrors(page);
  const premiumMenu = menuRecord();
  Object.assign(premiumMenu.restaurant, { premiumFeatures: true, paymentEnabled: true, upiId: "plantest@upi" });
  const scheduledFor = new Date(Date.now() + 30 * 60000).toISOString();
  await prepareProductionMock(page, {
    initialUser: { $id: "owner-1", email: "owner@restaurant.test", name: "Restaurant Owner" },
    seed: {
      "digital_menu_owner-1": [premiumMenu],
      digital_menu_entitlements: [{ id: "ent-premium", ownerId: "owner-1", plan: "premium", lifetime: true, maxRestaurants: 5 }],
      "digital_order_owner-1": [{
        id: "SCHEDULED-PAID-1", ownerId: "owner-1", cloudOwnerId: "owner-1", restaurantId: "restaurant-one",
        customerAccountId: "customer-1", customerName: "Scheduled Customer", customer: "Scheduled Customer",
        tokenNumber: 21, items: [{ id: "item-one", name: "Meal One", qty: 2, price: 199 }], total: 398,
        paymentMethod: "online", paymentStatus: "Awaiting confirmation", status: "Payment Verification",
        transactionId: "", paymentReceiptUrl: "https://cdn.example.com/receipt.png", paymentReceiptFileId: "receipt-file-21",
        scheduledFor, createdAt: new Date().toISOString(),
      }],
    },
  });
  await page.goto("/digital-menu/");
  await expect(page.locator(".plan-badge")).toContainText("Digital Menu Premium");
  await page.locator('[data-view="schedule"]').click();
  await expect(page.getByRole("heading", { name: "Scheduled Orders" })).toBeVisible();
  await expect(page.locator(".schedule-card")).toContainText("Scheduled Customer");
  await expect(page.locator(".schedule-card")).toContainText("2 × Meal One");
  await expect(page.locator(".schedule-card")).toContainText("Payment Verification");
  await expect(page.locator(".schedule-card")).toContainText("₹398");
  await page.locator(".schedule-card").getByRole("button", { name: "Confirm Payment" }).click();
  await expect(page.locator(".schedule-card")).toContainText("Scheduled");
  await expect(page.locator(".schedule-card .payment-receipt-link")).toHaveCount(0);
  const approval = await page.evaluate(() => ({
    order: window.__g58Mock.store["digital_order_owner-1"][0],
    removedMedia: window.__g58Mock.removedMedia,
  }));
  expect(approval.order).toMatchObject({ status: "Scheduled", paymentStatus: "Confirmed", paymentReceiptUrl: "", paymentReceiptFileId: "" });
  expect(approval.removedMedia).toContain("receipt-file-21");
  await assertNoErrors();
});

test("checkout requires a restaurant UPI QR and does not offer payment-link redirects", async ({ page }) => {
  const assertNoErrors = monitorPageErrors(page);
  const linkMenu = menuRecord();
  Object.assign(linkMenu.restaurant, {
    paymentEnabled: true, upiId: "", paymentLink: "https://pay.example.com/restaurant", phone: "+91 98765 43210",
  });
  await prepareProductionMock(page, { seed: { "digital_menu_owner-1": [linkMenu] } });
  page.on("popup", (popup) => popup.close());
  await page.goto("/digital-menu/#menu&cloud=restaurant-one&owner=owner-1");
  await page.getByRole("textbox", { name: "Enter your name" }).fill("Pay Link Customer");
  await page.getByRole("button", { name: "Continue to Menu" }).click();
  await page.locator('.poster-menu-item[data-search*="meal one"] [data-qty-action="plus"]').click();
  await page.locator("#openCart").click();
  await expect(page.getByRole("link", { name: "Open Restaurant Payment Page" })).toHaveCount(0);
  await expect(page.locator(".payment-app-grid")).toHaveCount(0);
  await expect(page.locator("#amountQr")).toHaveCount(0);
  await expect(page.locator("#checkoutPanel")).toContainText("UPI QR is not configured");
  await page.locator("#paymentReceipt").setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: Buffer.from("receipt-image") });
  await page.locator("#confirmPlaceOrder").click();
  await expect(page.locator("#checkoutError")).toContainText("not configured");
  await expect(page).not.toHaveURL(/#track&order=/);
  await assertNoErrors();
});
