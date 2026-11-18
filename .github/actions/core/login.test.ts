import { test } from "node:test";
import assert from "node:assert/strict";
import { sameLogin } from "./login.ts";

test("the same login matches", () => {
  assert.equal(sameLogin("ralch-bot", "ralch-bot"), true);
});

test("REST and GraphQL names of a bot match", () => {
  assert.equal(sameLogin("github-actions[bot]", "github-actions"), true);
  assert.equal(sameLogin("github-actions", "github-actions[bot]"), true);
});

test("logins are not case sensitive", () => {
  assert.equal(sameLogin("Ralch-Bot", "ralch-bot"), true);
});

test("different logins do not match", () => {
  assert.equal(sameLogin("alice", "github-actions[bot]"), false);
  assert.equal(sameLogin("ralch-bot", "ralch"), false);
});

test("an empty login never matches, not even another empty one", () => {
  assert.equal(sameLogin("", ""), false);
  assert.equal(sameLogin("", "alice"), false);
});
