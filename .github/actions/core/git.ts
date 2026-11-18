import { execFileSync } from "node:child_process";

export interface GitOptions {
  cwd?: string;
  input?: string;
}

/** Run git and return stdout. stderr goes to the job log; a non-zero exit throws. */
export function git(args: string[], { cwd, input }: GitOptions = {}): string {
  return execFileSync("git", args, {
    cwd,
    input,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "inherit"],
    maxBuffer: 256 * 1024 * 1024,
  });
}

export function gitSucceeds(args: string[], options: GitOptions = {}): boolean {
  try {
    git(args, options);
    return true;
  } catch {
    return false;
  }
}
