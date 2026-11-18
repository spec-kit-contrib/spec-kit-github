import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLogins } from "./logins.ts";

test("splits on commas and newlines, trims, drops blanks", () => {
  assert.deepEqual(parseLogins(" alice, bob \n\ncarol,"), ["alice", "bob", "carol"]);
});

test("drops duplicates", () => {
  assert.deepEqual(parseLogins("alice,alice,bob"), ["alice", "bob"]);
});

test("empty input gives no logins", () => {
  assert.deepEqual(parseLogins(""), []);
  assert.deepEqual(parseLogins(" , \n "), []);
});
