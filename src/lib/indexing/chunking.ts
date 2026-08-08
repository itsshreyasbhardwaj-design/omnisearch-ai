export interface Chunk {
  startLine: number;
  endLine: number;
  content: string;
}

const DEFAULT_CHUNK_LINES = 60;

/**
 * Splits file content into fixed-size, non-overlapping line windows. Each
 * chunk becomes one FTS5 row, so a search hit resolves to a line range
 * instead of "somewhere in this 3,000-line file." Non-overlapping is a
 * deliberate simplification for phase 1-2 — a match that straddles a chunk
 * boundary can be missed; symbol-aware chunking (phase 3) replaces this.
 */
export function chunkFileContent(content: string, chunkLines = DEFAULT_CHUNK_LINES): Chunk[] {
  if (content.length === 0) return [];

  const lines = content.split('\n');
  const chunks: Chunk[] = [];

  for (let start = 0; start < lines.length; start += chunkLines) {
    const end = Math.min(start + chunkLines, lines.length);
    const slice = lines.slice(start, end);
    chunks.push({
      startLine: start + 1,
      endLine: end,
      content: slice.join('\n'),
    });
  }

  return chunks;
}
