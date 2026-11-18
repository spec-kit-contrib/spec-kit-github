import { readFileSync } from "node:fs";
import { git, gitSucceeds } from "../core/git.ts";
import { includeArgs } from "../core/paths.ts";

export interface CommitOptions {
  /** Repository directory (a checkout with push credentials). */
  directory: string;
  /** Patch file to apply. */
  patch: string;
  /** Only these paths are taken from the patch. */
  paths: string[];
  branch: string;
  /** create: the branch must not exist yet. update: it must already exist. */
  mode: "create" | "update";
  message: string;
  /** "Name <email>" */
  author: string;
}

export interface CommitResult {
  changed: boolean;
  sha: string;
}

export function parseAuthor(author: string): { name: string; email: string } {
  const match = /^(.+?)\s*<(.+)>$/.exec(author.trim());
  if (!match) throw new Error(`author must look like "Name <email>": ${author}`);
  return { name: match[1]!, email: match[2]! };
}

export function commit(options: CommitOptions): CommitResult {
  const { directory: cwd, paths, branch } = options;

  const exists = gitSucceeds(["ls-remote", "--exit-code", "--heads", "origin", branch], { cwd });
  if (options.mode === "create" && exists) throw new Error(`branch ${branch} already exists`);
  if (options.mode === "update" && !exists) throw new Error(`branch ${branch} does not exist`);

  const patch = readFileSync(options.patch, "utf8");
  if (!patch.trim()) return { changed: false, sha: "" };

  git(["apply", ...includeArgs(paths), "-"], { cwd, input: patch });
  if (!git(["status", "--porcelain", "--", ...paths], { cwd }).trim()) return { changed: false, sha: "" };

  const { name, email } = parseAuthor(options.author);
  git(["add", "-A", "--", ...paths], { cwd });
  git(["-c", `user.name=${name}`, "-c", `user.email=${email}`, "commit", "-m", options.message], { cwd });
  const sha = git(["rev-parse", "HEAD"], { cwd }).trim();
  // A plain push: fails rather than overwrite if the branch moved in the meantime.
  git(["push", "origin", `HEAD:refs/heads/${branch}`], { cwd });
  return { changed: true, sha };
}
