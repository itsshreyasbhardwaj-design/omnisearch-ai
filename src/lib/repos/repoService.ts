import fs from 'node:fs/promises';
import { nanoid } from 'nanoid';
import { getDb } from '@/lib/db/client';
import { repoWorkingDir } from '@/lib/paths';
import type { RepositoryRow } from '@/types/db';
import { ApiVisibleError } from '@/lib/api/errors';
import { cloneGithubRepo, suggestedRepoName, GithubCloneError } from '@/lib/ingestion/github';
import { extractZipSafely, ZipExtractionError } from '@/lib/ingestion/zip';
import {
  validateLocalRepoPath,
  suggestedNameFromPath,
  LocalPathError,
} from '@/lib/ingestion/localPath';
import { indexRepository } from '@/lib/indexing/indexer';

/** github/zip repos are materialized under the data dir; local repos are read in place. */
export function resolveRepoRoot(repo: RepositoryRow): string {
  return repo.source_type === 'local' ? repo.source_ref : repoWorkingDir(repo.id);
}

export function listRepositoriesForUser(userId: string): RepositoryRow[] {
  return getDb()
    .prepare('SELECT * FROM repositories WHERE owner_user_id = ? ORDER BY created_at DESC')
    .all(userId) as RepositoryRow[];
}

/**
 * The single chokepoint every route must go through before touching a
 * repo's files, search index, or metadata — a repo owned by another user
 * is reported as not-found, never as forbidden, so its existence isn't
 * leaked either.
 */
export function getOwnedRepository(userId: string, repoId: string): RepositoryRow {
  const row = getDb()
    .prepare('SELECT * FROM repositories WHERE id = ? AND owner_user_id = ?')
    .get(repoId, userId) as RepositoryRow | undefined;
  if (!row) {
    throw new ApiVisibleError('Repository not found.', 'repo-not-found', 404);
  }
  return row;
}

function insertPendingRepo(
  userId: string,
  name: string,
  sourceType: RepositoryRow['source_type'],
  sourceRef: string,
): RepositoryRow {
  const db = getDb();
  const now = new Date().toISOString();
  const row: RepositoryRow = {
    id: nanoid(),
    owner_user_id: userId,
    name,
    source_type: sourceType,
    source_ref: sourceRef,
    status: 'pending',
    error_message: null,
    file_count: 0,
    total_size_bytes: 0,
    created_at: now,
    updated_at: now,
    last_indexed_at: null,
  };
  db.prepare(
    `INSERT INTO repositories
      (id, owner_user_id, name, source_type, source_ref, status, file_count, total_size_bytes, created_at, updated_at)
     VALUES (@id, @owner_user_id, @name, @source_type, @source_ref, @status, @file_count, @total_size_bytes, @created_at, @updated_at)`,
  ).run(row);
  return row;
}

export async function createGithubRepository(
  userId: string,
  url: string,
  name?: string,
): Promise<RepositoryRow> {
  const repo = insertPendingRepo(userId, name?.trim() || suggestedRepoName(url), 'github', url);

  try {
    await cloneGithubRepo(url, repoWorkingDir(repo.id));
    await indexRepository(repo.id, repoWorkingDir(repo.id));
  } catch (error) {
    if (error instanceof GithubCloneError) {
      throw new ApiVisibleError(error.message, 'clone-failed', 422);
    }
    throw error;
  }

  return getOwnedRepository(userId, repo.id);
}

export async function createLocalRepository(
  userId: string,
  inputPath: string,
  name?: string,
): Promise<RepositoryRow> {
  let resolvedPath: string;
  try {
    resolvedPath = await validateLocalRepoPath(inputPath);
  } catch (error) {
    if (error instanceof LocalPathError) {
      throw new ApiVisibleError(error.message, 'invalid-path', 422);
    }
    throw error;
  }

  const repo = insertPendingRepo(
    userId,
    name?.trim() || suggestedNameFromPath(resolvedPath),
    'local',
    resolvedPath,
  );

  await indexRepository(repo.id, resolvedPath);
  return getOwnedRepository(userId, repo.id);
}

export async function createZipRepository(
  userId: string,
  zipBuffer: Buffer,
  originalFilename: string,
  name?: string,
): Promise<RepositoryRow> {
  const repo = insertPendingRepo(
    userId,
    name?.trim() || originalFilename.replace(/\.zip$/i, ''),
    'zip',
    originalFilename,
  );

  try {
    await extractZipSafely(zipBuffer, repoWorkingDir(repo.id));
    await indexRepository(repo.id, repoWorkingDir(repo.id));
  } catch (error) {
    if (error instanceof ZipExtractionError) {
      throw new ApiVisibleError(error.message, 'zip-invalid', 422);
    }
    throw error;
  }

  return getOwnedRepository(userId, repo.id);
}

export async function reindexRepository(userId: string, repoId: string): Promise<RepositoryRow> {
  const repo = getOwnedRepository(userId, repoId);

  if (repo.source_type === 'github') {
    try {
      await cloneGithubRepo(repo.source_ref, repoWorkingDir(repo.id));
    } catch (error) {
      if (error instanceof GithubCloneError) {
        throw new ApiVisibleError(error.message, 'clone-failed', 422);
      }
      throw error;
    }
  }

  await indexRepository(repo.id, resolveRepoRoot(repo));
  return getOwnedRepository(userId, repoId);
}

export async function deleteRepository(userId: string, repoId: string): Promise<void> {
  const repo = getOwnedRepository(userId, repoId);
  const db = getDb();

  db.prepare('DELETE FROM chunks_fts WHERE repo_id = ?').run(repoId);
  db.prepare('DELETE FROM repositories WHERE id = ?').run(repoId);

  if (repo.source_type !== 'local') {
    await fs.rm(repoWorkingDir(repo.id), { recursive: true, force: true });
  }
}
