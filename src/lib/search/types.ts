export type MatchType =
  'TEXT MATCH' | 'REGEX MATCH' | 'SYMBOL MATCH' | 'SEMANTIC MATCH' | 'HYBRID MATCH';
export type SearchMode = 'text' | 'regex' | 'symbol' | 'semantic' | 'hybrid';

export interface SearchFilters {
  repoIds?: string[];
  language?: string;
  directory?: string;
  fileExtension?: string;
  symbolKind?: string;
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
  /** Populated for symbol/hybrid results — why this result was selected. */
  explanation?: string;
}

export interface SearchResponse {
  query: string;
  mode: SearchMode;
  results: SearchResult[];
  truncated: boolean;
  timedOut?: boolean;
  tookMs: number;
}

/**
 * The seam every search mode implements — text, regex, symbol, and semantic
 * already conform to it, so a new mode means adding a provider, not
 * touching the API route or the UI's result rendering.
 */
export interface SearchProvider {
  search(
    query: string,
    repos: { id: string; name: string; rootDir: string }[],
    filters: SearchFilters,
  ): Promise<Omit<SearchResponse, 'query' | 'mode' | 'tookMs'>>;
}
