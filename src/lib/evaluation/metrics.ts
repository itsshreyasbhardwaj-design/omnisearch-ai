export interface RankedOutcome {
  rank: number | null;
  latencyMs: number;
}

export interface RelevanceMetrics {
  queries: number;
  precisionAt1: number;
  precisionAt5: number;
  mrr: number;
  avgLatencyMs: number;
}

/** Pure, so `scripts/bench.ts`'s scoring logic is unit-testable without spinning up a repo index. */
export function computeRelevanceMetrics(outcomes: RankedOutcome[]): RelevanceMetrics {
  const n = outcomes.length;
  if (n === 0) {
    return { queries: 0, precisionAt1: 0, precisionAt5: 0, mrr: 0, avgLatencyMs: 0 };
  }

  const hitsAt1 = outcomes.filter((o) => o.rank === 1).length;
  const hitsAt5 = outcomes.filter((o) => o.rank !== null && o.rank <= 5).length;
  const mrr = outcomes.reduce((sum, o) => sum + (o.rank ? 1 / o.rank : 0), 0) / n;
  const avgLatencyMs = outcomes.reduce((sum, o) => sum + o.latencyMs, 0) / n;

  return {
    queries: n,
    precisionAt1: hitsAt1 / n,
    precisionAt5: hitsAt5 / n,
    mrr,
    avgLatencyMs,
  };
}
