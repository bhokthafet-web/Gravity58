import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";

const root = resolve(new URL("../..", import.meta.url).pathname);
const ignored = new Set([".git", "node_modules", "playwright-report", "test-results"]);

function filesUnder(directory) {
  return readdirSync(directory).flatMap((name) => {
    if (ignored.has(name)) return [];
    const path = join(directory, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

const files = filesUnder(root);
const htmlFiles = files.filter((file) => extname(file) === ".html");
const jsFiles = files.filter((file) => extname(file) === ".js" && !file.includes("/tests/"));

test("every production JavaScript file parses", () => {
  for (const file of jsFiles) {
    assert.doesNotThrow(
      () => execFileSync(process.execPath, ["--check", file], { stdio: "pipe" }),
      `JavaScript syntax failed: ${file}`,
    );
  }
});

test("every HTML page declares a title and mobile viewport", () => {
  for (const file of htmlFiles) {
    const html = readFileSync(file, "utf8");
    assert.match(html, /<title>[^<]+<\/title>/i, `Missing title: ${file}`);
    assert.match(html, /<meta[^>]+name=["']viewport["']/i, `Missing viewport: ${file}`);
  }
});

test("local HTML assets and routes resolve to files", () => {
  const missing = [];
  for (const file of htmlFiles) {
    const html = readFileSync(file, "utf8");
    for (const match of html.matchAll(/(?:href|src)=["']([^"'#]+)(?:#[^"']*)?["']/gi)) {
      const raw = match[1].split("?")[0];
      if (!raw || /^(?:https?:|mailto:|tel:|upi:|javascript:|data:)/i.test(raw)) continue;
      const target = raw.startsWith("/") ? join(root, raw) : resolve(dirname(file), raw);
      const candidates = [target, join(target, "index.html")];
      if (!candidates.some(existsSync)) missing.push(`${file}: ${raw}`);
    }
  }
  assert.deepEqual(missing, [], `Broken local references:\n${missing.join("\n")}`);
});

test("IDs are unique within each static page", () => {
  const duplicates = [];
  for (const file of htmlFiles) {
    const html = readFileSync(file, "utf8");
    const ids = [...html.matchAll(/\sid=["']([^"']+)["']/gi)].map((match) => match[1]);
    const seen = new Set();
    for (const id of ids) {
      if (seen.has(id)) duplicates.push(`${file}: ${id}`);
      seen.add(id);
    }
  }
  assert.deepEqual(duplicates, [], `Duplicate IDs:\n${duplicates.join("\n")}`);
});

test("production configuration has no placeholders or server secrets", () => {
  const configFiles = ["js/config.js", "advertise/config.js", "digital-menu/config.js", "team-admin/config.js"];
  for (const relative of configFiles) {
    const source = readFileSync(join(root, relative), "utf8");
    assert.doesNotMatch(source, /YOUR_[A-Z0-9_]+|service[_-]?role|api[_-]?key/i, `Unsafe or incomplete config: ${relative}`);
    assert.match(source, /6a776883001717bca81c/, `Wrong Appwrite project: ${relative}`);
    assert.match(source, /gravity58/, `Wrong Appwrite database: ${relative}`);
  }
});

test("JSON assets parse", () => {
  for (const file of files.filter((path) => extname(path) === ".json" && !path.endsWith("package-lock.json") && !path.includes("node_modules"))) {
    assert.doesNotThrow(() => JSON.parse(readFileSync(file, "utf8")), `Invalid JSON: ${file}`);
  }
});

test("GitHub Pages deployment and custom-domain files exist", () => {
  assert.ok(existsSync(join(root, ".github/workflows/pages.yml")));
  assert.equal(readFileSync(join(root, "CNAME"), "utf8").trim(), "g58.in");
  assert.match(readFileSync(join(root, "robots.txt"), "utf8"), /Sitemap:/i);
  assert.ok(existsSync(join(root, "sitemap.xml")));
});

test("normal advertiser records do not request administrator-team permissions", () => {
  const source = readFileSync(join(root, "js/appwrite-ads.js"), "utf8");
  assert.match(source, /function permissionSet\(kind, userId, includeAdminTeam = false\)/);
  assert.match(source, /if \(includeAdminTeam && config\.adminTeamId/);
});

test("customer receipt uploads only grant roles available to that customer", () => {
  const source = readFileSync(join(root, "js/appwrite-ads.js"), "utf8");
  const start = source.indexOf("async function uploadPaymentReceipt");
  const end = source.indexOf("async function removeAdMedia", start);
  assert.ok(start >= 0 && end > start, "Dedicated payment receipt uploader is missing");
  const receiptUploader = source.slice(start, end);
  assert.match(receiptUploader, /Role\.user\(current\.\$id\)/);
  assert.match(receiptUploader, /Role\.any\(\)/);
  assert.doesNotMatch(receiptUploader, /Role\.team|adminTeamId/, "Customer receipt upload cannot grant an administrator-team role");
});
