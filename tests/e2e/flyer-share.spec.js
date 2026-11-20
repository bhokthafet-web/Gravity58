import { test, expect } from "@playwright/test";
import { monitorPageErrors, prepareMockApi } from "./helpers.js";

const stubOpen = (page) => page.addInitScript(() => {
  window.__opened = [];
  window.open = (url) => { window.__opened.push(String(url)); return null; };
});

test("the floating WhatsApp icon opens a flyer popup with one WhatsApp button", async ({ page }) => {
  await prepareMockApi(page, { state: null });
  await stubOpen(page);
  const assertNoErrors = monitorPageErrors(page);
  await page.goto("/");
  await expect(page.locator("#flyerShare")).toHaveCount(0); // no inline section any more
  const icon = page.locator("a.g58-wa-float");
  await expect(icon.locator("svg.g58-wa-face-logo circle")).toHaveCount(3); // the G58 three-ring logo
  await expect(icon.locator("svg.g58-wa-face-chat path")).toHaveCount(1); // the WhatsApp glyph it turns into
  await page.screenshot({ path: `/private/tmp/claude-501/-Users-rajeshgurram-Desktop-58-caude/718e3f85-256d-43e5-b83e-384b66a3cfeb/scratchpad/icon-${test.info().project.name}.png`, clip: { x: 0, y: page.viewportSize().height - 110, width: 220, height: 110 } });
  await icon.click();

  const dialog = page.getByRole("dialog", { name: /flyer on WhatsApp/i });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".g58-flyer-page")).toHaveCount(2);
  await expect(dialog.getByRole("button", { name: /send.*customer/i })).toHaveCount(0);
  const wa = dialog.getByRole("link", { name: "Open WhatsApp" });
  const messageOf = async () => decodeURIComponent((await wa.getAttribute("href")).split("?text=")[1]);
  await expect(wa).toHaveAttribute("href", /^https:\/\/wa\.me\/919391523275\?text=/);
  let text = await messageOf();
  expect(text).toContain("Refills");
  expect(text).toContain("/assets/flyer/GRAVITY58_Flyer.pdf");

  await dialog.getByRole("radio", { name: "Salon / clinic" }).click();
  expect(await messageOf()).toContain("pre-book and pay in advance");
  await dialog.getByRole("radio", { name: "Restaurant" }).click();
  await dialog.getByLabel(/Your name or business/).fill("Sri Sai Medicals");
  text = await messageOf();
  expect(text).toContain("live digital menu");
  expect(text).toContain("My name / business: Sri Sai Medicals");

  // On a phone the WhatsApp button must be on screen without scrolling the popup.
  const waBox = await wa.boundingBox();
  expect(waBox.y + waBox.height).toBeLessThanOrEqual(page.viewportSize().height);
  expect(waBox.y).toBeGreaterThanOrEqual(0);
  await dialog.getByRole("button", { name: "Back" }).click();
  await expect(dialog.locator(".g58-flyer-page").nth(1)).toHaveClass(/is-front/);
  await expect(dialog.getByRole("link", { name: /Download the flyer/ })).toHaveAttribute("href", "/assets/flyer/GRAVITY58_Flyer.pdf");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `/private/tmp/claude-501/-Users-rajeshgurram-Desktop-58-caude/718e3f85-256d-43e5-b83e-384b66a3cfeb/scratchpad/popup-${test.info().project.name}.png` });

  // Closing: button, Escape and backdrop; focus returns to the icon.
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();
  await expect(icon).toBeFocused();
  await icon.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await icon.click();
  await page.locator(".g58-flyer-overlay").click({ position: { x: 4, y: 4 } });
  await expect(dialog).toBeHidden();
  await assertNoErrors();
});

test("the WhatsApp button inside the popup opens the chat and closes the popup", async ({ page }) => {
  await prepareMockApi(page, { state: null });
  await page.goto("/pricing/");
  await page.locator("a.g58-wa-float").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const href = await dialog.getByRole("link", { name: "Open WhatsApp" }).getAttribute("href");
  expect(href).toMatch(/^https:\/\/wa\.me\/919391523275\?text=/);
  expect(await dialog.getByRole("link", { name: "Open WhatsApp" }).getAttribute("target")).toBe("_blank");
  // The click must not navigate this page away.
  const popupPromise = page.context().waitForEvent("page");
  await dialog.getByRole("link", { name: "Open WhatsApp" }).click();
  const popup = await popupPromise;
  expect(popup.url()).toMatch(/wa\.me|whatsapp/);
  await popup.close();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/pricing\/$/);
});

test("the icon falls back to a plain WhatsApp chat if the popup cannot load", async ({ page }) => {
  await prepareMockApi(page, { state: null });
  await stubOpen(page);
  await page.route(/\/js\/flyer-share\.js/, (route) => route.abort());
  await page.goto("/demo/");
  await page.locator("a.g58-wa-float").click();
  await expect.poll(() => page.evaluate(() => window.__opened.length)).toBe(1);
  expect((await page.evaluate(() => window.__opened))[0]).toMatch(/^https:\/\/wa\.me\/919391523275\?text=/);
});

test("the floating button spins between the G58 logo and the WhatsApp button, and stays still for reduced motion", async ({ page }) => {
  await prepareMockApi(page, { state: null });
  await page.goto("/pricing/");
  const icon = page.locator("a.g58-wa-float");
  const shot = (name) => page.screenshot({ path: `/private/tmp/claude-501/-Users-rajeshgurram-Desktop-58-caude/718e3f85-256d-43e5-b83e-384b66a3cfeb/scratchpad/${name}-${test.info().project.name}.png`, clip: { x: 0, y: page.viewportSize().height - 110, width: 220, height: 110 } });
  const at = async (ms) => { await page.evaluate((t) => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = t; }), ms); };
  const state = () => icon.evaluate((el) => ({
    bg: getComputedStyle(el).backgroundColor,
    logo: Number(getComputedStyle(el.querySelector(".g58-wa-face-logo")).opacity),
    chat: Number(getComputedStyle(el.querySelector(".g58-wa-face-chat")).opacity),
  }));
  await at(1000); // start of each loop: the logo
  let s = await state();
  expect(s.bg).toBe("rgb(255, 255, 255)");
  expect(s.logo).toBe(1);
  expect(s.chat).toBe(0);
  await shot("float-logo");
  await at(4300); // middle: the WhatsApp button
  s = await state();
  expect(s.bg).toBe("rgb(37, 211, 102)");
  expect(s.chat).toBe(1);
  expect(s.logo).toBe(0);
  await shot("float-whatsapp");
  await at(8800); // end of the loop: back to the logo
  s = await state();
  expect(s.logo).toBe(1);
  expect(s.chat).toBe(0);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await expect(icon.locator(".g58-wa-face-chat")).toBeHidden();
  await expect(icon.locator(".g58-wa-face-logo")).toBeVisible();
  expect(await icon.evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
});
