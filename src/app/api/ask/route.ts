import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/guard';
import {
  getOwnedRepository,
  listRepositoriesForUser,
  resolveRepoRoot,
} from '@/lib/repos/repoService';
import { retrieveEvidence } from '@/lib/qa/retrieve';
import { getAnswerProvider } from '@/lib/qa/answerProvider';
import { askRequestSchema } from '@/lib/validation/ask';
import { checkRateLimit, clientKeyFromRequest } from '@/lib/rate-limit/limiter';
import { apiError, toApiError } from '@/lib/api/errors';
import type { RepositoryRow } from '@/types/db';

const ASK_RATE_LIMIT = Number(process.env.OMNISEARCH_ASK_RATE_LIMIT_PER_MINUTE ?? 20);

export async function POST(request: Request) {
  try {
    const user = await requireUser();

    const rateLimit = checkRateLimit(
      clientKeyFromRequest(request, `ask:${user.id}`),
      ASK_RATE_LIMIT,
    );
    if (!rateLimit.allowed) {
      return apiError('Too many questions. Slow down a bit.', 'rate-limited', 429, {
        'Retry-After': String(rateLimit.retryAfterSeconds),
      });
    }

    const body = await request.json().catch(() => ({}));
    const input = askRequestSchema.parse(body);

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

    const evidence = await retrieveEvidence(input.question, searchableRepos, input.filters);
    const provider = getAnswerProvider();
    const result = await provider.answer(input.question, evidence);

    return NextResponse.json({
      question: input.question,
      provider: provider.name,
      ...result,
    });
  } catch (error) {
    return toApiError(error);
  }
}
