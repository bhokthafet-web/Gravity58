import { test, expect } from "@playwright/test";
import { monitorPageErrors } from "./helpers.js";

test("G58 API adapter supports CRUD, filters and slot upserts", async ({ page }) => {
  const store = new Map();
  await page.route("http://localhost:8088/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace("/api/v1", "");
    const method = request.method();
    const match = path.match(/^\/records\/([^/]+)(?:\/([^/]+))?$/);
    if (!match) return route.fulfill({ status: 404, json: { error: "Not found" } });
    const kind = decodeURIComponent(match[1]);
    const id = match[2] ? decodeURIComponent(match[2]) : "";
    store.set(kind, store.get(kind) || []);
    const rows = store.get(kind);
    if (method === "GET" && !id) {
      const filters = JSON.parse(url.searchParams.get("filters") || "{}");
      return route.fulfill({ json: { rows: rows.filter((row) => Object.entries(filters).every(([key, value]) => row[key] === value)) } });
    }
    if (method === "GET") {
      const row = rows.find((item) => item.id === id);
      return row ? route.fulfill({ json: { row } }) : route.fulfill({ status: 404, json: { error: "Record not found" } });
    }
    if (method === "POST") {
      const body = request.postDataJSON();
      const rowId = body.id || `${kind}-generated`;
      if (rows.some((item) => item.id === rowId)) return route.fulfill({ status: 409, json: { error: "That record already exists" } });
      const row = { id: rowId, $id: rowId, ...body.data };
      rows.unshift(row);
      return route.fulfill({ status: 201, json: { row } });
    }
    if (method === "PATCH") {
      const row = rows.find((item) => item.id === id);
      if (!row) return route.fulfill({ status: 404, json: { error: "Record not found" } });
      Object.assign(row, request.postDataJSON().data);
      return route.fulfill({ json: { row } });
    }
    if (method === "DELETE") {
      store.set(kind, rows.filter((item) => item.id !== id));
      return route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({ status: 405, json: { error: "Method not allowed" } });
  });

  const assertNoErrors = monitorPageErrors(page);
  await page.goto("/tests/fixtures/g58-local.html");
  const result = await page.evaluate(async () => {
    const created = await Gravity58Ads.create("bookings", { customerId: "u1", status: "Requested", amount: 299 }, "booking-1");
    const fetched = await Gravity58Ads.get("bookings", "booking-1");
    await Gravity58Ads.create("bookings", { customerId: "u2", status: "Requested", amount: 599 }, "booking-2");
    const filtered = await Gravity58Ads.list("bookings", { customerId: "u1" });
    const updated = await Gravity58Ads.update("bookings", created.id, { status: "Live" });
    await Gravity58Ads.remove("bookings", "booking-2");
    const slot1 = await Gravity58Ads.upsertSlot({ id: "restaurant-1", restaurantKey: "Cafe|Hyderabad", name: "Cafe", city: "Hyderabad", active: true });
    const slot2 = await Gravity58Ads.upsertSlot({ id: "restaurant-1", restaurantKey: "Cafe|Hyderabad", name: "Cafe Updated", city: "Hyderabad", active: true });
    return {
      configured: Gravity58Ads.configured,
      fetched,
      filtered,
      updated,
      bookings: await Gravity58Ads.list("bookings"),
      slots: await Gravity58Ads.list("slots"),
      slotIds: [slot1.id, slot2.id],
    };
  });
  expect(result.configured).toBe(true);
  expect(result.fetched).toMatchObject({ id: "booking-1", customerId: "u1", amount: 299 });
  expect(result.filtered).toHaveLength(1);
  expect(result.updated.status).toBe("Live");
  expect(result.bookings).toHaveLength(1);
  expect(result.slots).toHaveLength(1);
  expect(result.slots[0].name).toBe("Cafe Updated");
  expect(result.slotIds[0]).toBe(result.slotIds[1]);
  await assertNoErrors();
});
