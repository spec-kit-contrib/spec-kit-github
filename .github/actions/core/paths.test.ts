import { test } from "node:test";
import assert from "node:assert/strict";
import { includeArgs, parsePaths } from "./paths.ts";

test("parsePaths trims, drops blanks and trailing slashes", () => {
  assert.deepEqual(parsePaths(" specs/ \n\nREADME.md\n"), ["specs", "README.md"]);
});

test("parsePaths rejects empty input", () => {
  assert.throws(() => parsePaths(" \n "), /no paths/);
});

for (const bad of ["/etc", "../x", "specs/../../x"]) {
  test(`parsePaths rejects ${bad}`, () => {
    assert.throws(() => parsePaths(bad), /invalid path/);
  });
}

test("includeArgs matches a path and everything below it", () => {
  assert.deepEqual(includeArgs(["specs"]), ["--include=specs", "--include=specs/*"]);
});
