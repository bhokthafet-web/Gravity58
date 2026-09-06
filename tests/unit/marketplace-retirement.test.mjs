import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("public posting marketplace is retired from production entry points", async () => {
  const [home, admin, sitemap, builder] = await Promise.all([
    read("index.html"),
    read("team-admin/app.js"),
    read("sitemap.xml"),
    read("templates/builder-core.js"),
  ]);

  assert.doesNotMatch(home, /id="myPostsButton"|id="contentArea"|Post Requirement|Create Business Card|src="\/js\/app\.js|src="\/js\/database\.js/);
  assert.doesNotMatch(admin, /data-view="marketplace"|api\.list\('posts'\)|Public Marketplace/);
  assert.doesNotMatch(sitemap, /<loc>https:\/\/g58\.in\/business\//);
  assert.doesNotMatch(builder, /businessCard|g58-card|G58 Business Card/);
});

test("retired business routes redirect to the current homepage", async () => {
  for (const path of [
    "business/index.html",
    "business/telangana/hyderabad/index.html",
    "business/dreamspace-interiors-gachibowli-hyderabad/index.html",
    "business/quickfix-plumbing-kukatpally-hyderabad/index.html",
  ]) {
    const html = await read(path);
    assert.match(html, /noindex/);
    assert.match(html, /url=\//i);
  }
});
