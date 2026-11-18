/**
 * Split the agent's final message into one reply per thread. Entries start with "Thread N:" and
 * run until the next one. Returns null when the message has no such entries, so the caller can
 * post it whole instead.
 */
export function splitReplies(text: string, count: number): Map<number, string> | null {
  const replies = new Map<number, string[]>();
  let current: number | null = null;
  for (const line of text.split("\n")) {
    const start = /^\s*\**Thread\s+(\d+)\**\s*[:.\-–]\s*(.*)$/i.exec(line);
    if (start) {
      const n = Number(start[1]);
      current = n >= 1 && n <= count ? n : null;
      if (current !== null) replies.set(current, [start[2]!]);
    } else if (current !== null) {
      replies.get(current)!.push(line);
    }
  }
  if (replies.size === 0) return null;
  const bodies = new Map<number, string>();
  for (const [n, lines] of replies) {
    const body = lines.join("\n").trim();
    if (body) bodies.set(n, body);
  }
  return bodies;
}
