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

// ---- WhatsApp bills (the POS sends bills instead of printing receipts) ----

function sampleBill(overrides = {}) {
  return {
    billNumber: "G58-000012", displayDate: "10/11/2026, 2:30:00 pm",
    upiId: "shop@upi", upiLink: "upi://pay?pa=shop%40upi&am=315.00&cu=INR",
    subtotal: 300, gstAmount: 15, total: 315, customerName: "Ravi", customerPhone: "919876543210",
    settings: { posEnabled: true, brandName: "Tasty Bites", contactNumber: "9000000001", gstEnabled: true, gstPercent: 5, cashierName: "Asha" },
    items: [
      { note: "Masala Dosa", quantity: 2, unitPrice: 120, amount: 240 },
      { note: "Filter Coffee", quantity: 1, unitPrice: 60, amount: 60 },
    ],
    ...overrides,
  };
}

test("customer WhatsApp numbers are normalised to international format", () => {
  const { context } = loadPos();
  assert.equal(context.normaliseWhatsAppNumber("98765 43210"), "919876543210");
  assert.equal(context.normaliseWhatsAppNumber("+91 98765-43210"), "919876543210");
  assert.equal(context.normaliseWhatsAppNumber("09876543210"), "919876543210");
  assert.equal(context.normaliseWhatsAppNumber("447911123456"), "447911123456");
  assert.equal(context.normaliseWhatsAppNumber(""), "");
  assert.equal(context.normaliseWhatsAppNumber("   "), "");
  assert.equal(context.normaliseWhatsAppNumber("12345"), null);
  assert.equal(context.normaliseWhatsAppNumber("1234567890123456"), null);
});

test("an unpaid WhatsApp bill lists the items, totals and UPI payment details", () => {
  const { context } = loadPos();
  const text = context.whatsappBillText(sampleBill());
  for (const expected of [
    "*Tasty Bites*", "9000000001", "Bill G58-000012", "Customer: Ravi", "Billed by: Asha",
    "1. Masala Dosa × 2 - ₹240.00", "2. Filter Coffee × 1 - ₹60.00",
    "Subtotal: ₹300.00", "GST 5%: ₹15.00", "*Total: ₹315.00*",
    "Pay ₹315.00 via UPI", "UPI ID: shop@upi", "upi://pay?pa=shop%40upi", "Powered by GRAVITY58",
  ]) assert.ok(text.includes(expected), `missing: ${expected}\n${text}`);
  assert.ok(!text.includes("Payment received"));
});

test("a paid WhatsApp bill is a receipt without payment instructions", () => {
  const { context } = loadPos();
  const text = context.whatsappBillText(sampleBill(), { paid: true });
  assert.ok(text.includes("Payment received. Thank you!"));
  assert.ok(text.includes("*Total: ₹315.00*"));
  assert.ok(!text.includes("UPI ID") && !text.includes("upi://"));
});

test("business details and GST only appear on the bill when they are switched on", () => {
  const { context } = loadPos();
  const text = context.whatsappBillText(sampleBill({
    customerName: "", settings: { posEnabled: false, brandName: "Hidden", contactNumber: "9", gstEnabled: false, gstPercent: 0, cashierName: "" },
  }));
  assert.ok(text.startsWith("Bill G58-000012"));
  assert.ok(!text.includes("Hidden") && !text.includes("GST") && !text.includes("Customer:") && !text.includes("Billed by"));
});

test("very long bills are summarised so the WhatsApp link stays short enough", () => {
  const { context } = loadPos();
  const items = Array.from({ length: 80 }, (_, index) => ({ note: `Menu item number ${index + 1}`, quantity: 2, unitPrice: 55, amount: 110 }));
  const text = context.whatsappBillText(sampleBill({ items, subtotal: 8800, total: 9240 }));
  assert.ok(encodeURIComponent(text).length <= 1700);
  assert.match(text, /\+ \d+ more item\(s\)/);
  assert.ok(text.includes("*Total: ₹9,240.00*") && text.includes("UPI ID: shop@upi"));
});

test("sending a bill opens WhatsApp for the customer, or the chooser when there is no number", () => {
  const { context } = loadPos();
  const opened = [];
  context.window.open = (url) => { opened.push(url); };
  const errorBox = { style: {} };

  assert.equal(context.sendWhatsAppBill(sampleBill(), { phoneInput: { value: "98765 43210", focus() {} }, errorBox }), true);
  assert.ok(opened[0].startsWith("https://wa.me/919876543210?text="));
  assert.ok(decodeURIComponent(opened[0]).includes("*Total: ₹315.00*"));
  assert.equal(errorBox.style.display, "none");

  assert.equal(context.sendWhatsAppBill(sampleBill({ customerPhone: "" }), {}), true);
  assert.ok(opened[1].startsWith("https://wa.me/?text="));

  assert.equal(context.sendWhatsAppBill(sampleBill(), { phoneInput: { value: "12345", focus() {} }, errorBox }), false);
  assert.equal(errorBox.style.display, "block");
  assert.equal(opened.length, 2, "an invalid number must not open WhatsApp");
});

test("the POS no longer has any receipt printer features", () => {
  const html = readFileSync(resolve("pos/index.html"), "utf8");
  for (const gone of ["window.print", "Print Receipt", "Print Report", "Share to Printer App", "paperWidth", "thermal", "html2canvas", "printReceipt", "POS Printing"]) {
    assert.ok(!html.includes(gone), `${gone} should be gone from the POS page`);
  }
  for (const id of ["sendBillBtn", "whatsappBillBtn", "historyWhatsappBtn", "customerPhone", "billCustomerName"]) assert.ok(html.includes(`id="${id}"`), `missing #${id}`);
});

test("Refills sends bills on WhatsApp and hands the customer's number and name to the POS", () => {
  const source = readFileSync(resolve("digit58/app.js"), "utf8");
  assert.ok(!/Print POS|PRINT_ICON_SVG/.test(source));
  assert.match(source, /modal\('Send Bill on WhatsApp'/);
  assert.match(source, /title="Send bill on WhatsApp">\$\{BILL_ICON_SVG\} Send Bill<\/button>/);
  const fn = source.match(/function posPrintLink\(row,amount,note\)\{[\s\S]*?\n\}/)?.[0];
  assert.ok(fn, "posPrintLink not found");
  const posPrintLink = new Function("storeForRow", `${fn}; return posPrintLink;`)(() => ({ upiId: "shop@upi", name: "Tasty Bites" }));
  const url = new URL(posPrintLink({ phone: "+91 98765 43210", customerName: "Ravi" }, 300.456, "Order #AB12"), "https://g58.in/digit58/");
  assert.equal(url.pathname, "/pos/");
  assert.deepEqual(
    Object.fromEntries(url.searchParams),
    { source: "digit58", embedded: "1", amount: "300.46", note: "Order #AB12", upi: "shop@upi", brand: "Tasty Bites", phone: "+919876543210", customer: "Ravi" },
  );
});
