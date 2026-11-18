import { sameLogin } from "../core/login.ts";
import {
  SPEC_BRANCH_PREFIX,
  WRITE_PERMISSIONS,
  skip,
  type DecideInput,
  type Decision,
  type ReviewThread,
  type ThreadComment,
} from "./types.ts";

const COMMAND = "/speckit-clarify";
// Clarify works on the spec. Widen this one rule to take review feedback on other files.
const SPEC_FILE = /^(specs\/[^/]+)\/spec\.md$/;

const startsWithCommand = (body: string): boolean => /^\/speckit-clarify(\s|$)/.test(body.trimStart());

/** The thread comments the agent may read: people with write access, and the agent itself. */
async function readable(
  comments: ThreadComment[],
  getPermission: DecideInput["getPermission"],
  githubLogin: string,
): Promise<ThreadComment[]> {
  const people = [...new Set(comments.filter((c) => !sameLogin(c.login, githubLogin) && c.userType === "User").map((c) => c.login))];
  const allowed = new Set<string>();
  for (const login of people) if (WRITE_PERMISSIONS.includes(await getPermission(login))) allowed.add(login);
  return comments.filter((comment) => sameLogin(comment.login, githubLogin) || allowed.has(comment.login));
}

export function clarifyPrompt(threads: ReviewThread[]): string {
  const blocks = threads.map((thread, index) => {
    const where = index === 0 ? "your /speckit-clarify comment" : thread.line ? `${thread.path} line ${thread.line}` : thread.path;
    return [`Thread ${index + 1} (${where}):`, ...thread.comments.map((c) => `@${c.login}: ${c.body.trim()}`)].join("\n");
  });
  return [
    COMMAND,
    "",
    `These are review threads on the spec, handled together. Thread 1 holds the instructions for this run; the other threads are comments on lines of the spec. This run is non-interactive: nobody can answer in this conversation.`,
    "",
    blocks.join("\n\n"),
    "",
    "For each thread:",
    "- If the latest comment answers or decides something, apply it to the spec the way /speckit-clarify normally does: record it in the Clarifications section and update the sections it affects.",
    "- If it is unclear or raises a question, change nothing for that thread and ask the reviewer one short question.",
    "Your final message is posted as replies, one per thread. Write one entry per thread, each starting with `Thread N:` and the number of the thread, then either the question or a one-line summary of what you changed. Nothing else.",
    "",
  ].join("\n");
}

/**
 * A /speckit-clarify comment on spec.md, or a reply in a thread it started. One run answers that
 * thread and every other thread on the same file that its author started and is still waiting on.
 */
export async function decideReviewComment({ payload, getThreads, getPermission, githubLogin }: DecideInput): Promise<Decision> {
  const { comment, pull_request: pr } = payload;
  if (!comment || !pr) return skip("no review comment in payload");
  if (comment.user.type !== "User") return skip("commenter is not a user");

  const permission = await getPermission(comment.user.login);
  if (!WRITE_PERMISSIONS.includes(permission)) return skip(`commenter has no write access (permission: ${permission})`);

  if (pr.head.repo?.full_name !== payload.repository.full_name) return skip("PR is from a fork");
  if (!pr.head.ref.startsWith(SPEC_BRANCH_PREFIX)) return skip("PR branch is not spec/*");

  const file = SPEC_FILE.exec(comment.path ?? "");
  if (!file) return skip("comment is not on a spec.md");

  const threads = await getThreads(pr.number);
  const rootId = comment.in_reply_to_id ?? comment.id;
  // The command starts a thread; replies continue it. A thread nobody started with it is ignored.
  const main = threads.find((t) => t.comments[0]?.id === rootId);
  const root = main?.comments[0];
  if (!main || !root || !startsWithCommand(root.body)) return skip("thread was not started with /speckit-clarify");

  // Other threads on this file that the same person started and that are waiting on a human.
  const others = threads.filter((t) => {
    const first = t.comments[0];
    const last = t.comments[t.comments.length - 1];
    return (
      t !== main &&
      t.path === main.path &&
      !t.isResolved &&
      first !== undefined &&
      first.login === root.login &&
      last !== undefined &&
      !sameLogin(last.login, githubLogin)
    );
  });

  const included: ReviewThread[] = [];
  for (const thread of [main, ...others]) {
    included.push({ ...thread, comments: await readable(thread.comments, getPermission, githubLogin) });
  }

  return {
    run: true,
    command: COMMAND,
    ref: pr.head.sha,
    prompt: clarifyPrompt(included),
    branch: pr.head.ref,
    featureDirectory: file[1]!,
    number: pr.number,
    threads: [main, ...others].map((t) => t.comments[0]!.id),
  };
}
