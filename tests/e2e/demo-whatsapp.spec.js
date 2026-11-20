import { test, expect } from "@playwright/test";
import { monitorPageErrors, prepareMockApi } from "./helpers.js";

const WA = /^https:\/\/wa\.me\/919391523275\?text=/;

test("the WhatsApp icon sits in the bottom-left corner of public pages", async ({ page }) => {
  await prepareMockApi(page, { state: null });
  const assertNoErrors = monitorPageErrors(page);
  for (const path of ["/", "/pricing/", "/demo/"]) {
    await page.goto(path);
    const icon = page.locator("a.g58-wa-float");
    await expect(icon).toBeVisible();
    await expect(icon).toHaveAttribute("href", WA);
    await expect(icon).toHaveAttribute("aria-label", "Chat with Gravity58 on WhatsApp");
    const box = await icon.boundingBox();
    const viewport = page.viewportSize();
    expect(box.x).toBeGreaterThanOrEqual(8);
    expect(box.x).toBeLessThan(40);
    const gap = viewport.height - (box.y + box.height);
    expect(gap).toBeGreaterThanOrEqual(8); // fully on screen, not clipped by the bottom edge
    expect(gap).toBeLessThan(40);
    // A page that overflows sideways widens the phone's layout area and pushes fixed buttons off screen.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await assertNoErrors();
});

test("app screens do not show the sales WhatsApp icon", async ({ page }) => {
  await prepareMockApi(page, { state: null });
  await page.goto("/digital-menu/");
  await expect(page.locator("a.g58-wa-float")).toHaveCount(0);
});

test("homepage 'Book a Free Demo' opens the demo page", async ({ page }) => {
  await prepareMockApi(page, { state: null });
  await page.goto("/");
  await page.locator(".hero-v2-ctas").getByRole("link", { name: "Book a Free Demo" }).click();
  await expect(page).toHaveURL(/\/demo\/$/);
  await expect(page.getByRole("heading", { name: "Book a free demo" })).toBeVisible();
});

test("a demo request needs a name, a valid number and a purpose, then reaches the team", async ({ page }) => {
  await prepareMockApi(page, { state: null });
  const assertNoErrors = monitorPageErrors(page);
  await page.goto("/demo/");
  const note = page.locator("#demoNote");
  await expect(page.locator("#demoPurpose option")).toHaveText(["Choose what you want a demo of", "Refills", "Booking", "Digital Menu"]);

  await page.getByRole("button", { name: "Request Demo" }).click();
  await expect(note).toContainText("enter your name");
  await page.locator("#demoName").fill("Anita Rao");
  await page.locator("#demoPhone").fill("12345");
  await page.getByRole("button", { name: "Request Demo" }).click();
  await expect(note).toContainText("valid contact number");
  await page.locator("#demoPhone").fill("+91 98765 43210");
  await page.getByRole("button", { name: "Request Demo" }).click();
  await expect(note).toContainText("what you want a demo of");

  await page.getByRole("button", { name: /^Booking/ }).click();
  await expect(page.locator("#demoPurpose")).toHaveValue("Booking");
  await expect(page.getByRole("button", { name: /^Booking/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Request Demo" }).click();

  await expect(page.getByRole("heading", { name: "Thank you!" })).toBeVisible();
  await expect(page.locator("#demoThanksText")).toContainText("Booking demo");
  await expect(page.locator("#demoForm")).toBeHidden();
  const saved = await page.evaluate(() => window.__g58Mock.store.g58_contact_requests);
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({ name: "Anita Rao", phone: "+91 98765 43210", interest: "Booking", requestType: "Demo", source: "demo-page" });
  await assertNoErrors();
});

test("the demo page can be opened with a product already chosen, and bots are ignored", async ({ page }) => {
  await prepareMockApi(page, { state: null });
  await page.goto("/demo/?for=digital-menu");
  await expect(page.locator("#demoPurpose")).toHaveValue("Digital Menu");
  await page.locator("#demoName").fill("Bot Name");
  await page.locator("#demoPhone").fill("9876543210");
  await page.locator("#demoWebsite").evaluate((input) => { input.value = "http://spam.example"; });
  await page.getByRole("button", { name: "Request Demo" }).click();
  await expect(page.getByRole("heading", { name: "Thank you!" })).toBeVisible();
  const saved = await page.evaluate(() => window.__g58Mock.store.g58_contact_requests || []);
  expect(saved).toHaveLength(0);
});

test("team admin shows demo requests with a Demo tag and a filter", async ({ page }) => {
  const seed = {
    g58_contact_requests: [
      { id: "c1", name: "Plain Contact", phone: "9000000001", interest: "POS", createdAt: new Date().toISOString() },
      { id: "c2", name: "Demo Person", phone: "9000000002", interest: "Booking", requestType: "Demo", source: "demo-page", createdAt: new Date().toISOString() },
    ],
  };
  await prepareMockApi(page, { admin: true, seed, state: null });
  const assertNoErrors = monitorPageErrors(page);
  await page.goto("/team-admin/");
  await page.locator('#login input[name="email"]').fill("admin@g58.in");
  await page.locator('#login input[name="password"]').fill("testing123");
  await page.locator("#login").getByRole("button", { name: "Secure Login" }).click();
  await page.locator('[data-view="contactRequests"]').click();
  await expect(page.locator("#contactRows tr")).toHaveCount(2);
  await expect(page.locator("#contactRows tr", { hasText: "Demo Person" }).locator(".chip.delivered")).toHaveText("Demo");
  await expect(page.locator("#contactRows tr", { hasText: "Plain Contact" }).locator(".chip.delivered")).toHaveCount(0);
  await page.locator("#contactInterestFilter").selectOption("Demo requests");
  await expect(page.locator("#contactRows tr")).toHaveCount(1);
  await expect(page.locator("#contactRows")).toContainText("Demo Person");
  await page.locator("#contactInterestFilter").selectOption("Booking");
  await expect(page.locator("#contactRows")).toContainText("Demo Person");
  await assertNoErrors();
});
