import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

// Extracts the source of a top-level `function name(...)` or `async function name(...)`
// declaration by counting braces, so multi-line minified bodies can be inspected in isolation.
function functionBody(source, name) {
  const signature = new RegExp(`(?:async\\s+)?function ${name}\\(`);
  const match = signature.exec(source);
  if (!match) return null;
  const braceStart = source.indexOf("{", match.index);
  if (braceStart < 0) return null;
  let depth = 0;
  for (let i = braceStart; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(match.index, i + 1);
    }
  }
  return null;
}

test("private team-admin console is excluded from search indexing", async () => {
  const html = await read("team-admin/index.html");
  assert.match(
    html,
    /<meta name="robots" content="noindex,nofollow">/,
    "team-admin/index.html must opt out of indexing like other private tool pages (templates/editor, templates/preview)",
  );
});

test("boot and login both gate access behind an authenticated team-admin role check", async () => {
  const source = await read("team-admin/app.js");
  assert.match(
    source,
    /async function boot\(\)\{if\(!api\.configured\)return configurationRequired\(\);user=await api\.currentUser\(\)\.catch\(\(\)=>null\);if\(!user\)return login\(\);if\(!await api\.isTeamAdmin\(\)\.catch\(\(\)=>false\)\)return accessDenied\(\);/,
    "boot() must deny non-admin sessions before loading admin data",
  );
  assert.match(
    source,
    /if\(!await api\.isTeamAdmin\(\)\)\{await api\.logout\(\);throw new Error\('This account is not a member of the G58 administration team\.'\)\}/,
    "login() must sign out and reject any account that is not a team admin",
  );
  assert.doesNotMatch(source, /admin(?:Password|Secret)\s*[:=]\s*["']/i, "No embedded administrator password/secret may live in the frontend");
});

test("every sidebar navigation button has a matching view renderer, and vice versa", async () => {
  const source = await read("team-admin/app.js");
  const navKeys = [...source.matchAll(/\$\{nav\('(\w+)'/g)].map((m) => m[1]);
  assert.ok(navKeys.length >= 12, `Expected the full admin nav (found ${navKeys.length}): ${navKeys.join(", ")}`);
  assert.equal(new Set(navKeys).size, navKeys.length, "Duplicate data-view keys in the sidebar nav");

  const dispatchMatch = source.match(/function renderView\(\)\{\(\{([\s\S]*?)\}\[view\]\|\|overview\)\(\)\}/);
  assert.ok(dispatchMatch, "Could not find the renderView() dispatch table");
  const dispatchKeys = dispatchMatch[1]
    .split(",")
    .map((entry) => entry.split(":")[0].trim())
    .filter(Boolean);

  for (const key of navKeys) {
    assert.ok(dispatchKeys.includes(key), `Sidebar nav view "${key}" has no renderer in the renderView() dispatch table`);
  }
  for (const key of dispatchKeys) {
    assert.ok(navKeys.includes(key), `renderView() dispatch key "${key}" is not reachable from any sidebar nav button`);
  }
});

test("permanently destructive admin actions require an explicit confirmation dialog", async () => {
  const source = await read("team-admin/app.js");
  const destructiveActions = [
    { fn: "deleteCampaign", must: /confirm\('Permanently delete this advertisement/ },
    { fn: "deleteDigit58Entitlement", must: /confirm\('Delete this Refills subscription\?/ },
    { fn: "deleteContactRequest", must: /confirm\(`Permanently delete the contact request/ },
    { fn: "runPurge", must: /confirm\(`Delete \$\{matches\.length\}/ },
  ];
  for (const { fn, must } of destructiveActions) {
    const body = functionBody(source, fn);
    assert.ok(body, `Could not isolate function body for ${fn}()`);
    assert.match(body, must, `${fn}() must ask for explicit confirmation before deleting data`);
    assert.match(body, /This cannot be undone/, `${fn}() confirmation copy should warn the action is irreversible`);
  }
});

test("Refills store-suspension and entitlement-deletion admin actions call the documented secure backend actions", async () => {
  const adminSource = await read("team-admin/app.js");
  const backendSource = await read("g58-core/src/actions.js");
  for (const action of ["digit58-set-store-suspended", "digit58-admin-delete-entitlement"]) {
    assert.match(adminSource, new RegExp(`action:'${action}'`), `team-admin/app.js must request the '${action}' secure action`);
    assert.match(backendSource, new RegExp(`requestBody\\?\\.action === '${action}'`), `g58-core/src/actions.js must implement the '${action}' secure action`);
  }
  // These privileged mutations must go through executeFunction (server-authorized), never a direct collection write.
  const suspendBody = functionBody(adminSource, "toggleDigit58Store");
  assert.match(suspendBody, /api\.executeFunction\(api\.config\.digitalOrderFunctionId,\{action:'digit58-set-store-suspended'/);
  const deleteBody = functionBody(adminSource, "deleteDigit58Entitlement");
  assert.match(deleteBody, /api\.executeFunction\(api\.config\.digitalOrderFunctionId,\{action:'digit58-admin-delete-entitlement'/);
});

test("advertisement placement image sizes and aspect ratios match between the advertiser booking flow and the admin console", async () => {
  const advertiseSource = await read("advertise/app.js");
  const adminSource = await read("team-admin/app.js");
  const slotsMatch = advertiseSource.match(/const slots=\[([\s\S]*?)\];/);
  assert.ok(slotsMatch, "Could not find the advertise/app.js slot catalogue");
  const slotEntries = [...slotsMatch[1].matchAll(/\{id:'(\w+)'[^}]*?size:'([^']+)',ratio:'([^']+)'\}/g)];
  assert.ok(slotEntries.length >= 3, "Expected at least 3 advertising placements");

  const specMatch = adminSource.match(/const AD_PLACEMENT_SPECS=\{([\s\S]*?)\};/);
  assert.ok(specMatch, "Could not find team-admin/app.js AD_PLACEMENT_SPECS");

  for (const [, id, size, ratio] of slotEntries) {
    const escapedSize = size.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const specPattern = new RegExp(`${id}:\\{label:'[^']*',size:'${escapedSize}',ratio:'${ratio}'\\}`);
    assert.match(specMatch[1], specPattern, `Admin console placement spec for "${id}" does not match advertiser-facing size/ratio (${size} · ${ratio})`);
  }
});

test("no admin data table interpolates unescaped advertiser or customer-supplied free text", async () => {
  const source = await read("team-admin/app.js");
  // Free-text fields that customers/advertisers control and that are rendered into admin tables
  // must always be passed through esc(); spot-check the highest-risk fields.
  const riskyFields = ["row.title", "row.customerName", "row.restaurantKey", "ad.description", "row.subject", "row.name"];
  for (const field of riskyFields) {
    const escaped = new RegExp(`esc\\(${field.replace(".", "\\.")}`);
    assert.match(source, escaped, `Expected at least one esc(${field}...) call rendering advertiser/customer text safely`);
  }
});
