/** The account the workflow runs as when no agent token is configured. */
export const DEFAULT_AGENT_LOGIN = "github-actions[bot]";

/**
 * Whether two logins are the same account. REST says "github-actions[bot]" and GraphQL says
 * "github-actions" for the same bot, and logins are not case sensitive.
 */
export function sameLogin(a: string, b: string): boolean {
  const normal = (login: string): string => login.replace(/\[bot\]$/i, "").toLowerCase();
  return normal(a) !== "" && normal(a) === normal(b);
}
