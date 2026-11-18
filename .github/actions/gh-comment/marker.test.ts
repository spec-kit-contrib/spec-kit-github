import { test } from "node:test";
import assert from "node:assert/strict";
import { findMarked, withMarker } from "./marker.ts";

test("withMarker appends a hidden marker", () => {
  assert.equal(withMarker("hello", "stage"), "hello\n\n<!-- stage -->");
});

test("withMarker leaves the body alone without a marker", () => {
  assert.equal(withMarker("hello", ""), "hello");
});

test("findMarked finds the comment carrying the marker", () => {
  const comments = [{ id: 1, body: "x" }, { id: 2, body: withMarker("y", "stage") }, { id: 3, body: null }];
  assert.equal(findMarked(comments, "stage")?.id, 2);
});

test("findMarked finds nothing without a marker or a match", () => {
  const comments = [{ id: 1, body: withMarker("y", "other") }];
  assert.equal(findMarked(comments, ""), undefined);
  assert.equal(findMarked(comments, "stage"), undefined);
});
