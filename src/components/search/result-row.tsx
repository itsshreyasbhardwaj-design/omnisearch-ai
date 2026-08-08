'use client';

import * as React from 'react';
import { FolderGit2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { MatchTypeBadge } from '@/components/repo/badges';
import { cn, truncatePath } from '@/lib/utils';
import type { SearchResult } from '@/lib/search/types';

interface ResultRowProps {
  result: SearchResult;
  showRepo: boolean;
  focused: boolean;
  onOpen: () => void;
}

export function ResultRow({ result, showRepo, focused, onOpen }: ResultRowProps) {
  const ref = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ block: 'nearest' });
  }, [focused]);

  const lineLabel =
    result.startLine === result.endLine
      ? `L${result.startLine}`
      : `L${result.startLine}-${result.endLine}`;

  return (
    <button
      ref={ref}
      type="button"
      role="option"
      aria-selected={focused}
      onClick={onOpen}
      className={cn(
        'border-line bg-surface/40 hover:border-line-strong hover:bg-raised/60 flex flex-col gap-1.5 rounded-md border px-3 py-2.5 text-left transition-colors',
        focused && 'border-beam/50 bg-beam/5',
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <MatchTypeBadge matchType={result.matchType} />
        {showRepo && (
          <span className="text-ink-faint flex items-center gap-1 text-[11px]">
            <FolderGit2 className="size-3" />
            {result.repoName}
          </span>
        )}
        <span className="font-mono-ui text-ink truncate text-xs" title={result.filePath}>
          {truncatePath(result.filePath)}
        </span>
        <span className="text-ink-faint text-[11px]">{lineLabel}</span>
        {result.language && <Badge>{result.language}</Badge>}
        <span className="text-ink-faint ml-auto text-[11px]">{result.score}</span>
      </div>
      <pre className="bg-void/40 font-mono-ui text-ink-muted [&_mark]:bg-match [&_mark]:text-match-ink overflow-x-auto rounded-sm px-2 py-1.5 text-xs whitespace-pre [&_mark]:rounded-xs [&_mark]:px-0.5 [&_mark]:font-semibold">
        <code dangerouslySetInnerHTML={{ __html: result.snippetHtml }} />
      </pre>
    </button>
  );
}
