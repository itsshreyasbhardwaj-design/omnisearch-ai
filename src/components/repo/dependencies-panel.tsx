'use client';

import * as React from 'react';
import { ArrowDownRight, ArrowUpLeft, ChevronDown, GitBranch } from 'lucide-react';
import { cn, truncatePath } from '@/lib/utils';

interface DependencyEdge {
  path: string;
  specifier: string;
  importedNames: string[];
}

interface DependenciesData {
  imports: DependencyEdge[];
  importedBy: DependencyEdge[];
}

export function DependenciesPanel({ repoId, filePath }: { repoId: string; filePath: string }) {
  const [data, setData] = React.useState<DependenciesData | null>(null);
  const [expanded, setExpanded] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    // Clears stale data from the previous file immediately, before the fetch
    // for the newly-selected file resolves — an external data fetch driven
    // by props changing, not state derived from other state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData(null);
    fetch(`/api/repos/${repoId}/dependencies?file=${encodeURIComponent(filePath)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelled && json) setData({ imports: json.imports, importedBy: json.importedBy });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [repoId, filePath]);

  if (!data || (data.imports.length === 0 && data.importedBy.length === 0)) return null;

  return (
    <div className="border-line bg-raised/30 rounded-md border text-xs">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="text-ink-muted flex w-full items-center gap-2 px-3 py-1.5"
      >
        <GitBranch className="size-3.5" />
        <span>
          {data.imports.length} import{data.imports.length === 1 ? '' : 's'} ·{' '}
          {data.importedBy.length} importer{data.importedBy.length === 1 ? '' : 's'}
        </span>
        <ChevronDown
          className={cn('ml-auto size-3.5 transition-transform', expanded && 'rotate-180')}
        />
      </button>
      {expanded && (
        <div className="border-line grid grid-cols-2 gap-3 border-t px-3 py-2">
          <div>
            <p className="text-ink-faint mb-1 flex items-center gap-1 font-medium">
              <ArrowDownRight className="size-3" /> Imports
            </p>
            {data.imports.length === 0 ? (
              <p className="text-ink-faint">None</p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {data.imports.map((edge, i) => (
                  <li key={i} className="font-mono-ui text-ink-muted truncate" title={edge.path}>
                    {truncatePath(edge.path, 40)}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="text-ink-faint mb-1 flex items-center gap-1 font-medium">
              <ArrowUpLeft className="size-3" /> Imported by
            </p>
            {data.importedBy.length === 0 ? (
              <p className="text-ink-faint">None</p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {data.importedBy.map((edge, i) => (
                  <li key={i} className="font-mono-ui text-ink-muted truncate" title={edge.path}>
                    {truncatePath(edge.path, 40)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
