import test from "node:test";
import assert from "node:assert/strict";
import { mediaResponseHeaders } from "../src/media.js";

test("public media can be embedded across G58 domains", () => {
  assert.deepEqual(mediaResponseHeaders(true), {
    "Cache-Control": "public, max-age=86400",
    "Content-Disposition": "inline",
    "Cross-Origin-Resource-Policy": "cross-origin",
  });
});

test("private media remains same-origin and is never cached", () => {
  assert.deepEqual(mediaResponseHeaders(false), {
    "Cache-Control": "private, no-store",
    "Content-Disposition": "inline",
    "Cross-Origin-Resource-Policy": "same-origin",
  });
});
