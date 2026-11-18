import { readFileSync } from "node:fs";
import * as core from "@actions/core";
import * as github from "@actions/github";
import { findMarked, withMarker } from "./marker.ts";

async function main(): Promise<void> {
  const octokit = github.getOctokit(core.getInput("github-token", { required: true }));
  const { owner, repo } = github.context.repo;
  const issue_number = Number(core.getInput("issue", { required: true }));
  const marker = core.getInput("marker");
  const bodyFile = core.getInput("body-file");
  const text = bodyFile ? readFileSync(bodyFile, "utf8") : core.getInput("body");
  if (!text.trim()) throw new Error("the comment body is empty: give body or a non-empty body-file");
  const body = withMarker(text, marker);

  const existing = marker
    ? findMarked(await octokit.paginate(octokit.rest.issues.listComments, { owner, repo, issue_number }), marker)
    : undefined;
  const { data } = existing
    ? await octokit.rest.issues.updateComment({ owner, repo, comment_id: existing.id, body })
    : await octokit.rest.issues.createComment({ owner, repo, issue_number, body });
  core.setOutput("id", String(data.id));
}

main().catch((error: unknown) => core.setFailed(error instanceof Error ? error.message : String(error)));
