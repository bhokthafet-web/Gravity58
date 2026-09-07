import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("advertise booking wizard requires a restaurant, title and description before sending a request", async () => {
  const source = await read("advertise/app.js");
  assert.match(
    source,
    /if\(!restaurantKey\|\|!title\|\|!description\)return toast\('Complete all required fields'\)/,
    "Booking submit handler must reject incomplete requests client-side before calling the API",
  );
  assert.match(source, /<input id="title" value="[^"]*" required>/, "Ad title field must be required");
  assert.match(source, /<textarea id="description" required>/, "Ad description field must be required");
});

test("advertise account creation requires accepting the retention and permanent-deletion policy", async () => {
  const source = await read("advertise/app.js");
  assert.match(
    source,
    /<input name="retentionAccepted" type="checkbox" required>\s*I accept the <a href="\/terms\/" target="_blank" rel="noopener">Terms<\/a>, including the 1-year order\/booking retention/,
    "Registration form must require accepting the retention policy",
  );
});

test("payment and extension payment proof submissions require a transaction reference", async () => {
  const source = await read("advertise/app.js");
  assert.match(
    source,
    /<label>Transaction \/ UTR reference<\/label><input name="paymentReference" required minlength="4">/,
    "Proof dialog must require a non-trivial payment reference",
  );
});

test("uploaded creative and payment-proof media is validated client-side before use", async () => {
  const source = await read("advertise/app.js");
  const uploadSites = [...source.matchAll(/\.onchange=event=>\{[^}]*?try\{api\.validateMediaFile\?\.\(\w+\)\}catch\(error\)/g)];
  assert.ok(uploadSites.length >= 2, "Both the creative studio and booking wizard file inputs must call api.validateMediaFile before use");
});

test("advertise history mounts the shared data-retention control under the 'service' product key", async () => {
  const advertiseSource = await read("advertise/app.js");
  const retentionSource = await read("js/data-retention.js");
  assert.match(advertiseSource, /window\.G58DataRetention\?\.mount\(\{host:'#retentionControl',product:'service',rows:history,afterDelete:dashboard\}\)/);
  assert.match(retentionSource, /service: new Set\(/, "data-retention.js must recognise the 'service' product used by advertise/app.js");
});

test("advertise never renders raw HTML for advertiser-supplied text (title, description, restaurant key)", async () => {
  const source = await read("advertise/app.js");
  assert.match(source, /esc\(booking\.title\|\|slot\?\.name\|\|booking\.slotId\)/);
  assert.match(source, /esc\(booking\.restaurantKey\)/);
  assert.match(source, /esc\(slot\?\.name\|\|booking\.slotId\)/);
});

test("advertise and team-admin agree on the money and countdown-timer formatting helpers", async () => {
  const advertiseSource = await read("advertise/app.js");
  const adminSource = await read("team-admin/app.js");
  const moneyFormula = "money=value=>`₹${Number(value||0).toLocaleString('en-IN')}`";
  assert.ok(advertiseSource.includes(moneyFormula), "advertise/app.js money formatter changed");
  assert.ok(adminSource.includes(moneyFormula), "team-admin/app.js money formatter changed");
  const countdownFormula = "const days=Math.floor(ms/864e5),hours=Math.floor(ms%864e5/36e5),minutes=Math.floor(ms%36e5/6e4);return`${days?days+'d ':''}${hours}h ${minutes}m remaining`";
  assert.ok(advertiseSource.includes(countdownFormula), "advertise/app.js countdown formula changed");
  assert.ok(adminSource.includes(countdownFormula), "team-admin/app.js countdown formula changed");
});

test("advertise config exposes only the public G58 endpoint, matching team-admin's endpoint", async () => {
  const advertiseConfig = await read("advertise/config.js");
  const adminConfig = await read("team-admin/config.js");
  const [advertiseEndpoint] = advertiseConfig.match(/endpoint:\s*"([^"]+)"/) ?? [];
  const [adminEndpoint] = adminConfig.match(/endpoint:\s*"([^"]+)"/) ?? [];
  assert.ok(advertiseEndpoint, "advertise/config.js is missing a g58 endpoint");
  assert.equal(advertiseEndpoint, adminEndpoint, "advertise and team-admin must target the same G58 Core endpoint");
});
