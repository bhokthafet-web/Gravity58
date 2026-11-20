import test from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL ||= "postgres://test:test@127.0.0.1:1/test";
process.env.PUBLIC_BASE_URL = "https://server.g58.in/agents";
process.env.UNSUBSCRIBE_SECRET = "unsub-secret";

const { extractEmails, isPrivateAddress } = await import("../src/channels/websites.js");
const { buildAreaQuery, toEmailCandidates } = await import("../src/channels/osm.js");
const { composeEmail, unsubscribeToken, verifyUnsubscribe } = await import("../src/channels/email.js");
const { templateDraft } = await import("../src/agents/email.js");

const PRODUCTS = [
  { code: "digital_menu", name: "G58 Digital Menu", price_inr: 699, period: "month", url: "https://g58.in/digital-menu/", pitch: "" },
  { code: "refills", name: "G58 Refills", price_inr: 699, period: "month", url: "https://g58.in/pricing/", pitch: "" },
  { code: "website", name: "Business website", price_inr: 2999, period: "once", url: "", pitch: "" },
];

test("finds emails in mailto links, text and Cloudflare-protected markup, own domain first", () => {
  // "info@cafe.in" XOR-encoded with key 0x42, as Cloudflare does.
  const cf = "42" + [..."info@cafe.in"].map((c) => (c.charCodeAt(0) ^ 0x42).toString(16).padStart(2, "0")).join("");
  const html = `<a href="mailto:Owner@Gmail.com?subject=Hi">Mail</a> <p>Write to sales@cafe.in.</p> Site by hello@webagency.com
    <img src="logo@2x.png"> <span>user@example.com</span> <a data-cfemail="${cf}">[email protected]</a>`;
  assert.deepEqual(extractEmails(html, "www.cafe.in"), ["info@cafe.in", "sales@cafe.in", "owner@gmail.com"]);
});

test("blocks private and local addresses when reading websites", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.21.0.5", "192.168.0.4", "169.254.169.254", "::1", "fd00::1", "::ffff:10.0.0.1"]) {
    assert.ok(isPrivateAddress(ip), ip);
  }
  for (const ip of ["8.8.8.8", "103.17.193.70", "2606:4700::1111"]) assert.ok(!isPrivateAddress(ip), ip);
});

test("builds an area query with a bounding box and keeps businesses with email or website", () => {
  const q = buildAreaQuery([17.4, 78.3, 17.5, 78.5], ["cafe", "restaurant", "bakery", "bad\"];"]);
  assert.match(q, /\["amenity"~"\^\(cafe\|restaurant\)\$"\]\["name"\].*\(17\.4,78\.3,17\.5,78\.5\);/);
  assert.match(q, /\["shop"~"\^\(bakery\|bad\)\$"\]/);
  const rows = toEmailCandidates([
    { type: "node", id: 1, tags: { name: "Cafe A", amenity: "cafe", email: "Hello@CafeA.in; other@x.in" } },
    { type: "node", id: 2, tags: { name: "Shop B", shop: "clothes", website: "shopb.in", phone: "9848022338" } },
    { type: "node", id: 3, tags: { amenity: "cafe", email: "no@name.in" } },
  ], "Kukatpally");
  assert.equal(rows.length, 2);
  assert.equal(rows[0].email, "hello@cafea.in");
  assert.equal(rows[1].email, null);
  assert.equal(rows[1].phone, "919848022338");
});

test("signs unsubscribe links and adds them to every email", () => {
  const token = unsubscribeToken("Owner@Cafe.in");
  assert.ok(verifyUnsubscribe("owner@cafe.in", token));
  assert.ok(!verifyUnsubscribe("other@cafe.in", token));
  assert.ok(!verifyUnsubscribe("owner@cafe.in", "nope"));
  const { text, html } = composeEmail("Hello <team>\nSee https://g58.in", "owner@cafe.in");
  assert.match(text, /Unsubscribe: https:\/\/server\.g58\.in\/agents\/unsubscribe\?e=owner%40cafe\.in&t=[0-9a-f]{32}/);
  assert.match(html, /Hello &lt;team&gt;<br>See <a href="https:\/\/g58\.in">/);
});

test("drafts a template email that fits the business type", () => {
  const cafe = templateDraft({ name: "Cafe A", category: "cafe", city: "Kukatpally", website: "cafea.in" }, PRODUCTS);
  assert.equal(cafe.subject, "A free QR menu for Cafe A");
  assert.match(cafe.body, /Digital Menu/);
  const shop = templateDraft({ name: "Shop B", category: "hardware", city: "Kukatpally", website: null }, PRODUCTS);
  assert.equal(shop.subject, "A website for Shop B");
  assert.match(shop.body, /₹2999/);
});
