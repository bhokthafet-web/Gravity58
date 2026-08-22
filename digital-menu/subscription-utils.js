(function (root) {
  "use strict";

  const INDIA_OFFSET_MS = 330 * 60 * 1000;
  const ACTIVE_ORDER_STATUSES = new Set([
    "Payment Verification", "Pending", "Accepted", "Preparing", "Ready", "Scheduled",
  ]);
  const DEFAULT_PRICING = {
    standardMonthly: 699,
    premiumMonthly: 1299,
    periods: [
      { id: "1m", label: "1 Month", months: 1, discount: 0 },
      { id: "6m", label: "6 Months", months: 6, discount: 10 },
      { id: "1y", label: "1 Year", months: 12, discount: 20 },
      { id: "3y", label: "3 Years", months: 36, discount: 30 },
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

  function orderRetention(order, { premium = false, at = new Date() } = {}) {
    const created = order?.createdAt || order?.$createdAt;
    if (!created || Number.isNaN(new Date(created).getTime())) return { keep: true, carry: false };
    if (premium) {
      if (ACTIVE_ORDER_STATUSES.has(order?.status)) return { keep: true, retained: true, carry: false };
      const age = new Date(at).getTime() - new Date(created).getTime();
      return { keep: age < 365 * 86400000, retained: true, carry: false };
    }
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
    return {
      ...DEFAULT_PRICING,
      ...value,
      periods: Array.isArray(value.periods) && value.periods.length ? value.periods : DEFAULT_PRICING.periods,
      links: { ...DEFAULT_PRICING.links, ...(value.links || {}) },
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
