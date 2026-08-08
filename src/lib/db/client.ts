import fs from 'node:fs';
import Database from 'better-sqlite3';
import { dataDir, dbPath, reposRootDir, uploadsTmpDir } from '@/lib/paths';
import { runMigrations } from './migrate';

declare global {
  var __omnisearchDb: Database.Database | undefined;
}

function open(): Database.Database {
  for (const dir of [dataDir(), reposRootDir(), uploadsTmpDir()]) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath());
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  runMigrations(db);
  return db;
}

/**
 * Next.js dev mode re-evaluates modules on every request in some setups;
 * caching the connection on `globalThis` (the standard Prisma-style pattern)
 * keeps a single SQLite handle instead of opening a new file descriptor
 * per request.
 */
export function getDb(): Database.Database {
  if (!globalThis.__omnisearchDb) {
    globalThis.__omnisearchDb = open();
  }
  return globalThis.__omnisearchDb;
}
