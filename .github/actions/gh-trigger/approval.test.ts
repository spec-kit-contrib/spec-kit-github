import { test } from "node:test";
import assert from "node:assert/strict";
import { approvalStatus } from "./approval.ts";
import type { Review } from "./types.ts";

const HEAD = "abc123";
const review = (login: string, state: string, commitId = HEAD, userType = "User"): Review => ({
  login,
  userType,
  state,
  commitId,
});
const writers: Record<string, string> = { alice: "write", bob: "admin", carol: "maintain", dave: "read", botty: "write" };
const getPermission = async (login: string) => writers[login] ?? "none";
const check = (reviews: Review[], author = "github-actions") => approvalStatus(reviews, HEAD, author, getPermission);

test("an approval of the current commit by a writer is enough", async () => {
  assert.deepEqual(await check([review("alice", "APPROVED")]), { approved: true, reason: "" });
});

test("no reviews at all is not approved", async () => {
  assert.deepEqual(await check([]), { approved: false, reason: "no approval yet" });
});

test("a plain comment review is not an approval", async () => {
  assert.equal((await check([review("alice", "COMMENTED")])).approved, false);
});

test("an approval of an older commit is stale", async () => {
  const status = await check([review("alice", "APPROVED", "old999")]);
  assert.equal(status.approved, false);
  assert.match(status.reason, /@alice approved an older commit/);
});

test("a bot's approval does not count", async () => {
  const status = await check([review("botty", "APPROVED", HEAD, "Bot")]);
  assert.equal(status.approved, false);
});

test("the PR author cannot approve their own PR", async () => {
  const status = await check([review("alice", "APPROVED")], "alice");
  assert.equal(status.approved, false);
  assert.match(status.reason, /opened the PR and cannot approve/);
});

test("an approval from someone without write access does not count", async () => {
  const status = await check([review("dave", "APPROVED")]);
  assert.equal(status.approved, false);
  assert.match(status.reason, /@dave has no write access/);
  assert.equal((await check([review("erin", "APPROVED")])).approved, false);
});

for (const login of ["alice", "bob", "carol"]) {
  test(`${login}, with ${writers[login]} access, can approve`, async () => {
    assert.equal((await check([review(login, "APPROVED")])).approved, true);
  });
}

test("a later change request cancels an earlier approval by the same person", async () => {
  const status = await check([review("alice", "APPROVED"), review("alice", "CHANGES_REQUESTED")]);
  assert.equal(status.approved, false);
  assert.match(status.reason, /@alice requested changes/);
});

test("a later approval replaces an earlier change request by the same person", async () => {
  assert.equal((await check([review("alice", "CHANGES_REQUESTED"), review("alice", "APPROVED")])).approved, true);
});

test("a dismissed approval no longer counts", async () => {
  assert.equal((await check([review("alice", "APPROVED"), review("alice", "DISMISSED")])).approved, false);
});

test("a comment after an approval does not undo it", async () => {
  assert.equal((await check([review("alice", "APPROVED"), review("alice", "COMMENTED")])).approved, true);
});

test("someone else's change request blocks, even with an approval", async () => {
  const status = await check([review("alice", "APPROVED"), review("bob", "CHANGES_REQUESTED")]);
  assert.equal(status.approved, false);
  assert.match(status.reason, /@bob requested changes/);
});

test("a change request from someone without write access does not block", async () => {
  assert.equal((await check([review("alice", "APPROVED"), review("dave", "CHANGES_REQUESTED")])).approved, true);
});

test("one valid approval is enough when another is stale", async () => {
  assert.equal((await check([review("alice", "APPROVED", "old999"), review("bob", "APPROVED")])).approved, true);
});
