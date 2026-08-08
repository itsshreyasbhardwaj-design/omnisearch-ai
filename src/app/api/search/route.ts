import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/guard';
import {
  getOwnedRepository,
  listRepositoriesForUser,
  resolveRepoRoot,
} from '@/lib/repos/repoService';
import { sqliteFtsProvider } from '@/lib/search/sqliteFtsProvider';
import { searchRegex, InvalidRegexError } from '@/lib/search/regexSearch';
import { recordSearch } from '@/lib/search/history';
import { searchRequestSchema } from '@/lib/validation/search';
import { checkRateLimit, clientKeyFromRequest } from '@/lib/rate-limit/limiter';
import { apiError, toApiError } from '@/lib/api/errors';
import type { SearchResponse } from '@/lib/search/types';

const SEARCH_RATE_LIMIT = Number(process.env.OMNISEARCH_SEARCH_RATE_LIMIT_PER_MINUTE ?? 60);

export async function POST(request: Request) {
  try {
    const user = await requireUser();

    const rateLimit = checkRateLimit(
      clientKeyFromRequest(request, `search:${user.id}`),
      SEARCH_RATE_LIMIT,
    );
    if (!rateLimit.allowed) {
      return apiError('Too many searches. Slow down a bit.', 'rate-limited', 429, {
        'Retry-After': String(rateLimit.retryAfterSeconds),
      });
    }

    const body = await request.json().catch(() => ({}));
    const input = searchRequestSchema.parse(body);

    // Ownership boundary: a scoped search re-checks the repo belongs to this
    // user; an unscoped search only ever sees repos this user owns.
    const repositories = input.repoId
      ? [getOwnedRepository(user.id, input.repoId)]
      : listRepositoriesForUser(user.id);

    const searchableRepos = repositories
      .filter((repo) => repo.status === 'ready')
      .map((repo) => ({ id: repo.id, name: repo.name, rootDir: resolveRepoRoot(repo) }));

    const startedAt = Date.now();

    if (input.mode === 'text') {
      const outcome = await sqliteFtsProvider.search(input.query, searchableRepos, input.filters);
      recordSearch(user.id, input.repoId ?? null, input.query, 'text', outcome.results.length);
      const response: SearchResponse = {
        query: input.query,
        mode: 'text',
        results: outcome.results,
        truncated: outcome.truncated,
        tookMs: Date.now() - startedAt,
      };
      return NextResponse.json(response);
    }

    try {
      const outcome = await searchRegex(
        input.query,
        input.regexFlags,
        searchableRepos,
        input.filters,
      );
      recordSearch(user.id, input.repoId ?? null, input.query, 'regex', outcome.results.length);
      const response: SearchResponse = {
        query: input.query,
        mode: 'regex',
        results: outcome.results,
        truncated: outcome.truncated,
        timedOut: outcome.timedOut,
        tookMs: Date.now() - startedAt,
      };
      return NextResponse.json(response);
    } catch (error) {
      if (error instanceof InvalidRegexError) {
        return apiError(error.message, 'invalid-regex', 400);
      }
      throw error;
    }
  } catch (error) {
    return toApiError(error);
  }
}
