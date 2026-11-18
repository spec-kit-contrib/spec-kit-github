import { test } from "node:test";
import assert from "node:assert/strict";
import { staleReactions, type Reaction } from "./state.ts";

const BOT = "github-actions[bot]";
const r = (id: number, content: string, login = BOT): Reaction => ({ id, content, login });

test("the agent's other state reactions are stale", () => {
  assert.deepEqual(staleReactions([r(1, "eyes"), r(2, "+1")], "+1", BOT), [1]);
});

test("the reaction to keep is not stale", () => {
  assert.deepEqual(staleReactions([r(1, "+1")], "+1", BOT), []);
});

test("people's reactions are never touched, even with the same emoji", () => {
  assert.deepEqual(staleReactions([r(1, "eyes", "alice"), r(2, "+1", "alice"), r(3, "eyes")], "+1", BOT), [3]);
});

test("the agent's reactions that are not states are never touched", () => {
  assert.deepEqual(staleReactions([r(1, "heart"), r(2, "rocket"), r(3, "eyes")], "confused", BOT), [3]);
});

test("nothing to delete when there are no reactions", () => {
  assert.deepEqual(staleReactions([], "eyes", BOT), []);
});
