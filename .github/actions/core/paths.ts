/** Parse a newline-separated list of repository paths (no globs). */
export function parsePaths(input: string): string[] {
  const paths = input
    .split("\n")
    .map((line) => line.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  if (paths.length === 0) throw new Error("no paths given");
  for (const path of paths) {
    if (path.startsWith("/") || path.split("/").includes("..")) throw new Error(`invalid path: ${path}`);
  }
  return paths;
}

/** `git apply` filters: each path itself and everything below it. */
export function includeArgs(paths: string[]): string[] {
  return paths.flatMap((path) => [`--include=${path}`, `--include=${path}/*`]);
}
