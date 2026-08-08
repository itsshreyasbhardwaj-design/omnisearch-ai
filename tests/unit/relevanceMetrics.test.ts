import { describe, expect, it } from 'vitest';
import { computeRelevanceMetrics } from '@/lib/evaluation/metrics';

describe('computeRelevanceMetrics', () => {
  it('scores a perfect run as 1.0 across the board', () => {
    const metrics = computeRelevanceMetrics([
      { rank: 1, latencyMs: 10 },
      { rank: 1, latencyMs: 20 },
    ]);
    expect(metrics).toMatchObject({
      queries: 2,
      precisionAt1: 1,
      precisionAt5: 1,
      mrr: 1,
      avgLatencyMs: 15,
    });
  });

  it('computes MRR as the mean of 1/rank, treating a miss as 0', () => {
    const metrics = computeRelevanceMetrics([
      { rank: 1, latencyMs: 0 }, // 1/1 = 1
      { rank: 4, latencyMs: 0 }, // 1/4 = 0.25
      { rank: null, latencyMs: 0 }, // miss = 0
    ]);
    expect(metrics.mrr).toBeCloseTo((1 + 0.25 + 0) / 3, 5);
  });

  it('distinguishes precision@1 from precision@5', () => {
    const metrics = computeRelevanceMetrics([
      { rank: 1, latencyMs: 0 },
      { rank: 3, latencyMs: 0 },
      { rank: 5, latencyMs: 0 },
      { rank: 6, latencyMs: 0 },
    ]);
    expect(metrics.precisionAt1).toBeCloseTo(0.25);
    expect(metrics.precisionAt5).toBeCloseTo(0.75);
  });

  it('handles an empty result set without dividing by zero', () => {
    expect(computeRelevanceMetrics([])).toEqual({
      queries: 0,
      precisionAt1: 0,
      precisionAt5: 0,
      mrr: 0,
      avgLatencyMs: 0,
    });
  });
});
