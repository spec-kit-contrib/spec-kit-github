export interface PullRequest {
  headRepo: string;
  headRef: string;
  headSha: string;
  /** Login of whoever opened the PR. */
  author: string;
}

/** A submitted pull request review. */
export interface Review {
  login: string;
  /** "User", "Bot", ... */
  userType: string;
  /** APPROVED, CHANGES_REQUESTED, COMMENTED or DISMISSED. */
  state: string;
  /** The commit the review was made on. */
  commitId: string;
}

/** A comment in a review thread, oldest first. */
export interface ThreadComment {
  id: number;
  login: string;
  /** "User", "Bot", ... */
  userType: string;
  body: string;
}

/** A review thread on a pull request. */
export interface ReviewThread {
  path: string;
  line: number | null;
  isResolved: boolean;
  /** Oldest first; the first one started the thread. */
  comments: ThreadComment[];
}

export interface EventPayload {
  repository: { full_name: string; default_branch: string };
  issue?: {
    number: number;
    title: string;
    body: string | null;
    pull_request?: object;
  };
  assignee?: { login: string };
  comment?: {
    id: number;
    body: string;
    user: { type: string; login: string };
    /** Review comments only: file, line and the id of the thread's first comment. */
    path?: string;
    line?: number | null;
    in_reply_to_id?: number;
  };
  /** Review comment events only. */
  pull_request?: {
    number: number;
    head: { ref: string; sha: string; repo: { full_name: string } | null };
  };
}

export interface DecideInput {
  eventName: string;
  payload: EventPayload;
  githubLogin: string;
  getPullRequest: (number: number) => Promise<PullRequest>;
  /** Directories under specs/ at the given ref, e.g. ["specs/001-greeting-cli"]. */
  listSpecDirectories: (ref: string) => Promise<string[]>;
  /** The reviews submitted on the pull request, oldest first. */
  getReviews: (pullNumber: number) => Promise<Review[]>;
  /** The commenter's repository permission: admin, write, read or none. */
  getPermission: (login: string) => Promise<string>;
  /** Every review thread on the pull request. */
  getThreads: (pullNumber: number) => Promise<ReviewThread[]>;
}

export type Decision =
  | { run: false; reason: string }
  | {
      run: true;
      command: string;
      ref: string;
      prompt: string;
      branch: string;
      featureDirectory: string;
      /** The issue or PR number. */
      number: number;
      /**
       * Review threads to answer, as the ids of their first comments. The first is the thread the
       * command was given in. Empty outside review comment events.
       */
      threads: number[];
    };

// Repository permissions that may trigger a stage. The comment's author_association is not
// used: GitHub reports different values for the same person in different event payloads.
export const WRITE_PERMISSIONS = ["admin", "maintain", "write"];
// Only PRs from branches with this prefix are touched.
export const SPEC_BRANCH_PREFIX = "spec/";
// The agent's own login: its replies are part of a thread but never trigger a run.
export const AGENT_LOGIN = "github-actions[bot]";
// REST says "github-actions[bot]" and GraphQL says "github-actions" for the same account.
export const isAgent = (login: string): boolean => login.replace(/\[bot\]$/, "") === "github-actions";

export const skip = (reason: string): Decision => ({ run: false, reason });
