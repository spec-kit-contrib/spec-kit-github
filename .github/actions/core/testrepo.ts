// Test helper: a bare "remote" plus a clone with an initial commit on main.

// The tests must not depend on whoever runs them: ignore their global and system git config, which
// may sign commits with a key that is not available, or rewrite URLs.
process.env["GIT_CONFIG_GLOBAL"] = "/dev/null";
process.env["GIT_CONFIG_NOSYSTEM"] = "1";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { git } from "./git.ts";

const identity = ["-c", "user.name=Test", "-c", "user.email=test@example.com"];

export function makeRepo(): { remote: string; work: string } {
  const root = mkdtempSync(join(tmpdir(), "spec-kit-test-"));
  const remote = join(root, "remote.git");
  const work = join(root, "work");
  git(["init", "--bare", "--initial-branch=main", remote]);
  git(["clone", remote, work]);
  write(work, "README.md", "hello\n");
  git(["add", "-A"], { cwd: work });
  git([...identity, "commit", "-m", "init"], { cwd: work });
  git(["push", "origin", "HEAD:refs/heads/main"], { cwd: work });
  return { remote, work };
}

export function write(dir: string, path: string, content: string): void {
  mkdirSync(dirname(join(dir, path)), { recursive: true });
  writeFileSync(join(dir, path), content);
}
