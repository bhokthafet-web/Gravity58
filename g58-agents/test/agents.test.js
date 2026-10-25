import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

process.env.DATABASE_URL ||= "postgres://test:test@127.0.0.1:1/test";
process.env.ANTHROPIC_API_KEY ||= "test";
process.env.WA_APP_SECRET = "wa-secret";
process.env.RAZORPAY_WEBHOOK_SECRET = "rzp-secret";

const { normalizeIndianPhone, isOptOut } = await import("../src/phone.js");
const { buildQuery, toLeads } = await import("../src/channels/osm.js");
const { parseWebhook, verifySignature, insideServiceWindow } = await import("../src/channels/whatsapp.js");
const { verifyWebhook } = await import("../src/channels/razorpay.js");
const { sanitizeHtml, slugify } = await import("../src/agents/builder.js");
const { inSendWindow } = await import("../src/time.js");

test("normalises Indian mobile numbers and rejects landlines", () => {
  assert.equal(normalizeIndianPhone("+91 98480 22338"), "919848022338");
  assert.equal(normalizeIndianPhone("098480-22338"), "919848022338");
  assert.equal(normalizeIndianPhone("9848022338; 040 2345 6789"), "919848022338");
  assert.equal(normalizeIndianPhone("0091 9848022338"), "919848022338");
  assert.equal(normalizeIndianPhone("040 2345 6789"), null);
  assert.equal(normalizeIndianPhone(""), null);
});

test("detects opt-out replies only at the start of a message", () => {
  assert.ok(isOptOut("STOP"));
  assert.ok(isOptOut("  not interested, thanks"));
  assert.ok(isOptOut("Unsubscribe me"));
  assert.ok(!isOptOut("Can you tell me the price?"));
  assert.ok(!isOptOut("We don't stop orders on Sunday"));
});

test("builds an Overpass query with amenity and shop tags and strips injection", () => {
  const q = buildQuery('Hyder"abad', ["restaurant", "supermarket", "bad\"];out;"]);
  assert.match(q, /area\["name"="Hyderabad"\]/);
  assert.match(q, /\["amenity"="restaurant"\]/);
  assert.match(q, /\["shop"="supermarket"\]/);
  assert.match(q, /\["shop"="badout"\]/);
});

test("turns Overpass elements into leads and drops ones without a mobile", () => {
  const leads = toLeads([
    { type: "node", id: 1, lat: 17.4, lon: 78.4, tags: { name: "Cafe One", amenity: "cafe", phone: "+91 98480 22338", "addr:street": "Road 1" } },
    { type: "way", id: 2, center: { lat: 17.5, lon: 78.5 }, tags: { name: "Shop Two", shop: "clothes", "contact:phone": "9000000001" } },
    { type: "node", id: 3, tags: { name: "Landline Only", amenity: "restaurant", phone: "040 2345 6789" } },
    { type: "node", id: 4, tags: { amenity: "cafe", phone: "9848022338" } },
  ], "Hyderabad");
  assert.equal(leads.length, 2);
  assert.deepEqual(leads[0], {
    sourceRef: "osm:node/1", name: "Cafe One", category: "cafe", phone: "919848022338", email: null, website: null,
    address: "Road 1", city: "Hyderabad", lat: 17.4, lon: 78.4,
  });
  assert.equal(leads[1].lat, 17.5);
});

test("verifies WhatsApp webhook signatures", () => {
  const body = '{"entry":[]}';
  const good = `sha256=${crypto.createHmac("sha256", "wa-secret").update(body).digest("hex")}`;
  assert.ok(verifySignature(body, good));
  assert.ok(!verifySignature(body, "sha256=00"));
  assert.ok(!verifySignature(body, undefined));
});

test("parses inbound messages, statuses and quality alerts from a WhatsApp webhook", () => {
  const parsed = parseWebhook({
    entry: [{
      changes: [
        { field: "messages", value: {
          contacts: [{ profile: { name: "Ravi" } }],
          messages: [{ from: "919848022338", id: "wamid.1", type: "text", text: { body: "Price?" } }],
          statuses: [{ id: "wamid.0", status: "read" }],
        } },
        { field: "phone_number_quality_update", value: { event: "FLAGGED" } },
      ],
    }],
  });
  assert.deepEqual(parsed.inbound, [{ from: "919848022338", id: "wamid.1", text: "Price?", name: "Ravi" }]);
  assert.deepEqual(parsed.statuses, [{ id: "wamid.0", status: "read", error: null }]);
  assert.equal(parsed.alerts[0].value.event, "FLAGGED");
});

test("only allows free-form WhatsApp replies inside the service window", () => {
  assert.ok(insideServiceWindow({ last_inbound_at: new Date(Date.now() - 3600_000).toISOString() }));
  assert.ok(!insideServiceWindow({ last_inbound_at: new Date(Date.now() - 24 * 3600_000).toISOString() }));
  assert.ok(!insideServiceWindow({ last_inbound_at: null }));
});

test("verifies Razorpay webhook signatures", () => {
  const body = '{"event":"payment_link.paid"}';
  assert.ok(verifyWebhook(body, crypto.createHmac("sha256", "rzp-secret").update(body).digest("hex")));
  assert.ok(!verifyWebhook(body, "deadbeef"));
});

test("strips scripts, handlers and frames from generated websites", () => {
  const html = sanitizeHtml(`<h1 onclick="x()">Hi</h1><script>alert(1)</script><a href="javascript:evil()">x</a><iframe src="//e"></iframe><p>ok</p>`);
  assert.equal(html, `<h1>Hi</h1><a href="#">x</a><p>ok</p>`);
});

test("makes URL-safe slugs", () => {
  assert.equal(slugify("Sri Lakshmi Tiffins & Meals!"), "sri-lakshmi-tiffins-meals");
  assert.equal(slugify("☕"), "business");
});

test("respects the IST send window", () => {
  // 04:30 UTC = 10:00 IST; 14:00 UTC = 19:30 IST
  assert.ok(inSendWindow({ start: 10, end: 19 }, new Date("2026-10-25T04:30:00Z")));
  assert.ok(!inSendWindow({ start: 10, end: 19 }, new Date("2026-10-25T14:00:00Z")));
});

process.env.OWNER_WHATSAPP = "+91 99999 00000";
const { ownerSaid } = await import("../src/agents/owner-chat.js");
const { templateSafe } = await import("../src/channels/owner.js");

test("only approves or rejects money when the owner said so", () => {
  assert.ok(ownerSaid("Approve Snap Mandi", "approve"));
  assert.ok(ownerSaid("yes go ahead with it", "approve"));
  assert.ok(!ownerSaid("what is waiting for approval?", "approve"));
  assert.ok(!ownerSaid("show me pending payments", "approve"));
  assert.ok(ownerSaid("reject the second one", "reject"));
  assert.ok(!ownerSaid("approve it", "reject"));
});

test("makes text safe for a WhatsApp template parameter", () => {
  assert.equal(templateSafe("Line one\n\nLine\ttwo     end"), "Line one Line two end");
  assert.equal(templateSafe("x".repeat(2000)).length, 900);
});
