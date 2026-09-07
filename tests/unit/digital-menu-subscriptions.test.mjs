import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

const source = readFileSync(resolve("digital-menu/subscription-utils.js"), "utf8");
const context = vm.createContext({ globalThis: {}, Date, Set, Math, Number, String });
vm.runInContext(source, context);
const plans = context.globalThis.Gravity58DigitalPlans;

test("free orders reset at India midnight while processing orders carry for one day", () => {
  const today = new Date("2026-08-12T06:30:00.000Z"); // 12:00 PM IST
  const sameDay = plans.orderRetention({ createdAt: "2026-08-12T01:00:00.000Z", status: "Completed" }, { at: today });
  const completedYesterday = plans.orderRetention({ createdAt: "2026-08-11T10:00:00.000Z", completedAt: "2026-08-11T15:00:00.000Z", status: "Completed" }, { at: today });
  const processingYesterday = plans.orderRetention({ createdAt: "2026-08-11T17:30:00.000Z", status: "Preparing" }, { at: today });
  const carriedCompleted = plans.orderRetention({ createdAt: "2026-08-11T17:30:00.000Z", status: "Completed", retentionCarryDay: "20260812" }, { at: today });
  const nextDay = plans.orderRetention({ createdAt: "2026-08-11T17:30:00.000Z", status: "Preparing", retentionCarryDay: "20260812" }, { at: new Date("2026-08-13T06:30:00.000Z") });

  assert.equal(sameDay.keep, true);
  assert.equal(completedYesterday.keep, false);
  assert.deepEqual({ keep: processingYesterday.keep, carry: processingYesterday.carry, carryDay: processingYesterday.carryDay }, { keep: true, carry: true, carryDay: "20260812" });
  assert.equal(carriedCompleted.keep, true);
  assert.equal(nextDay.keep, false);
});

test("all Digital Menu accounts use the daily reset and one ₹699 monthly plan", () => {
  const at = new Date("2026-08-12T06:30:00.000Z");
  const completedYesterday = plans.orderRetention({ createdAt: "2026-08-11T10:00:00.000Z", status: "Completed" }, { premium: true, at });
  const activeYesterday = plans.orderRetention({ createdAt: "2026-08-11T10:00:00.000Z", status: "Preparing" }, { premium: true, at });
  const pricing = plans.normalisePricing({ standardMonthly: 999, premiumMonthly: 1299, links: { premium_1m: "https://pay.example.com/monthly" } });
  assert.equal(completedYesterday.keep, false);
  assert.equal(activeYesterday.keep, true);
  assert.equal(activeYesterday.carry, true);
  assert.equal(pricing.monthly, 699);
  assert.equal(pricing.periods.length, 1);
  assert.equal(plans.priceFor(pricing.monthly, pricing.periods[0]), 699);
  assert.equal(pricing.links.paid_1m, "https://pay.example.com/monthly");
});

test("free reset countdown targets the next India midnight", () => {
  assert.equal(plans.resetCountdown(new Date("2026-08-12T18:29:30.000Z")), "00h 00m 30s");
  assert.equal(plans.indiaDayKey(new Date("2026-08-12T18:31:00.000Z")), "20260813");
});

test("startOfIndiaDay and nextIndiaMidnight anchor exactly on the IST day boundary", () => {
  const atBoundary = new Date("2026-08-11T18:30:00.000Z"); // exactly 2026-08-12 00:00 IST
  assert.equal(plans.indiaDayKey(atBoundary), "20260812");
  assert.equal(plans.startOfIndiaDay(atBoundary).toISOString(), "2026-08-11T18:30:00.000Z");
  assert.equal(plans.nextIndiaMidnight(atBoundary).toISOString(), "2026-08-12T18:30:00.000Z");
  // one millisecond earlier is still the previous India day
  const justBefore = new Date("2026-08-11T18:29:59.999Z");
  assert.equal(plans.indiaDayKey(justBefore), "20260811");
});

test("orderRetention keeps orders whose createdAt is missing, unparsable or in the future", () => {
  const at = new Date("2026-08-12T06:30:00.000Z");
  const asPlainResult = (result) => ({ keep: result.keep, carry: result.carry });
  assert.deepEqual(asPlainResult(plans.orderRetention({ status: "Completed" }, { at })), { keep: true, carry: false });
  assert.deepEqual(asPlainResult(plans.orderRetention({ createdAt: "not-a-date", status: "Completed" }, { at })), { keep: true, carry: false });
  // createdAt one India-day ahead of "now" (clock skew) must not be purged
  assert.deepEqual(asPlainResult(plans.orderRetention({ createdAt: "2026-08-13T10:00:00.000Z", status: "Completed" }, { at })), { keep: true, carry: false });
});

test("priceFor rounds monthly amount by months and percentage discount, defaulting an absent period to one month with no discount", () => {
  assert.equal(plans.priceFor(699, undefined), 699);
  assert.equal(plans.priceFor(1000, { months: 3, discount: 10 }), 2700);
  assert.equal(plans.priceFor(699, { months: 1, discount: 7 }), 650); // 699 * 0.93 = 650.07 -> rounds to 650
  assert.equal(plans.priceFor(0, { months: 6, discount: 50 }), 0);
});

test("normalisePricing defaults to an empty payment link and forces the ₹699 monthly plan even with no input", () => {
  const pricing = plans.normalisePricing();
  assert.equal(pricing.monthly, 699);
  assert.equal(pricing.standardMonthly, 699);
  assert.equal(pricing.premiumMonthly, 699);
  assert.equal(pricing.links.paid_1m, "");
  assert.equal(pricing.periods.length, 1);
  assert.equal(pricing.periods[0].id, "1m");
});

test("ACTIVE_ORDER_STATUSES contains exactly the in-flight order states", () => {
  for (const status of ["Payment Verification", "Pending", "Accepted", "Preparing", "Ready", "Scheduled"]) {
    assert.equal(plans.ACTIVE_ORDER_STATUSES.has(status), true, `${status} should be treated as active`);
  }
  for (const status of ["Completed", "Rejected", "Payment Rejected", ""]) {
    assert.equal(plans.ACTIVE_ORDER_STATUSES.has(status), false, `${status} should not be treated as active`);
  }
});
