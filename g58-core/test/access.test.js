import test from "node:test";
import assert from "node:assert/strict";
import { canReadRecord, canWriteRecord, isPublicKind, visibilityForKind } from "../src/access.js";

test("customer-facing catalog data is public but entitlements remain private", () => {
  assert.equal(isPublicKind("advertisements"), true);
  assert.equal(isPublicKind("digit58_store_items"), true);
  assert.equal(isPublicKind("digital_menu_entitlements"), false);
  assert.equal(visibilityForKind("digital_menu_orders"), "private");
});

test("private records are limited to owners, participants and staff", () => {
  const record = { visibility: "private", owner_id: "owner", participant_ids: ["customer"] };
  assert.equal(canReadRecord(record, { id: "owner", role: "user" }), true);
  assert.equal(canReadRecord(record, { id: "customer", role: "user" }), true);
  assert.equal(canReadRecord(record, { id: "other", role: "user" }), false);
  assert.equal(canReadRecord(record, { id: "staff", role: "support" }), true);
  assert.equal(canWriteRecord(record, { id: "customer", role: "user" }), false);
  assert.equal(canWriteRecord(record, { id: "admin", role: "admin" }), true);
});
