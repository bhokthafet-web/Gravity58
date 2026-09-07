import test from "node:test";
import assert from "node:assert/strict";
import { canReadRecord, canWriteRecord, isAdmin, isPublicKind, isStaff, visibilityForKind } from "../src/access.js";

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

test("digital menu prefix kinds are public except the customer-private request/order/subscription exceptions", () => {
  assert.equal(isPublicKind("digital_menu_pricing"), true);
  assert.equal(isPublicKind("digital_menu_categories"), true);
  assert.equal(isPublicKind("digital_menu_entitlements"), false);
  assert.equal(isPublicKind("digital_menu_requests"), false);
  assert.equal(isPublicKind("digital_menu_orders"), false);
  assert.equal(isPublicKind("digital_menu_subscriptions"), false);
  assert.equal(visibilityForKind("digital_menu_requests"), "private");
  assert.equal(visibilityForKind("digital_menu_categories"), "public");
});

test("digit58 store/promo/service/expert/stay-extra prefixes are all public kinds", () => {
  for (const kind of [
    "digit58_promo_offers",
    "digit58_service_bookings",
    "digit58_expert_profiles",
    "digit58_stay_extra_addons",
  ]) {
    assert.equal(isPublicKind(kind), true, `${kind} should be public`);
    assert.equal(visibilityForKind(kind), "public");
  }
  // an unrecognised kind with none of the known prefixes defaults to private
  assert.equal(isPublicKind("some_unlisted_kind"), false);
  assert.equal(visibilityForKind("some_unlisted_kind"), "private");
});

test("isAdmin and isStaff apply role thresholds correctly", () => {
  assert.equal(isAdmin({ role: "admin" }), true);
  assert.equal(isAdmin({ role: "super_admin" }), true);
  assert.equal(isAdmin({ role: "support" }), false);
  assert.equal(isAdmin({ role: "user" }), false);
  assert.equal(isAdmin(undefined), false);
  assert.equal(isAdmin(null), false);

  assert.equal(isStaff({ role: "support" }), true);
  assert.equal(isStaff({ role: "admin" }), true);
  assert.equal(isStaff({ role: "super_admin" }), true);
  assert.equal(isStaff({ role: "user" }), false);
  assert.equal(isStaff(undefined), false);
});

test("canReadRecord treats public records as open to anonymous visitors, and private records as closed to them", () => {
  const publicRecord = { visibility: "public", owner_id: "owner" };
  assert.equal(canReadRecord(publicRecord, undefined), true);
  assert.equal(canReadRecord(publicRecord, null), true);

  const privateRecord = { visibility: "private", owner_id: "owner" };
  // note: for an anonymous visitor this short-circuits to `undefined` rather than `false`
  // (still falsy everywhere the caller checks it, but not a strict boolean)
  assert.ok(!canReadRecord(privateRecord, undefined));
  // a private record with no participant_ids array must not throw for an anonymous visitor
  assert.doesNotThrow(() => canReadRecord({ visibility: "private", owner_id: "owner" }, undefined));
});

test("canWriteRecord requires admin role or ownership, and rejects anonymous or support-only users", () => {
  const record = { visibility: "private", owner_id: "owner" };
  assert.equal(canWriteRecord(record, undefined), false);
  assert.equal(canWriteRecord(record, { id: "owner" }), true);
  assert.equal(canWriteRecord(record, { id: "someone-else", role: "support" }), false);
  assert.equal(canWriteRecord(record, { id: "someone-else", role: "super_admin" }), true);
});
