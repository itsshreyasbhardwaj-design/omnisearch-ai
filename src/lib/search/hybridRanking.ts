import { sqliteFtsProvider } from './sqliteFtsProvider';
import { semanticProvider } from './semanticProvider';
import { symbolProvider } from './symbolProvider';
import type { SearchProvider, SearchResult } from './types';

const TEXT_WEIGHT = 0.5;
const SEMANTIC_WEIGHT = 0.3;
const SYMBOL_WEIGHT = 0.2;
const PAGE_SIZE = 30;

function resultKey(r: Pick<SearchResult, 'repoId' | 'filePath' | 'startLine'>): string {
  return `${r.repoId}:${r.filePath}:${r.startLine}`;
}

/**
 * Combines lexical (BM25), local-semantic (cosine similarity), and symbol
 * name relevance into one ranked list — a real weighted merge over the
 * other three providers' own (already-normalized 0-100) scores, not a stub.
 *
 * Sub-providers are always called at their own first page: the candidate
 * pool this merges over is fixed regardless of which hybrid page is being
 * requested, so paginating hybrid results means slicing that one ranked
 * list rather than re-deriving a shifting merge per page.
 */
export const hybridProvider: SearchProvider = {
  async search(query, repos, filters, cursor = 0) {
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
    const hasNextPage = cursor + PAGE_SIZE < ranked.length;
    const page = ranked.slice(cursor, cursor + PAGE_SIZE);

    const results: SearchResult[] = page.map(({ result, weightedScore, signals }) => ({
      ...result,
      matchType: 'HYBRID MATCH',
      score: Math.round(Math.min(100, weightedScore)),
      explanation: `Matched via ${signals.join(' + ')}${result.explanation ? ` — ${result.explanation}` : ''}`,
    }));

    return {
      results,
      truncated: textOutcome.truncated || semanticOutcome.truncated || symbolOutcome.truncated,
      nextCursor: hasNextPage ? cursor + PAGE_SIZE : null,
    };
  },
};
