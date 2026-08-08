import { test, expect } from "@playwright/test";
import { monitorPageErrors, prepareOffline } from "./helpers.js";

async function createPosAccount(page) {
  await prepareOffline(page, { state: null });
  await page.goto("/pos/");
  await expect(page.locator("#posAccountGate")).toBeVisible();
  await page.locator("#gateEmail").fill("owner@example.com");
  await page.locator("#gatePassword").fill("secret123");
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

  await page.locator("#generateBtn").click();
  await expect(page.locator("#qrModal")).toHaveClass(/show/);
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
  await page.locator("#generateBtn").click();
  await page.locator("#paymentCancelledBtn").click();
  const cancelled = await page.evaluate(() => JSON.parse(localStorage.getItem("g58CancelledBills") || "[]"));
  expect(cancelled).toHaveLength(1);
  expect(cancelled[0].status).toBe("cancelled");
  const receivedAfterCancel = await page.evaluate(() => JSON.parse(localStorage.getItem("g58Bills") || "[]"));
  expect(receivedAfterCancel).toHaveLength(1);
  await assertNoErrors();
});

test("POS account logout, local forgot-password and new login work", async ({ page }) => {
  const assertNoErrors = monitorPageErrors(page);
  await createPosAccount(page);
  await page.locator("#localLogout").click();
  await expect(page.locator("#posAccountGate")).toBeVisible();
  await page.locator("#gateEmail").fill("owner@example.com");
  await page.locator("#gatePassword").fill("newsecret123");
  await page.locator("#gateForgot").click();
  await expect(page.locator("#gateMessage")).toContainText("Password updated");
  await page.locator("#gateLogin").click();
  await expect(page.locator("#posAccountGate")).toHaveCount(0);
  await expect(page.locator("#premiumShell")).toContainText("owner@example.com");
  await assertNoErrors();
});

test("premium activation, menu import/removal, optional inventory and dashboard work", async ({ page }) => {
  const assertNoErrors = monitorPageErrors(page);
  page.on("dialog", (dialog) => dialog.accept());
  await createPosAccount(page);
  await configurePos(page);

  await page.locator('#premiumShell [data-p="license"]').click();
  await page.locator("#localPremiumKey").fill("G58-POS-TEST-2026");
  await page.locator("#activateLocalPremium").click();
  await expect(page.locator("#premiumShell")).toContainText("PREMIUM ACTIVE");

  await page.locator('#premiumShell [data-p="menu"]').click();
  await page.locator("#inventoryToggle").check();
  await page.locator("#mn").fill("Chicken Marination");
  await page.locator("#mc").fill("Marinations");
  await page.locator("#mp").fill("120");
  await page.locator("#mg").fill("5");
  await page.locator("#msq").fill("10");
  await page.locator("#saveLocalMenu").click();
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
  await expect(page.locator("#importStatus")).toContainText("2 menu item(s) imported");
  await expect(page.locator("#localMenuList")).toContainText("Prawns, Spicy");

  const firstRemove = page.locator("[data-remove-menu]").first();
  await firstRemove.click();
  await expect(page.locator("#localMenuList")).not.toContainText("Chicken Marination");

  await page.locator('#premiumShell [data-p="dashboard"]').click();
  await expect(page.locator("#pp")).toContainText("Business dashboard");
  await expect(page.locator("#pp")).toContainText("Received bills");
  await expect(page.locator("#pp")).toContainText("₹240");
  await assertNoErrors();
});

test("premium purchase request is stored without opening WhatsApp", async ({ page }) => {
  const assertNoErrors = monitorPageErrors(page);
  await createPosAccount(page);
  await page.locator("#openPremiumPlansBtn").click();
  await expect(page.locator("#premiumPlansModal")).toHaveClass(/open/);
  await page.locator('.buy-plan[data-plan="Monthly"]').click();
  await expect(page.locator("#premiumPlansModal")).not.toHaveClass(/open/);
  const request = await page.evaluate(() => JSON.parse(localStorage.getItem("g58SubscriptionRequest")));
  expect(request).toMatchObject({ plan: "monthly", amount: 299, status: "requested", email: "owner@example.com" });
  await assertNoErrors();
});
