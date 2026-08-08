import { nanoid } from 'nanoid';
import { getDb } from '@/lib/db/client';

/** Best-effort — a missing files row (e.g. a local repo that changed on disk since indexing) shouldn't break viewing the file. */
export function recordFileAccess(userId: string, repoId: string, path: string): void {
  const db = getDb();
  const fileRow = db
    .prepare('SELECT id FROM files WHERE repo_id = ? AND path = ?')
    .get(repoId, path) as { id: string } | undefined;
  if (!fileRow) return;

  db.prepare(
    'INSERT INTO file_access (id, user_id, repo_id, file_id, path) VALUES (?, ?, ?, ?, ?)',
  ).run(nanoid(), userId, repoId, fileRow.id, path);
}
