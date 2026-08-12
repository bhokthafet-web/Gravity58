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

test("free restaurant account is menu-only and pricing shows every discounted period", async ({ page }) => {
  const assertNoErrors = monitorPageErrors(page);
  await prepareProductionMock(page, { initialUser: { $id: "owner-1", email: "free@restaurant.test", name: "Free Owner" }, seed: { "digital_menu_owner-1": [menuRecord()] } });
  await page.goto("/digital-menu/");
  await expect(page.getByRole("heading", { name: /Plan Test Kitchen/ })).toBeVisible();
  await expect(page.locator(".plan-badge")).toContainText("Free Digital Menu");
  await page.locator('[data-view="orders"]').click();
  await expect(page.getByRole("heading", { name: "Digital Menu Pricing" })).toBeVisible();
  await expect(page.locator("#page")).toContainText("₹699");
  await expect(page.locator("#page")).toContainText("₹3,775");
  await expect(page.locator("#page")).toContainText("₹6,710");
  await expect(page.locator("#page")).toContainText("₹17,615");
  await page.locator("#addRestaurant").click();
  await expect(page.getByRole("heading", { name: "Digital Menu Pricing" })).toBeVisible();
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
      digital_menu_requests: [{ id: "request-1", ownerId: "owner-1", ownerEmail: "owner@restaurant.test", ownerName: "Restaurant Owner", plan: "premium", periodId: "1m", periodLabel: "1 Month", months: 1, amount: 1299, status: "Requested", createdAt: new Date().toISOString() }],
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
  const result = await page.evaluate(() => ({ pricing: window.__g58Mock.store.digital_menu_pricing[0], entitlement: window.__g58Mock.store.digital_menu_entitlements[0], request: window.__g58Mock.store.digital_menu_requests[0] }));
  expect(result.pricing.standardMonthly).toBe(749);
  expect(result.pricing.links.premium_1m).toBe("https://pay.example.com/premium-month");
  expect(result.entitlement).toMatchObject({ ownerId: "owner-1", plan: "premium", lifetime: true, expiresAt: "" });
  expect(result.request.status).toBe("Activated");
  await assertNoErrors();
});

test("Premium customer creates a meal subscription and schedules a receipt-backed UPI order", async ({ page }) => {
  const assertNoErrors = monitorPageErrors(page);
  const premiumMenu = menuRecord();
  Object.assign(premiumMenu.restaurant, {
    ordersEnabled: true, premiumFeatures: true, paymentEnabled: true, upiId: "plantest@upi", phone: "+91 98765 43210",
    subscriptionPlans: [{ id: "meal-plan-1", name: "Healthy Monthly Meals", description: "Daily restaurant meals", price: 2499, meals: 30, periodLabel: "1 Month", paymentLink: "", active: true }],
  });
  await prepareProductionMock(page, { seed: { "digital_menu_owner-1": [premiumMenu] } });
  page.on("popup", (popup) => popup.close());
  await page.goto("/digital-menu/#menu&cloud=restaurant-one&owner=owner-1");
  await page.getByRole("textbox", { name: "Enter your name" }).fill("Premium Customer");
  await page.getByRole("button", { name: "Continue to Menu" }).click();
  await page.locator("#openMealSubscriptions").click();
  await page.locator('#mealCustomerRegister input[name="name"]').fill("Premium Customer");
  await page.locator('#mealCustomerRegister input[name="email"]').fill("premium.customer@example.com");
  await page.locator('#mealCustomerRegister input[name="password"]').fill("secret123");
  await page.locator("#mealCustomerRegister").getByRole("button", { name: "Create Customer Account" }).click();
  await expect(page.getByRole("heading", { name: /Plan Test Kitchen Meal Plans/ })).toBeVisible();
  await page.locator('[data-customer-subscribe="meal-plan-1"]').click();
  await expect(page.locator(".customer-subscription-history")).toContainText("Healthy Monthly Meals");
  await page.getByRole("button", { name: "Close dialog" }).click();

  await page.locator('.poster-menu-item[data-search*="meal one"] [data-qty-action="plus"]').click();
  await page.locator("#openCart").click();
  await expect(page.locator('#checkoutPanel input[value="counter"]')).toHaveCount(0);
  await expect(page.locator(".payment-app-grid")).toContainText("PhonePe");
  await page.locator("#transactionId").fill("UPI-TEST-12345");
  await page.locator("#paymentReceipt").setInputFiles({ name: "receipt.png", mimeType: "image/png", buffer: Buffer.from("receipt-image") });
  const scheduledFor = await page.evaluate(() => { const date = new Date(Date.now() + 10 * 60000); date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); return date.toISOString().slice(0, 16); });
  await page.locator("#scheduledFor").fill(scheduledFor);
  await page.locator("#confirmPlaceOrder").click();
  await expect(page).toHaveURL(/#track&order=/);
  await expect(page.getByRole("heading", { name: "Verifying Your Payment" })).toBeVisible();
  await expect(page.locator(".customer-chat-toggle")).toBeVisible();
  const result = await page.evaluate(() => ({ subscriptions: window.__g58Mock.store["digital_subscription_owner-1"], orders: window.__g58Mock.store["digital_order_owner-1"] }));
  expect(result.subscriptions[0]).toMatchObject({ planId: "meal-plan-1", customerEmail: "premium.customer@example.com", status: "Requested" });
  expect(result.orders[0].transactionId).toBe("UPI-TEST-12345");
  expect(result.orders[0].paymentReceiptUrl).toContain("receipt.png");
  expect(result.orders[0].scheduledFor).toBeTruthy();
  await assertNoErrors();
});
