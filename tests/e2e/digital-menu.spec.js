import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { monitorPageErrors, prepareMockApi, prepareOffline } from "./helpers.js";

async function loginDemoOwner(page) {
  await page.goto("/digital-menu/");
  await page.locator('#loginForm input[name="email"]').fill("testing@g58.in");
  await page.locator('#loginForm input[name="password"]').fill("test123");
  await page.locator("#loginForm").getByRole("button", { name: "Login" }).click();
  await expect(page.getByRole("heading", { name: /Gravity58 Café/ })).toBeVisible();
}

test("restaurant owner imports CSV, controls availability, orders, QR, reports and settings", async ({ page }) => {
  await prepareOffline(page, { state: null });
  const assertNoErrors = monitorPageErrors(page);
  page.on("dialog", (dialog) => dialog.accept());
  await loginDemoOwner(page);

  await expect(page.locator("#openImageCompressor")).toHaveCount(0);
  await page.locator('[data-view="menu"]').click();
  await expect(page.locator("#openImageCompressor")).toBeVisible();
  await page.locator("#openImageCompressor").click();
  await page.locator("#compressorFile").setInputFiles({
    name: "restaurant.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZkMcAAAAASUVORK5CYII=", "base64"),
  });
  await expect(page.locator("#compressorResult")).toContainText("KB JPG ready");
  await expect(page.locator("#downloadCompressedImage")).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#downloadCompressedImage").click();
  const compressedDownload = await downloadPromise;
  expect(compressedDownload.suggestedFilename()).toBe("restaurant-g58.jpg");
  const compressedPath = await compressedDownload.path();
  const compressedBytes = await readFile(compressedPath);
  expect(compressedBytes.subarray(0, 2).toString("hex")).toBe("ffd8");
  expect(compressedBytes.length).toBeLessThanOrEqual(100 * 1024);
  await page.getByRole("button", { name: "Close dialog" }).click();

  await expect(page.locator("#addItem")).toHaveCount(0);
  const csv = "category,item_name,description,price,food_type,available,preparation_minutes,preparation_instructions,image_file\nRegression Specials,Regression Platter,Automated test menu item,299,Veg,true,12,false,\n";
  await page.locator("#menuCsvFile").setInputFiles({ name: "menu.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await expect(page.locator("#catFilter")).toContainText("Regression Specials");
  const itemCard = page.locator("#menuGrid .menu-item", { hasText: "Regression Platter" });
  await expect(itemCard).toBeVisible();
  await expect(itemCard.locator(".media-fallback")).toBeVisible();
  await itemCard.getByRole("button", { name: "Out of stock" }).click();
  await expect(page.locator("#menuGrid .menu-item", { hasText: "Regression Platter" })).toContainText("Out of stock");
  await page.locator("#menuGrid .menu-item", { hasText: "Regression Platter" }).getByRole("button", { name: "Make available" }).click();

  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem("gravity58DigitalMenu"));
    const pending = saved.orders.find((row) => row.restaurantId === "res_cafe" && row.status === "Pending");
    Object.assign(pending, { serviceMode: "table", tableNumber: "2", customerName: "Table Guest", tokenNumber: 7, messages: [] });
    localStorage.setItem("gravity58DigitalMenu", JSON.stringify(saved));
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: /Gravity58 Café/ })).toBeVisible();

  await page.locator('[data-view="orders"]').click();
  await expect(page.locator("#ordersGrid")).toContainText("Pending");
  let pendingCard = page.locator("#ordersGrid .order-card", { hasText: "Pending" }).first();
  await expect(pendingCard.locator(".incoming-order-beacon")).toBeVisible();
  await expect(pendingCard).toContainText("TOKEN 0007");
  await pendingCard.getByRole("button", { name: "Correct table" }).click();
  await page.locator("#correctTableNumber").fill("12");
  await page.getByRole("button", { name: "Update table" }).click();
  pendingCard = page.locator("#ordersGrid .order-card", { hasText: "Pending" }).first();
  await expect(pendingCard).toContainText("Table 12");
  await pendingCard.getByRole("textbox", { name: "Message customer" }).fill("Your table is now 12");
  await pendingCard.locator("[data-order-chat]").getByRole("button", { name: "Send" }).click();
  pendingCard = page.locator("#ordersGrid .order-card", { hasText: "Pending" }).first();
  await expect(pendingCard).toContainText("Your table is now 12");
  await pendingCard.getByRole("button", { name: "Print" }).click();
  await expect(page.locator(".receipt-print-frame")).toHaveCount(1);
  await pendingCard.getByRole("button", { name: "Accept" }).click();
  await expect(page.locator("#ordersGrid")).toContainText("Accepted");
  const acceptedCard = page.locator("#ordersGrid .order-card", { hasText: "Accepted" }).first();
  await expect(acceptedCard.locator(".incoming-order-beacon")).toHaveCount(0);
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
  await removable.getByRole("button", { name: "Remove" }).click();
  await expect(page.locator("#menuGrid")).not.toContainText("Regression Platter");
  await assertNoErrors();
});

test("customer QR entry requires a customer name or table number", async ({ page }) => {
  await prepareOffline(page, { state: null });
  const assertNoErrors = monitorPageErrors(page);
  await page.goto("/digital-menu/#menu&restaurant=res_cafe");
  await expect(page.locator("#modal")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Close dialog" })).toHaveCount(0);
  await page.keyboard.press("Escape");
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

test("mobile menu uses photo cards and keeps the advertisement beside the restaurant header", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepareOffline(page, { state: null });
  const assertNoErrors = monitorPageErrors(page);
  await page.goto("/digital-menu/#menu&restaurant=res_cafe");
  await page.getByRole("textbox", { name: "Enter your name" }).fill("Mobile Guest");
  await page.getByRole("button", { name: "Continue to Menu" }).click();
  await expect(page.locator("#publicMenuCategory")).toBeVisible();
  await expect(page.locator(".category-chip-strip")).toHaveCount(0);
  await expect(page.locator("#publicMenuSort")).toHaveCount(0);
  await expect(page.locator("#categoryWheel")).toHaveCount(0);
  const heroBox = await page.locator(".compact-menu-hero").boundingBox();
  const adBox = await page.locator(".header-ad-panel").boundingBox();
  expect(heroBox).toBeTruthy();
  expect(adBox).toBeTruthy();
  expect(adBox.x).toBeGreaterThan(heroBox.x);
  expect(Math.abs(adBox.y - heroBox.y)).toBeLessThan(5);
  expect(heroBox.height).toBeLessThanOrEqual(140);
  expect(adBox.height).toBeLessThanOrEqual(140);
  const cartBox = await page.locator(".cart-bar").boundingBox();
  const cartButtonFontSize = await page.locator("#openCart").evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
  expect(cartBox.height).toBeLessThanOrEqual(38);
  expect(cartButtonFontSize).toBeLessThanOrEqual(10);
  await assertNoErrors();
});

test("public menu offers premium category, veg, non-veg, search and availability filters", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepareOffline(page, { state: null });
  const assertNoErrors = monitorPageErrors(page);
  await page.goto("/digital-menu/#menu&restaurant=res_family");
  await page.getByRole("textbox", { name: "Enter your name" }).fill("Filter Guest");
  await page.getByRole("button", { name: "Continue to Menu" }).click();

  await expect(page.locator("#publicMenuCount")).toHaveText("3 items");
  const firstNonVeg = page.locator(".poster-menu-item", { hasText: "Chicken 65" });
  await expect(firstNonVeg.locator(".poster-meta")).toBeVisible();
  await expect(firstNonVeg.locator(".poster-meta")).toContainText("Non-Veg");
  const itemBoundary = await firstNonVeg.evaluate((element) => {
    const style = getComputedStyle(element);
    return { borderWidth: parseFloat(style.borderTopWidth), radius: parseFloat(style.borderTopLeftRadius) };
  });
  expect(itemBoundary.borderWidth).toBeGreaterThanOrEqual(1);
  expect(itemBoundary.radius).toBeGreaterThanOrEqual(12);
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
  await page.locator("#publicMenuCategory").selectOption({ label: "Main Course" });
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
  await page.locator('#prepareInstructionForm input[value="Medium spicy"]').check();
  await page.locator('#prepareInstructionForm textarea[name="customNote"]').fill("No butter");
  await page.getByRole("button", { name: "Save Instructions" }).click();
  await expect(page.locator("#cartCount")).toHaveText("3");

  await page.locator("#openCart").click();
  await expect(page.getByRole("heading", { name: "Your Cart" })).toBeVisible();
  await page.locator("#confirmPlaceOrder").click();
  await expect(page).toHaveURL(/#track&order=/);
  await expect(page.getByRole("heading", { name: "Order Received" })).toBeVisible();
  await expect(page.getByText("Your Food Is Being Prepared", { exact: true })).toHaveCount(0);
  await expect(page.locator(".customer-token-panel strong")).toHaveText(/\d{4}/);
  await expect(page.locator("#refreshTrack")).toHaveCount(0);
  await expect(page.locator(".customer-chat-toggle")).toBeVisible();
  await expect(page.locator(".customer-chat-panel")).not.toBeVisible();
  await page.locator(".customer-chat-toggle").click();
  await expect(page.locator(".customer-chat-panel")).toBeVisible();
  await page.getByRole("textbox", { name: "Message restaurant" }).fill("Please confirm my order");
  await page.locator("[data-customer-chat]").getByRole("button", { name: "Send" }).click();
  await expect(page.locator(".customer-order-chat")).toContainText("Please confirm my order");
  const order = await page.evaluate(() => JSON.parse(localStorage.getItem("gravity58DigitalMenu")).orders[0]);
  expect(order.customerName).toBe("Menu Customer");
  expect(order.tokenNumber).toBeGreaterThan(0);
  expect(order.messages.at(-1)).toMatchObject({ senderRole: "customer", text: "Please confirm my order" });
  expect(order.items.find((item) => item.name === "Masala Dosa").qty).toBe(2);
  expect(order.items.find((item) => item.name === "Paneer Sandwich").prepareInstruction).toContain("Medium spicy");

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
  const readyPeep = await page.evaluate(() => sessionStorage.getItem(`gravity58ReadyPeep_${JSON.parse(localStorage.getItem("gravity58DigitalMenu")).orders[0].id}`));
  expect(readyPeep).toBe("1");
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
  await page.locator("#registerForm").getByRole("button", { name: "Create Account" }).click();
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

test("existing Gravity58 account can open its account-scoped restaurant setup", async ({ page }) => {
  await prepareMockApi(page, { initialUser: { $id: "cloud-owner-1", email: "owner@example.com", name: "Cloud Owner" }, state: null });
  const assertNoErrors = monitorPageErrors(page);
  await page.goto("/digital-menu/");
  await expect(page.getByRole("heading", { name: "Create your first Digital Menu" })).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("gravity58DigitalMenu")));
  expect(saved.session).toMatchObject({ userId: "g58_cloud-owner-1", provider: "gravity58" });
  expect(saved.users.find((row) => row.id === "g58_cloud-owner-1")).toMatchObject({ email: "owner@example.com", provider: "gravity58" });
  await assertNoErrors();
});

test("restaurant menu loads from the signed-in account and CSV changes persist to Appwrite", async ({ page }) => {
  const cloudMenu = {
    id: "cloud-cafe",
    ownerId: "cloud-owner-1",
    schemaVersion: 2,
    restaurant: { id: "cloud-cafe", name: "Cloud Account Café", type: "Café", city: "Hyderabad", description: "Account menu", address: "Central Road", phone: "+91 9000000000", open: true, accepting: true, tax: 5, service: 0, identification: "Customer Name", restaurantKey: "Cloud Account Café|Hyderabad", social: {} },
    categories: [{ id: "cloud-drinks", name: "Drinks" }],
    items: [{ id: "cloud-tea", categoryId: "cloud-drinks", name: "Masala Tea", description: "Fresh tea", price: 40, type: "Veg", available: true, prep: 5, prepareInstructionsEnabled: false, imageUrl: "" }],
  };
  await prepareMockApi(page, { initialUser: { $id: "cloud-owner-1", email: "owner@example.com", name: "Cloud Owner" }, state: null, seed: { "digital_menu_cloud-owner-1": [cloudMenu] } });
  const assertNoErrors = monitorPageErrors(page);
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/digital-menu/");
  await expect(page.getByRole("heading", { name: /Cloud Account Café/ })).toBeVisible();
  await expect(page.getByText("Menu synced")).toHaveText("Menu synced");

  await page.locator('[data-view="menu"]').click();
  await expect(page.locator("#menuGrid")).toContainText("Masala Tea");
  await page.getByRole("button", { name: "+ Add Menu Item" }).click();
  await page.getByLabel("Item name").fill("Paneer Tikka");
  await page.getByLabel("Category").fill("Starters");
  await page.getByLabel("Price (₹)").fill("220");
  await page.getByLabel("Description").fill("Char-grilled paneer");
  await page.getByLabel("Allow customer preparation instructions").check();
  await page.getByLabel("Food image").setInputFiles({
    name: "paneer-tikka.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZkMcAAAAASUVORK5CYII=", "base64"),
  });
  await page.getByRole("button", { name: "Add Menu Item", exact: true }).click();
  const manualItem = page.locator(".menu-item", { hasText: "Paneer Tikka" });
  await expect(manualItem).toContainText("₹220");
  await manualItem.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Price (₹)").fill("230");
  await page.getByRole("button", { name: "Save Changes" }).click();
  await expect(page.locator(".menu-item", { hasText: "Paneer Tikka" })).toContainText("₹230");
  const manualStored = await page.evaluate(() => window.__g58Mock.store["digital_menu_cloud-owner-1"][0]);
  expect(manualStored.items.find((row) => row.name === "Paneer Tikka")).toMatchObject({ price: 230, categoryId: expect.any(String), available: true, prepareInstructionsEnabled: true, imageUrl: "https://media.example.com/paneer-tikka.png" });
  const accessRepair = await page.evaluate(() => window.__g58Mock.permissionCalls.find((row) => row.action === "update" && row.id === "cloud-cafe"));
  expect(accessRepair.permissions).toContain("read:any");

  await page.locator("#menuImageFiles").setInputFiles({
    name: "cold-coffee.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZkMcAAAAASUVORK5CYII=", "base64"),
  });
  await expect(page.locator("#imageSelectionStatus")).toContainText("1 food image");
  const csv = [
    "category,item_name,description,price,food_type,available,preparation_minutes,preparation_instructions,image_file",
    'Drinks,"Cold Coffee","Chilled coffee",140,Veg,true,6,false,cold-coffee.png',
    'Main Course,"Chicken Biryani","Account imported dish",340,Non-Veg,false,25,true,',
  ].join("\n");
  await page.locator("#menuCsvFile").setInputFiles({ name: "menu.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await expect(page.locator("#menuGrid")).toContainText("Cold Coffee");
  await expect(page.locator("#menuGrid")).toContainText("Chicken Biryani");
  const stored = await page.evaluate(() => window.__g58Mock.store["digital_menu_cloud-owner-1"][0]);
  expect(stored.ownerId).toBe("cloud-owner-1");
  expect(stored.items.find((row) => row.name === "Cold Coffee")).toMatchObject({ price: 140, available: true, imageUrl: "https://media.example.com/cold-coffee.png", imageFileId: expect.stringMatching(/^mock-menu-/) });
  expect(stored.items.find((row) => row.name === "Chicken Biryani")).toMatchObject({ type: "Non-Veg", available: false, prepareInstructionsEnabled: true });
  expect(stored.orders).toBeUndefined();

  await page.locator("#menuImageFiles").setInputFiles({ name: "too-large.png", mimeType: "image/png", buffer: Buffer.alloc(100 * 1024 + 1) });
  const oversizedCsv = "category,item_name,price,image_file\nDrinks,Large Image Item,50,too-large.png\n";
  await page.locator("#menuCsvFile").setInputFiles({ name: "oversized.csv", mimeType: "text/csv", buffer: Buffer.from(oversizedCsv) });
  await expect(page.locator("#toast")).toContainText("100 KB or smaller");
  await expect(page.locator("#menuGrid")).not.toContainText("Large Image Item");

  await page.locator("#menuImportMode").selectOption("replace");
  const replacementCsv = "category,item_name,description,price,food_type,available\nChef Specials,Replacement Meal,Fresh replacement,225,Veg,true\n";
  await page.locator("#menuCsvFile").setInputFiles({ name: "replacement.csv", mimeType: "text/csv", buffer: Buffer.from(replacementCsv) });
  await expect(page.locator("#toast")).toContainText("replaced the previous menu");
  await expect(page.locator("#menuGrid")).toContainText("Replacement Meal");
  await expect(page.locator("#menuGrid")).not.toContainText("Masala Tea");
  await expect(page.locator("#menuGrid")).not.toContainText("Cold Coffee");
  const replaced = await page.evaluate(() => window.__g58Mock.store["digital_menu_cloud-owner-1"][0]);
  expect(replaced.items.map((row) => row.name)).toEqual(["Replacement Meal"]);

  await page.locator('[data-view="qr"]').click();
  const qrText = await page.locator("#qrcode").getAttribute("data-qr-text");
  expect(qrText).toContain("cloud=cloud-cafe");
  expect(qrText).toContain("owner=cloud-owner-1");
  await assertNoErrors();
});

test("customer can load the latest account menu on another device", async ({ page }) => {
  const cloudMenu = {
    id: "public-cloud-cafe",
    ownerId: "public-owner",
    schemaVersion: 2,
    restaurant: { id: "public-cloud-cafe", name: "Public Cloud Café", type: "Restaurant", city: "Hyderabad", description: "Loaded from Appwrite", address: "Market Road", phone: "+91 9888888888", open: true, accepting: true, tax: 5, service: 0, identification: "Customer Name", restaurantKey: "Public Cloud Café|Hyderabad", social: {}, logoImageUrl: "https://cdn.example.com/restaurant.jpg" },
    categories: [{ id: "specials", name: "Specials" }],
    items: [{ id: "cloud-meal", categoryId: "specials", name: "Cloud Meal", description: "Visible on every device", price: 299, type: "Veg", available: true, prep: 12, prepareInstructionsEnabled: false, imageUrl: "https://cdn.example.com/cloud-meal.jpg" }],
  };
  await prepareMockApi(page, { state: null, seed: { "digital_menu_public-owner": [cloudMenu] } });
  const assertNoErrors = monitorPageErrors(page);
  await page.goto("/digital-menu/#menu&cloud=public-cloud-cafe&owner=public-owner");
  await expect(page.getByRole("heading", { name: "Public Cloud Café", exact: true })).toBeVisible();
  await expect(page.getByText("Live account menu")).toBeVisible();
  await page.getByRole("textbox", { name: "Enter your name" }).fill("Cloud Guest");
  await page.getByRole("button", { name: "Continue to Menu" }).click();
  await expect(page.getByRole("heading", { name: "Cloud Meal" })).toBeVisible();
  await expect(page.locator('.poster-menu-item img[src="https://cdn.example.com/cloud-meal.jpg"]')).toBeVisible();
  await expect(page.locator('.compact-hero-photo[src="https://cdn.example.com/restaurant.jpg"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "ADD" })).toBeVisible();
  await page.getByRole("button", { name: "ADD" }).click();
  await expect(page.locator('.compact-hero-photo[src="https://cdn.example.com/restaurant.jpg"]')).toBeVisible();
  await expect(page.locator('.compact-hero-photo[src="https://cdn.example.com/cloud-meal.jpg"]')).toHaveCount(0);
  await assertNoErrors();
});

test("simultaneous cloud orders receive unique serial tokens and remain independently trackable", async ({ page }) => {
  const cloudMenu = {
    id: "queue-cafe", ownerId: "queue-owner", schemaVersion: 2,
    restaurant: { id: "queue-cafe", name: "Queue Café", type: "Café", city: "Hyderabad", description: "Live queue test", address: "Queue Road", phone: "+91 9000000000", open: true, accepting: true, tax: 0, service: 0, identification: "Customer Name", restaurantKey: "Queue Café|Hyderabad", social: {} },
    categories: [{ id: "quick", name: "Quick Bites" }],
    items: [{ id: "queue-tea", categoryId: "quick", name: "Queue Tea", description: "Fresh tea", price: 40, type: "Veg", available: true, prep: 5, prepareInstructionsEnabled: false }],
  };
  await prepareMockApi(page, { state: null, seed: { "digital_menu_queue-owner": [cloudMenu] } });
  const assertNoErrors = monitorPageErrors(page);
  await page.goto("/digital-menu/#menu&cloud=queue-cafe&owner=queue-owner");
  await page.getByRole("textbox", { name: "Enter your name" }).fill("Queue Customer");
  await page.getByRole("button", { name: "Continue to Menu" }).click();

  for (let index = 0; index < 2; index += 1) {
    await page.getByRole("button", { name: "ADD" }).click();
    await page.locator("#openCart").click();
    await page.locator("#confirmPlaceOrder").click();
    await expect(page.locator(".customer-token-panel strong")).toHaveText(index === 0 ? "0001" : "0002");
    if (index === 0) await page.getByRole("button", { name: "View Menu" }).click();
  }

  const result = await page.evaluate(() => ({
    tokens: window.__g58Mock.store["digital_order_queue-owner"].map((row) => row.tokenNumber).sort((a, b) => a - b),
    reservations: window.__g58Mock.store["digital_token_queue-owner"].map((row) => row.tokenNumber).sort((a, b) => a - b),
    orderPermissions: window.__g58Mock.permissionCalls.filter((row) => row.action === "create" && row.kind === "digital_order_queue-owner").map((row) => row.permissions),
    tokenPermissions: window.__g58Mock.permissionCalls.filter((row) => row.action === "create" && row.kind === "digital_token_queue-owner").map((row) => row.permissions),
  }));
  expect(result.tokens).toEqual([1, 2]);
  expect(result.reservations).toEqual([1, 2]);
  expect(result.orderPermissions.every((permissions) => permissions.includes("read:users") && permissions.includes("update:users"))).toBe(true);
  expect(result.tokenPermissions.every((permissions) => !permissions.some((permission) => permission.includes("queue-owner")))).toBe(true);
  await assertNoErrors();
});

test("restaurant dashboard receives a new cloud order without a manual refresh", async ({ page }) => {
  const cloudMenu = {
    id: "live-cafe", ownerId: "live-owner", schemaVersion: 2,
    restaurant: { id: "live-cafe", name: "Live Café", type: "Café", city: "Hyderabad", description: "Realtime kitchen", open: true, accepting: true, tax: 0, service: 0, identification: "Table Number", restaurantKey: "Live Café|Hyderabad", social: {} },
    categories: [], items: [],
  };
  await prepareMockApi(page, { initialUser: { $id: "live-owner", email: "live@example.com", name: "Live Owner" }, state: null, seed: { "digital_menu_live-owner": [cloudMenu], "digital_order_live-owner": [] } });
  const assertNoErrors = monitorPageErrors(page);
  await page.goto("/digital-menu/");
  await expect(page.getByRole("heading", { name: /Live Café/ })).toBeVisible();

  await page.evaluate(async () => {
    await window.Gravity58Ads.create("digital_order_live-owner", {
      id: "LIVE-ORDER-1", ownerId: "live-owner", cloudOwnerId: "live-owner", restaurantId: "live-cafe",
      customerName: "Realtime Guest", customer: "Realtime Guest · Table 4", serviceMode: "table", tableNumber: "4",
      tokenNumber: 11, orderDay: "20260809", items: [{ name: "Tea", qty: 2, price: 40 }], total: 80,
      paymentMethod: "counter", paymentStatus: "Not required", status: "Pending", messages: [], createdAt: new Date().toISOString(),
    }, "LIVE-ORDER-1", []);
  });

  const liveCard = page.locator(".order-card", { hasText: "Realtime Guest" });
  await expect(liveCard).toBeVisible();
  await expect(liveCard).toContainText("TOKEN 0011");
  await expect(liveCard.locator(".incoming-order-beacon")).toBeVisible();
  await liveCard.getByRole("button", { name: "Accept" }).click();
  const acceptedLiveCard = page.locator(".order-card", { hasText: "Realtime Guest" });
  await expect(acceptedLiveCard).toContainText("Accepted");
  await expect(acceptedLiveCard.locator(".incoming-order-beacon")).toHaveCount(0);
  await assertNoErrors();
});

test("older customer links recover a missing owner and repair the URL", async ({ page }) => {
  const cloudMenu = {
    id: "ownerless-cafe",
    ownerId: "recovered-owner",
    schemaVersion: 2,
    restaurant: { id: "ownerless-cafe", name: "Recovered Café", type: "Café", city: "Hyderabad", open: true, accepting: true, tax: 5, service: 0, identification: "Customer Name", restaurantKey: "Recovered Café|Hyderabad", social: {} },
    categories: [{ id: "drinks", name: "Drinks" }],
    items: [{ id: "tea", categoryId: "drinks", name: "Fresh Tea", price: 40, type: "Veg", available: true }],
  };
  await prepareMockApi(page, { state: null, seed: { "digital_menu_public": [cloudMenu] } });
  const assertNoErrors = monitorPageErrors(page);
  await page.goto("/digital-menu/#menu?cloud=ownerless-cafe");
  await expect(page.getByRole("heading", { name: "Recovered Café", exact: true })).toBeVisible();
  await expect(page).toHaveURL(/#menu&cloud=ownerless-cafe&owner=recovered-owner$/);
  await page.getByRole("textbox", { name: "Enter your name" }).fill("Recovered Guest");
  await page.getByRole("button", { name: "Continue to Menu" }).click();
  await expect(page.getByRole("heading", { name: "Fresh Tea" })).toBeVisible();
  await assertNoErrors();
});

test("owner gets an automatic G58 Cloud customer menu link", async ({ page }) => {
  const cloudMenu = {
    id: "share-cafe", ownerId: "share-owner", schemaVersion: 2,
    restaurant: { id: "share-cafe", name: "Share Café", type: "Café", city: "Hyderabad", open: true, accepting: true, tax: 5, service: 0, identification: "Customer Name", restaurantKey: "Share Café|Hyderabad", social: {} },
    categories: [], items: [],
  };
  await prepareMockApi(page, { initialUser: { $id: "share-owner", email: "share@example.com", name: "Share Owner" }, state: null, seed: { "digital_menu_share-owner": [cloudMenu] } });
  const assertNoErrors = monitorPageErrors(page);
  await page.goto("/digital-menu/");
  await page.locator('[data-view="publish"]').click();
  await expect(page.getByRole("heading", { name: "Share Menu" })).toBeVisible();
  await expect(page.locator("#cloudMenuQr [data-testid='qr-rendered']")).toBeVisible();
  await expect(page.locator("#page")).toContainText("cloud=share-cafe");
  await expect(page.locator("#publishUrlForm")).toHaveCount(0);
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
  await expect(page.locator(".header-ad-panel")).toBeVisible();
  await assertNoErrors();
});
