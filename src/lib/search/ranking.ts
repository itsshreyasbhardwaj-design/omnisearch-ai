/**
 * SQLite's bm25() returns a "golf score" — smaller (more negative) means a
 * better match — which is unbounded and not comparable across queries.
 * These two pure functions turn that into an ascending, display-friendly
 * 0-100 score that's honestly scoped to "best result in this result set,"
 * not a universal relevance percentage.
 */

export function normalizeBm25(rawScore: number): number {
  return -rawScore;
}

export function toRelevancePercent(normalizedScores: number[]): number[] {
  const max = Math.max(...normalizedScores, 0.0001);
  return normalizedScores.map((score) =>
    Math.round(Math.max(0, Math.min(100, (score / max) * 100))),
  );
}
