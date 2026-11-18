/** Used when the assignee cannot be resolved: the account the workflow itself runs as. */
export const DEFAULT_AUTHOR = "github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>";

/**
 * A commit author that GitHub links to the account: the no-reply address carries the account's id,
 * so the commit shows that user's name and avatar.
 */
export function noreplyAuthor(login: string, id: number): string {
  return `${login} <${id}+${login}@users.noreply.github.com>`;
}
