import { hybridProvider } from '@/lib/search/hybridRanking';
import type { SearchFilters, SearchResult } from '@/lib/search/types';

const EVIDENCE_CAP = 8;

/**
 * Retrieval for a natural-language question is just hybrid search — the
 * same lexical + semantic + symbol ranking used for code search, capped
 * tighter so an answer's evidence list stays readable. This is the
 * "candidate retrieval → hybrid ranking → context selection" pipeline;
 * "AI generation" and "citation validation" are `answerProvider.ts`.
 */
export async function retrieveEvidence(
  question: string,
  repos: { id: string; name: string; rootDir: string }[],
  filters: SearchFilters,
): Promise<SearchResult[]> {
  const outcome = await hybridProvider.search(question, repos, filters);
  return outcome.results.slice(0, EVIDENCE_CAP);
}
