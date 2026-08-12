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

test("Premium orders are permanent and pricing uses the 10 percent period ladder", () => {
  const oldOrder = plans.orderRetention({ createdAt: "2020-01-01T00:00:00.000Z", status: "Completed" }, { premium: true, at: new Date("2026-08-12T06:30:00.000Z") });
  const pricing = plans.normalisePricing();
  assert.equal(oldOrder.keep, true);
  assert.equal(oldOrder.permanent, true);
  assert.equal(JSON.stringify(pricing.periods.map((period) => plans.priceFor(699, period))), JSON.stringify([699, 3775, 6710, 17615]));
  assert.equal(JSON.stringify(pricing.periods.map((period) => plans.priceFor(1299, period))), JSON.stringify([1299, 7015, 12470, 32735]));
});

test("free reset countdown targets the next India midnight", () => {
  assert.equal(plans.resetCountdown(new Date("2026-08-12T18:29:30.000Z")), "00h 00m 30s");
  assert.equal(plans.indiaDayKey(new Date("2026-08-12T18:31:00.000Z")), "20260813");
});
