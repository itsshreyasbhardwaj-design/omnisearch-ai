import path from 'node:path';

/**
 * Everything OmniSearch writes to disk — the SQLite DB, cloned/extracted
 * repositories, and the auto-generated session secret — lives under one
 * directory so `rm -rf` of it is a full, safe reset.
 */
export function dataDir(): string {
  const configured = process.env.OMNISEARCH_DATA_DIR;
  return path.resolve(
    process.cwd(),
    configured && configured.length > 0 ? configured : '.omnisearch',
  );
}

export function dbPath(): string {
  return path.join(dataDir(), 'omnisearch.db');
}

export function sessionSecretPath(): string {
  return path.join(dataDir(), 'session-secret');
}

export function reposRootDir(): string {
  return path.join(dataDir(), 'repos');
}

export function repoWorkingDir(repoId: string): string {
  return path.join(reposRootDir(), repoId);
}

export function uploadsTmpDir(): string {
  return path.join(dataDir(), 'tmp');
}
