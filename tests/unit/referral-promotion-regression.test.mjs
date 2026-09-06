import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("the homepage has no floating referral or website builder shortcuts", async () => {
  const html = await read("index.html");
  const css = await read("css/style.css");
  assert.doesNotMatch(html, /g58-referral-float|g58-builder-float/);
  assert.doesNotMatch(css, /g58-referral-float|g58-builder-float/);
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
  assert.match(html, /\/refer\/app\.js\?v=2/);
  assert.match(css, /color-scheme:light only/);
  assert.match(css, /body\.refer-page\{[^}]*background:#f6f3ec!important;[^}]*color:#111820!important/);
});

test("Refills preserves safe promotion images and auto-compresses larger uploads", async () => {
  const source = await read("digit58/app.js");
  assert.match(source, /const PROMOTION_IMAGE_MAX_BYTES=95000;/);
  assert.match(source, /if\(file\.size<=PROMOTION_IMAGE_MAX_BYTES\)return file;/);
  assert.match(source, /if\(blob\.size<=PROMOTION_IMAGE_MAX_BYTES\)return blob;/);
  assert.match(source, /if\(compressionPromise\)await compressionPromise;/);
  assert.doesNotMatch(source, /stripNearWhiteBackground/);
  assert.match(source, /imageSmoothingQuality='high'/);
});

test("customer promotion cards show uploaded brand art with a visible product title", async () => {
  const source = await read("digit58/app.js");
  assert.match(source, /const hasImage=Boolean\(promotion\.imageUrl\)/);
  assert.match(source, /<h3 class="promotion-product-title">\$\{html\(promotion\.name\)\}<\/h3>/);
  assert.match(source, /hasImage\?`<div class="promotion-ticket-image"[^`]+`:[^}]*\}<h3 class="promotion-product-title">/);
  const css = await read("digit58/styles.css");
  assert.match(css, /\.customer-ticket\.brand-art-ticket\{[^}]*background:transparent/);
  assert.match(css, /filter:none!important;opacity:1!important/);
  assert.doesNotMatch(source, /promotion-badge/);
  assert.match(css, /\.promotion-offer-price\{[^}]*color:#dc2626!important;[^}]*animation:none/);
  assert.match(css, /\.customer-ticket \.promotion-product-title\{[^}]*color:#fff;[^}]*font-weight:950;[^}]*white-space:normal;[^}]*-webkit-line-clamp:2/);
  assert.match(css, /\.customer-ticket\.brand-art-ticket \.promotion-ticket-image\{[^}]*height:158px;[^}]*min-height:158px;[^}]*flex:0 0 158px/);
  assert.match(css, /\.customer-ticket\.brand-art-ticket \.promotion-end-date\{[^}]*color:#fff/);
});

test("Refills rejection alerts are limited to live status transitions", async () => {
  const source = await read("digit58/app.js");
  assert.doesNotMatch(source, /g58-rejected-order:/);
  assert.match(source, /const newlyRejected=order\.status==='Rejected'&&previous&&previous\.status!=='Rejected'/);
  assert.match(source, /rejectedOrderSnapshots=new Map\(orders\.map\(order=>\[order\.id,rejectedOrderSnapshot\(order\)\]\)\)/);
  assert.match(source, /queueRejectedOrderNotifications\(orders,store,customer,promotions\)/);
});
