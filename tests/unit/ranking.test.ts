import { describe, expect, it } from 'vitest';
import { normalizeBm25, toRelevancePercent } from '@/lib/search/ranking';

describe('normalizeBm25', () => {
  it('negates so a smaller (better) bm25 score becomes larger', () => {
    expect(normalizeBm25(-5)).toBe(5);
    expect(normalizeBm25(-1)).toBe(1);
    expect(normalizeBm25(-5)).toBeGreaterThan(normalizeBm25(-1));
  });
});

describe('toRelevancePercent', () => {
  it('scales the best score in the batch to 100', () => {
    const result = toRelevancePercent([5, 2.5, 1]);
    expect(result[0]).toBe(100);
    expect(result[1]).toBe(50);
    expect(result[2]).toBe(20);
  });

  it('never returns a value outside [0, 100]', () => {
    const result = toRelevancePercent([-3, 0, 10]);
    for (const value of result) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
  });

  it('handles an all-zero batch without dividing by zero', () => {
    const result = toRelevancePercent([0, 0]);
    expect(result.every((v) => Number.isFinite(v))).toBe(true);
  });
});
