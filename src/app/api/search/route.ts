import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/guard';
import {
  getOwnedRepository,
  listRepositoriesForUser,
  resolveRepoRoot,
} from '@/lib/repos/repoService';
import { sqliteFtsProvider } from '@/lib/search/sqliteFtsProvider';
import { symbolProvider } from '@/lib/search/symbolProvider';
import { semanticProvider } from '@/lib/search/semanticProvider';
import { hybridProvider } from '@/lib/search/hybridRanking';
import { searchRegex, InvalidRegexError } from '@/lib/search/regexSearch';
import { recordSearch } from '@/lib/search/history';
import { searchRequestSchema } from '@/lib/validation/search';
import { checkRateLimit, clientKeyFromRequest } from '@/lib/rate-limit/limiter';
import { apiError, toApiError } from '@/lib/api/errors';
import type { SearchProvider, SearchResponse } from '@/lib/search/types';
import type { RepositoryRow } from '@/types/db';

const SEARCH_RATE_LIMIT = Number(process.env.OMNISEARCH_SEARCH_RATE_LIMIT_PER_MINUTE ?? 60);

const PROVIDERS: Record<'text' | 'symbol' | 'semantic' | 'hybrid', SearchProvider> = {
  text: sqliteFtsProvider,
  symbol: symbolProvider,
  semantic: semanticProvider,
  hybrid: hybridProvider,
};

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

    // Ownership boundary: a scoped search re-checks the repo(s) belong to
    // this user; an unscoped search only ever sees repos this user owns.
    let repositories: RepositoryRow[];
    if (input.repoId) {
      repositories = [getOwnedRepository(user.id, input.repoId)];
    } else if (input.repoIds && input.repoIds.length > 0) {
      repositories = input.repoIds.map((id) => getOwnedRepository(user.id, id));
    } else {
      repositories = listRepositoriesForUser(user.id);
    }

    const searchableRepos = repositories
      .filter((repo) => repo.status === 'ready')
      .map((repo) => ({ id: repo.id, name: repo.name, rootDir: resolveRepoRoot(repo) }));

    const startedAt = Date.now();
    const scopedRepoId = input.repoId ?? null;

    if (input.mode === 'regex') {
      try {
        const outcome = await searchRegex(
          input.query,
          input.regexFlags,
          searchableRepos,
          input.filters,
        );
        const tookMs = Date.now() - startedAt;
        recordSearch(user.id, scopedRepoId, input.query, 'regex', outcome.results.length, tookMs);
        const response: SearchResponse = {
          query: input.query,
          mode: 'regex',
          results: outcome.results,
          truncated: outcome.truncated,
          timedOut: outcome.timedOut,
          tookMs,
        };
        return NextResponse.json(response);
      } catch (error) {
        if (error instanceof InvalidRegexError) {
          return apiError(error.message, 'invalid-regex', 400);
        }
        throw error;
      }
    }

    const provider = PROVIDERS[input.mode];
    const outcome = await provider.search(input.query, searchableRepos, input.filters);
    const tookMs = Date.now() - startedAt;
    recordSearch(user.id, scopedRepoId, input.query, input.mode, outcome.results.length, tookMs);
    const response: SearchResponse = {
      query: input.query,
      mode: input.mode,
      results: outcome.results,
      truncated: outcome.truncated,
      tookMs,
    };
    return NextResponse.json(response);
  } catch (error) {
    return toApiError(error);
  }
}
