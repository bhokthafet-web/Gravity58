import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, randomToken, tokenHash, verifyPassword } from "../src/security.js";

test("passwords are stored with Argon2id and verify correctly", async () => {
  const hash = await hashPassword("A-strong-test-password-2026");
  assert.match(hash, /^\$argon2id\$/);
  assert.equal(await verifyPassword(hash, "A-strong-test-password-2026"), true);
  assert.equal(await verifyPassword(hash, "wrong-password"), false);
});

test("session and recovery tokens are random and stored as hashes", () => {
  const first = randomToken();
  const second = randomToken();
  assert.notEqual(first, second);
  assert.equal(tokenHash(first).length, 64);
  assert.notEqual(tokenHash(first), first);
});
