'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FolderGit2, MoreHorizontal, RefreshCw, Search, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { StatusBadge, SourceBadge } from './badges';
import { formatBytes, formatRelativeTime, pluralize } from '@/lib/utils';
import type { RepositoryRow } from '@/types/db';

export function RepoCard({ repo }: { repo: RepositoryRow }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function handleReindex() {
    setBusy(true);
    try {
      await fetch(`/api/repos/${repo.id}/reindex`, { method: 'POST' });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Remove "${repo.name}"? This deletes its search index.`)) return;
    setBusy(true);
    try {
      await fetch(`/api/repos/${repo.id}`, { method: 'DELETE' });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="group hover:border-line-strong relative transition-colors">
      <Link
        href={`/repos/${repo.id}`}
        className="absolute inset-0"
        aria-label={`Open ${repo.name}`}
      />
      <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
        <div className="flex items-center gap-2">
          <FolderGit2 className="text-ink-faint size-4" />
          <span className="text-ink truncate text-sm font-semibold">{repo.name}</span>
        </div>
        <div className="relative z-10 flex items-center gap-1.5">
          <StatusBadge status={repo.status} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={busy}
                onClick={(e) => e.preventDefault()}
              >
                <MoreHorizontal className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => router.push(`/search?repoId=${repo.id}`)}>
                <Search className="size-3.5" />
                Search this repo
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleReindex}>
                <RefreshCw className="size-3.5" />
                Reindex
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={handleDelete} className="text-danger focus:bg-danger/10">
                <Trash2 className="size-3.5" />
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5">
          <SourceBadge sourceType={repo.source_type} />
          <span className="text-ink-faint truncate text-xs">{repo.source_ref}</span>
        </div>
        {repo.status === 'error' && repo.error_message && (
          <p className="text-danger text-xs">{repo.error_message}</p>
        )}
        <div className="text-ink-muted flex items-center gap-3 text-xs">
          <span>
            {repo.file_count.toLocaleString()} {pluralize(repo.file_count, 'file')}
          </span>
          <span>{formatBytes(repo.total_size_bytes)}</span>
          <span>Indexed {formatRelativeTime(repo.last_indexed_at)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
