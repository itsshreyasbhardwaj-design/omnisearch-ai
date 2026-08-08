import { getDb } from '@/lib/db/client';
import type { FileRow } from '@/types/db';

export type FileSummary = Pick<FileRow, 'path' | 'language' | 'size_bytes' | 'line_count'>;

export function listFilesForRepo(repoId: string): FileSummary[] {
  return getDb()
    .prepare(
      'SELECT path, language, size_bytes, line_count FROM files WHERE repo_id = ? ORDER BY path',
    )
    .all(repoId) as FileSummary[];
}
