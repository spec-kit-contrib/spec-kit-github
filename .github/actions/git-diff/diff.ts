import { git } from "../core/git.ts";
import { pathspec } from "../core/paths.ts";

/** Stage and return the changes under `paths`, minus `excludes`, as a binary patch ("" when there are none). */
export function diff(directory: string, paths: string[], excludes: string[] = []): string {
  const spec = pathspec(paths, excludes);
  // `git add` fails on a pathspec that matches nothing; `status` does not.
  if (!git(["status", "--porcelain", "--", ...spec], { cwd: directory }).trim()) return "";
  git(["add", "-A", "--", ...spec], { cwd: directory });
  return git(["diff", "--cached", "--binary", "--", ...spec], { cwd: directory });
}
