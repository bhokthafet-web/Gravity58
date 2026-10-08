import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../../digital-menu/app-v11.js", import.meta.url), "utf8");
const pick = (name) => source.match(new RegExp(`function ${name}\\([^\\n]*\\n?`))?.[0];
const load = () => new Function(`${pick("formatToken")}\n${pick("isTakeawayOrder")}\n${pick("orderServiceLabel")}\nreturn { isTakeawayOrder, orderServiceLabel };`)();

test("a name-less counter order is a TakeAway; table and named counter orders are unchanged", () => {
  const { isTakeawayOrder, orderServiceLabel } = load();
  assert.equal(isTakeawayOrder({ serviceMode: "counter", customerName: "" }), true);
  assert.equal(isTakeawayOrder({ serviceMode: "takeaway", customerName: "  " }), true);
  assert.equal(isTakeawayOrder({ serviceMode: "counter", customerName: "Asha" }), false);
  assert.equal(isTakeawayOrder({ serviceMode: "table", customerName: "" }), false);
  assert.equal(orderServiceLabel({ serviceMode: "table", tableNumber: "12" }), "Table 12");
  assert.equal(orderServiceLabel({ serviceMode: "counter", customerName: "Asha" }), "Single Counter");
  assert.equal(orderServiceLabel({ serviceMode: "counter", customerName: "Asha" }, "Counter"), "Counter");
  assert.equal(orderServiceLabel({ serviceMode: "counter", customerName: "" }), "TakeAway");
});

test("TakeAway is an owner setting that is off by default and published to the customer menu", () => {
  assert.match(source, /'ordersEnabled','takeawayEnabled'/);
  assert.match(source, /<select name="takeawayEnabled">.*?Disabled.*?Enabled/s);
  assert.match(source, /takeawayEnabled:values\.takeawayEnabled==='true'/);
  assert.ok(source.includes("${r.takeawayEnabled===true?'<label class=") && source.includes("takeaway-choice"));
});

test("TakeAway reuses the existing counter order path so name and table are not required", () => {
  assert.match(source, /const serviceMode=takeaway\?'counter':d\.serviceMode;/);
  assert.match(source, /customerName=takeaway\?'':/);
  assert.match(source, /form\.customerName\.required=mode==='counter'/);
});

test("the existing Identification mode dropdown offers TakeAway and stays in step with the setting", () => {
  assert.match(source, /'Token Number','TakeAway'\]/);
  assert.match(source, /takeawayEnabled:d\.identification==='TakeAway'/g);
});
