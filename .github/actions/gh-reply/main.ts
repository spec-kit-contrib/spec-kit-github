import { readFileSync } from "node:fs";
import * as core from "@actions/core";
import * as github from "@actions/github";
import { splitReplies } from "./replies.ts";

async function main(): Promise<void> {
  const octokit = github.getOctokit(core.getInput("github-token", { required: true }));
  const pull_number = Number(core.getInput("pull", { required: true }));
  const threads = core
    .getInput("threads", { required: true })
    .split(",")
    .map((id) => Number(id.trim()))
    .filter(Boolean);
  if (threads.length === 0) throw new Error("no threads to reply in");
  const text = readFileSync(core.getInput("body-file", { required: true }), "utf8").trim();
  if (!text) throw new Error("the reply is empty");
  const footer = core.getInput("footer").trim();

  // One reply per thread; if the message is not in that shape, post it whole in the first thread.
  const split = splitReplies(text, threads.length);
  const bodies = new Map<number, string>();
  if (split) {
    for (const [n, body] of split) bodies.set(threads[n - 1]!, body);
  } else {
    bodies.set(threads[0]!, text);
  }
  // The footer, for example the commit the changes were applied in, goes with the first thread.
  if (footer) bodies.set(threads[0]!, [bodies.get(threads[0]!), footer].filter(Boolean).join("\n\n"));

  const ids: number[] = [];
  for (const [comment_id, body] of bodies) {
    const { data } = await octokit.rest.pulls.createReplyForReviewComment({
      ...github.context.repo,
      pull_number,
      comment_id,
      body,
    });
    ids.push(data.id);
  }
  core.setOutput("ids", ids.join(","));
}

main().catch((error: unknown) => core.setFailed(error instanceof Error ? error.message : String(error)));
