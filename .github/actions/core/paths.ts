function parse(input: string): string[] {
  const paths = input
    .split("\n")
    .map((line) => line.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  for (const path of paths) {
    if (path.startsWith("/") || path.split("/").includes("..")) throw new Error(`invalid path: ${path}`);
  }
  return paths;
}

/** Parse a newline-separated list of repository paths (no globs). "." means the whole repository. */
export function parsePaths(input: string): string[] {
  const paths = parse(input);
  if (paths.length === 0) throw new Error("no paths given");
  return paths;
}

/** Like parsePaths, but an empty list is fine: paths that are never taken, even inside the allowed ones. */
export function parseExcludes(input: string): string[] {
  return parse(input);
}

/** Git pathspecs for the allowed paths, minus the excluded ones. */
export function pathspec(paths: string[], excludes: string[]): string[] {
  return [...paths, ...excludes.map((path) => `:(exclude)${path}`)];
}

/**
 * `git apply` filters. The first rule that matches a file decides, so the excludes come first.
 * Each path stands for itself and everything below it; "." stands for every file.
 */
export function applyArgs(paths: string[], excludes: string[]): string[] {
  const exclude = excludes.flatMap((path) => [`--exclude=${path}`, `--exclude=${path}/*`]);
  const include = paths.flatMap((path) => (path === "." ? ["--include=*"] : [`--include=${path}`, `--include=${path}/*`]));
  return [...exclude, ...include];
}
