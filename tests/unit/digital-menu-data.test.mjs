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
    'Starters,"Paneer, Pepper Fry","Fresh, spicy paneer",249,Veg,yes,18,enabled,https://cdn.example.com/paneer.jpg',
  ].join("\n"));

  assert.equal(rows.length, 1);
  assert.equal(rows[0].item_name, "Paneer, Pepper Fry");
  assert.equal(rows[0].description, "Fresh, spicy paneer");
  assert.equal(rows[0].food_type, "Veg");
  assert.equal(menuData.csvBoolean(rows[0].available, false), true);
  assert.equal(menuData.csvBoolean(rows[0].preparation_instructions, false), true);
});

test("digital menu CSV parser rejects missing columns and invalid prices", () => {
  assert.throws(() => menuData.parseMenuCsv("item_name,price\nTea,30"), /Missing required columns: category/);
  assert.throws(() => menuData.parseMenuCsv("category,item_name,price\nDrinks,Tea,free"), /valid non-negative price/);
});

test("download template contains every supported menu field", () => {
  const header = menuData.MENU_CSV_TEMPLATE.split("\n")[0];
  for (const column of ["category", "item_name", "description", "price", "food_type", "available", "preparation_minutes", "preparation_instructions", "image_url"]) {
    assert.ok(header.includes(column), `Template is missing ${column}`);
  }
});
