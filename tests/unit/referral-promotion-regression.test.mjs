import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("the homepage keeps only the floating rupee referral entry point", async () => {
  const html = await read("index.html");
  assert.match(html, /class="g58-referral-float"[^>]+href="\/refer\/"[^>]*>₹<\/a>/);
  assert.doesNotMatch(html, /g58-refer-section/);
});

test("the referral page explains qualification and provides account-aware link controls", async () => {
  const html = await read("refer/index.html");
  const css = await read("refer/styles.css");
  assert.match(html, /How you earn the reward/);
  assert.match(html, /A free trial alone does not qualify/);
  assert.match(html, /id="generateReferralButton"/);
  assert.match(html, /id="referralHistory"/);
  assert.match(html, /name="color-scheme" content="light only"/);
  assert.match(html, /\/refer\/styles\.css\?v=2/);
  assert.match(html, /\/refer\/app\.js\?v=1/);
  assert.match(css, /color-scheme:light only/);
  assert.match(css, /body\.refer-page\{[^}]*background:#f6f3ec!important;[^}]*color:#111820!important/);
});

test("Refills preserves promotion images already within the 100 KB limit", async () => {
  const source = await read("digit58/app.js");
  assert.match(source, /if\(file\.size<=100\*1024\)return file;/);
  assert.doesNotMatch(source, /stripNearWhiteBackground/);
  assert.match(source, /imageSmoothingQuality='high'/);
});

test("customer promotion cards show uploaded brand art with a visible product title", async () => {
  const source = await read("digit58/app.js");
  assert.match(source, /const hasImage=Boolean\(promotion\.imageUrl\)/);
  assert.match(source, /<h3 class="promotion-product-title">\$\{html\(promotion\.name\)\}<\/h3>/);
  assert.match(source, /hasImage\?`<div class="promotion-ticket-image"/);
  const css = await read("digit58/styles.css");
  assert.match(css, /\.customer-ticket\.brand-art-ticket\{[^}]*background:transparent/);
  assert.match(css, /filter:none!important;opacity:1!important/);
  assert.doesNotMatch(source, /promotion-badge/);
  assert.match(css, /\.promotion-offer-price\{[^}]*color:#dc2626!important;[^}]*animation:none/);
  assert.match(css, /\.customer-ticket \.promotion-product-title\{[^}]*color:#fff;[^}]*font-weight:950/);
  assert.match(css, /\.customer-ticket\.brand-art-ticket \.promotion-end-date\{[^}]*color:#fff/);
});
