import { test, expect } from "@playwright/test";
import { monitorPageErrors, prepareMockApi, prepareOffline } from "./helpers.js";

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
  await page.locator("#addItem").click();
  await page.locator('#itemForm input[name="name"]').fill("Regression Platter");
  await page.locator('#itemForm input[name="categoryName"]').fill("Regression Specials");
  await page.locator('#itemForm input[name="price"]').fill("299");
  await page.locator('#itemForm textarea[name="description"]').fill("Automated test menu item");
  await page.locator('#itemForm input[name="imageFile"]').setInputFiles({
    name: "regression.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nWQAAAAASUVORK5CYII=", "base64"),
  });
  await page.locator("#itemForm").getByRole("button", { name: "Save Menu Item" }).click();
  await expect(page.locator("#catFilter")).toContainText("Regression Specials");
  const itemCard = page.locator("#menuGrid .menu-item", { hasText: "Regression Platter" });
  await expect(itemCard).toBeVisible();
  await expect(itemCard.locator("img.menu-owner-photo")).toBeVisible();
  const localImageStorage = await page.evaluate(async () => {
    const localRecord = localStorage.getItem("gravity58DigitalMenu") || "";
    const saved = JSON.parse(localRecord);
    const item = saved.items.find((row) => row.name === "Regression Platter");
    const blob = await new Promise((resolve, reject) => {
      const open = indexedDB.open("gravity58LocalMedia", 1);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const request = open.result.transaction("images", "readonly").objectStore("images").get(item.imageKey);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      };
    });
    return { containsBase64: localRecord.includes("data:image/"), imageKey: item.imageKey, blobSize: blob?.size || 0 };
  });
  expect(localImageStorage.containsBase64).toBe(false);
  expect(localImageStorage.imageKey).toMatch(/^menu-item:/);
  expect(localImageStorage.blobSize).toBeGreaterThan(0);
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
  await acceptedCard.getByRole("button", { name: "Start Preparing" }).click();
  const preparingCard = page.locator("#ordersGrid .order-card", { hasText: "Preparing" }).first();
  await preparingCard.getByRole("button", { name: "Mark Ready" }).click();
  const readyCard = page.locator("#ordersGrid .order-card", { hasText: "Ready" }).first();
  await readyCard.getByRole("button", { name: "Complete" }).click();
  await expect(page.locator("#ordersGrid")).toContainText("Completed");
  await expect(page.locator("#ordersGrid")).not.toContainText("Delivered");

  await page.locator('[data-view="qr"]').click();
  await expect(page.locator("#qrcode [data-testid='qr-rendered']")).toBeVisible();
  await expect(page.locator(".qr-card")).not.toContainText("#menu&restaurant=res_cafe");
  await expect(page.locator("#copyQr")).toHaveText("Copy Menu Link");

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

test("mobile menu uses photo cards and keeps advertisement rail on the right", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepareOffline(page, { state: null });
  const assertNoErrors = monitorPageErrors(page);
  await page.goto("/digital-menu/#menu&restaurant=res_cafe");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(page.locator(".category-chip-strip")).toBeVisible();
  await expect(page.locator("#categoryWheel")).toHaveCount(0);
  const menuBox = await page.locator(".focused-menu-panel").boundingBox();
  const adBox = await page.locator(".vertical-ad-rail").boundingBox();
  expect(menuBox).toBeTruthy();
  expect(adBox).toBeTruthy();
  expect(adBox.x).toBeGreaterThan(menuBox.x);
  expect(adBox.y).toBeLessThan(menuBox.y + menuBox.height / 2);
  await assertNoErrors();
});

test("public menu offers premium category, veg, non-veg, search and availability filters", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepareOffline(page, { state: null });
  const assertNoErrors = monitorPageErrors(page);
  await page.goto("/digital-menu/#menu&restaurant=res_family");
  await page.getByRole("button", { name: "Close dialog" }).click();

  await expect(page.locator("#publicMenuCount")).toHaveText("3 items");
  await page.getByRole("button", { name: "Veg", exact: true }).click();
  await expect(page.locator("#publicMenuCount")).toHaveText("1 item");
  await expect(page.locator(".poster-menu-item:visible")).toContainText("Paneer Butter Masala");

  await page.getByRole("button", { name: "Non-Veg", exact: true }).click();
  await expect(page.locator("#publicMenuCount")).toHaveText("2 items");
  await page.locator("#publicMenuSearch").fill("biryani");
  await expect(page.locator("#publicMenuCount")).toHaveText("1 item");
  await expect(page.locator(".poster-menu-item:visible")).toContainText("Chicken Biryani");

  await page.locator("#publicMenuSearch").fill("");
  await page.getByRole("button", { name: "All", exact: true }).click();
  await page.getByRole("button", { name: "Main Course", exact: true }).click();
  await expect(page.locator("#publicMenuHeading")).toHaveText("Main Course");
  await expect(page.locator("#publicMenuCount")).toHaveText("2 items");
  await page.locator("label.availability-filter").click();
  await expect(page.locator("#publicMenuCount")).toHaveText("2 items");
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
    saved.orders[0].status = "Preparing";
    localStorage.setItem("gravity58DigitalMenu", JSON.stringify(saved));
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Order Preparing" })).toBeVisible();
  await expect(page.locator(".pot-scene")).toBeVisible();

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

test("restaurant owner can permanently delete a restaurant and its local records", async ({ page }) => {
  await prepareOffline(page, { state: null });
  const assertNoErrors = monitorPageErrors(page);
  page.on("dialog", (dialog) => dialog.accept());
  await loginDemoOwner(page);
  await page.locator('[data-view="restaurants"]').click();
  const restaurant = page.locator(".restaurant-card", { hasText: "Gravity58 Cloud Kitchen" });
  await restaurant.getByRole("button", { name: "Delete" }).click();
  await expect(page.locator(".restaurant-grid")).not.toContainText("Gravity58 Cloud Kitchen");
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("gravity58DigitalMenu")));
  expect(saved.restaurants.some((row) => row.id === "res_cloud")).toBe(false);
  expect(saved.items.some((row) => row.restaurantId === "res_cloud")).toBe(false);
  await assertNoErrors();
});

test("existing Gravity58 account can open restaurant setup while menu data stays local", async ({ page }) => {
  await prepareMockApi(page, { initialUser: { $id: "cloud-owner-1", email: "owner@example.com", name: "Cloud Owner" }, state: null });
  const assertNoErrors = monitorPageErrors(page);
  await page.goto("/digital-menu/");
  await expect(page.getByRole("heading", { name: "Create your first Digital Menu" })).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("gravity58DigitalMenu")));
  expect(saved.session).toMatchObject({ userId: "g58_cloud-owner-1", provider: "gravity58" });
  expect(saved.users.find((row) => row.id === "g58_cloud-owner-1")).toMatchObject({ email: "owner@example.com", provider: "gravity58" });
  await assertNoErrors();
});

test("owner can download a portable config and generate a customer menu link", async ({ page }) => {
  await prepareOffline(page, { state: null });
  const assertNoErrors = monitorPageErrors(page);
  await loginDemoOwner(page);
  await page.locator('[data-view="publish"]').click();
  await expect(page.getByRole("heading", { name: "Publish & Setup" })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download Menu Config" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("gravity58-cafe-g58-menu.json");

  await page.locator('#publishUrlForm input[name="configUrl"]').fill("https://menus.example.com/gravity58-cafe.json");
  await page.getByRole("button", { name: "Save URL & Generate Link" }).click();
  await expect(page.locator("#publishResult")).toContainText("CUSTOMER MENU LINK");
  await expect(page.locator("#publishedMenuQr [data-testid='qr-rendered']")).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("gravity58DigitalMenu")).restaurants.find((row) => row.id === "res_cafe"));
  expect(saved.publishedConfigUrl).toBe("https://menus.example.com/gravity58-cafe.json");
  await assertNoErrors();
});

test("customer can load a hosted static config without menu records in Appwrite", async ({ page }) => {
  await prepareOffline(page, { state: null });
  const assertNoErrors = monitorPageErrors(page);
  const hostedConfig = {
    g58MenuConfig: 1,
    restaurant: { id: "published-cafe", name: "Published Café", type: "Café", city: "Hyderabad", description: "Static hosted menu", address: "High Street", phone: "+91 9000000000", open: true, restaurantKey: "Published Café|Hyderabad" },
    categories: [{ id: "published-cat", name: "Chef Specials" }],
    items: [{ id: "published-item", categoryId: "published-cat", name: "Premium Bowl", description: "Customer-visible static dish", price: 249, type: "Veg", available: true, prep: 12, imageData: "" }],
  };
  await page.route("https://menus.example.com/published-cafe.json", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify(hostedConfig) }));
  await page.goto(`/digital-menu/#menu&config=${encodeURIComponent("https://menus.example.com/published-cafe.json")}`);
  await expect(page.getByRole("heading", { name: "Published Café" })).toBeVisible();
  await expect(page.getByText("Published customer menu")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Premium Bowl" })).toBeVisible();
  await expect(page.getByText("View-only published menu")).toBeVisible();
  await expect(page.getByRole("button", { name: "ADD" })).toHaveCount(0);
  await expect(page.locator("#modal")).toHaveCount(0);
  await expect(page.locator(".vertical-ad-rail")).toBeVisible();
  await assertNoErrors();
});
