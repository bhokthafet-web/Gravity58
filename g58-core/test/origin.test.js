import test from "node:test";
import assert from "node:assert/strict";
import { isAllowedOrigin } from "../src/origin.js";

test("accepts G58 website, subdomain and Android app origins", () => {
  const configured = new Set(["https://g58.in"]);
  assert.equal(isAllowedOrigin("https://g58.in", configured), true);
  assert.equal(isAllowedOrigin("https://server.g58.in", configured), true);
  assert.equal(isAllowedOrigin("https://localhost", configured), true);
  assert.equal(isAllowedOrigin("capacitor://localhost", configured), true);
  assert.equal(isAllowedOrigin("ionic://localhost", configured), true);
});

test("rejects unrelated and lookalike origins", () => {
  assert.equal(isAllowedOrigin("https://not-g58.example"), false);
  assert.equal(isAllowedOrigin("https://g58.in.attacker.example"), false);
  assert.equal(isAllowedOrigin("http://g58.in"), false);
  assert.equal(isAllowedOrigin("not an origin"), false);
});
