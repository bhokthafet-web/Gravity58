import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

// digit58/app.js is a single ~3800-line classic script (not a module) that
// defines the whole Refills/Store/Service/Stay owner+customer app. Its pure
// helpers (money, storeMinimum, buildUpiUri, digit58PlanAmount,
// parseCatalogCsv, medicine-course math, ...) are declared with `function
// name(){}` at the top level, so — exactly like `var` — they are hoisted
// onto the script's global object regardless of what happens later in the
// file. We run the whole source in a stubbed DOM/localStorage vm context
// (swallowing the eventual async boot() failure, since our stub has no real
// UI) and then read those hoisted functions straight off the context.
// `const`/`let` top-level bindings (money, storeMinimum, entitlement, ...)
// are NOT copied onto the global object by the spec, so a short follow-up
// script run in the *same* context (sharing its lexical environment) is
// used to lift them out too.
function makeFakeElement() {
  return {
    style: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    dataset: {},
    children: [],
    value: "",
    textContent: "",
    innerHTML: "",
    className: "",
    disabled: false,
    addEventListener() {},
    removeEventListener() {},
    appendChild() {},
    insertAdjacentHTML() {},
    querySelector() { return makeFakeElement(); },
    querySelectorAll() { return []; },
    closest() { return null; },
    remove() {},
    focus() {},
    click() {},
    scrollIntoView() {},
  };
}

let cachedApi = null;
function loadDigit58() {
  if (cachedApi) return cachedApi;
  const source = readFileSync(resolve("digit58/app.js"), "utf8");

  const elementCache = new Map();
  const document_ = {
    getElementById(id) { if (!elementCache.has(id)) elementCache.set(id, makeFakeElement()); return elementCache.get(id); },
    querySelector(sel) { if (!elementCache.has(sel)) elementCache.set(sel, makeFakeElement()); return elementCache.get(sel); },
    querySelectorAll() { return []; },
    createElement() { return makeFakeElement(); },
    body: makeFakeElement(),
    documentElement: { style: {} },
    addEventListener() {},
    visibilityState: "hidden",
  };
  const backing = new Map();
  const localStorage_ = {
    getItem(k) { return backing.has(k) ? backing.get(k) : null; },
    setItem(k, v) { backing.set(k, String(v)); },
    removeItem(k) { backing.delete(k); },
  };
  const window_ = { addEventListener() {}, removeEventListener() {}, postMessage() {}, scrollTo() {} };
  const context = vm.createContext({
    window: window_,
    document: document_,
    localStorage: localStorage_,
    location: { search: "", origin: "http://localhost", pathname: "/digit58/", hostname: "localhost" },
    console,
    URLSearchParams,
    URL,
    Number, String, Array, Object, Math, JSON, Date, RegExp, Boolean, Map, Set, Intl,
    setTimeout, clearTimeout, setInterval, clearInterval,
    navigator: {},
    history: { replaceState() {} },
  });

  // app.js ends by calling an async boot() that reaches for a full DOM/live
  // API we don't provide; that rejection happens on a later microtask, well
  // after every top-level function/const we care about has already run, so
  // it is harmless noise for this test file specifically.
  const onUnhandledRejection = () => {};
  process.on("unhandledRejection", onUnhandledRejection);
  try {
    vm.runInContext(source, context);
  } finally {
    process.off("unhandledRejection", onUnhandledRejection);
  }

  // Lift the top-level `const`/`let` bindings we need out of the shared
  // lexical scope of this same vm context.
  vm.runInContext("this.__consts = { money, offerPrice, configuredStoreMinimum, storeMinimum, html };", context);

  cachedApi = { ...context.__consts, ...context };
  return cachedApi;
}

test("money() formats INR with Indian digit grouping and defaults falsy values to 0", () => {
  const api = loadDigit58();
  assert.equal(api.money(1234.5), "₹1,234.5");
  assert.equal(api.money(1234567.89), "₹12,34,567.89");
  assert.equal(api.money(0), "₹0");
  assert.equal(api.money(undefined), "₹0");
  assert.equal(api.money(null), "₹0");
});

test("offerPrice appends the '/- only' suffix used on promotion cards", () => {
  const api = loadDigit58();
  assert.equal(api.offerPrice(499), "₹499/- only");
});

test("storeMinimum returns 0 when the owner disabled the minimum, otherwise the configured value clamped at 0", () => {
  const api = loadDigit58();
  assert.equal(api.storeMinimum({ minimumOrderEnabled: false, minimumOrderValue: 500 }), 0);
  assert.equal(api.storeMinimum({ minimumOrderEnabled: true, minimumOrderValue: 500 }), 500);
  assert.equal(api.storeMinimum({ minimumOrderValue: 300 }), 300, "minimum defaults to enabled when the flag is unset");
  assert.equal(api.configuredStoreMinimum({ minimumOrderValue: -50 }), 0, "a negative configured minimum must clamp to 0");
  assert.equal(api.storeMinimum(undefined), 0);
});

test("digit58PlanAmount rounds monthly price by months and percentage discount", () => {
  const api = loadDigit58();
  assert.equal(api.digit58PlanAmount(699, { months: 1, discount: 0 }), 699);
  assert.equal(api.digit58PlanAmount(699, { months: 12, discount: 10 }), Math.round(699 * 12 * 0.9));
  assert.equal(api.digit58PlanAmount(699, { months: 6, discount: 50 }), Math.round(699 * 6 * 0.5));
});

test("storeSlotsAllowed guarantees a floor of 5 slots even with no/low entitlement", () => {
  const api = loadDigit58();
  assert.equal(api.storeSlotsAllowed(), 5);
});

test("buildUpiUri builds a upi://pay link with a rounded 2-decimal amount, or '' with no UPI id", () => {
  const api = loadDigit58();
  const link = api.buildUpiUri("shop@upi", "My Shop", 199.5, "order-123");
  const url = new URL(link.replace("upi://pay?", "https://pay.example/?"));
  assert.equal(url.searchParams.get("pa"), "shop@upi");
  assert.equal(url.searchParams.get("pn"), "My Shop");
  assert.equal(url.searchParams.get("am"), "199.50");
  assert.equal(url.searchParams.get("cu"), "INR");
  assert.equal(api.buildUpiUri("", "My Shop", 100, "order-1"), "");
});

test("validRazorpayLink only accepts https razorpay.me / rzp.io links", () => {
  const api = loadDigit58();
  assert.equal(api.validRazorpayLink("https://razorpay.me/@myshop"), true);
  assert.equal(api.validRazorpayLink("https://rzp.io/l/abc123"), true);
  assert.equal(api.validRazorpayLink("http://razorpay.me/@myshop"), false, "non-https must be rejected");
  assert.equal(api.validRazorpayLink("https://evil.com/razorpay.me"), false, "a lookalike host must be rejected");
  assert.equal(api.validRazorpayLink(""), false);
  assert.equal(api.normaliseRazorpayLink("razorpay.me/@myshop"), "https://razorpay.me/@myshop");
});

test("parseCsvText handles quoted commas and parseCatalogCsv validates required columns and prices", () => {
  const api = loadDigit58();
  // Arrays/objects created inside the vm context belong to a different
  // realm (different Array/Object intrinsics), so round-trip through JSON
  // before comparing structurally with node:assert.
  const rows = JSON.parse(JSON.stringify(api.parseCsvText('item_name,price,unit\nMilk 1L,60,pack\n"Water, 20L",80,can\n')));
  assert.deepEqual(rows, [
    ["item_name", "price", "unit"],
    ["Milk 1L", "60", "pack"],
    ["Water, 20L", "80", "can"],
  ]);

  const items = JSON.parse(JSON.stringify(api.parseCatalogCsv("item_name,price,unit\nMilk 1L,60,pack\nDrinking Water 20L,80,can\n")));
  assert.deepEqual(items, [
    { name: "Milk 1L", price: 60, unit: "pack" },
    { name: "Drinking Water 20L", price: 80, unit: "can" },
  ]);

  assert.throws(() => api.parseCatalogCsv("item_name,unit\nMilk,pack\n"), /item_name and price columns/);
  assert.throws(() => api.parseCatalogCsv("item_name,price\nMilk,not-a-number\n"), /Invalid price/);
});

test("isMedicalStore matches pharmacy-style category names", () => {
  const api = loadDigit58();
  assert.equal(api.isMedicalStore({ category: "Medical Store" }), true);
  assert.equal(api.isMedicalStore({ category: "Chemist & Druggist" }), true);
  assert.equal(api.isMedicalStore({ category: "Grocery" }), false);
  assert.equal(api.isMedicalStore({}), false);
});

test("medicine course completion tracks elapsed days against the prescribed duration", () => {
  const api = loadDigit58();
  const longAgo = new Date(Date.now() - 30 * 86400000).toISOString(); // 30 real days ago
  const justNow = new Date().toISOString();

  assert.equal(api.isMedicineComplete({ startedAt: longAgo, days: 5 }), true, "a 5-day course started 30 days ago must be complete");
  assert.equal(api.isMedicineComplete({ startedAt: justNow, days: 9999 }), false, "a course requiring 9999 days cannot be complete on day 0");

  const course = {
    medicines: [
      { startedAt: longAgo, days: 5 }, // finished long ago
      { startedAt: justNow, days: 9999 }, // still running
    ],
  };
  assert.equal(api.isCourseComplete(course), false, "a course is only complete once every medicine in it is complete");

  const finishedCourse = { medicines: [{ startedAt: longAgo, days: 1 }, { startedAt: longAgo, days: 2 }] };
  assert.equal(api.isCourseComplete(finishedCourse), true);
});
