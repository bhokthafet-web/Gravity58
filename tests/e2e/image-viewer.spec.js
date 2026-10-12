import { test, expect } from "@playwright/test";
import { monitorPageErrors, prepareMockApi, prepareOffline } from "./helpers.js";

async function loginDemoOwner(page) {
  await page.goto("/digital-menu/");
  await page.locator('#loginForm input[name="email"]').fill("testing@g58.in");
  await page.locator('#loginForm input[name="password"]').fill("test123");
  await page.locator("#loginForm").getByRole("button", { name: "Login" }).click();
  await expect(page.getByRole("heading", { name: /Gravity58 Café/ })).toBeVisible();
}

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const serveMedia = (page, { missing = false } = {}) => page.route(/\/api\/v1\/media\//, (route) =>
  missing ? route.fulfill({ status: 404, contentType: "application/json", body: '{"error":"File not found"}' }) : route.fulfill({ status: 200, contentType: "image/png", body: PNG }));

async function plainPageWithReceiptLink(page, options) {
  await serveMedia(page, options);
  await page.route(/\/viewer-test\.html$/, (route) => route.fulfill({
    contentType: "text/html",
    body: '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Viewer test</title></head><body style="padding:24px"><p><a id="receipt" href="/api/v1/media/receipt-1" target="_blank" rel="noopener">View payment receipt ↗</a></p><p><a id="plain" href="#other" target="_blank">Other link</a></p><script src="/js/image-viewer.js"></script></body></html>',
  }));
  await page.goto("/viewer-test.html");
}

test("uploaded files open in an on-page preview that closes without leaving the page", async ({ page, context }) => {
  await plainPageWithReceiptLink(page);
  const url = page.url();
  await page.locator("#receipt").click();
  const viewer = page.locator(".g58-viewer");
  await expect(viewer).toBeVisible();
  await expect(viewer.locator(".g58-viewer-title")).toHaveText("View payment receipt");
  await expect(viewer.locator("img")).toBeVisible();
  expect(context.pages()).toHaveLength(1);
  await viewer.getByRole("button", { name: "Close preview" }).click();
  await expect(viewer).toBeHidden();
  expect(page.url()).toBe(url);
  await expect(page.locator("#receipt")).toBeVisible();
});

test("Escape, tapping outside the picture and the phone Back button all close the preview", async ({ page }) => {
  await plainPageWithReceiptLink(page);
  const url = page.url();
  const viewer = page.locator(".g58-viewer");

  await page.locator("#receipt").click();
  await expect(viewer.locator("img")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(viewer).toBeHidden();

  await page.locator("#receipt").click();
  await expect(viewer.locator("img")).toBeVisible();
  await page.locator(".g58-viewer-stage").click({ position: { x: 4, y: 4 } });
  await expect(viewer).toBeHidden();

  await page.locator("#receipt").click();
  await expect(viewer.locator("img")).toBeVisible();
  await page.goBack();
  await expect(viewer).toBeHidden();
  expect(page.url()).toBe(url);
  await expect(page.locator("#receipt")).toBeVisible();
});

test("a deleted file shows a message and can still be closed; other links are left alone", async ({ page }) => {
  await plainPageWithReceiptLink(page, { missing: true });
  await page.locator("#receipt").click();
  const viewer = page.locator(".g58-viewer");
  await expect(viewer).toContainText("could not be loaded");
  await viewer.getByRole("button", { name: "Close preview" }).click();
  await expect(viewer).toBeHidden();
  const intercepted = await page.evaluate(() => {
    let prevented = false;
    document.addEventListener("click", (event) => { prevented = event.defaultPrevented; event.preventDefault(); }, { once: true });
    document.querySelector("#plain").click();
    return prevented;
  });
  expect(intercepted).toBe(false);
});

test("Digital Menu: the owner can open a payment receipt and get back to the orders page", async ({ page }) => {
  await serveMedia(page);
  await prepareOffline(page, { state: null });
  const assertNoErrors = monitorPageErrors(page);
  await loginDemoOwner(page);
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem("gravity58DigitalMenu"));
    saved.orders = [{
      id: "receipt-order", restaurantId: "res_cafe", customerName: "Receipt Guest", customer: "Receipt Guest", serviceMode: "counter",
      items: [{ name: "Masala Dosa", qty: 1, price: 120 }], total: 120, status: "Payment Verification", tokenNumber: 1, createdAt: new Date().toISOString(),
      messages: [], paymentMethod: "online", paymentStatus: "Awaiting confirmation", paymentReceiptUrl: "/api/v1/media/receipt-1",
    }];
    localStorage.setItem("gravity58DigitalMenu", JSON.stringify(saved));
  });
  await page.reload();
  await page.locator('[data-view="orders"]').click();
  await expect(page.getByRole("heading", { name: /Live Orders/ })).toBeVisible();
  await page.getByRole("link", { name: /View payment receipt/ }).click();
  const viewer = page.locator(".g58-viewer");
  await expect(viewer.locator("img")).toBeVisible();
  await viewer.getByRole("button", { name: "Close preview" }).click();
  await expect(viewer).toBeHidden();
  await expect(page.getByRole("heading", { name: /Live Orders/ })).toBeVisible();
  await expect(page.locator("#ordersGrid .order-card")).toHaveCount(1);
  await assertNoErrors();
});

test("team admin: booking proof opens in the preview and closes back to Ad Bookings", async ({ page }) => {
  await serveMedia(page);
  const seed = {
    bookings: [{ id: "booking-proof", customerName: "Customer Two", customerEmail: "two@example.com", restaurantKey: "Test Restaurant|Hyderabad", slotId: "right_rail", hours: 1, amount: 100, title: "Proof Ad", description: "Ready", status: "Proof Sent", paymentReference: "UTR123", proofMediaUrl: "/api/v1/media/proof-1", createdAt: new Date().toISOString() }],
  };
  await prepareMockApi(page, { admin: true, seed, state: null });
  const assertNoErrors = monitorPageErrors(page);
  await page.goto("/team-admin/");
  await page.locator('#login input[name="email"]').fill("admin@g58.in");
  await page.locator('#login input[name="password"]').fill("testing123");
  await page.locator("#login").getByRole("button", { name: "Secure Login" }).click();
  await page.locator('[data-view="bookings"]').click();
  await page.getByRole("link", { name: "View proof" }).click();
  const viewer = page.locator(".g58-viewer");
  await expect(viewer.locator("img")).toBeVisible();
  await viewer.getByRole("button", { name: "Close preview" }).click();
  await expect(viewer).toBeHidden();
  await expect(page.getByRole("heading", { name: "Advertising Bookings" })).toBeVisible();
  await assertNoErrors();
});

test("Refills loads the shared preview so prescriptions and guest IDs use it too", async ({ page }) => {
  await prepareMockApi(page, { state: null });
  const assertNoErrors = monitorPageErrors(page);
  await page.goto("/digit58/");
  expect(await page.evaluate(() => typeof window.G58ImageViewer?.open)).toBe("function");
  await assertNoErrors();
});
