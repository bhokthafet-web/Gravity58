(function (root) {
  "use strict";

  const REQUIRED_MENU_COLUMNS = ["category", "item_name", "price"];
  const MENU_CSV_TEMPLATE = [
    "category,item_name,description,price,food_type,available,preparation_minutes,preparation_instructions,image_url",
    'Starters,"Veg Spring Rolls","Crispy rolls with vegetables",180,Veg,true,15,false,https://example.com/spring-rolls.jpg',
    'Main Course,"Chicken Biryani","Basmati rice with chicken",320,Non-Veg,true,25,true,https://example.com/chicken-biryani.jpg',
  ].join("\n");

  function normaliseHeader(value) {
    const key = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
    return ({ name: "item_name", item: "item_name", type: "food_type", prep: "preparation_minutes", instructions: "preparation_instructions", image: "image_url" })[key] || key;
  }

  function parseCsv(text) {
    const rows = [];
    let row = [], cell = "", quoted = false;
    const input = String(text || "").replace(/^\uFEFF/, "");
    for (let index = 0; index < input.length; index += 1) {
      const char = input[index];
      if (quoted) {
        if (char === '"' && input[index + 1] === '"') { cell += '"'; index += 1; }
        else if (char === '"') quoted = false;
        else cell += char;
      } else if (char === '"') quoted = true;
      else if (char === ",") { row.push(cell.trim()); cell = ""; }
      else if (char === "\n") { row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); row = []; cell = ""; }
      else if (char !== "\r") cell += char;
    }
    row.push(cell.trim());
    if (row.some(Boolean)) rows.push(row);
    if (quoted) throw new Error("CSV contains an unfinished quoted value");
    return rows;
  }

  function parseMenuCsv(text) {
    const matrix = parseCsv(text);
    if (matrix.length < 2) throw new Error("CSV must contain a header and at least one menu item");
    const headers = matrix.shift().map(normaliseHeader);
    const missing = REQUIRED_MENU_COLUMNS.filter((column) => !headers.includes(column));
    if (missing.length) throw new Error(`Missing required columns: ${missing.join(", ")}`);
    const rows = matrix.map((cells, rowIndex) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]))).filter((row) => row.item_name || row.category || row.price);
    rows.forEach((row, index) => {
      if (!row.item_name || !row.category) throw new Error(`Row ${index + 2}: category and item_name are required`);
      if (row.price === "" || !Number.isFinite(Number(row.price)) || Number(row.price) < 0) throw new Error(`Row ${index + 2}: enter a valid non-negative price`);
      if (row.image_url && !/^https:\/\//i.test(row.image_url)) throw new Error(`Row ${index + 2}: image_url must use HTTPS`);
    });
    return rows;
  }

  function csvBoolean(value, fallback) {
    const normalised = String(value ?? "").trim().toLowerCase();
    if (!normalised) return fallback;
    if (["true", "yes", "1", "available", "enabled"].includes(normalised)) return true;
    if (["false", "no", "0", "unavailable", "disabled"].includes(normalised)) return false;
    return fallback;
  }

  root.Gravity58MenuData = Object.freeze({ MENU_CSV_TEMPLATE, parseCsv, parseMenuCsv, csvBoolean });
})(globalThis);
