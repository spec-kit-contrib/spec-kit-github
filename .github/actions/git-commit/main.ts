import { resolve } from "node:path";
import * as core from "@actions/core";
import { parseExcludes, parsePaths } from "../core/paths.ts";
import { commit, DEFAULT_AUTHOR } from "./commit.ts";

try {
  const mode = core.getInput("mode", { required: true });
  if (mode !== "create" && mode !== "update") throw new Error(`mode must be create or update, got ${mode}`);
  const result = commit({
    directory: resolve(core.getInput("directory") || "."),
    patch: resolve(core.getInput("patch", { required: true })),
    paths: parsePaths(core.getInput("paths", { required: true })),
    excludes: parseExcludes(core.getInput("exclude")),
    branch: core.getInput("branch", { required: true }),
    mode,
    message: core.getInput("message", { required: true }),
    // An empty value, such as an output that could not be resolved, means the default.
    author: core.getInput("author") || DEFAULT_AUTHOR,
    trailers: core.getInput("trailers").split("\n").map((line) => line.trim()).filter(Boolean),
  });
  core.setOutput("changed", String(result.changed));
  core.setOutput("sha", result.sha);
} catch (error) {
  core.setFailed(error instanceof Error ? error.message : String(error));
}
