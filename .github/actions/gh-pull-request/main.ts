import * as core from "@actions/core";
import * as github from "@actions/github";
import { parseLogins } from "./logins.ts";

async function main(): Promise<void> {
  const octokit = github.getOctokit(core.getInput("github-token", { required: true }));
  const { owner, repo } = github.context.repo;
  const branch = core.getInput("branch", { required: true });
  const base =
    core.getInput("base") || (github.context.payload.repository as { default_branch: string } | undefined)?.default_branch;
  if (!base) throw new Error("no base branch given and none in the event payload");

  const open = await octokit.rest.pulls.list({ owner, repo, head: `${owner}:${branch}`, state: "open" });
  let pr: { number: number; html_url: string } | undefined = open.data[0];
  let created = false;
  if (!pr) {
    ({ data: pr } = await octokit.rest.pulls.create({
      owner,
      repo,
      head: branch,
      base,
      title: core.getInput("title", { required: true }),
      body: core.getInput("body"),
    }));
    created = true;
  }
  // A PR is an issue as far as assignees go. Adding someone who is already assigned changes nothing.
  const assignees = parseLogins(core.getInput("assignees"));
  if (assignees.length > 0) {
    await octokit.rest.issues.addAssignees({ owner, repo, issue_number: pr.number, assignees });
  }
  core.setOutput("number", String(pr.number));
  core.setOutput("url", pr.html_url);
  core.setOutput("created", String(created));
}

main().catch((error: unknown) => core.setFailed(error instanceof Error ? error.message : String(error)));
