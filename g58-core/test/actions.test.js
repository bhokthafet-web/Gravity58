import test from "node:test";
import assert from "node:assert/strict";
import {
  text, finite, normalisePhone, indiaDay,
  safeKindId, pairRowId, cleanRow,
  buildOrder, combineOrderItems, mergeOrder, parseMenu,
  hhmmToMinutes, rangesOverlap, digit58ServiceDurationMinutes, digit58LunchBreakRange,
  digit58PlanAmount, buildDigit58UpiUri,
  sanitiseBusinessReview, closedHistoryRecord, recordTime,
  stayNightCount, stayOverlaps, nextDeliveryDate,
  cleanMedicineInput, digit58PushMessageForOrder, generateReferralCode,
  digit58EntitlementRowId, digit58ReferrerProfileRowId,
} from "../src/actions.js";

// ---- basic utils ----

test("text() trims, stringifies and truncates", () => {
  assert.equal(text("  hello  ", 10), "hello");
  assert.equal(text(null), "");
  assert.equal(text(undefined), "");
  assert.equal(text(12345, 3), "123");
});

test("finite() coerces numeric-like values and falls back otherwise", () => {
  assert.equal(finite("42"), 42);
  assert.equal(finite(3.5), 3.5);
  assert.equal(finite("not a number"), 0);
  assert.equal(finite(undefined, 7), 7);
  assert.equal(finite(NaN, 9), 9);
});

test("normalisePhone() strips everything but digits", () => {
  assert.equal(normalisePhone("+91 98765-43210"), "919876543210");
  assert.equal(normalisePhone(""), "");
});

test("indiaDay() formats in Asia/Kolkata as YYYY-MM-DD", () => {
  // 2026-01-01T19:00:00Z is 2026-01-02 00:30 IST — crosses the midnight boundary.
  assert.equal(indiaDay("2026-01-01T19:00:00Z"), "2026-01-02");
  assert.equal(indiaDay("2026-01-01T10:00:00Z"), "2026-01-01");
});

// ---- id helpers ----

test("safeKindId() strips unsafe characters and caps length", () => {
  assert.equal(safeKindId("kind_", "owner@123!", 6), "kind_owner-");
  assert.equal(safeKindId("kind_", "abcdefghij", 4), "kind_abcd");
});

test("pairRowId() is deterministic and order-sensitive", () => {
  const a = pairRowId("p-", "owner1", "owner2");
  const b = pairRowId("p-", "owner1", "owner2");
  const c = pairRowId("p-", "owner2", "owner1");
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.ok(a.startsWith("p-"));
  assert.ok(a.length <= 32);
});

test("cleanRow() merges parsed payload over the row and prefers payload id", () => {
  const row = { $id: "row1", payload: JSON.stringify({ id: "payload1", foo: "bar" }) };
  assert.deepEqual(cleanRow(row), { $id: "row1", payload: row.payload, id: "payload1", foo: "bar" });
  const noId = { $id: "row2", payload: JSON.stringify({ foo: "bar" }) };
  assert.equal(cleanRow(noId).id, "row2");
  assert.deepEqual(cleanRow({ $id: "row3", payload: "not json" }).id, "row3");
});

// ---- digital menu order pricing ----

function fixtureMenu(overrides = {}) {
  return {
    payload: {
      items: [
        { id: "i1", name: "Idli", price: 40, available: true, restaurantId: "r1" },
        { id: "i2", name: "Dosa", price: 60, available: true, restaurantId: "r1" },
        { id: "i3", name: "Sold Out Item", price: 100, available: false, restaurantId: "r1" },
      ],
    },
    restaurant: { id: "r1", tax: 5, service: 10, paymentEnabled: true, upiId: "owner@upi", paymentLink: "", ...overrides },
  };
}

test("buildOrder() computes subtotal, tax and service charge correctly", () => {
  const order = buildOrder(
    { items: [{ id: "i1", qty: 2 }, { id: "i2", qty: 1 }], phone: "9876543210", customer: "Test" },
    fixtureMenu(), "user1", 3, "res1"
  );
  assert.equal(order.subtotal, 140); // 40*2 + 60
  assert.equal(order.tax, 7); // 5% of 140
  assert.equal(order.serviceCharge, 14); // 10% of 140
  assert.equal(order.total, 161);
  assert.equal(order.paymentMethod, "counter");
  assert.equal(order.tokenNumber, 3);
  assert.equal(order.status, "Pending");
});

test("buildOrder() rejects empty or oversized item lists", () => {
  assert.throws(() => buildOrder({ items: [], phone: "9876543210" }, fixtureMenu(), "u", 1, "r"), /between 1 and 50/);
  const tooMany = Array.from({ length: 51 }, () => ({ id: "i1", qty: 1 }));
  assert.throws(() => buildOrder({ items: tooMany, phone: "9876543210" }, fixtureMenu(), "u", 1, "r"), /between 1 and 50/);
});

test("buildOrder() rejects unavailable or unknown items", () => {
  assert.throws(
    () => buildOrder({ items: [{ id: "i3", qty: 1 }], phone: "9876543210" }, fixtureMenu(), "u", 1, "r"),
    /no longer available/
  );
});

test("buildOrder() validates the customer phone number", () => {
  assert.throws(() => buildOrder({ items: [{ id: "i1", qty: 1 }], phone: "123" }, fixtureMenu(), "u", 1, "r"), /valid customer phone/);
});

test("buildOrder() requires a receipt and enabled payments for online orders", () => {
  assert.throws(
    () => buildOrder({ items: [{ id: "i1", qty: 1 }], phone: "9876543210", paymentMethod: "online" }, fixtureMenu(), "u", 1, "r"),
    /receipt image is required/
  );
  assert.throws(
    () => buildOrder(
      { items: [{ id: "i1", qty: 1 }], phone: "9876543210", paymentMethod: "online", paymentReceiptFileId: "f1" },
      fixtureMenu({ paymentEnabled: false }), "u", 1, "r"
    ),
    /Online payment is not enabled/
  );
});

test("buildOrder() clamps quantity to 1-99 and keeps a valid custom id", () => {
  const order = buildOrder(
    { id: "GR58-abc123", items: [{ id: "i1", qty: 500 }], phone: "9876543210" },
    fixtureMenu(), "u", 1, "r"
  );
  assert.equal(order.items[0].qty, 99);
  assert.equal(order.id, "GR58-abc123");
});

test("combineOrderItems() merges matching items and sums quantity, capped at 99", () => {
  const merged = combineOrderItems(
    [{ id: "i1", name: "Idli", qty: 60, price: 40 }],
    [{ id: "i1", name: "Idli", qty: 50, price: 40 }]
  );
  assert.equal(merged.length, 1);
  assert.equal(merged[0].qty, 99);
});

test("combineOrderItems() keeps differently-customised items separate", () => {
  const merged = combineOrderItems(
    [{ id: "i1", name: "Idli", qty: 1, price: 40, prepareInstruction: "no chutney" }],
    [{ id: "i1", name: "Idli", qty: 1, price: 40, prepareInstruction: "extra spicy" }]
  );
  assert.equal(merged.length, 2);
});

test("mergeOrder() recomputes totals from the combined item list", () => {
  const existing = { items: [{ id: "i1", name: "Idli", qty: 1, price: 40 }], customer: "A" };
  const incoming = {
    items: [{ id: "i2", name: "Dosa", qty: 1, price: 60 }],
    customer: "A", customerName: "A", serviceMode: "takeaway", tableNumber: "", phone: "9876543210",
    paymentMethod: "counter",
  };
  const merged = mergeOrder(existing, incoming, { tax: 10, service: 0 });
  assert.equal(merged.subtotal, 100);
  assert.equal(merged.tax, 10);
  assert.equal(merged.total, 110);
  assert.equal(merged.status, "Pending");
});

test("parseMenu() rejects a row that does not belong to the owner", () => {
  const row = { kind: "digital_menu_someone-else", payload: "{}" };
  assert.throws(() => parseMenu(row, "owner1", "r1"), /not owned by the selected restaurant account/);
});

test("parseMenu() rejects a restaurant that is closed when acceptance is required", () => {
  const kind = safeKindId("digital_menu_", "owner1", 48);
  const row = { kind, payload: JSON.stringify({ restaurant: { id: "r1", open: false } }) };
  assert.throws(() => parseMenu(row, "owner1", "r1"), /not accepting orders/);
  assert.doesNotThrow(() => parseMenu(row, "owner1", "r1", false));
});

// ---- booking slot logic ----

test("hhmmToMinutes() converts HH:MM to minutes since midnight", () => {
  assert.equal(hhmmToMinutes("13:30"), 810);
  assert.equal(hhmmToMinutes("00:00"), 0);
  assert.equal(hhmmToMinutes(""), 0);
});

test("rangesOverlap() detects overlapping half-open intervals", () => {
  assert.equal(rangesOverlap(60, 90, 80, 100), true);
  assert.equal(rangesOverlap(60, 90, 90, 120), false);
  assert.equal(rangesOverlap(60, 90, 30, 60), false);
});

test("digit58ServiceDurationMinutes() prefers service duration, then store slot, then a 30-minute default", () => {
  assert.equal(digit58ServiceDurationMinutes({}, { durationMinutes: 45 }), 45);
  assert.equal(digit58ServiceDurationMinutes({ slotDurationMinutes: 20 }, {}), 20);
  assert.equal(digit58ServiceDurationMinutes({}, {}), 30);
  assert.equal(digit58ServiceDurationMinutes({}, { durationMinutes: 2 }), 5); // floor of 5 minutes
});

test("digit58LunchBreakRange() returns null unless enabled, else a 60-minute window", () => {
  assert.equal(digit58LunchBreakRange({ lunchBreakEnabled: false }), null);
  assert.deepEqual(digit58LunchBreakRange({ lunchBreakEnabled: true }), { start: 780, end: 840 }); // default 13:00
  assert.deepEqual(digit58LunchBreakRange({ lunchBreakEnabled: true, lunchBreakStart: "14:15" }), { start: 855, end: 915 });
});

// ---- pricing / payment ----

test("digit58PlanAmount() rounds the monthly price for the configured plan", () => {
  assert.equal(digit58PlanAmount(699, "1m"), 699);
});

test("buildDigit58UpiUri() returns empty string without a UPI id, else a valid upi:// link", () => {
  assert.equal(buildDigit58UpiUri("", "Store", 100, "ref1"), "");
  const uri = buildDigit58UpiUri("store@upi", "My Store", 149.5, "order123");
  assert.ok(uri.startsWith("upi://pay?"));
  const params = new URLSearchParams(uri.split("?")[1]);
  assert.equal(params.get("pa"), "store@upi");
  assert.equal(params.get("am"), "149.50");
  assert.equal(params.get("cu"), "INR");
  assert.ok(params.get("tr").startsWith("58"));
});

// ---- business reviews ----

test("sanitiseBusinessReview() clamps rating and normalises whitespace", () => {
  const review = sanitiseBusinessReview({ rating: 4, name: "  Jane   Doe ", comment: "Great   service" }, "rater1", null);
  assert.equal(review.rating, 4);
  assert.equal(review.name, "Jane Doe");
  assert.equal(review.comment, "Great service");
  assert.equal(review.raterId, "rater1");
});

test("sanitiseBusinessReview() rejects out-of-range ratings and missing names", () => {
  assert.throws(() => sanitiseBusinessReview({ rating: 0, name: "Jane" }, "r1", null), /1 to 5 stars/);
  assert.throws(() => sanitiseBusinessReview({ rating: 6, name: "Jane" }, "r1", null), /1 to 5 stars/);
  assert.throws(() => sanitiseBusinessReview({ rating: 5, name: "J" }, "r1", null), /1 to 5 stars/);
});

test("sanitiseBusinessReview() blocks links and promotional handles in the comment", () => {
  assert.throws(() => sanitiseBusinessReview({ rating: 5, name: "Jane", comment: "call me at @jane" }, "r1", null), /Links and promotional/);
  assert.throws(() => sanitiseBusinessReview({ rating: 5, name: "Jane", comment: "visit https://example.com" }, "r1", null), /Links and promotional/);
});

test("sanitiseBusinessReview() preserves the id and created time when updating", () => {
  const existing = { id: "review-1", created: 1000 };
  const updated = sanitiseBusinessReview({ rating: 2, name: "Jane" }, "r1", existing);
  assert.equal(updated.id, "review-1");
  assert.equal(updated.created, 1000);
  assert.ok(updated.updated > 0);
});

// ---- data retention ----

test("closedHistoryRecord() recognises terminal statuses per record kind", () => {
  assert.equal(closedHistoryRecord("digital_order_owner1", { status: "Completed" }), true);
  assert.equal(closedHistoryRecord("digital_order_owner1", { status: "Pending" }), false);
  assert.equal(closedHistoryRecord("digit58_order_owner1", { status: "Delivered" }), true);
  assert.equal(closedHistoryRecord("digit58_booking_owner1", { status: "Completed" }), true);
  assert.equal(closedHistoryRecord("bookings", { status: "Confirmed", expiresAt: "2020-01-01" }), true);
  assert.equal(closedHistoryRecord("bookings", { status: "Confirmed", expiresAt: "2999-01-01" }), false);
  assert.equal(closedHistoryRecord("unrelated_kind", { status: "Completed" }), false);
});

test("recordTime() picks the most relevant timestamp and falls back to 0", () => {
  assert.equal(recordTime({ completedAt: "2026-01-01T00:00:00Z" }), Date.parse("2026-01-01T00:00:00Z"));
  assert.equal(recordTime({}), 0);
  assert.equal(recordTime({ createdAt: "not a date" }), 0);
});

// ---- digital stay ----

test("stayNightCount() counts full nights between check-in and check-out", () => {
  assert.equal(stayNightCount("2026-01-01", "2026-01-03"), 2);
  assert.equal(stayNightCount("2026-01-01", "2026-01-01"), 0);
});

test("stayOverlaps() detects date-range conflicts between stays", () => {
  const row = { checkInDate: "2026-01-05", checkOutDate: "2026-01-08" };
  assert.equal(stayOverlaps(row, "2026-01-06", "2026-01-07"), true); // fully inside
  assert.equal(stayOverlaps(row, "2026-01-01", "2026-01-05"), false); // ends exactly at check-in
  assert.equal(stayOverlaps(row, "2026-01-08", "2026-01-10"), false); // starts exactly at check-out
  assert.equal(stayOverlaps(row, "2026-01-07", "2026-01-10"), true); // overlaps the tail
});

// ---- subscriptions ----

test("nextDeliveryDate() returns empty string with no delivery days configured", () => {
  assert.equal(nextDeliveryDate([], "12:00", new Date("2026-01-01T00:00:00Z")), "");
});

test("nextDeliveryDate() finds the next matching weekday at the configured IST time", () => {
  // Thursday 2026-01-01T00:00:00Z (05:30 IST) — deliveryDays 4 = Thursday.
  const result = nextDeliveryDate([4], "18:00", new Date("2026-01-01T00:00:00Z"));
  assert.ok(result);
  const parsed = new Date(result);
  // 18:00 IST == 12:30 UTC.
  assert.equal(parsed.toISOString(), "2026-01-01T12:30:00.000Z");
});

// ---- medicine courses ----

test("cleanMedicineInput() validates name, time format and day count", () => {
  const med = cleanMedicineInput({ name: "Paracetamol", time: "08:30", days: 5 });
  assert.equal(med.name, "Paracetamol");
  assert.equal(med.time, "08:30");
  assert.equal(med.days, 5);
  assert.throws(() => cleanMedicineInput({ name: "", time: "08:30", days: 5 }), /medicine name/);
  assert.throws(() => cleanMedicineInput({ name: "X", time: "25:00", days: 5 }), /valid medicine time/);
  // NOTE: days is clamped to a 1-365 range via Math.max(1, ...) *before* the
  // "!days" guard runs, so that guard can never actually fire — days:0 (or
  // missing) silently becomes a 1-day course instead of being rejected. This
  // documents the real behavior; see the flagged finding for the owning code.
  assert.equal(cleanMedicineInput({ name: "X", time: "08:30", days: 0 }).days, 1);
});

// ---- push notification copy ----

test("digit58PushMessageForOrder() builds status-specific copy and a deep link", () => {
  const msg = digit58PushMessageForOrder({ id: "order123456", status: "Delivered", ownerId: "o1", storeId: "s1" });
  assert.match(msg.title, /delivered/i);
  assert.match(msg.body, /123456/);
  assert.equal(msg.url, "/digit58/#store&owner=o1&store=s1");
});

test("digit58PushMessageForOrder() falls back to a generic message for unknown statuses", () => {
  const msg = digit58PushMessageForOrder({ id: "orderabc", status: "Something Else" });
  assert.match(msg.body, /Something Else/);
});

// ---- referral codes / row ids ----

test("generateReferralCode() produces a 6-character code from the safe alphabet", () => {
  const code = generateReferralCode();
  assert.equal(code.length, 6);
  assert.match(code, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
});

test("digit58EntitlementRowId() and digit58ReferrerProfileRowId() are deterministic and length-capped", () => {
  assert.equal(digit58EntitlementRowId("owner1"), "d58-owner1");
  assert.equal(digit58ReferrerProfileRowId("user1"), "refp-user1");
  const longId = "x".repeat(50);
  assert.equal(digit58EntitlementRowId(longId).length, 34); // "d58-" + 30 chars
});
