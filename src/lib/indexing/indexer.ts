import fsp from 'node:fs/promises';
import crypto from 'node:crypto';
import { nanoid } from 'nanoid';
import { getDb } from '@/lib/db/client';
import { walkRepository, isBinaryContent } from '@/lib/ingestion/fileFilter';
import { detectLanguage } from '@/lib/ingestion/languageDetect';
import { extractImports, extractSymbols } from '@/lib/symbols/extractor';
import { resolveImportSpecifier } from '@/lib/dependencies/resolver';
// Imported directly (not via getEmbeddingProvider()) because better-sqlite3
// transactions are synchronous — a future async provider would need its
// embeddings computed in the read phase above, before the transaction opens.
import { embedChunk } from '@/lib/embeddings/localEmbedding';
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

    // Every current path in the repo, and the file_id each one will have
    // after this run — needed up front so import resolution (which can
    // point at an unchanged file) always has the full picture.
    const pathToFileId = new Map(existing.map((f) => [f.path, f.id]));
    for (const relPath of diff.changed) {
      pathToFileId.set(relPath, existingByPath.get(relPath)?.id ?? nanoid());
    }
    const repoFilePaths = new Set(readFiles.keys());

    const deleteFileStmt = db.prepare('DELETE FROM files WHERE id = ?');
    const deleteChunksStmt = db.prepare('DELETE FROM chunks_fts WHERE file_id = ?');
    const deleteSymbolsStmt = db.prepare('DELETE FROM symbols WHERE file_id = ?');
    const deleteImportsStmt = db.prepare('DELETE FROM imports WHERE file_id = ?');
    const deleteEmbeddingsStmt = db.prepare('DELETE FROM embeddings WHERE file_id = ?');
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
    const insertSymbolStmt = db.prepare(`
      INSERT INTO symbols (id, repo_id, file_id, path, name, kind, start_line, end_line, signature, exported, language)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertImportStmt = db.prepare(`
      INSERT INTO imports (id, repo_id, file_id, path, specifier, imported_names_json, resolved_file_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertEmbeddingStmt = db.prepare(`
      INSERT INTO embeddings (id, repo_id, file_id, path, start_line, end_line, language, vector, norm)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const updateRepoStmt = db.prepare(`
      UPDATE repositories
      SET status = 'ready', error_message = NULL, file_count = ?, total_size_bytes = ?, updated_at = ?, last_indexed_at = ?
      WHERE id = ?
    `);

    const applyChanges = db.transaction(() => {
      for (const removed of diff.removed) {
        deleteChunksStmt.run(removed.id);
        deleteSymbolsStmt.run(removed.id);
        deleteImportsStmt.run(removed.id);
        deleteEmbeddingsStmt.run(removed.id);
        deleteFileStmt.run(removed.id);
      }

      for (const relPath of diff.changed) {
        const file = readFiles.get(relPath);
        if (!file) continue;
        const fileId = pathToFileId.get(relPath) ?? nanoid();

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
      }

      // Second pass, now that every file row for this run exists: derived
      // data can safely reference ANY file's id (imports.resolved_file_id
      // routinely points at a different file than the one being processed,
      // so it must exist before this pass — hence the split).
      for (const relPath of diff.changed) {
        const file = readFiles.get(relPath);
        if (!file) continue;
        const fileId = pathToFileId.get(relPath) ?? nanoid();

        const chunks = chunkFileContent(file.content);

        deleteChunksStmt.run(fileId);
        for (const chunk of chunks) {
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

        deleteEmbeddingsStmt.run(fileId);
        for (const chunk of chunks) {
          const embedded = embedChunk(chunk.content);
          insertEmbeddingStmt.run(
            nanoid(),
            repoId,
            fileId,
            file.relPath,
            chunk.startLine,
            chunk.endLine,
            file.language,
            embedded.vector,
            embedded.norm,
          );
        }

        deleteSymbolsStmt.run(fileId);
        for (const symbol of extractSymbols(file.content, file.relPath, file.language)) {
          insertSymbolStmt.run(
            nanoid(),
            repoId,
            fileId,
            file.relPath,
            symbol.name,
            symbol.kind,
            symbol.startLine,
            symbol.endLine,
            symbol.signature,
            symbol.exported ? 1 : 0,
            file.language,
          );
        }

        deleteImportsStmt.run(fileId);
        for (const imp of extractImports(file.content, file.language)) {
          const resolvedPath = resolveImportSpecifier(imp.specifier, file.relPath, repoFilePaths);
          const resolvedFileId = resolvedPath ? (pathToFileId.get(resolvedPath) ?? null) : null;
          insertImportStmt.run(
            nanoid(),
            repoId,
            fileId,
            file.relPath,
            imp.specifier,
            JSON.stringify(imp.importedNames),
            resolvedFileId,
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
