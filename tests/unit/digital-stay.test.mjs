import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = path => readFileSync(resolve(path), "utf8");

test("Digital Stay is selectable and exposes the complete owner workspace", () => {
  const app = read("digit58/app.js");
  assert.match(app, /name="businessType" value="digital_stay"/);
  assert.match(app, /<strong>Digital Stay<\/strong>/);
  for (const feature of [
    "Room Types",
    "Rooms",
    "Add-ons & Room Service",
    "Stay Settings",
    "Stay Bookings",
    "Room Service Orders",
    "Stay History",
  ]) assert.match(app, new RegExp(feature.replace(/[&]/g, "&")));
});

test("Digital Stay guest flow requires private ID review before payment and allocation", () => {
  const app = read("digit58/app.js");
  const actions = read("g58-core/src/actions.js");
  const api = read("js/g58-api.js");
  const server = read("g58-core/src/server.js");

  assert.match(api, /async function uploadStayIdentity/);
  assert.match(api, /uploadMedia\(file, "stay-identity"\)/);
  assert.match(server, /\["payment-receipt", "stay-identity"\]\.includes\(purpose\)/);
  assert.match(actions, /status: 'Identity Review'/);
  assert.match(actions, /Only the hotel owner can review guest identity/);
  assert.match(actions, /identityDeletedAt: updatedAt/);
  assert.match(actions, /status: 'Pending Payment'/);
  assert.match(actions, /status: 'Confirmed', paymentStatus: 'Verified'/);
  assert.match(actions, /randomInt\(100000, 1000000\)/);
  assert.match(app, /Approve ID & Send Payment/);
  assert.match(app, /Payment QR is now visible to the guest/);
});

test("Digital Stay prevents room overlap and limits room service to a confirmed stay", () => {
  const actions = read("g58-core/src/actions.js");
  assert.match(actions, /const stayOverlaps/);
  assert.match(actions, /No room is available for these dates/);
  assert.match(actions, /Room service becomes available after the stay is confirmed/);
  assert.match(actions, /Room service is available during your stay/);
  assert.match(actions, /orderType: 'room_service'/);
  for (const action of [
    "digit58-get-stay-availability",
    "digit58-create-stay-booking",
    "digit58-review-stay-identity",
    "digit58-mark-stay-payment",
    "digit58-confirm-stay-payment",
    "digit58-create-room-service-order",
  ]) assert.match(actions, new RegExp(action));
});

test("one G58 subscription includes five mixed business locations", () => {
  const app = read("digit58/app.js");
  const actions = read("g58-core/src/actions.js");
  const admin = read("team-admin/app.js");
  assert.match(app, /Math\.max\(5,Number\(entitlement\?\.storeSlots\)\|\|5\)/);
  assert.match(app, /One ₹699 subscription includes up to 5 stores, service businesses, game zones, restaurants or hotels/);
  assert.match(actions, /storeSlots: 5/);
  assert.match(admin, /Grant Five More Location Slots/);
});

test("Digital Stay is discoverable on the public G58 website", () => {
  const home = read("index.html");
  const guide = read("refills-guide/index.html");
  assert.match(home, /G58 Digital Stay/);
  assert.match(home, /Explore Digital Stay/);
  assert.match(guide, /id="digital-stay"/);
  assert.match(guide, /Take Hotel Bookings Without Setup Hassle/);
});
