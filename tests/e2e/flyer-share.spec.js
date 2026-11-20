import { test, expect } from "@playwright/test";
import { monitorPageErrors, prepareMockApi } from "./helpers.js";

const stubOpen = (page) => page.addInitScript(() => {
  window.__opened = [];
  window.open = (url) => { window.__opened.push(String(url)); return null; };
});

test("the home page flyer section opens a WhatsApp chat with a ready-made message", async ({ page }) => {
  await prepareMockApi(page, { state: null });
  const assertNoErrors = monitorPageErrors(page);
  await page.goto("/");
  const section = page.locator("#flyerShare");
  await section.scrollIntoViewIfNeeded();
  await expect(section).toHaveClass(/is-live/);
  await expect(section.locator(".flyer-page")).toHaveCount(2);

  const link = page.locator("#flyerChatLink");
  await expect(link).toBeVisible();
  const messageOf = async () => decodeURIComponent((await link.getAttribute("href")).split("?text=")[1]);
  await expect(link).toHaveAttribute("href", /^https:\/\/wa\.me\/919391523275\?text=/);
  expect(await messageOf()).toContain("Refills");
  await expect(page.locator("#flyerBubbleText")).toContainText("1 month free trial");

  await page.getByRole("radio", { name: /Salon/ }).click();
  expect(await messageOf()).toContain("pre-book and pay in advance");
  await page.getByRole("radio", { name: /Restaurant/ }).click();
  expect(await messageOf()).toContain("digital menu");
  await page.locator("#flyerName").fill("Sri Sai Medicals");
  expect(await messageOf()).toContain("My name / business: Sri Sai Medicals");
  await expect(page.locator("#flyerBubbleText")).toContainText("Sri Sai Medicals");

  await page.getByRole("button", { name: "Back" }).click();
  await expect(section.locator(".flyer-page").nth(1)).toHaveClass(/is-front/);
  await expect(page.getByRole("link", { name: "Download PDF" })).toHaveAttribute("href", "/assets/flyer/GRAVITY58_Flyer.pdf");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await section.screenshot({ path: "/private/tmp/claude-501/-Users-rajeshgurram-Desktop-58-caude/718e3f85-256d-43e5-b83e-384b66a3cfeb/scratchpad/flyer-section-" + test.info().project.name + ".png" });
  await assertNoErrors();
});

test("'Send the flyer' falls back to a WhatsApp message with the flyer link when the share sheet is unavailable", async ({ page }) => {
  await stubOpen(page);
  await page.addInitScript(() => { Object.defineProperty(navigator, "canShare", { value: undefined, configurable: true }); });
  await prepareMockApi(page, { state: null });
  await page.goto("/");
  await page.locator("#flyerSendBtn").click();
  const opened = await page.evaluate(() => window.__opened);
  expect(opened).toHaveLength(1);
  expect(opened[0]).toMatch(/^https:\/\/wa\.me\/\?text=/);
  expect(decodeURIComponent(opened[0].split("?text=")[1])).toContain("/assets/flyer/GRAVITY58_Flyer.pdf");
});

test("'Send the flyer' shares the PDF file through the share sheet when the phone supports it", async ({ page }) => {
  await page.addInitScript(() => {
    window.__shared = null;
    navigator.canShare = (data) => Boolean(data && data.files && data.files.length);
    navigator.share = async (data) => { window.__shared = { name: data.files[0].name, type: data.files[0].type, size: data.files[0].size }; };
  });
  await prepareMockApi(page, { state: null });
  await page.goto("/");
  await page.locator("#flyerSendBtn").click();
  await expect.poll(() => page.evaluate(() => window.__shared)).toMatchObject({ name: "GRAVITY58_Flyer.pdf", type: "application/pdf" });
  expect((await page.evaluate(() => window.__shared)).size).toBeGreaterThan(100000);
});
