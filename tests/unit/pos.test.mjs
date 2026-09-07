import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

// pos/index.html keeps its billing logic inside a single inline
// `(() => { ... })();` IIFE rather than an importable module. We slice out
// the IIFE body and execute it as a top-level classic script inside a vm
// context: function *declarations* inside that body (formatCurrency,
// validUpiId, getSubtotal, addValue, createUpiLink, localDateKey, ...) are
// hoisted onto the sandbox object exactly like `var`/function bindings on a
// real global object, so they stay reachable even though the very end of
// the script touches DOM ids our stub doesn't fully emulate.
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

function loadPos() {
  const html = readFileSync(resolve("pos/index.html"), "utf8");
  const match = html.match(/<script>\s*\(\(\) => \{([\s\S]*?)\}\)\(\);\s*<\/script>/);
  assert.ok(match, "Could not locate the POS billing IIFE in pos/index.html");
  const body = match[1];

  const elementCache = new Map();
  const document_ = {
    getElementById(id) {
      if (!elementCache.has(id)) elementCache.set(id, makeFakeElement());
      return elementCache.get(id);
    },
    createElement() { return makeFakeElement(); },
    body: makeFakeElement(),
    documentElement: { style: {} },
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
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
    location: { search: "", origin: "http://localhost", pathname: "/pos/", hostname: "localhost" },
    console,
    URLSearchParams,
    Number, String, Array, Object, Math, JSON, Date, RegExp, Boolean, Map, Set, Intl,
    setTimeout, clearTimeout, setInterval, clearInterval,
    navigator: {},
  });
  window_.parent = window_;

  vm.runInContext(body, context);
  return { context, document: document_ };
}

test("POS UPI id and phone validators accept realistic values and reject malformed ones", () => {
  const { context } = loadPos();
  assert.equal(context.validUpiId("shopkeeper@paytm"), true);
  assert.equal(context.validUpiId("a@xy"), false); // local part below the 2-char minimum
  assert.equal(context.validUpiId("no-at-sign"), false);
  assert.equal(context.validUpiId(""), false);

  assert.equal(context.validPhone("9876543210"), true);
  assert.equal(context.validPhone("+91 98765 43210"), true);
  assert.equal(context.validPhone("123"), false); // below the 7-char minimum
  assert.equal(context.validPhone("98765abcde"), false);
});

test("addValue multiplies unit price by quantity and clamps quantity to a positive integer", () => {
  const { context, document } = loadPos();

  document.getElementById("valueInput").value = "150";
  document.getElementById("quantityInput").value = "3";
  document.getElementById("itemNoteInput").value = "Chicken 65";
  context.addValue();

  document.getElementById("valueInput").value = "99.5";
  document.getElementById("quantityInput").value = "2.9"; // fractional quantity must floor, not round
  context.addValue();

  document.getElementById("valueInput").value = "50";
  document.getElementById("quantityInput").value = "-4"; // invalid quantity must clamp up to 1
  context.addValue();

  assert.equal(context.getSubtotal(), 150 * 3 + 99.5 * 2 + 50 * 1);
});

test("addValue rejects zero or negative amounts and does not add a line item", () => {
  const { context, document } = loadPos();
  document.getElementById("valueInput").value = "0";
  document.getElementById("quantityInput").value = "1";
  context.addValue();
  assert.equal(context.getSubtotal(), 0);
  assert.equal(document.getElementById("valueError").style.display, "block");

  document.getElementById("valueInput").value = "-25";
  context.addValue();
  assert.equal(context.getSubtotal(), 0);
});

test("GST is only applied when enabled, and the grand total is subtotal plus GST", () => {
  const { context, document } = loadPos();
  document.getElementById("valueInput").value = "200";
  document.getElementById("quantityInput").value = "1";
  context.addValue();

  assert.equal(context.getSubtotal(), 200);
  assert.equal(context.getGstAmount(), 0, "GST must be zero while disabled");
  assert.equal(context.getGrandTotal(), 200);

  vm.runInContext("Object.assign(settings, {gstEnabled:true, gstPercent:18});", context);
  assert.equal(context.getGstAmount(), 36); // 18% of 200
  assert.equal(context.getGrandTotal(), 236);
});

test("createUpiLink encodes the payee, rounded amount and GST note", () => {
  const { context } = loadPos();
  vm.runInContext("Object.assign(settings, {upiId:'shop@upi', gstEnabled:true, gstPercent:18, posEnabled:false});", context);
  const link = context.createUpiLink(236, "G58-000042");
  const url = new URL(link.replace("upi://pay?", "https://pay.example/?"));
  assert.equal(url.searchParams.get("pa"), "shop@upi");
  assert.equal(url.searchParams.get("am"), "236.00");
  assert.equal(url.searchParams.get("cu"), "INR");
  assert.match(url.searchParams.get("tn"), /Bill G58-000042 incl\. 18% GST/);
});

test("localDateKey formats a date as a zero-padded YYYY-MM-DD local key", () => {
  const { context } = loadPos();
  const key = context.localDateKey(new Date(2026, 0, 5, 12, 0, 0)); // 5 Jan 2026, local time, midday
  assert.equal(key, "2026-01-05");
  const paddedMonthDay = context.localDateKey(new Date(2026, 8, 9, 12, 0, 0)); // 9 Sep 2026
  assert.equal(paddedMonthDay, "2026-09-09");
});

test("reportDateLabel renders a human readable en-IN date from a YYYY-MM-DD key", () => {
  const { context } = loadPos();
  assert.equal(context.reportDateLabel("2026-01-05"), "05 Jan 2026");
  assert.equal(context.reportDateLabel(""), "");
});
