import { getDb } from '@/lib/db/client';
import { escapeHtml, highlightSpan } from './highlight';
import type { SearchProvider, SearchResult } from './types';
import type { SymbolRow } from '@/types/db';

const RESULT_CAP = 100;

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function kindLabel(kind: string): string {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

export const symbolProvider: SearchProvider = {
  async search(query, repos, filters) {
    const trimmed = query.trim();
    if (!trimmed || repos.length === 0) {
      return { results: [], truncated: false };
    }

    const repoById = new Map(repos.map((r) => [r.id, r]));
    const db = getDb();

    const conditions = [
      `repo_id IN (${repos.map(() => '?').join(',')})`,
      "name LIKE ? ESCAPE '\\'",
    ];
    const params: (string | number)[] = [...repos.map((r) => r.id), `%${escapeLike(trimmed)}%`];

    if (filters.language) {
      conditions.push('language = ?');
      params.push(filters.language);
    }
    if (filters.symbolKind) {
      conditions.push('kind = ?');
      params.push(filters.symbolKind);
    }
    if (filters.directory) {
      conditions.push("path LIKE ? ESCAPE '\\'");
      params.push(`${escapeLike(filters.directory.replace(/^\/+|\/+$/g, ''))}/%`);
    }
    if (filters.fileExtension) {
      conditions.push("path LIKE ? ESCAPE '\\'");
      params.push(`%.${escapeLike(filters.fileExtension.replace(/^\./, ''))}`);
    }

    const sql = `
      SELECT * FROM symbols
      WHERE ${conditions.join(' AND ')}
      ORDER BY (name = ?) DESC, exported DESC, length(name) ASC
      LIMIT ?
    `;
    params.push(trimmed, RESULT_CAP + 1);

    const rows = db.prepare(sql).all(...params) as SymbolRow[];
    const truncated = rows.length > RESULT_CAP;
    const capped = truncated ? rows.slice(0, RESULT_CAP) : rows;
    const lowerQuery = trimmed.toLowerCase();

    const results: SearchResult[] = capped.map((row) => {
      const repo = repoById.get(row.repo_id);
      const nameIndex = row.name.toLowerCase().indexOf(lowerQuery);
      const nameHtml =
        nameIndex >= 0 ? highlightSpan(row.name, nameIndex, trimmed.length) : escapeHtml(row.name);
      const signatureHtml = row.signature ? escapeHtml(row.signature) : '';
      const exactMatch = row.name.toLowerCase() === lowerQuery;

      return {
        repoId: row.repo_id,
        repoName: repo?.name ?? row.repo_id,
        filePath: row.path,
        language: row.language,
        matchType: 'SYMBOL MATCH',
        score: exactMatch ? 100 : row.exported ? 80 : 60,
        startLine: row.start_line,
        endLine: row.end_line,
        snippetHtml: signatureHtml || nameHtml,
        highlightLine: row.start_line,
        explanation: `${kindLabel(row.kind)}${row.exported ? ', exported' : ''}`,
      };
    });

    return { results, truncated };
  },
};
