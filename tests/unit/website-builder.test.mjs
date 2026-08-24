import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const root = new URL("../../", import.meta.url);

async function loadBuilder() {
  const source = await readFile(new URL("templates/builder-core.js", root), "utf8");
  const context = { window: {}, TextEncoder, Blob, URL, Date, Math, JSON, Uint8Array, console, setTimeout, clearTimeout };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context.window.G58Builder;
}

test("G58 publishes ten free business templates in the requested categories", async () => {
  const builder = await loadBuilder();
  assert.equal(builder.templates.length, 10);
  assert.equal(builder.templates.filter((row) => row.kind === "service").length, 5);
  assert.equal(builder.templates.filter((row) => row.kind === "product").length, 3);
  assert.equal(builder.templates.filter((row) => row.kind === "menu").length, 2);
  assert.equal(new Set(builder.templates.map((row) => row.id)).size, 10);
});

test("website projects use structured page, section and unique element records", async () => {
  const builder = await loadBuilder();
  const project = builder.makeProject("food-truck");
  assert.equal(project.template, "food-truck");
  assert.ok(project.website.pages.length >= 3);
  assert.equal(project.website.pages.filter((page) => page.home).length, 1);
  const sections = project.website.pages.flatMap((page) => page.sections);
  const elements = sections.flatMap((section) => section.elements);
  assert.ok(sections.length >= 8);
  assert.equal(new Set(sections.map((row) => row.id)).size, sections.length);
  assert.equal(new Set(elements.map((row) => row.id)).size, elements.length);
  assert.ok(elements.some((row) => row.type === "menu-item"));
});

test("generated websites contain responsive navigation, G58 links and no builder dependency", async () => {
  const builder = await loadBuilder();
  const project = builder.makeProject("clinic");
  project.website.integrations.booking = "https://g58.in/digit58/#book";
  project.website.integrations.businessCard = "https://g58.in/business/clinic";
  const home = project.website.pages.find((page) => page.home);
  const html = builder.exportHtml(project, home);
  assert.match(html, /assets\/css\/style\.css/);
  assert.match(html, /assets\/js\/site\.js/);
  assert.match(html, /https:\/\/g58\.in\/digit58\/#book/);
  assert.match(html, /aria-label="G58 Business Card"/);
  assert.match(html, /class="wa"[^>]*aria-label="WhatsApp"><svg/);
  assert.match(html, /class="ig"[^>]*aria-label="Instagram"><svg/);
  assert.doesNotMatch(html, /builder-core|indexedDB|login|register/i);
  assert.match(builder.publicCss, /@media\(max-width:600px\)/);
});

test("marketplace and editor are explicitly open without authentication", async () => {
  const marketplace = await readFile(new URL("templates/index.html", root), "utf8");
  const editor = await readFile(new URL("templates/editor/index.html", root), "utf8");
  assert.match(marketplace, /No account/);
  assert.match(marketplace, /Start Building Free/);
  assert.doesNotMatch(marketplace + editor, /siteLoginButton|create account|OTP|subscription required/i);
  assert.match(editor, /Download Website/);
  assert.match(editor, /Responsive preview/);
});
