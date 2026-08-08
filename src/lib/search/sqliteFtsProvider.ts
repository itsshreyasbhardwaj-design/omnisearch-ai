import { getDb } from '@/lib/db/client';
import { normalizeBm25, toRelevancePercent } from './ranking';
import { findMatchingLine } from './lineMatch';
import { markersToHtml } from './highlight';
import type { SearchProvider, SearchResult } from './types';

const RESULT_CAP = 100;
// Control characters, not visible symbols, so they can't collide with real
// source text — used only to find the matched span in SQLite's snippet()
// output before it's escaped and re-wrapped in <mark> by markersToHtml.
const SNIPPET_START = '\u0001';
const SNIPPET_END = '\u0002';

// Quotes every token so arbitrary user text can't be parsed as FTS5 query syntax (NOT / OR / prefix-star / column-colon).
export function buildFtsQuery(raw: string): { matchQuery: string; tokens: string[] } {
  const tokens = raw.trim().split(/\s+/).filter(Boolean).slice(0, 12);
  const matchQuery = tokens.map((token) => `"${token.replace(/"/g, '""')}"`).join(' ');
  return { matchQuery, tokens };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

interface ChunkRow {
  path: string;
  repo_id: string;
  start_line: number;
  end_line: number;
  language: string | null;
  content: string;
  score: number;
  snippet: string;
}

export const sqliteFtsProvider: SearchProvider = {
  async search(query, repos, filters) {
    const { matchQuery, tokens } = buildFtsQuery(query);
    if (!matchQuery || repos.length === 0) {
      return { results: [], truncated: false };
    }

    const repoById = new Map(repos.map((r) => [r.id, r]));
    const db = getDb();

    const conditions = ['chunks_fts MATCH ?'];
    const params: (string | number)[] = [matchQuery];

    conditions.push(`repo_id IN (${repos.map(() => '?').join(',')})`);
    params.push(...repos.map((r) => r.id));

    if (filters.language) {
      conditions.push('language = ?');
      params.push(filters.language);
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
      SELECT
        path, repo_id, start_line, end_line, language, content,
        bm25(chunks_fts) AS score,
        snippet(chunks_fts, 0, '${SNIPPET_START}', '${SNIPPET_END}', '…', 16) AS snippet
      FROM chunks_fts
      WHERE ${conditions.join(' AND ')}
      ORDER BY score ASC
      LIMIT ?
    `;
    params.push(RESULT_CAP + 1);

    const rows = db.prepare(sql).all(...params) as ChunkRow[];
    const truncated = rows.length > RESULT_CAP;
    const capped = truncated ? rows.slice(0, RESULT_CAP) : rows;

    const relevance = toRelevancePercent(capped.map((r) => normalizeBm25(r.score)));

    const results: SearchResult[] = capped.map((row, index) => {
      const repo = repoById.get(row.repo_id);
      const matchedLine = findMatchingLine(row.content, tokens, row.start_line);
      return {
        repoId: row.repo_id,
        repoName: repo?.name ?? row.repo_id,
        filePath: row.path,
        language: row.language,
        matchType: 'TEXT MATCH',
        score: relevance[index] ?? 0,
        startLine: matchedLine,
        endLine: matchedLine,
        snippetHtml: markersToHtml(row.snippet, SNIPPET_START, SNIPPET_END),
        highlightLine: matchedLine,
      };
    });

    return { results, truncated };
  },
};
