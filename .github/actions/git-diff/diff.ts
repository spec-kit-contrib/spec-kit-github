import { git } from "../core/git.ts";

/** Stage and return the changes under `paths` as a binary patch ("" when there are none). */
export function diff(directory: string, paths: string[]): string {
  // `git add` fails on a pathspec that matches nothing; `status` does not.
  if (!git(["status", "--porcelain", "--", ...paths], { cwd: directory }).trim()) return "";
  git(["add", "-A", "--", ...paths], { cwd: directory });
  return git(["diff", "--cached", "--binary", "--", ...paths], { cwd: directory });
}
