export type MatchType = 'TEXT MATCH' | 'REGEX MATCH';

export interface SearchFilters {
  repoIds?: string[];
  language?: string;
  directory?: string;
  fileExtension?: string;
}

export interface SearchResult {
  repoId: string;
  repoName: string;
  filePath: string;
  language: string | null;
  matchType: MatchType;
  score: number;
  startLine: number;
  endLine: number;
  /** Pre-escaped HTML with the match wrapped in <mark> — safe to render directly. */
  snippetHtml: string;
  highlightLine: number | null;
}

export interface SearchResponse {
  query: string;
  mode: 'text' | 'regex';
  results: SearchResult[];
  truncated: boolean;
  timedOut?: boolean;
  tookMs: number;
}

/**
 * The seam symbol/semantic/hybrid search (phase 3-5) will implement — text
 * and regex already conform to it so adding a mode later means adding a
 * provider, not touching the API route or the UI's result rendering.
 */
export interface SearchProvider {
  search(
    query: string,
    repos: { id: string; name: string; rootDir: string }[],
    filters: SearchFilters,
  ): Promise<Omit<SearchResponse, 'query' | 'mode' | 'tookMs'>>;
}
