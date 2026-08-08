/**
 * Additive schema for symbol extraction, dependency edges, local embeddings,
 * search latency tracking, and file-access logging (analytics). Nothing
 * here touches an existing table's shape — see 0001_init.ts.
 */
export const id = '0002_phase3_7';

export const sql = `
CREATE TABLE IF NOT EXISTS symbols (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  start_line INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  signature TEXT,
  exported INTEGER NOT NULL DEFAULT 0,
  language TEXT
);
CREATE INDEX IF NOT EXISTS idx_symbols_repo ON symbols(repo_id);
CREATE INDEX IF NOT EXISTS idx_symbols_file ON symbols(file_id);
CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(repo_id, name);

CREATE TABLE IF NOT EXISTS imports (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  specifier TEXT NOT NULL,
  imported_names_json TEXT NOT NULL DEFAULT '[]',
  resolved_file_id TEXT REFERENCES files(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_imports_repo ON imports(repo_id);
CREATE INDEX IF NOT EXISTS idx_imports_file ON imports(file_id);
CREATE INDEX IF NOT EXISTS idx_imports_resolved ON imports(resolved_file_id);

CREATE TABLE IF NOT EXISTS embeddings (
  id TEXT PRIMARY KEY,
  repo_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  start_line INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  language TEXT,
  vector BLOB NOT NULL,
  norm REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_embeddings_repo ON embeddings(repo_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_file ON embeddings(file_id);

CREATE TABLE IF NOT EXISTS file_access (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  repo_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  accessed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS idx_file_access_user ON file_access(user_id, accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_file_access_repo_path ON file_access(repo_id, path);

ALTER TABLE search_history ADD COLUMN latency_ms INTEGER;
`;
