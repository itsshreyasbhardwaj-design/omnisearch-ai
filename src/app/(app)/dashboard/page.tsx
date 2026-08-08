import type { Metadata } from 'next';
import { FolderGit2 } from 'lucide-react';
import { requireUser } from '@/lib/auth/guard';
import { listRepositoriesForUser } from '@/lib/repos/repoService';
import { RepoCard } from '@/components/repo/repo-card';
import { AddRepoDialog } from '@/components/repo/add-repo-dialog';

export const metadata: Metadata = { title: 'Repositories' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await requireUser();
  const repositories = listRepositoriesForUser(user.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-ink text-lg font-semibold">Repositories</h1>
          <p className="text-ink-muted text-sm">
            {repositories.length === 0
              ? 'Add a repository to start searching.'
              : `${repositories.length} connected — only you can see these.`}
          </p>
        </div>
        <AddRepoDialog />
      </div>

      {repositories.length === 0 ? (
        <div className="border-line-strong flex flex-col items-center gap-3 rounded-lg border border-dashed py-20 text-center">
          <FolderGit2 className="text-ink-faint size-8" />
          <div>
            <p className="text-ink text-sm font-medium">No repositories yet</p>
            <p className="text-ink-muted text-xs">
              Connect a public GitHub repo, a local path, or upload a ZIP archive.
            </p>
          </div>
          <AddRepoDialog />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {repositories.map((repo) => (
            <RepoCard key={repo.id} repo={repo} />
          ))}
        </div>
      )}
    </div>
  );
}
