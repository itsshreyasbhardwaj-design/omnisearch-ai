import { getDb } from '@/lib/db/client';
import { escapeHtml, highlightSpan } from './highlight';
import type { SearchProvider, SearchResult } from './types';
import type { SymbolRow } from '@/types/db';

const PAGE_SIZE = 30;

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function kindLabel(kind: string): string {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

export const symbolProvider: SearchProvider = {
  async search(query, repos, filters, cursor = 0) {
    const trimmed = query.trim();
    if (!trimmed || repos.length === 0) {
      return { results: [], truncated: false, nextCursor: null };
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
      LIMIT ? OFFSET ?
    `;
    params.push(trimmed, PAGE_SIZE + 1, cursor);

    const rows = db.prepare(sql).all(...params) as SymbolRow[];
    const hasNextPage = rows.length > PAGE_SIZE;
    const page = hasNextPage ? rows.slice(0, PAGE_SIZE) : rows;
    const lowerQuery = trimmed.toLowerCase();

    const results: SearchResult[] = page.map((row) => {
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

    return { results, truncated: false, nextCursor: hasNextPage ? cursor + PAGE_SIZE : null };
  },
};
