import { WRITE_PERMISSIONS, type Review } from "./types.ts";

export interface ApprovalStatus {
  approved: boolean;
  /** Why not, when it is not approved. */
  reason: string;
}

// Only these reviews change what a reviewer has decided. A plain comment does not.
const DECISIVE = ["APPROVED", "CHANGES_REQUESTED", "DISMISSED"];

/**
 * Whether a pull request may have generated code run on it. At least one person must have approved
 * the current head commit, and no one with write access may be asking for changes.
 *
 * An approval counts only if it is the reviewer's latest decisive review, it is on the current head
 * commit, the reviewer is a person who did not open the PR, and the reviewer has write access.
 */
export async function approvalStatus(
  reviews: Review[],
  headSha: string,
  author: string,
  getPermission: (login: string) => Promise<string>,
): Promise<ApprovalStatus> {
  // Each reviewer's latest decisive review. Reviews arrive oldest first.
  const latest = new Map<string, Review>();
  for (const review of reviews) if (DECISIVE.includes(review.state)) latest.set(review.login, review);

  const problems: string[] = [];
  let approvals = 0;
  for (const review of latest.values()) {
    if (review.userType !== "User") continue;
    const writer = WRITE_PERMISSIONS.includes(await getPermission(review.login));
    if (review.state === "CHANGES_REQUESTED" && writer) problems.push(`@${review.login} requested changes`);
    if (review.state !== "APPROVED") continue;
    if (review.login === author) problems.push(`@${review.login} opened the PR and cannot approve it`);
    else if (!writer) problems.push(`@${review.login} has no write access`);
    else if (review.commitId !== headSha) problems.push(`@${review.login} approved an older commit`);
    else approvals += 1;
  }

  const blocking = problems.filter((p) => p.endsWith("requested changes"));
  if (blocking.length > 0) return { approved: false, reason: blocking.join("; ") };
  if (approvals > 0) return { approved: true, reason: "" };
  return { approved: false, reason: problems.length > 0 ? problems.join("; ") : "no approval yet" };
}
