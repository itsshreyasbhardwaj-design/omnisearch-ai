import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/guard';
import { getAnalyticsSummary } from '@/lib/analytics/metrics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatBytes, truncatePath } from '@/lib/utils';

export const metadata: Metadata = { title: 'Analytics' };
export const dynamic = 'force-dynamic';

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-ink-faint text-xs">{label}</p>
        <p className="text-ink mt-1 text-2xl font-semibold">{value}</p>
        {sub && <p className="text-ink-faint mt-0.5 text-xs">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function Bar({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? Math.max(4, Math.round((count / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-ink-muted w-32 shrink-0 truncate" title={label}>
        {label}
      </span>
      <div className="bg-raised h-2 flex-1 overflow-hidden rounded-full">
        <div className="bg-beam h-full rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-ink-faint w-8 shrink-0 text-right">{count}</span>
    </div>
  );
}

export default async function AnalyticsPage() {
  const user = await requireUser();
  const summary = getAnalyticsSummary(user.id);

  const maxModeCount = Math.max(1, ...summary.searchesByMode.map((m) => m.count));
  const maxRepoCount = Math.max(1, ...summary.topRepos.map((r) => r.count));
  const maxFileCount = Math.max(1, ...summary.topFiles.map((f) => f.count));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-ink text-lg font-semibold">Analytics</h1>
        <p className="text-ink-muted text-sm">
          Your own search activity — never shared across accounts.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Searches" value={summary.totalSearches.toLocaleString()} />
        <StatCard label="Avg. latency" value={`${summary.avgLatencyMs}ms`} />
        <StatCard
          label="Zero-result rate"
          value={`${Math.round(summary.zeroResultRate * 100)}%`}
          sub={`${summary.zeroResultCount} of ${summary.totalSearches}`}
        />
        <StatCard
          label="Index size"
          value={formatBytes(summary.totalIndexSizeBytes)}
          sub={`${summary.totalFileCount.toLocaleString()} files · ${summary.totalRepositories} repos`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Searches by mode</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {summary.searchesByMode.length === 0 ? (
              <p className="text-ink-faint text-xs">No searches yet.</p>
            ) : (
              summary.searchesByMode.map((m) => (
                <Bar key={m.mode} label={m.mode} count={m.count} max={maxModeCount} />
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Most-searched repositories</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {summary.topRepos.length === 0 ? (
              <p className="text-ink-faint text-xs">No searches yet.</p>
            ) : (
              summary.topRepos.map((r) => (
                <Bar key={r.repoId} label={r.repoName} count={r.count} max={maxRepoCount} />
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Most-accessed files</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {summary.topFiles.length === 0 ? (
              <p className="text-ink-faint text-xs">No files opened yet.</p>
            ) : (
              summary.topFiles.map((f, i) => (
                <Bar
                  key={`${f.repoId}-${f.path}-${i}`}
                  label={truncatePath(f.path, 30)}
                  count={f.count}
                  max={maxFileCount}
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
