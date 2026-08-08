import fsp from 'node:fs/promises';
import crypto from 'node:crypto';
import { nanoid } from 'nanoid';
import { getDb } from '@/lib/db/client';
import { walkRepository, isBinaryContent } from '@/lib/ingestion/fileFilter';
import { detectLanguage } from '@/lib/ingestion/languageDetect';
import { chunkFileContent } from './chunking';
import { diffFiles, type ExistingFileRecord } from './incremental';

export interface IndexResult {
  fileCount: number;
  totalSizeBytes: number;
  changed: number;
  unchanged: number;
  removed: number;
}

function sha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Ingests + indexes a repository already materialized at `rootDir` (a
 * clone, an extracted ZIP, or a local path). Safe to call repeatedly on the
 * same repo — unchanged files are skipped via `diffFiles`, and files that
 * disappeared from disk are removed from the index.
 */
export async function indexRepository(repoId: string, rootDir: string): Promise<IndexResult> {
  const db = getDb();

  db.prepare('UPDATE repositories SET status = ?, updated_at = ? WHERE id = ?').run(
    'indexing',
    new Date().toISOString(),
    repoId,
  );

  try {
    const discovered = await walkRepository(rootDir);

    const existing = db
      .prepare('SELECT id, path, content_hash AS contentHash FROM files WHERE repo_id = ?')
      .all(repoId) as ExistingFileRecord[];
    const existingByPath = new Map(existing.map((file) => [file.path, file]));

    interface ReadFile {
      relPath: string;
      content: string;
      hash: string;
      sizeBytes: number;
      language: string | null;
      lineCount: number;
    }
    const readFiles = new Map<string, ReadFile>();
    let totalSizeBytes = 0;

    for (const file of discovered) {
      const buffer = await fsp.readFile(file.absPath);
      if (isBinaryContent(buffer)) continue;
      const content = buffer.toString('utf8');
      totalSizeBytes += file.sizeBytes;
      readFiles.set(file.relPath, {
        relPath: file.relPath,
        content,
        hash: sha256(buffer),
        sizeBytes: file.sizeBytes,
        language: detectLanguage(file.relPath),
        lineCount: content.length === 0 ? 0 : content.split('\n').length,
      });
    }

    const diff = diffFiles(
      existing,
      Array.from(readFiles.values()).map((f) => ({ path: f.relPath, contentHash: f.hash })),
    );

    const deleteFileStmt = db.prepare('DELETE FROM files WHERE id = ?');
    const deleteChunksStmt = db.prepare('DELETE FROM chunks_fts WHERE file_id = ?');
    const upsertFileStmt = db.prepare(`
      INSERT INTO files (id, repo_id, path, language, size_bytes, content_hash, line_count, updated_at)
      VALUES (@id, @repo_id, @path, @language, @size_bytes, @content_hash, @line_count, @updated_at)
      ON CONFLICT(repo_id, path) DO UPDATE SET
        language = excluded.language,
        size_bytes = excluded.size_bytes,
        content_hash = excluded.content_hash,
        line_count = excluded.line_count,
        updated_at = excluded.updated_at
    `);
    const insertChunkStmt = db.prepare(`
      INSERT INTO chunks_fts (content, path, file_id, repo_id, start_line, end_line, language)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const updateRepoStmt = db.prepare(`
      UPDATE repositories
      SET status = 'ready', error_message = NULL, file_count = ?, total_size_bytes = ?, updated_at = ?, last_indexed_at = ?
      WHERE id = ?
    `);

    const applyChanges = db.transaction(() => {
      for (const removed of diff.removed) {
        deleteChunksStmt.run(removed.id);
        deleteFileStmt.run(removed.id);
      }

      for (const relPath of diff.changed) {
        const file = readFiles.get(relPath);
        if (!file) continue;
        const fileId = existingByPath.get(relPath)?.id ?? nanoid();

        upsertFileStmt.run({
          id: fileId,
          repo_id: repoId,
          path: file.relPath,
          language: file.language,
          size_bytes: file.sizeBytes,
          content_hash: file.hash,
          line_count: file.lineCount,
          updated_at: new Date().toISOString(),
        });

        deleteChunksStmt.run(fileId);
        for (const chunk of chunkFileContent(file.content)) {
          insertChunkStmt.run(
            chunk.content,
            file.relPath,
            fileId,
            repoId,
            chunk.startLine,
            chunk.endLine,
            file.language,
          );
        }
      }

      const now = new Date().toISOString();
      updateRepoStmt.run(discovered.length, totalSizeBytes, now, now, repoId);
    });

    applyChanges();

    return {
      fileCount: discovered.length,
      totalSizeBytes,
      changed: diff.changed.length,
      unchanged: diff.unchanged.length,
      removed: diff.removed.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Indexing failed.';
    db.prepare(
      'UPDATE repositories SET status = ?, error_message = ?, updated_at = ? WHERE id = ?',
    ).run('error', message, new Date().toISOString(), repoId);
    throw error;
  }
}
