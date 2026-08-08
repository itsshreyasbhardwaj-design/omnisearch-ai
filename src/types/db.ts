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

export type SearchMode = 'text' | 'regex';

export interface SearchHistoryRow {
  id: string;
  user_id: string;
  repo_id: string | null;
  query: string;
  mode: SearchMode;
  result_count: number;
  created_at: string;
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
