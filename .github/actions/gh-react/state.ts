/** The states shown as reactions: running, done, failed. */
export const STATES = ["eyes", "+1", "confused"] as const;
export type State = (typeof STATES)[number];

import { sameLogin } from "../core/login.ts";

export interface Reaction {
  id: number;
  content: string;
  /** Login of whoever reacted. */
  login: string;
}

/** The reaction ids to delete so that only `keep` is left of the agent's own state reactions. */
export function staleReactions(existing: Reaction[], keep: State, login: string): number[] {
  return existing
    .filter((r) => sameLogin(r.login, login) && r.content !== keep && (STATES as readonly string[]).includes(r.content))
    .map((r) => r.id);
}
