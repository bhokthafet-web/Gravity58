import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

function loadDataRetention() {
  const source = readFileSync(resolve("js/data-retention.js"), "utf8");
  const context = { window: {}, console };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context.window.G58DataRetention;
}

test("eligibleRows keeps only closed digital-menu order statuses", () => {
  const retention = loadDataRetention();
  const rows = [
    { id: 1, status: "Completed" },
    { id: 2, status: "Rejected" },
    { id: 3, status: "Payment Rejected" },
    { id: 4, status: "Cancelled" },
    { id: 5, status: "Pending" },
    { id: 6, status: "Accepted" },
    { id: 7, status: "Preparing" },
    { id: 8, status: "Ready" },
  ];
  const eligible = retention.eligibleRows("digital-menu", rows).map((row) => row.id);
  assert.deepEqual(eligible.sort(), [1, 2, 3, 4]);
});

test("eligibleRows keeps only closed refills (store order + booking) statuses", () => {
  const retention = loadDataRetention();
  const rows = [
    { id: 1, status: "Delivered" },
    { id: 2, status: "Completed" },
    { id: 3, status: "Rejected" },
    { id: 4, status: "Cancelled" },
    { id: 5, status: "Requested" },
    { id: 6, status: "Priced" },
    { id: 7, status: "Accepted" },
    { id: 8, status: "Preparing" },
    { id: 9, status: "Out for Delivery" },
  ];
  const eligible = retention.eligibleRows("refills", rows).map((row) => row.id);
  assert.deepEqual(eligible.sort(), [1, 2, 3, 4]);
});

test("eligibleRows for service also sweeps up rows whose expiresAt has already passed", () => {
  const retention = loadDataRetention();
  const past = new Date(Date.now() - 86400000).toISOString();
  const future = new Date(Date.now() + 86400000).toISOString();
  const rows = [
    { id: 1, status: "Completed" },
    { id: 2, status: "Active", expiresAt: past }, // expired but status never changed
    { id: 3, status: "Active", expiresAt: future }, // still running, must stay
    { id: 4, status: "Open" },
  ];
  const eligible = retention.eligibleRows("service", rows).map((row) => row.id);
  assert.deepEqual(eligible.sort(), [1, 2]);
});

test("eligibleRows treats POS bills as never automatically eligible (owner-driven deletion only)", () => {
  const retention = loadDataRetention();
  const rows = [{ id: 1, status: "received" }, { id: 2, status: "cancelled" }];
  assert.deepEqual(retention.eligibleRows("pos", rows), rows);
});

test("toCsv escapes embedded quotes/commas and unions column headers across mixed rows", () => {
  const retention = loadDataRetention();
  const csv = retention.toCsv([
    { billNumber: "G58-1", note: 'Contains a "quote", and a comma' },
    { billNumber: "G58-2", total: 250 },
  ]);
  const lines = csv.trim().split("\n");
  assert.equal(lines.length, 3); // header + 2 rows
  assert.match(lines[0], /billNumber/);
  assert.match(lines[0], /note/);
  assert.match(lines[0], /total/);
  assert.match(lines[1], /"Contains a ""quote"", and a comma"/);
  assert.equal(retention.toCsv([]), "");
});
