import { sqliteFtsProvider } from './sqliteFtsProvider';
import { semanticProvider } from './semanticProvider';
import { symbolProvider } from './symbolProvider';
import type { SearchProvider, SearchResult } from './types';

const TEXT_WEIGHT = 0.5;
const SEMANTIC_WEIGHT = 0.3;
const SYMBOL_WEIGHT = 0.2;
const RESULT_CAP = 50;

function resultKey(r: Pick<SearchResult, 'repoId' | 'filePath' | 'startLine'>): string {
  return `${r.repoId}:${r.filePath}:${r.startLine}`;
}

/**
 * Combines lexical (BM25), local-semantic (cosine similarity), and symbol
 * name relevance into one ranked list — a real weighted merge over the
 * other three providers' own (already-normalized 0-100) scores, not a stub.
 */
export const hybridProvider: SearchProvider = {
  async search(query, repos, filters) {
    const [textOutcome, semanticOutcome, symbolOutcome] = await Promise.all([
      sqliteFtsProvider.search(query, repos, filters),
      semanticProvider.search(query, repos, filters),
      symbolProvider.search(query, repos, filters),
    ]);

    const merged = new Map<
      string,
      { result: SearchResult; weightedScore: number; signals: string[] }
    >();

    function fold(results: SearchResult[], weight: number, signal: string) {
      for (const result of results) {
        const key = resultKey(result);
        const contribution = result.score * weight;
        const existing = merged.get(key);
        if (existing) {
          existing.weightedScore += contribution;
          existing.signals.push(signal);
        } else {
          merged.set(key, { result, weightedScore: contribution, signals: [signal] });
        }
      }
    }

    fold(textOutcome.results, TEXT_WEIGHT, 'text');
    fold(semanticOutcome.results, SEMANTIC_WEIGHT, 'semantic');
    fold(symbolOutcome.results, SYMBOL_WEIGHT, 'symbol');

    const ranked = Array.from(merged.values()).sort((a, b) => b.weightedScore - a.weightedScore);
    const truncated = ranked.length > RESULT_CAP;
    const top = ranked.slice(0, RESULT_CAP);

    const results: SearchResult[] = top.map(({ result, weightedScore, signals }) => ({
      ...result,
      matchType: 'HYBRID MATCH',
      score: Math.round(Math.min(100, weightedScore)),
      explanation: `Matched via ${signals.join(' + ')}${result.explanation ? ` — ${result.explanation}` : ''}`,
    }));

    return {
      results,
      truncated:
        truncated || textOutcome.truncated || semanticOutcome.truncated || symbolOutcome.truncated,
    };
  },
};
