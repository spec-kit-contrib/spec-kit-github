import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import * as core from "@actions/core";
import { parsePaths } from "../core/paths.ts";
import { diff } from "./diff.ts";

try {
  const patch = diff(core.getInput("directory") || ".", parsePaths(core.getInput("paths", { required: true })));
  const output = resolve(core.getInput("output") || "changes.patch");
  writeFileSync(output, patch);
  core.setOutput("patch", output);
  core.setOutput("changed", String(patch.length > 0));
} catch (error) {
  core.setFailed(error instanceof Error ? error.message : String(error));
}
