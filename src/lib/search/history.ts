import { nanoid } from 'nanoid';
import { getDb } from '@/lib/db/client';
import type { SearchHistoryRow, SearchMode } from '@/types/db';

export function recordSearch(
  userId: string,
  repoId: string | null,
  query: string,
  mode: SearchMode,
  resultCount: number,
): void {
  getDb()
    .prepare(
      `INSERT INTO search_history (id, user_id, repo_id, query, mode, result_count)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(nanoid(), userId, repoId, query, mode, resultCount);
}

export function listRecentSearches(userId: string, limit = 20): SearchHistoryRow[] {
  return getDb()
    .prepare('SELECT * FROM search_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(userId, limit) as SearchHistoryRow[];
}
