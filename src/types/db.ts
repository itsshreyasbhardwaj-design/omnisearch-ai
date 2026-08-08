export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
}

export type RepoSourceType = 'github' | 'local' | 'zip';
export type RepoStatus = 'pending' | 'indexing' | 'ready' | 'error';

export interface RepositoryRow {
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

export interface FileRow {
  id: string;
  repo_id: string;
  path: string;
  language: string | null;
  size_bytes: number;
  content_hash: string;
  line_count: number;
  updated_at: string;
}

export type SearchMode = 'text' | 'regex' | 'symbol' | 'semantic' | 'hybrid';

export interface SearchHistoryRow {
  id: string;
  user_id: string;
  repo_id: string | null;
  query: string;
  mode: SearchMode;
  result_count: number;
  latency_ms: number | null;
  created_at: string;
}

export type SymbolKind =
  'function' | 'method' | 'class' | 'interface' | 'type' | 'variable' | 'component';

export interface SymbolRow {
  id: string;
  repo_id: string;
  file_id: string;
  path: string;
  name: string;
  kind: SymbolKind;
  start_line: number;
  end_line: number;
  signature: string | null;
  exported: 0 | 1;
  language: string | null;
}

export interface ImportRow {
  id: string;
  repo_id: string;
  file_id: string;
  path: string;
  specifier: string;
  imported_names_json: string;
  resolved_file_id: string | null;
}

export interface EmbeddingRow {
  id: string;
  repo_id: string;
  file_id: string;
  path: string;
  start_line: number;
  end_line: number;
  language: string | null;
  vector: Buffer;
  norm: number;
}

export interface FileAccessRow {
  id: string;
  user_id: string;
  repo_id: string;
  file_id: string;
  path: string;
  accessed_at: string;
}

export interface SavedSearchRow {
  id: string;
  user_id: string;
  name: string;
  query: string;
  mode: SearchMode;
  filters_json: string;
  created_at: string;
}
