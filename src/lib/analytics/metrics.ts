import { getDb } from '@/lib/db/client';

export interface AnalyticsSummary {
  totalSearches: number;
  avgLatencyMs: number;
  zeroResultCount: number;
  zeroResultRate: number;
  searchesByMode: { mode: string; count: number }[];
  topRepos: { repoId: string; repoName: string; count: number }[];
  topFiles: { repoId: string; repoName: string; path: string; count: number }[];
  totalRepositories: number;
  totalFileCount: number;
  totalIndexSizeBytes: number;
}

/** Every query here is scoped to `userId` — analytics never mixes data across accounts. */
export function getAnalyticsSummary(userId: string): AnalyticsSummary {
  const db = getDb();

  const totals = db
    .prepare(
      `SELECT
         COUNT(*) AS totalSearches,
         COALESCE(AVG(latency_ms), 0) AS avgLatencyMs,
         SUM(CASE WHEN result_count = 0 THEN 1 ELSE 0 END) AS zeroResultCount
       FROM search_history WHERE user_id = ?`,
    )
    .get(userId) as { totalSearches: number; avgLatencyMs: number; zeroResultCount: number };

  const searchesByMode = db
    .prepare('SELECT mode, COUNT(*) AS count FROM search_history WHERE user_id = ? GROUP BY mode')
    .all(userId) as { mode: string; count: number }[];

  const topRepos = db
    .prepare(
      `SELECT sh.repo_id AS repoId, r.name AS repoName, COUNT(*) AS count
       FROM search_history sh
       JOIN repositories r ON r.id = sh.repo_id
       WHERE sh.user_id = ? AND sh.repo_id IS NOT NULL
       GROUP BY sh.repo_id
       ORDER BY count DESC
       LIMIT 10`,
    )
    .all(userId) as { repoId: string; repoName: string; count: number }[];

  const topFiles = db
    .prepare(
      `SELECT fa.repo_id AS repoId, r.name AS repoName, fa.path AS path, COUNT(*) AS count
       FROM file_access fa
       JOIN repositories r ON r.id = fa.repo_id
       WHERE fa.user_id = ?
       GROUP BY fa.repo_id, fa.path
       ORDER BY count DESC
       LIMIT 10`,
    )
    .all(userId) as { repoId: string; repoName: string; path: string; count: number }[];

  const repoTotals = db
    .prepare(
      `SELECT COUNT(*) AS totalRepositories,
              COALESCE(SUM(file_count), 0) AS totalFileCount,
              COALESCE(SUM(total_size_bytes), 0) AS totalIndexSizeBytes
       FROM repositories WHERE owner_user_id = ?`,
    )
    .get(userId) as {
    totalRepositories: number;
    totalFileCount: number;
    totalIndexSizeBytes: number;
  };

  return {
    totalSearches: totals.totalSearches,
    avgLatencyMs: Math.round(totals.avgLatencyMs),
    zeroResultCount: totals.zeroResultCount,
    zeroResultRate: totals.totalSearches > 0 ? totals.zeroResultCount / totals.totalSearches : 0,
    searchesByMode,
    topRepos,
    topFiles,
    totalRepositories: repoTotals.totalRepositories,
    totalFileCount: repoTotals.totalFileCount,
    totalIndexSizeBytes: repoTotals.totalIndexSizeBytes,
  };
}
