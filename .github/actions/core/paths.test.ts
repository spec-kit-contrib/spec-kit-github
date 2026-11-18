import { test } from "node:test";
import assert from "node:assert/strict";
import { applyArgs, parseExcludes, parsePaths, pathspec } from "./paths.ts";

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

test("applyArgs matches a path and everything below it", () => {
  assert.deepEqual(applyArgs(["specs"], []), ["--include=specs", "--include=specs/*"]);
});

test("applyArgs puts the excludes first, because the first matching rule wins", () => {
  assert.deepEqual(applyArgs(["specs"], [".github"]), [
    "--exclude=.github",
    "--exclude=.github/*",
    "--include=specs",
    "--include=specs/*",
  ]);
});

test('applyArgs: "." allows every file', () => {
  assert.deepEqual(applyArgs(["."], ["flake.nix"]), ["--exclude=flake.nix", "--exclude=flake.nix/*", "--include=*"]);
});

test("pathspec appends the excludes as exclusion pathspecs", () => {
  assert.deepEqual(pathspec(["."], [".github", "flake.nix"]), [".", ":(exclude).github", ":(exclude)flake.nix"]);
  assert.deepEqual(pathspec(["specs"], []), ["specs"]);
});

test("parseExcludes allows an empty list and validates like parsePaths", () => {
  assert.deepEqual(parseExcludes(""), []);
  assert.deepEqual(parseExcludes(".github/\n flake.nix \n"), [".github", "flake.nix"]);
  assert.throws(() => parseExcludes("../x"), /invalid path/);
});
