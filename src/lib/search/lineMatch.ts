/**
 * A chunk covers many lines; this finds which one actually contains a query
 * term so results point at a real line instead of just the chunk's start.
 * Falls back to `startLine` when no line matches (can happen when a match
 * spans a token boundary FTS5's tokenizer merges but a literal scan won't).
 */
export function findMatchingLine(
  chunkContent: string,
  tokens: string[],
  startLine: number,
): number {
  const lowerTokens = tokens.map((t) => t.toLowerCase()).filter(Boolean);
  if (lowerTokens.length === 0) return startLine;

  const lines = chunkContent.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line === undefined) continue;
    const lower = line.toLowerCase();
    if (lowerTokens.some((token) => lower.includes(token))) {
      return startLine + i;
    }
  }
  return startLine;
}
