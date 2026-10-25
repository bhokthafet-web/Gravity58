import test from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL ||= "postgres://test:test@127.0.0.1:1/test";
process.env.ANTHROPIC_API_KEY ||= "test";
process.env.OWNER_WHATSAPP = "+91 99999 00000";

const { isOwner } = await import("../src/channels/owner.js");

test("recognises the owner's WhatsApp number in wa_id form", () => {
  assert.ok(isOwner("919999900000"));
  assert.ok(!isOwner("919848022338"));
  assert.ok(!isOwner(undefined));
});
