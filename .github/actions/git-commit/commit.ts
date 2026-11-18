import { readFileSync } from "node:fs";
import { git, gitSucceeds } from "../core/git.ts";
import { applyArgs, pathspec } from "../core/paths.ts";

export interface CommitOptions {
  /** Repository directory (a checkout with push credentials). */
  directory: string;
  /** Patch file to apply. */
  patch: string;
  /** Only these paths are taken from the patch. */
  paths: string[];
  /** Paths that are never taken, even inside the allowed ones. */
  excludes?: string[];
  branch: string;
  /** create: the branch must not exist yet. update: it must already exist. */
  mode: "create" | "update";
  message: string;
  /** Lines added to the message after a blank line, such as "Co-authored-by: Name <email>". */
  trailers?: string[];
  /** "Name <email>" */
  author: string;
}

export interface CommitResult {
  changed: boolean;
  sha: string;
}

/** The account the workflow runs as, used when no author is given. */
export const DEFAULT_AUTHOR = "github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>";

export function parseAuthor(author: string): { name: string; email: string } {
  const match = /^(.+?)\s*<(.+)>$/.exec(author.trim());
  if (!match) throw new Error(`author must look like "Name <email>": ${author}`);
  return { name: match[1]!, email: match[2]! };
}

export function commit(options: CommitOptions): CommitResult {
  const { directory: cwd, paths, branch } = options;
  const excludes = options.excludes ?? [];
  const spec = pathspec(paths, excludes);

  const exists = gitSucceeds(["ls-remote", "--exit-code", "--heads", "origin", branch], { cwd });
  if (options.mode === "create" && exists) throw new Error(`branch ${branch} already exists`);
  if (options.mode === "update" && !exists) throw new Error(`branch ${branch} does not exist`);

  const patch = readFileSync(options.patch, "utf8");
  if (!patch.trim()) return { changed: false, sha: "" };

  git(["apply", ...applyArgs(paths, excludes), "-"], { cwd, input: patch });
  if (!git(["status", "--porcelain", "--", ...spec], { cwd }).trim()) return { changed: false, sha: "" };

  const { name, email } = parseAuthor(options.author);
  const trailers = options.trailers ?? [];
  const message = trailers.length > 0 ? `${options.message}\n\n${trailers.join("\n")}` : options.message;
  git(["add", "-A", "--", ...spec], { cwd });
  git(["-c", `user.name=${name}`, "-c", `user.email=${email}`, "commit", "-m", message], { cwd });
  const sha = git(["rev-parse", "HEAD"], { cwd }).trim();
  // A plain push: fails rather than overwrite if the branch moved in the meantime.
  git(["push", "origin", `HEAD:refs/heads/${branch}`], { cwd });
  return { changed: true, sha };
}
