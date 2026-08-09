import { test, expect } from "@playwright/test";
import { monitorPageErrors } from "./helpers.js";

test("Appwrite adapter local fallback supports CRUD, filters, slots and change events", async ({ page }) => {
  const assertNoErrors = monitorPageErrors(page);
  await page.goto("/tests/fixtures/appwrite-local.html");
  const result = await page.evaluate(async () => {
    let events = 0;
    window.addEventListener("g58-ad-data-changed", () => events += 1);
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
      events,
    };
  });
  expect(result.configured).toBe(false);
  expect(result.fetched).toMatchObject({ id: "booking-1", customerId: "u1", amount: 299 });
  expect(result.filtered).toHaveLength(1);
  expect(result.updated.status).toBe("Live");
  expect(result.bookings).toHaveLength(1);
  expect(result.slots).toHaveLength(1);
  expect(result.slots[0].name).toBe("Cafe Updated");
  expect(result.slotIds[0]).toBe(result.slotIds[1]);
  expect(result.events).toBeGreaterThanOrEqual(5);
  await assertNoErrors();
});
