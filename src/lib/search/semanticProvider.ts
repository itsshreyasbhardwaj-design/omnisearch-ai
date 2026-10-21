import { getDb } from '@/lib/db/client';
import { getEmbeddingProvider } from '@/lib/embeddings/embeddingProvider';
import { bufferToVector } from '@/lib/embeddings/localEmbedding';
import { cosineSimilarity } from '@/lib/embeddings/similarity';
import { escapeHtml } from './highlight';
import { toRelevancePercent } from './ranking';
import type { SearchProvider, SearchResult } from './types';
import type { EmbeddingRow } from '@/types/db';

const MAX_CANDIDATES = 50;
const PAGE_SIZE = 30;
const MIN_SIMILARITY = 0.05;

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export const semanticProvider: SearchProvider = {
  async search(query, repos, filters, cursor = 0) {
    if (!query.trim() || repos.length === 0) {
      return { results: [], truncated: false, nextCursor: null };
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

    if (rows.length === 0) return { results: [], truncated: false, nextCursor: null };

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

    const candidates = scored.slice(0, MAX_CANDIDATES);
    const hasNextPage = cursor + PAGE_SIZE < candidates.length;
    const page = candidates.slice(cursor, cursor + PAGE_SIZE);
    const repoById = new Map(repos.map((r) => [r.id, r]));
    // Relevance is scaled against the whole candidate set, not just this
    // page, so a result's score doesn't shift depending on which page it's on.
    const relevanceForCandidates = toRelevancePercent(candidates.map((s) => s.similarity));

    const results: SearchResult[] = page.map((s, pageIndex) => {
      const index = cursor + pageIndex;
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
        score: relevanceForCandidates[index] ?? Math.round(s.similarity * 100),
        startLine: s.row.start_line,
        endLine: s.row.end_line,
        // No single "matched span" for a semantic result — the whole chunk is
        // relevant, not one substring — so this is escaped, not <mark>-wrapped.
        snippetHtml: escapeHtml(snippetSource),
        highlightLine: s.row.start_line,
        explanation: `${Math.round(s.similarity * 100)}% lexical/conceptual overlap with the query (local embedding, not neural)`,
      };
    });

    return { results, truncated: false, nextCursor: hasNextPage ? cursor + PAGE_SIZE : null };
  },
};
