import { test } from "node:test";
import assert from "node:assert/strict";
import { splitReplies } from "./replies.ts";

test("one entry per thread", () => {
  const text = "Thread 1: Applied the 24h limit.\nThread 2: What is the unit for `-t`?\nThread 3: Applied.";
  assert.deepEqual([...splitReplies(text, 3)!], [
    [1, "Applied the 24h limit."],
    [2, "What is the unit for `-t`?"],
    [3, "Applied."],
  ]);
});

test("an entry can span several lines", () => {
  const text = "Thread 1: First line.\nSecond line.\n\nThread 2: Other.";
  assert.equal(splitReplies(text, 2)!.get(1), "First line.\nSecond line.");
});

test("bold and other separators are tolerated", () => {
  const text = "**Thread 1**: One.\nThread 2 - Two.\nTHREAD 3. Three.";
  assert.deepEqual([...splitReplies(text, 3)!.values()], ["One.", "Two.", "Three."]);
});

test("text before the first entry is dropped", () => {
  assert.deepEqual([...splitReplies("I read the spec.\nThread 1: Done.", 1)!], [[1, "Done."]]);
});

test("entries for threads that do not exist are dropped", () => {
  assert.deepEqual([...splitReplies("Thread 1: a\nThread 9: b", 2)!], [[1, "a"]]);
});

test("a message without entries gives null", () => {
  assert.equal(splitReplies("Done, applied everything.", 2), null);
});

test("empty entries are dropped", () => {
  assert.deepEqual([...splitReplies("Thread 1:\nThread 2: b", 2)!], [[2, "b"]]);
});
