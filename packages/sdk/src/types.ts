/**
 * Mirrors the JSON contract of the OmniSearch AI REST API. Deliberately not
 * imported from the server package — a consumer of this SDK shouldn't need
 * the whole Next.js app as a dependency just for its types.
 */

export type SearchMode = 'text' | 'regex' | 'symbol' | 'semantic' | 'hybrid';
export type MatchType =
  'TEXT MATCH' | 'REGEX MATCH' | 'SYMBOL MATCH' | 'SEMANTIC MATCH' | 'HYBRID MATCH';

export interface SearchResult {
  repoId: string;
  repoName: string;
  filePath: string;
  language: string | null;
  matchType: MatchType;
  score: number;
  startLine: number;
  endLine: number;
  snippetHtml: string;
  highlightLine: number | null;
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

export interface SearchFilters {
  language?: string;
  directory?: string;
  fileExtension?: string;
  symbolKind?: string;
}

export interface SearchOptions {
  repoId?: string;
  repoIds?: string[];
  regexFlags?: string;
  filters?: SearchFilters;
}

export interface AskResponse {
  question: string;
  provider: string;
  synthesized: boolean;
  summary: string;
  citations: SearchResult[];
  insufficientEvidence: boolean;
}

export type RepoSourceType = 'github' | 'local' | 'zip';
export type RepoStatus = 'pending' | 'indexing' | 'ready' | 'error';

export interface Repository {
  id: string;
  owner_user_id: string;
  name: string;
  source_type: RepoSourceType;
  source_ref: string;
  status: RepoStatus;
  error_message: string | null;
  file_count: number;
  total_size_bytes: number;
  created_at: string;
  updated_at: string;
  last_indexed_at: string | null;
}

export interface User {
  id: string;
  email: string;
  createdAt: string;
}
