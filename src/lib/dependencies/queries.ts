import { getDb } from '@/lib/db/client';
import type { ImportRow } from '@/types/db';

export interface DependencyEdge {
  path: string;
  specifier: string;
  importedNames: string[];
}

/** Files this file imports, resolved to paths within the same repo (unresolved = external package). */
export function whatFileImports(repoId: string, filePath: string): DependencyEdge[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM imports WHERE repo_id = ? AND path = ?')
    .all(repoId, filePath) as ImportRow[];

  const resolvedIds = [
    ...new Set(rows.map((r) => r.resolved_file_id).filter((id): id is string => id !== null)),
  ];
  const pathById = new Map<string, string>();
  if (resolvedIds.length > 0) {
    const placeholders = resolvedIds.map(() => '?').join(',');
    const fileRows = db
      .prepare(`SELECT id, path FROM files WHERE id IN (${placeholders})`)
      .all(...resolvedIds) as { id: string; path: string }[];
    for (const f of fileRows) pathById.set(f.id, f.path);
  }

  return rows.map((row) => ({
    path: (row.resolved_file_id && pathById.get(row.resolved_file_id)) || row.specifier,
    specifier: row.specifier,
    importedNames: JSON.parse(row.imported_names_json) as string[],
  }));
}

/** Files that import this file — "what depends on X". */
export function whatImportsFile(repoId: string, filePath: string): DependencyEdge[] {
  const fileRow = getDb()
    .prepare('SELECT id FROM files WHERE repo_id = ? AND path = ?')
    .get(repoId, filePath) as { id: string } | undefined;
  if (!fileRow) return [];

  const rows = getDb()
    .prepare('SELECT * FROM imports WHERE repo_id = ? AND resolved_file_id = ?')
    .all(repoId, fileRow.id) as ImportRow[];

  return rows.map((row) => ({
    path: row.path,
    specifier: row.specifier,
    importedNames: JSON.parse(row.imported_names_json) as string[],
  }));
}

/** Files that reference a given exported symbol name anywhere in the repo — "where is X used". */
export function whereSymbolIsUsed(
  repoId: string,
  symbolName: string,
): { path: string; line: number }[] {
  const rows = getDb()
    .prepare(
      `SELECT path, start_line AS line FROM chunks_fts
       WHERE chunks_fts MATCH ? AND repo_id = ?
       LIMIT 50`,
    )
    .all(`"${symbolName.replace(/"/g, '""')}"`, repoId) as { path: string; line: number }[];
  return rows;
}
