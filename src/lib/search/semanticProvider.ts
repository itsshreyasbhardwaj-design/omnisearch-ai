import { getDb } from '@/lib/db/client';
import { getEmbeddingProvider } from '@/lib/embeddings/embeddingProvider';
import { bufferToVector } from '@/lib/embeddings/localEmbedding';
import { cosineSimilarity } from '@/lib/embeddings/similarity';
import { escapeHtml } from './highlight';
import { toRelevancePercent } from './ranking';
import type { SearchProvider, SearchResult } from './types';
import type { EmbeddingRow } from '@/types/db';

const RESULT_CAP = 50;
const MIN_SIMILARITY = 0.05;

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export const semanticProvider: SearchProvider = {
  async search(query, repos, filters) {
    if (!query.trim() || repos.length === 0) {
      return { results: [], truncated: false };
    }

    const db = getDb();
    const conditions = [`repo_id IN (${repos.map(() => '?').join(',')})`];
    const params: (string | number)[] = repos.map((r) => r.id);

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

    const rows = db
      .prepare(`SELECT * FROM embeddings WHERE ${conditions.join(' AND ')}`)
      .all(...params) as EmbeddingRow[];

    if (rows.length === 0) return { results: [], truncated: false };

    const provider = getEmbeddingProvider();
    const queryEmbedding = await provider.embedQuery(query);
    const queryVector = bufferToVector(queryEmbedding.vector);

    const scored = rows
      .map((row) => ({
        row,
        similarity: cosineSimilarity(
          queryVector,
          queryEmbedding.norm,
          bufferToVector(row.vector),
          row.norm,
        ),
      }))
      .filter((s) => s.similarity >= MIN_SIMILARITY)
      .sort((a, b) => b.similarity - a.similarity);

    const truncated = scored.length > RESULT_CAP;
    const top = scored.slice(0, RESULT_CAP);
    const repoById = new Map(repos.map((r) => [r.id, r]));
    const relevance = toRelevancePercent(top.map((s) => s.similarity));

    const results: SearchResult[] = top.map((s, index) => {
      const content = (
        db
          .prepare(
            'SELECT content FROM chunks_fts WHERE file_id = ? AND start_line = ? AND end_line = ?',
          )
          .get(s.row.file_id, s.row.start_line, s.row.end_line) as { content: string } | undefined
      )?.content;

      const snippetSource = content
        ? content.split('\n').slice(0, 3).join('\n')
        : `${s.row.path}:${s.row.start_line}`;

      return {
        repoId: s.row.repo_id,
        repoName: repoById.get(s.row.repo_id)?.name ?? s.row.repo_id,
        filePath: s.row.path,
        language: s.row.language,
        matchType: 'SEMANTIC MATCH',
        score: relevance[index] ?? Math.round(s.similarity * 100),
        startLine: s.row.start_line,
        endLine: s.row.end_line,
        // No single "matched span" for a semantic result — the whole chunk is
        // relevant, not one substring — so this is escaped, not <mark>-wrapped.
        snippetHtml: escapeHtml(snippetSource),
        highlightLine: s.row.start_line,
        explanation: `${Math.round(s.similarity * 100)}% lexical/conceptual overlap with the query (local embedding, not neural)`,
      };
    });

    return { results, truncated };
  },
};
