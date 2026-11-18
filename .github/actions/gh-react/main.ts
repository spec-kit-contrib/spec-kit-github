import * as core from "@actions/core";
import * as github from "@actions/github";
import { STATES, staleReactions, type Reaction, type State } from "./state.ts";

type Octokit = ReturnType<typeof github.getOctokit>;
type Content = "eyes" | "+1" | "confused";

interface Target {
  create: (content: Content) => Promise<void>;
  list: () => Promise<Reaction[]>;
  remove: (id: number) => Promise<void>;
}

const toReactions = (rows: Array<{ id: number; content: string; user: { login: string } | null }>): Reaction[] =>
  rows.map((row) => ({ id: row.id, content: row.content, login: row.user?.login ?? "" }));

/** The thing to react to: the issue for an assignment, otherwise the comment that gave the command. */
function target(octokit: Octokit): Target {
  const { context } = github;
  const repo = context.repo;
  const payload = context.payload;

  if (context.eventName === "issues") {
    const issue_number = payload.issue!.number;
    return {
      create: async (content) => void (await octokit.rest.reactions.createForIssue({ ...repo, issue_number, content })),
      list: async () => toReactions(await octokit.paginate(octokit.rest.reactions.listForIssue, { ...repo, issue_number })),
      remove: async (reaction_id) => void (await octokit.rest.reactions.deleteForIssue({ ...repo, issue_number, reaction_id })),
    };
  }
  if (context.eventName === "issue_comment") {
    const comment_id = payload.comment!.id;
    return {
      create: async (content) => void (await octokit.rest.reactions.createForIssueComment({ ...repo, comment_id, content })),
      list: async () =>
        toReactions(await octokit.paginate(octokit.rest.reactions.listForIssueComment, { ...repo, comment_id })),
      remove: async (reaction_id) =>
        void (await octokit.rest.reactions.deleteForIssueComment({ ...repo, comment_id, reaction_id })),
    };
  }
  if (context.eventName === "pull_request_review_comment") {
    const comment_id = payload.comment!.id;
    return {
      create: async (content) =>
        void (await octokit.rest.reactions.createForPullRequestReviewComment({ ...repo, comment_id, content })),
      list: async () =>
        toReactions(await octokit.paginate(octokit.rest.reactions.listForPullRequestReviewComment, { ...repo, comment_id })),
      remove: async (reaction_id) =>
        void (await octokit.rest.reactions.deleteForPullRequestComment({ ...repo, comment_id, reaction_id })),
    };
  }
  throw new Error(`nothing to react to for event ${context.eventName}`);
}

async function main(): Promise<void> {
  const octokit = github.getOctokit(core.getInput("github-token", { required: true }));
  const content = core.getInput("content", { required: true });
  if (!(STATES as readonly string[]).includes(content)) throw new Error(`content must be one of ${STATES.join(", ")}`);
  const state = content as State;

  const where = target(octokit);
  await where.create(state);
  // One state at a time: drop the agent's earlier state reactions, such as the eyes when done.
  for (const id of staleReactions(await where.list(), state, core.getInput("github-login", { required: true }))) await where.remove(id);
}

main().catch((error: unknown) => core.setFailed(error instanceof Error ? error.message : String(error)));
