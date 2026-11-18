import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_AUTHOR, noreplyAuthor } from "./author.ts";

test("the author is the login with the account's no-reply address", () => {
  assert.equal(noreplyAuthor("ralch-bot", 12345), "ralch-bot <12345+ralch-bot@users.noreply.github.com>");
});

test("the default author is the Actions bot", () => {
  assert.equal(DEFAULT_AUTHOR, "github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>");
});
