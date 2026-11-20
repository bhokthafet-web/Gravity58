import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const MARKETING_PAGES = [
  "index.html", "about/index.html", "pricing/index.html", "contact/index.html", "support/index.html", "refer/index.html",
  "refills-guide/index.html", "digital-menu-guide/index.html", "terms/index.html", "privacy-policy/index.html", "demo/index.html",
];
const APP_PAGES = ["digital-menu/index.html", "digit58/index.html", "pos/index.html", "team-admin/index.html", "advertise/index.html"];

test("the WhatsApp icon opens a real international number, not a placeholder", () => {
  const source = read("js/whatsapp-float.js");
  const number = source.match(/const WHATSAPP_NUMBER = "(\d*)";/)?.[1];
  assert.equal(number, "919391523275");
  assert.match(number, /^91[6-9]\d{9}$/);
  assert.ok(!/9000000000|9876543210/.test(number));
  assert.match(source, /https:\/\/wa\.me\/\$\{WHATSAPP_NUMBER\}\?text=/);
  assert.match(source, /left:max\(16px,env\(safe-area-inset-left\)\)/);
});

test("the WhatsApp icon is on every public marketing page and on no app screen", () => {
  for (const page of MARKETING_PAGES) assert.match(read(page), /<script src="\/js\/whatsapp-float\.js\?v=\d+"><\/script>/, `${page} is missing the WhatsApp icon`);
  for (const page of APP_PAGES) assert.ok(!read(page).includes("whatsapp-float"), `${page} must not show the sales WhatsApp icon`);
});

test("the demo page collects name, contact number and a Refills / Booking / Digital Menu purpose", () => {
  assert.ok(existsSync(new URL("../../demo/index.html", import.meta.url)));
  const page = read("demo/index.html");
  assert.match(page, /<input id="demoName" name="name"[^>]*required>/);
  assert.match(page, /<input id="demoPhone" name="phone" type="tel"[^>]*required>/);
  const options = [...page.matchAll(/<option value="([^"]*)"/g)].map((match) => match[1]);
  assert.deepEqual(options, ["", "Refills", "Booking", "Digital Menu"]);
  assert.match(page, /api\.create\('g58_contact_requests', \{ name, phone, interest: purpose\.value, requestType: 'Demo'/);
  assert.match(page, /<link rel="canonical" href="https:\/\/g58\.in\/demo\/">/);
  assert.match(page, /name="website" tabindex="-1"/);
});

test("the demo page is linked from the homepage and listed in the sitemap", () => {
  const home = read("index.html");
  assert.match(home, /class="btn hero-secondary-cta" href="\/demo\/">Book a Free Demo</);
  assert.match(home, /<a class="mobile-nav-link" href="\/demo\/"/);
  assert.match(read("sitemap.xml"), /<loc>https:\/\/g58\.in\/demo\/<\/loc>/);
});

test("team admin marks demo requests, filters them and announces them by name", () => {
  const admin = read("team-admin/app.js");
  assert.match(admin, /const interests=\['All','Demo requests','POS','Digital Menu','Refills','Booking'\]/);
  assert.match(admin, /row\.requestType==='Demo'\?' <span class="chip delivered">Demo<\/span>'/);
  assert.match(admin, /row\.requestType==='Demo'\?'Demo request':watcher\.label/);
  assert.equal(read("mobile-team-admin/www/app.js"), admin, "the Android app bundle must carry the same admin code");
});
