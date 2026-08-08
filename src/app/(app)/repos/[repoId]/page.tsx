import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/guard';
import { getOwnedRepository } from '@/lib/repos/repoService';
import { listFilesForRepo } from '@/lib/repos/files';
import { ApiVisibleError } from '@/lib/api/errors';
import { RepoWorkspace } from '@/components/repo/repo-workspace';
import { StatusBadge, SourceBadge } from '@/components/repo/badges';
import { Spinner } from '@/components/ui/spinner';

export const dynamic = 'force-dynamic';

interface RepoPageProps {
  params: Promise<{ repoId: string }>;
}

export async function generateMetadata({ params }: RepoPageProps): Promise<Metadata> {
  const { repoId } = await params;
  try {
    const user = await requireUser();
    const repo = getOwnedRepository(user.id, repoId);
    return { title: repo.name };
  } catch {
    return { title: 'Repository' };
  }
}

export default async function RepoPage({ params }: RepoPageProps) {
  const { repoId } = await params;
  const user = await requireUser();

  let repo;
  try {
    repo = getOwnedRepository(user.id, repoId);
  } catch (error) {
    if (error instanceof ApiVisibleError && error.status === 404) notFound();
    throw error;
  }

  const files = listFilesForRepo(repoId);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center gap-2">
        <h1 className="text-ink text-lg font-semibold">{repo.name}</h1>
        <StatusBadge status={repo.status} />
        <SourceBadge sourceType={repo.source_type} />
      </div>

      {repo.status !== 'ready' ? (
        <div className="border-line-strong text-ink-faint flex flex-1 flex-col items-center justify-center gap-2 rounded-md border border-dashed">
          {repo.status === 'error' ? (
            <p className="text-danger text-sm">{repo.error_message ?? 'Indexing failed.'}</p>
          ) : (
            <>
              <Spinner />
              <p className="text-xs">Indexing…</p>
            </>
          )}
        </div>
      ) : (
        <Suspense
          fallback={
            <div className="flex flex-1 items-center justify-center">
              <Spinner />
            </div>
          }
        >
          <RepoWorkspace repo={repo} initialFiles={files} />
        </Suspense>
      )}
    </div>
  );
}
