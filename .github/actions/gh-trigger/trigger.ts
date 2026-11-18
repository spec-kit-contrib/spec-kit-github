// Pure decision logic: no I/O except the injected lookups.
import { sameLogin } from "../core/login.ts";
import { approvalStatus } from "./approval.ts";
import { decideReviewComment } from "./review.ts";
import { SPEC_BRANCH_PREFIX, WRITE_PERMISSIONS, skip, type DecideInput, type Decision } from "./types.ts";

export type { DecideInput, Decision, EventPayload, PullRequest, Review, ReviewThread, ThreadComment } from "./types.ts";

// Commands that may be triggered by a PR comment. Specify is started by assignment.
export const COMMENT_COMMANDS = ["plan", "tasks", "checklist", "converge", "analyze", "implement"];

export async function decide(input: DecideInput): Promise<Decision> {
  const { eventName, payload } = input;
  // The agent's own comments are never commands. With a token of its own, the agent is a user with
  // write access, and its comments start workflows, so without this it would answer itself forever.
  if (payload.comment && sameLogin(payload.comment.user.login, input.agentLogin)) {
    return skip("comment is from the agent itself");
  }
  if (eventName === "issues") return decideAssignment(input);
  if (eventName === "issue_comment") return decideComment(input);
  if (eventName === "pull_request_review_comment") return decideReviewComment(input);
  return skip(`unsupported event: ${eventName}`);
}

function decideAssignment({ payload, githubLogin }: DecideInput): Decision {
  if (!githubLogin) return skip("no agent assignee configured");
  if (payload.assignee?.login !== githubLogin) return skip("not assigned to the agent");
  if (!payload.issue) return skip("no issue in payload");
  const { title, body } = payload.issue;
  const command = "/speckit-specify";
  return {
    run: true,
    command,
    ref: payload.repository.default_branch,
    prompt: `${command} ${title}\n\n${body ?? ""}\n`,
    // The new spec branch for this issue.
    branch: `${SPEC_BRANCH_PREFIX}${payload.issue.number}`,
    // Specify creates the feature directory itself.
    featureDirectory: "",
    number: payload.issue.number,
    threads: [],
  };
}

async function decideComment({ payload, getPullRequest, getReviews, getPermission, listSpecDirectories }: DecideInput): Promise<Decision> {
  const { issue, comment } = payload;
  if (!issue?.pull_request) return skip("comment is not on a PR");
  if (!comment) return skip("no comment in payload");
  if (comment.user.type !== "User") return skip("commenter is not a user");
  const permission = await getPermission(comment.user.login);
  if (!WRITE_PERMISSIONS.includes(permission)) {
    return skip(`commenter has no write access (permission: ${permission})`);
  }

  // Leading whitespace is fine; the command must still start the comment.
  const body = comment.body.trimStart();
  const match = /^\/speckit-([a-z]+)(\s|$)/.exec(body);
  if (!match || !COMMENT_COMMANDS.includes(match[1]!)) return skip("no allowed command");

  const pr = await getPullRequest(issue.number);
  if (pr.headRepo !== payload.repository.full_name) return skip("PR is from a fork");
  if (!pr.headRef.startsWith(SPEC_BRANCH_PREFIX)) return skip("PR branch is not spec/*");

  // Implement runs generated code with the API key present, so a person has to have approved the
  // PR as it is now. Every other command only writes documents under specs/.
  if (match[1] === "implement") {
    const status = await approvalStatus(await getReviews(issue.number), pr.headSha, pr.author, getPermission);
    if (!status.approved) return skip(`/speckit-implement needs an approval of the current commit: ${status.reason}`);
  }

  // Spec Kit needs to be told which feature a later stage belongs to. A PR holds exactly one.
  const directories = await listSpecDirectories(pr.headSha);
  if (directories.length !== 1) {
    throw new Error(`expected exactly one directory in specs/ at ${pr.headSha}, found ${directories.length}`);
  }

  return {
    run: true,
    command: `/speckit-${match[1]}`,
    ref: pr.headSha,
    prompt: `${body}\n`,
    branch: pr.headRef,
    featureDirectory: directories[0]!,
    number: issue.number,
    threads: [],
  };
}
