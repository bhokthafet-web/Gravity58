(function (root) {
  "use strict";

  const INDIA_OFFSET_MS = 330 * 60 * 1000;
  const ACTIVE_ORDER_STATUSES = new Set([
    "Payment Verification", "Pending", "Accepted", "Preparing", "Ready", "Scheduled",
  ]);
  const DEFAULT_PRICING = {
    monthly: 699,
    standardMonthly: 699,
    premiumMonthly: 699,
    periods: [
      { id: "1m", label: "Monthly Subscription", months: 1, discount: 0 },
    ],
    links: {},
  };

  function indiaParts(value = new Date()) {
    const shifted = new Date(new Date(value).getTime() + INDIA_OFFSET_MS);
    return {
      year: shifted.getUTCFullYear(),
      month: shifted.getUTCMonth() + 1,
      day: shifted.getUTCDate(),
    };
  }

  function indiaDayKey(value = new Date()) {
    const part = indiaParts(value);
    return `${part.year}${String(part.month).padStart(2, "0")}${String(part.day).padStart(2, "0")}`;
  }

  function indiaDayNumber(value = new Date()) {
    const part = indiaParts(value);
    return Math.floor(Date.UTC(part.year, part.month - 1, part.day) / 86400000);
  }

  function startOfIndiaDay(value = new Date()) {
    const part = indiaParts(value);
    return new Date(Date.UTC(part.year, part.month - 1, part.day) - INDIA_OFFSET_MS);
  }

  function nextIndiaMidnight(value = new Date()) {
    return new Date(startOfIndiaDay(value).getTime() + 86400000);
  }

  function resetCountdown(value = new Date()) {
    const milliseconds = Math.max(0, nextIndiaMidnight(value).getTime() - new Date(value).getTime());
    const hours = Math.floor(milliseconds / 3600000);
    const minutes = Math.floor((milliseconds % 3600000) / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    return `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
  }

  function orderRetention(order, { at = new Date() } = {}) {
    const created = order?.createdAt || order?.$createdAt;
    if (!created || Number.isNaN(new Date(created).getTime())) return { keep: true, carry: false };
    const currentDay = indiaDayKey(at);
    const dayDifference = indiaDayNumber(at) - indiaDayNumber(created);
    if (dayDifference <= 0) return { keep: true, carry: false };
    if (dayDifference >= 2) return { keep: false, carry: false };
    if (order.retentionCarryDay === currentDay) return { keep: true, carry: false };
    const start = startOfIndiaDay(at).getTime();
    const terminalTime = new Date(order.completedAt || order.rejectedAt || order.paymentRejectedAt || order.updatedAt || order.$updatedAt || 0).getTime();
    const wasProcessingAtReset = ACTIVE_ORDER_STATUSES.has(order.status) || (Number.isFinite(terminalTime) && terminalTime >= start);
    return wasProcessingAtReset
      ? { keep: true, carry: true, carryDay: currentDay }
      : { keep: false, carry: false };
  }

  function priceFor(monthly, period) {
    const amount = Number(monthly || 0) * Number(period?.months || 1) * (1 - Number(period?.discount || 0) / 100);
    return Math.round(amount);
  }

  function normalisePricing(value = {}) {
    const monthly = DEFAULT_PRICING.monthly;
    const sourceLinks = value.links || {};
    const paymentLink = value.paymentLink || sourceLinks.paid_1m || sourceLinks.premium_1m || sourceLinks.standard_1m || "";
    return {
      ...DEFAULT_PRICING,
      ...value,
      monthly,
      standardMonthly: monthly,
      premiumMonthly: monthly,
      periods: DEFAULT_PRICING.periods.map((period) => ({ ...period })),
      links: { paid_1m: paymentLink },
    };
  }

  root.Gravity58DigitalPlans = Object.freeze({
    INDIA_OFFSET_MS,
    ACTIVE_ORDER_STATUSES,
    DEFAULT_PRICING,
    indiaDayKey,
    startOfIndiaDay,
    nextIndiaMidnight,
    resetCountdown,
    orderRetention,
    priceFor,
    normalisePricing,
  });
})(typeof window !== "undefined" ? window : globalThis);
