import { test, expect } from "@playwright/test";
import { monitorPageErrors, prepareMockApi } from "./helpers.js";

async function createPosAccount(page, options = {}) {
  await prepareMockApi(page, { state: null, ...options });
  await page.goto("/pos/");
  await expect(page.locator("#posAccountGate")).toBeVisible();
  await page.locator("#gateEmail").fill("owner@example.com");
  await page.locator("#gatePassword").fill("secret123");
  await page.locator("#gateSignup").click();
  await page.locator("#gateRetentionAccepted").check();
  await page.locator("#gateSignup").click();
  await expect(page.locator("#posAccountGate")).toHaveCount(0);
  if (await page.locator("#posGuideModal.show").count()) await page.locator("#startUsingPosBtn").click();
}

async function configurePos(page, { gst = false } = {}) {
  await page.locator("#setupUpiId").fill("gravity58@upi");
  if (gst) {
    await page.locator("#gstEnabled").check();
    await page.locator("#gstPercent").fill("5");
  }
  await page.locator("#notesEnabled").check();
  await page.locator("#continueBtn").click();
  await expect(page.locator("#builderScreen")).toHaveClass(/active/);
}

test("free POS validates setup, calculates quantity and settles received/cancelled bills", async ({ page }) => {
  const assertNoErrors = monitorPageErrors(page);
  await createPosAccount(page);
  await expect(page.getByRole("link", { name: "Home", exact: true })).toBeVisible();

  await page.locator("#continueBtn").click();
  await expect(page.locator("#setupUpiError")).toBeVisible();
  await configurePos(page, { gst: true });

  await page.locator("#valueInput").fill("120");
  await page.locator("#quantityInput").fill("2");
  await page.locator("#itemNoteInput").fill("Test Item");
  await page.locator("#addValueBtn").click();
  await expect(page.locator("#subtotalAmount")).toHaveText("₹240.00");
  await expect(page.locator("#gstAmount")).toHaveText("₹12.00");
  await expect(page.locator("#grandTotal")).toHaveText("₹252.00");
  await expect(page.locator("#sideQrcode [data-testid='qr-rendered']")).toBeVisible();

  await page.locator("#generateBtn").click();
  await expect(page.locator("#qrModal")).toHaveClass(/show/);
  await expect(page.locator(".payment-qr-header")).toBeVisible();
  await expect(page.locator(".payment-qr-content")).toBeVisible();
  await expect(page.locator("#qrcode [data-testid='qr-rendered']")).toBeVisible();
  await page.locator("#paymentReceivedBtn").click();
  await expect(page.locator("#qrModal")).not.toHaveClass(/show/);
  const received = await page.evaluate(() => JSON.parse(localStorage.getItem("g58Bills") || "[]"));
  expect(received).toHaveLength(1);
  expect(received[0].total).toBe(252);
  expect(received[0].items[0]).toMatchObject({ unitPrice: 120, quantity: 2, amount: 240, note: "Test Item" });
  await expect(page.locator("#historyList")).toContainText(received[0].billNumber);

  await page.locator("#valueInput").fill("50");
  await page.locator("#quantityInput").fill("1");
  await page.locator("#itemNoteInput").fill("Cancelled Item");
  await page.locator("#addValueBtn").click();
  await expect(page.locator("#subtotalAmount")).toHaveText("₹50.00");
  await page.locator("#generateBtn").click();
  await expect(page.locator("#qrModal")).toHaveClass(/show/);
  await page.locator("#paymentCancelledBtn").click();
  const cancelled = await page.evaluate(() => JSON.parse(localStorage.getItem("g58CancelledBills") || "[]"));
  expect(cancelled).toHaveLength(1);
  expect(cancelled[0].status).toBe("cancelled");
  const receivedAfterCancel = await page.evaluate(() => JSON.parse(localStorage.getItem("g58Bills") || "[]"));
  expect(receivedAfterCancel).toHaveLength(1);
  await assertNoErrors();
});

test("POS account logout, cloud forgot-password and new login work", async ({ page }) => {
  const assertNoErrors = monitorPageErrors(page);
  await createPosAccount(page);
  await page.locator("#localLogout").click();
  await expect(page.locator("#posAccountGate")).toBeVisible();
  await page.locator("#gateEmail").fill("owner@example.com");
  await page.locator("#gateForgot").click();
  await expect(page.locator("#gateMessage")).toContainText("Password reset email sent");
  const recovery = await page.evaluate(() => window.__g58Mock.recoveries[0]);
  expect(recovery).toMatchObject({ email: "owner@example.com" });
  await page.locator("#gatePassword").fill("secret123");
  await page.locator("#gateLogin").click();
  await expect(page.locator("#posAccountGate")).toHaveCount(0);
  await expect(page.locator("#premiumShell")).toContainText("owner@example.com");
  await assertNoErrors();
});

test("Refills entitlement unlocks menu import/removal, optional inventory and dashboard", async ({ page }) => {
  const assertNoErrors = monitorPageErrors(page);
  page.on("dialog", (dialog) => dialog.accept());
  await createPosAccount(page, {
    seed: {
      digit58_entitlements: [{ id: "refills-entitlement", ownerId: "user-1", active: true, paused: false, lifetime: true }],
    },
  });
  await configurePos(page);

  await page.locator('#premiumShell [data-p="license"]').click();
  await expect(page.locator("#premiumShell")).toContainText("Extra features unlocked");
  await expect(page.locator("#premiumShell")).toContainText("Refills store subscription");

  await page.locator('#premiumShell [data-p="menu"]').click();
  await page.locator("#inventoryToggle").check();
  await expect(page.locator("#saveLocalMenu")).toHaveCount(0);
  const firstCsv = "name,category,price,gst,available,stock\nChicken Marination,Marinations,120,5,true,10\n";
  await page.locator("#menuImportFile").setInputFiles({ name: "menu.csv", mimeType: "text/csv", buffer: Buffer.from(firstCsv) });
  await page.locator("#importMenu").click();
  await expect(page.locator("#localMenuList")).toContainText("Chicken Marination");
  await expect(page.locator("#localMenuList")).toContainText("Stock 10");

  await page.locator("#premiumItemPicker").selectOption({ index: 1 });
  await page.locator("#premiumItemQty").fill("2");
  await page.locator("#premiumAddItem").click();
  await expect(page.locator("#subtotalAmount")).toHaveText("₹240.00");
  await page.locator("#generateBtn").click();
  await page.locator("#paymentReceivedBtn").click();
  const stock = await page.evaluate(() => JSON.parse(localStorage.getItem("g58PremiumMenu"))[0].stock);
  expect(stock).toBe(8);

  await page.locator('#premiumShell [data-p="menu"]').click();
  const csv = "name,category,price,gst,available,stock\nFish Fry,Starters,200,5,true,5\n\"Prawns, Spicy\",Marinations,300,5,false,0\n";
  await page.locator("#menuImportFile").setInputFiles({ name: "menu.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.locator("#importMenu").click();
  await expect(page.locator("#importStatus")).toContainText("2 menu item(s) added or updated");
  await expect(page.locator("#localMenuList")).toContainText("Prawns, Spicy");

  const firstRemove = page.locator("[data-remove-menu]").first();
  await firstRemove.click();
  await expect(page.locator("#localMenuList")).not.toContainText("Chicken Marination");

  await page.locator("#posMenuImportMode").selectOption("replace");
  const replacementCsv = "name,category,price,gst,available,stock\nReplacement Meal,Chef Specials,225,5,true,7\n";
  await page.locator("#menuImportFile").setInputFiles({ name: "replacement.csv", mimeType: "text/csv", buffer: Buffer.from(replacementCsv) });
  await page.locator("#importMenu").click();
  await expect(page.locator("#importStatus")).toContainText("replaced the previous menu");
  await expect(page.locator("#localMenuList")).toContainText("Replacement Meal");
  await expect(page.locator("#localMenuList")).not.toContainText("Fish Fry");
  await expect(page.locator("#localMenuList")).not.toContainText("Prawns, Spicy");

  await page.locator('#premiumShell [data-p="dashboard"]').click();
  await expect(page.locator("#pp")).toContainText("Business dashboard");
  await expect(page.locator("#pp")).toContainText("Received bills");
  await expect(page.locator("#pp")).toContainText("₹240");
  await assertNoErrors();
});

test("POS explains that premium access comes from Refills or Digital Menu", async ({ page }) => {
  const assertNoErrors = monitorPageErrors(page);
  await createPosAccount(page);
  await page.locator('#premiumShell [data-p="license"]').click();
  await expect(page.locator("#premiumShell")).toContainText("there is no separate POS purchase");
  await expect(page.getByRole("link", { name: "Explore Refills" })).toHaveAttribute("href", "/digit58/");
  await expect(page.getByRole("link", { name: "Explore Digital Menu" })).toHaveAttribute("href", "/digital-menu/");
  await assertNoErrors();
});

test("Digital Menu Premium opens a restaurant-scoped POS with synced menu and orders", async ({ page }) => {
  const assertNoErrors = monitorPageErrors(page);
  await prepareMockApi(page, {
    initialUser: { $id: "owner-sync", email: "sync@restaurant.test", name: "Sync Owner" },
    seed: {
      "digital_menu_owner-sync": [{
        id: "restaurant-sync", ownerId: "owner-sync",
        restaurant: { id: "restaurant-sync", name: "Sync Kitchen", city: "Hyderabad", phone: "9876543210", tax: 5, upiId: "synckitchen@upi" },
        categories: [{ id: "cat-meals", name: "Meals" }],
        items: [{ id: "meal-sync", categoryId: "cat-meals", name: "Sync Meal", price: 249, type: "Veg", available: true }],
      }],
      digital_menu_entitlements: [{ id: "ent-sync", ownerId: "owner-sync", plan: "premium", lifetime: true }],
      "digital_order_owner-sync": [{
        id: "ORDER-SYNC-1", ownerId: "owner-sync", restaurantId: "restaurant-sync", tokenNumber: 7,
        customer: "Table 4", items: [{ name: "Sync Meal", qty: 2, price: 249 }], total: 498,
        status: "Completed", createdAt: new Date().toISOString(), completedAt: new Date().toISOString(),
      }],
    },
  });
  await page.goto("/pos/?source=digital-menu&restaurant=restaurant-sync&owner=owner-sync");
  await expect(page.locator("#posAccountGate")).toHaveCount(0);
  if (await page.locator("#posGuideModal.show").count()) await page.locator("#startUsingPosBtn").click();
  await expect(page.locator(".restaurant-sync-banner")).toContainText("Sync Kitchen");
  await expect(page.locator("#premiumShell")).toContainText("restaurant-synced workspace");

  await page.locator('#premiumShell [data-p="menu"]').click();
  await expect(page.locator("#localMenuList")).toContainText("Sync Meal");
  await page.locator('[data-toggle-menu="meal-sync"]').click();
  await expect.poll(() => page.evaluate(() => window.__g58Mock.store["digital_menu_owner-sync"][0].items[0].available)).toBe(false);

  await page.locator('#premiumShell [data-p="orders"]').click();
  await expect(page.locator(".digital-order-table")).toContainText("ORDER-SYNC-1");
  await expect(page.locator(".digital-order-table")).toContainText("#0007");
  await expect(page.locator(".digital-order-table")).toContainText("₹498");

  await page.locator('#premiumShell [data-p="dashboard"]').click();
  await expect(page.locator("#pp")).toContainText("Sync Kitchen business dashboard");
  await expect(page.locator("#pp")).toContainText("Digital Menu sales");
  await expect(page.locator("#pp")).toContainText("₹498");
  await expect.poll(() => page.evaluate(() => Object.values(window.__g58Mock.store).flat().find((row) => row.restaurantId === "restaurant-sync" && row.digitalMenuLinked) || null)).toMatchObject({ ownerId: "owner-sync", restaurantId: "restaurant-sync", restaurantName: "Sync Kitchen" });
  await assertNoErrors();
});
