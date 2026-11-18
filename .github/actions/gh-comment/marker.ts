const tag = (marker: string): string => `<!-- ${marker} -->`;

/** Append a hidden marker so the comment can be found again. */
export function withMarker(body: string, marker: string): string {
  return marker ? `${body}\n\n${tag(marker)}` : body;
}

export function findMarked<T extends { body?: string | null }>(comments: T[], marker: string): T | undefined {
  return marker ? comments.find((comment) => comment.body?.includes(tag(marker))) : undefined;
}
