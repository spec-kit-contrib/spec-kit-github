import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { git } from "../core/git.ts";
import { makeRepo, write } from "../core/testrepo.ts";
import { diff } from "../git-diff/diff.ts";
import { commit, parseAuthor, type CommitOptions } from "./commit.ts";

const author = "github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>";

/** A patch made in a scratch clone, as the execute job would make it. */
function patchFile(remote: string, files: Record<string, string>, branch = "main"): string {
  const scratch = mkdtempSync(join(tmpdir(), "spec-kit-scratch-"));
  git(["clone", "--branch", branch, remote, scratch]);
  for (const [path, content] of Object.entries(files)) write(scratch, path, content);
  // Stage everything, not just specs/, to see that commit() filters.
  git(["add", "-A"], { cwd: scratch });
  const file = join(scratch, "..", `${Date.now()}-${Math.random()}.patch`);
  writeFileSync(file, git(["diff", "--cached", "--binary"], { cwd: scratch }));
  return file;
}

function options(work: string, patch: string, over: Partial<CommitOptions> = {}): CommitOptions {
  return { directory: work, patch, paths: ["specs"], branch: "spec/7", mode: "create", message: "specify #7", author, ...over };
}

const remoteFiles = (remote: string, branch: string): string[] =>
  git(["ls-tree", "-r", "--name-only", branch], { cwd: remote }).trim().split("\n");

test("create: commits only allowed paths and pushes a new branch", () => {
  const { remote, work } = makeRepo();
  const patch = patchFile(remote, { "specs/001-x/spec.md": "spec\n", ".github/workflows/evil.yml": "on: push\n" });
  const result = commit(options(work, patch));
  assert.equal(result.changed, true);
  assert.match(result.sha, /^[0-9a-f]{40}$/);
  assert.deepEqual(remoteFiles(remote, "spec/7"), ["README.md", "specs/001-x/spec.md"]);
  assert.match(git(["log", "-1", "--format=%an <%ae>|%s", "spec/7"], { cwd: remote }), /^github-actions\[bot\] <41898282\+github-actions\[bot\]@users\.noreply\.github\.com>\|specify #7/);
});

test("create: refuses a branch that already exists", () => {
  const { remote, work } = makeRepo();
  const patch = patchFile(remote, { "specs/001-x/spec.md": "spec\n" });
  commit(options(work, patch));
  assert.throws(() => commit(options(work, patch)), /already exists/);
});

test("update: refuses a branch that does not exist", () => {
  const { remote, work } = makeRepo();
  const patch = patchFile(remote, { "specs/001-x/plan.md": "plan\n" });
  assert.throws(() => commit(options(work, patch, { mode: "update" })), /does not exist/);
});

test("update: adds a commit to an existing branch", () => {
  const { remote, work } = makeRepo();
  commit(options(work, patchFile(remote, { "specs/001-x/spec.md": "spec\n" })));
  // The follow-up job checks out the branch head and applies the next stage on top.
  git(["fetch", "origin", "spec/7"], { cwd: work });
  git(["checkout", "--detach", "FETCH_HEAD"], { cwd: work });
  const plan = patchFile(remote, { "specs/001-x/plan.md": "plan\n" }, "spec/7");
  const result = commit(options(work, plan, { mode: "update", message: "plan #7" }));
  assert.equal(result.changed, true);
  assert.deepEqual(remoteFiles(remote, "spec/7"), ["README.md", "specs/001-x/plan.md", "specs/001-x/spec.md"]);
});

test("an empty patch changes nothing", () => {
  const { remote, work } = makeRepo();
  const empty = join(mkdtempSync(join(tmpdir(), "spec-kit-empty-")), "e.patch");
  writeFileSync(empty, "");
  assert.deepEqual(commit(options(work, empty)), { changed: false, sha: "" });
  assert.throws(() => git(["rev-parse", "--verify", "spec/7"], { cwd: remote }));
});

test("a patch with only disallowed paths changes nothing", () => {
  const { remote, work } = makeRepo();
  const patch = patchFile(remote, { ".github/workflows/evil.yml": "on: push\n" });
  assert.deepEqual(commit(options(work, patch)), { changed: false, sha: "" });
});

test("diff then commit round trip", () => {
  const { remote, work } = makeRepo();
  const scratch = mkdtempSync(join(tmpdir(), "spec-kit-rt-"));
  git(["clone", remote, scratch]);
  write(scratch, "specs/001-x/spec.md", "spec\n");
  const file = join(scratch, "..", "rt.patch");
  writeFileSync(file, diff(scratch, ["specs"]));
  assert.equal(commit(options(work, file)).changed, true);
  assert.deepEqual(remoteFiles(remote, "spec/7"), ["README.md", "specs/001-x/spec.md"]);
});

test("parseAuthor", () => {
  assert.deepEqual(parseAuthor("A B <a@b.c>"), { name: "A B", email: "a@b.c" });
  assert.throws(() => parseAuthor("nobody"), /Name <email>/);
});

test("with the whole repository allowed, excluded paths in the patch are ignored", () => {
  const { remote, work } = makeRepo();
  const patch = patchFile(remote, {
    "src/app.py": "print('hi')\n",
    "tests/test_app.py": "def test(): pass\n",
    ".github/workflows/evil.yml": "on: push\n",
    ".claude/settings.json": "{}\n",
    "flake.nix": "{}\n",
  });
  const protectedPaths = [".github", ".claude", "flake.nix"];
  const result = commit(options(work, patch, { paths: ["."], excludes: protectedPaths }));
  assert.equal(result.changed, true);
  assert.deepEqual(remoteFiles(remote, "spec/7"), ["README.md", "src/app.py", "tests/test_app.py"]);
});

test("a patch that only touches excluded paths changes nothing", () => {
  const { remote, work } = makeRepo();
  const patch = patchFile(remote, { ".github/workflows/evil.yml": "on: push\n", "flake.nix": "{}\n" });
  assert.deepEqual(commit(options(work, patch, { paths: ["."], excludes: [".github", "flake.nix"] })), {
    changed: false,
    sha: "",
  });
});

test("an excluded path wins over an allowed one that contains it", () => {
  const { remote, work } = makeRepo();
  const patch = patchFile(remote, { "specs/001-x/spec.md": "spec\n", "specs/001-x/secret/run.sh": "evil\n" });
  const result = commit(options(work, patch, { paths: ["specs"], excludes: ["specs/001-x/secret"] }));
  assert.equal(result.changed, true);
  assert.deepEqual(remoteFiles(remote, "spec/7"), ["README.md", "specs/001-x/spec.md"]);
});
