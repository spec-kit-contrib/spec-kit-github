import { test } from "node:test";
import assert from "node:assert/strict";
import { makeRepo, write } from "../core/testrepo.ts";
import { diff } from "./diff.ts";

test("only changes under the allowed paths end up in the patch", () => {
  const { work } = makeRepo();
  write(work, "specs/001-x/spec.md", "spec\n");
  write(work, ".github/workflows/evil.yml", "on: push\n");
  const patch = diff(work, ["specs"]);
  assert.match(patch, /specs\/001-x\/spec\.md/);
  assert.doesNotMatch(patch, /evil\.yml/);
});

test("no changes gives an empty patch", () => {
  const { work } = makeRepo();
  assert.equal(diff(work, ["specs"]), "");
});

test("changes only outside the allowed paths give an empty patch", () => {
  const { work } = makeRepo();
  write(work, "README.md", "changed\n");
  assert.equal(diff(work, ["specs"]), "");
});
