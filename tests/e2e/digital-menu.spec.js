import { test, expect } from "@playwright/test";
import { monitorPageErrors, prepareOffline } from "./helpers.js";

async function loginDemoOwner(page) {
  await page.goto("/digital-menu/");
  await page.locator('#loginForm input[name="email"]').fill("demo@g58.in");
  await page.locator('#loginForm input[name="password"]').fill("demo123");
  await page.locator("#loginForm").getByRole("button", { name: "Login" }).click();
  await expect(page.getByRole("heading", { name: /Gravity58 Café/ })).toBeVisible();
}

test("restaurant owner login, menu CRUD, availability, orders, QR, reports and settings work", async ({ page }) => {
  await prepareOffline(page, { state: null });
  const assertNoErrors = monitorPageErrors(page);
  page.on("dialog", (dialog) => dialog.accept());
  await loginDemoOwner(page);

  await page.locator('[data-view="menu"]').click();
  await page.locator("#addCategory").click();
  await page.locator('#categoryForm input[name="name"]').fill("Regression Specials");
  await page.locator("#categoryForm").getByRole("button", { name: "Create Category" }).click();
  await expect(page.locator("#catFilter")).toContainText("Regression Specials");

  await page.locator("#addItem").click();
  await page.locator('#itemForm input[name="name"]').fill("Regression Platter");
  await page.locator('#itemForm select[name="categoryId"]').selectOption({ label: "Regression Specials" });
  await page.locator('#itemForm input[name="price"]').fill("299");
  await page.locator('#itemForm textarea[name="description"]').fill("Automated test menu item");
  await page.locator("#itemForm").getByRole("button", { name: "Save Menu Item" }).click();
  const itemCard = page.locator("#menuGrid .menu-item", { hasText: "Regression Platter" });
  await expect(itemCard).toBeVisible();
  await itemCard.getByRole("button", { name: "Out of stock" }).click();
  await expect(page.locator("#menuGrid .menu-item", { hasText: "Regression Platter" })).toContainText("Out of stock");
  await page.locator("#menuGrid .menu-item", { hasText: "Regression Platter" }).getByRole("button", { name: "Make available" }).click();

  await page.locator('[data-view="orders"]').click();
  await page.locator("#simulate").click();
  await expect(page.locator("#ordersGrid")).toContainText("Pending");
  const pendingCard = page.locator("#ordersGrid .order-card", { hasText: "Pending" }).first();
  await pendingCard.getByRole("button", { name: "Accept" }).click();
  await expect(page.locator("#ordersGrid")).toContainText("Accepted");
  const acceptedCard = page.locator("#ordersGrid .order-card", { hasText: "Accepted" }).first();
  await acceptedCard.getByRole("button", { name: "Done" }).click();
  const readyCard = page.locator("#ordersGrid .order-card", { hasText: "Ready" }).first();
  await readyCard.getByRole("button", { name: "Complete" }).click();
  await expect(page.locator("#ordersGrid")).toContainText("Completed");
  await expect(page.locator("#ordersGrid")).not.toContainText("Delivered");

  await page.locator('[data-view="qr"]').click();
  await expect(page.locator("#qrcode [data-testid='qr-rendered']")).toBeVisible();
  await expect(page.locator(".qr-card")).toContainText("#menu&restaurant=res_cafe");

  await page.locator('[data-view="reports"]').click();
  await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
  await expect(page.locator("#page")).toContainText("Total Orders");

  await page.locator('[data-view="settings"]').click();
  await page.locator('#settingsForm select[name="open"]').selectOption("false");
  await page.locator('#settingsForm input[name="upiId"]').fill("updated@upi");
  await page.locator("#settingsForm").getByRole("button", { name: "Save Settings" }).click();
  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem("gravity58DigitalMenu")).restaurants.find((row) => row.id === "res_cafe"));
  expect(persisted).toMatchObject({ open: false, upiId: "updated@upi" });

  await page.locator('[data-view="menu"]').click();
  const removable = page.locator("#menuGrid .menu-item", { hasText: "Regression Platter" });
  await removable.getByRole("button", { name: "Delete" }).click();
  await expect(page.locator("#menuGrid")).not.toContainText("Regression Platter");
  await assertNoErrors();
});

test("customer QR entry popup closes and table/counter validation works", async ({ page }) => {
  await prepareOffline(page, { state: null });
  const assertNoErrors = monitorPageErrors(page);
  await page.goto("/digital-menu/#menu&restaurant=res_cafe");
  await expect(page.locator("#modal")).toHaveCount(1);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(page.locator("#modal")).toHaveCount(0);

  await page.reload();
  await expect(page.locator("#modal")).toHaveCount(1);
  await page.getByRole("radio", { name: /Enter Table Number/ }).check();
  await expect(page.locator("#tableNumberField")).toBeVisible();
  await page.getByRole("textbox", { name: "Example: 12" }).fill("7");
  await page.getByRole("button", { name: "Continue to Menu" }).click();
  await expect(page.locator("#modal")).toHaveCount(0);
  const context = await page.evaluate(() => JSON.parse(sessionStorage.getItem("gravity58Customer_res_cafe")));
  expect(context).toMatchObject({ serviceMode: "table", tableNumber: "7", customer: "Table 7" });
  await assertNoErrors();
});

test("customer adds quantities and preparation instructions, places order and tracks it", async ({ page }) => {
  await prepareOffline(page, { state: null });
  const assertNoErrors = monitorPageErrors(page);
  await page.goto("/digital-menu/#menu&restaurant=res_cafe");
  await page.getByRole("textbox", { name: "Enter your name" }).fill("Menu Customer");
  await page.getByRole("textbox", { name: "Optional contact number" }).fill("9876543210");
  await page.getByRole("button", { name: "Continue to Menu" }).click();

  const dosa = page.locator(".poster-menu-item", { hasText: "Masala Dosa" });
  await dosa.getByRole("button", { name: "Add" }).click();
  await page.locator(".poster-menu-item", { hasText: "Masala Dosa" }).getByRole("button", { name: "Add one" }).click();
  await expect(page.locator("#cartCount")).toHaveText("2");
  await expect(page.locator("#cartTotal")).toHaveText("₹240");

  const sandwich = page.locator(".poster-menu-item", { hasText: "Paneer Sandwich" });
  await sandwich.getByRole("checkbox", { name: "Prepare instructions" }).check();
  await page.locator('#prepareInstructionForm input[value="Less spicy"]').check();
  await page.locator('#prepareInstructionForm textarea[name="customNote"]').fill("No butter");
  await page.getByRole("button", { name: "Save Instructions" }).click();
  await expect(page.locator("#cartCount")).toHaveText("3");

  await page.locator("#openCart").click();
  await expect(page.getByRole("heading", { name: "Your Cart" })).toBeVisible();
  await page.locator("#confirmPlaceOrder").click();
  await expect(page).toHaveURL(/#track&order=/);
  await expect(page.getByRole("heading", { name: "Order Received" })).toBeVisible();
  await expect(page.getByText("Your Food Is Being Prepared", { exact: true })).toHaveCount(0);
  const order = await page.evaluate(() => JSON.parse(localStorage.getItem("gravity58DigitalMenu")).orders[0]);
  expect(order.customerName).toBe("Menu Customer");
  expect(order.items.find((item) => item.name === "Masala Dosa").qty).toBe(2);
  expect(order.items.find((item) => item.name === "Paneer Sandwich").prepareInstruction).toContain("Less spicy");

  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem("gravity58DigitalMenu"));
    saved.orders[0].status = "Ready";
    localStorage.setItem("gravity58DigitalMenu", JSON.stringify(saved));
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Your Food Is Ready!" })).toBeVisible();
  await expect(page.getByText("Your order will be served soon", { exact: true })).toBeVisible();
  await expect(page.getByText("Your Food Is Being Prepared", { exact: true })).toHaveCount(0);
  await assertNoErrors();
});

test("digital-menu local account creation and password reset work", async ({ page }) => {
  await prepareOffline(page, { state: null });
  const assertNoErrors = monitorPageErrors(page);
  await page.goto("/digital-menu/");
  await page.locator("#newUser").click();
  await page.locator('#registerForm input[name="name"]').fill("New Owner");
  await page.locator('#registerForm input[name="email"]').fill("newowner@example.com");
  await page.locator('#registerForm input[name="password"]').fill("newpass123");
  await page.locator('#registerForm input[name="confirm"]').fill("newpass123");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page.getByRole("heading", { name: "Create your first Digital Menu" })).toBeVisible();
  await page.locator("#onboardingLogout").click();

  await page.locator("#forgot").click();
  await page.locator('#forgotForm input[name="email"]').fill("newowner@example.com");
  await page.locator('#forgotForm input[name="password"]').fill("updated123");
  await page.locator('#forgotForm input[name="confirm"]').fill("updated123");
  await page.getByRole("button", { name: "Reset Password" }).click();
  await page.locator('#loginForm input[name="email"]').fill("newowner@example.com");
  await page.locator('#loginForm input[name="password"]').fill("updated123");
  await page.locator("#loginForm").getByRole("button", { name: "Login" }).click();
  await expect(page.getByRole("heading", { name: "Create your first Digital Menu" })).toBeVisible();
  await assertNoErrors();
});
