import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

const source = readFileSync(resolve("digital-menu/menu-data-utils.js"), "utf8");
const context = vm.createContext({ globalThis: {} });
vm.runInContext(source, context);
const menuData = context.globalThis.Gravity58MenuData;

test("digital menu CSV parser supports quoted values and normalises aliases", () => {
  const rows = menuData.parseMenuCsv([
    "category,name,description,price,type,available,prep,instructions,image",
    'Starters,"Paneer, Pepper Fry","Fresh, spicy paneer",249,Veg,yes,18,enabled,paneer.jpg',
  ].join("\n"));

  assert.equal(rows.length, 1);
  assert.equal(rows[0].item_name, "Paneer, Pepper Fry");
  assert.equal(rows[0].description, "Fresh, spicy paneer");
  assert.equal(rows[0].food_type, "Veg");
  assert.equal(rows[0].image_file, "paneer.jpg");
  assert.equal(menuData.csvBoolean(rows[0].available, false), true);
  assert.equal(menuData.csvBoolean(rows[0].preparation_instructions, false), true);
});

test("digital menu CSV parser rejects missing columns and invalid prices", () => {
  assert.throws(() => menuData.parseMenuCsv("item_name,price\nTea,30"), /Missing required columns: category/);
  assert.throws(() => menuData.parseMenuCsv("category,item_name,price\nDrinks,Tea,free"), /valid non-negative price/);
});

test("download template contains every supported menu field", () => {
  const header = menuData.MENU_CSV_TEMPLATE.split("\n")[0];
  for (const column of ["category", "item_name", "description", "price", "food_type", "available", "preparation_minutes", "preparation_instructions", "image_file"]) {
    assert.ok(header.includes(column), `Template is missing ${column}`);
  }
});

test("download template itself is importable without errors", () => {
  const rows = menuData.parseMenuCsv(menuData.MENU_CSV_TEMPLATE);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].item_name, "Veg Spring Rolls");
  assert.equal(rows[1].item_name, "Chicken Biryani");
});

test("digital menu CSV parser rejects each required column individually and reports every missing one", () => {
  assert.throws(() => menuData.parseMenuCsv("category,price\nStarters,30"), /Missing required columns: item_name/);
  assert.throws(() => menuData.parseMenuCsv("category,item_name\nStarters,Tea"), /Missing required columns: price/);
  assert.throws(() => menuData.parseMenuCsv("item_name\nTea"), /Missing required columns: category, price/);
});

test("digital menu CSV import rejects image_file values that look like a path", () => {
  assert.throws(
    () => menuData.parseMenuCsv("category,item_name,price,image_file\nStarters,Tea,30,folder/pic.jpg"),
    /Row 2: image_file must contain a file name only/,
  );
  assert.throws(
    () => menuData.parseMenuCsv("category,item_name,price,image_file\nStarters,Tea,30,..\\secrets.jpg"),
    /Row 2: image_file must contain a file name only/,
  );
  assert.doesNotThrow(() => menuData.parseMenuCsv("category,item_name,price,image_file\nStarters,Tea,30,tea.jpg"));
});

test("digital menu CSV import silently drops rows missing category, item_name and price", () => {
  const rows = menuData.parseMenuCsv([
    "category,item_name,description,price",
    ',,"Notes only row, no real data",',
    "Starters,Tea,,30",
  ].join("\n"));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].item_name, "Tea");
});

test("digital menu CSV parser resolves escaped quotes and tolerates CRLF line endings", () => {
  const rows = menuData.parseMenuCsv('category,item_name,price\r\nStarters,"Chef ""Special"" Dosa",150\r\n');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].item_name, 'Chef "Special" Dosa');
});

test("digital menu CSV parser rejects an unterminated quoted value", () => {
  assert.throws(
    () => menuData.parseCsv('category,item_name,price\nStarters,"Unclosed value,150'),
    /CSV contains an unfinished quoted value/,
  );
});

test("csvBoolean falls back for blank and unrecognised values but recognises common synonyms", () => {
  assert.equal(menuData.csvBoolean("", true), true);
  assert.equal(menuData.csvBoolean(undefined, false), false);
  assert.equal(menuData.csvBoolean("maybe", true), true);
  assert.equal(menuData.csvBoolean("Available", false), true);
  assert.equal(menuData.csvBoolean("Disabled", true), false);
});
