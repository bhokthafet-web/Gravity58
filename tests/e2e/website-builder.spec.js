import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("marketplace shows ten templates and opens without authentication", async ({ page }) => {
  await page.goto("/templates/");
  await expect(page.getByRole("heading", { name: "Build Your Business Website. Free." })).toBeVisible();
  await expect(page.locator(".template-card")).toHaveCount(10);
  await expect(page.getByText("No account", { exact: false }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Edit" })).toHaveCount(10);
  await expect(page.getByRole("button", { name: "Download" })).toHaveCount(10);
  await expect(page.getByText(/login|create account|verify otp/i)).toHaveCount(0);
});

test("visitor edits content, adds a section and creates a page without login", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("g58BuilderGuideSeen", "1"));
  await page.goto("/templates/editor/?template=salon-spa");
  await page.getByRole("heading", { name: "Beauty that feels like you." }).click();
  await page.getByLabel("Text").fill("A beautiful website for every local business.");
  await expect(page.getByRole("heading", { name: "A beautiful website for every local business." })).toBeVisible();

  const before = await page.locator("[data-section-id]").count();
  await page.getByRole("button", { name: "+ Add Section" }).click();
  await page.locator(".library-card", { hasText: "FAQ" }).getByRole("button", { name: "stack" }).click();
  await expect(page.locator("[data-section-id]")).toHaveCount(before + 1);

  await page.getByRole("button", { name: /Pages/ }).click();
  await page.getByRole("button", { name: "+ Add Page" }).click();
  await page.getByLabel("Page name").fill("Offers");
  await page.getByRole("button", { name: "Add Page", exact: true }).click();
  await expect(page.getByRole("button", { name: /Offers 4/ })).toBeVisible();
  await expect(page.getByText("Offers", { exact: true }).first()).toBeVisible();

  await page.locator('[data-editor-region="navigation"]').click({ position: { x: 10, y: 10 } });
  await expect(page.getByText("Website header", { exact: true })).toBeVisible();
  await page.locator('[data-tool="elements"]').click();
  await page.locator('[data-add-element="price-card"]').click();
  await expect(page.locator(".wb-offer-card")).toHaveCount(1);
  await expect(page.locator(".wb-floating .wa svg")).toHaveCount(1);
  await expect(page.locator(".wb-floating .ig svg")).toHaveCount(1);

  await page.getByRole("button", { name: /Mobile/ }).click();
  await expect(page.locator("#canvasFrame")).toHaveClass(/viewport-mobile/);
  await expect(page.getByText(/login|create account|verify otp/i)).toHaveCount(0);
});

test("G58 integration links save locally and appear in preview", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("g58BuilderGuideSeen", "1"));
  await page.goto("/templates/editor/?template=clinic");
  await page.getByRole("button", { name: /G58 Links/ }).click();
  await page.getByLabel("G58 Booking URL").fill("https://g58.in/digit58/#customer-booking");
  await expect(page.getByLabel("G58 Booking URL")).toHaveValue("https://g58.in/digit58/#customer-booking");
  await expect(page.getByText("Saved on this device", { exact: false })).toBeVisible();
  await Promise.all([
    page.waitForURL(/\/templates\/preview\//),
    page.getByRole("link", { name: "Preview" }).click(),
  ]);
  await expect(page.getByRole("link", { name: "Book an Appointment" }).first()).toHaveAttribute("href", "https://g58.in/digit58/#customer-booking");
});

test("customized website downloads as a ZIP", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("g58BuilderGuideSeen", "1"));
  await page.route("https://images.unsplash.com/**", (route) => route.abort());
  await page.goto("/templates/editor/?template=organic-grocery");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download Website" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.zip$/);
  const zipPath = await download.path();
  const zipContents = (await readFile(zipPath)).toString("latin1");
  expect(zipContents).toContain("index.html");
  expect(zipContents).toContain("assets/css/style.css");
  expect(zipContents).toContain("assets/js/site.js");
  expect(zipContents).toContain("sitemap.xml");
  expect(zipContents).toContain("robots.txt");
  await expect(page.getByText("Complete website downloaded")).toBeVisible();
});
