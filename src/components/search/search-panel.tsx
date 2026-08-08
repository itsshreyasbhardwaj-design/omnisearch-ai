'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { ResultRow } from './result-row';
import type { SearchMode, SearchResponse, SearchResult } from '@/lib/search/types';
import type { RepositoryRow } from '@/types/db';

interface SearchPanelProps {
  repoId?: string;
  repoName?: string;
  initialQuery?: string;
  onResultOpen?: () => void;
}

const MODE_PLACEHOLDER: Record<SearchMode, string> = {
  text: 'Search across your repositories…',
  regex: 'Regular expression, e.g. TODO|FIXME',
  symbol: 'Symbol name, e.g. authenticateUser',
  semantic: 'Describe what you’re looking for…',
  hybrid: 'Search across your repositories…',
};

const SYMBOL_KINDS = ['function', 'method', 'class', 'interface', 'type', 'variable', 'component'];

export function SearchPanel({ repoId, repoName, initialQuery, onResultOpen }: SearchPanelProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState(initialQuery ?? '');
  const [mode, setMode] = React.useState<SearchMode>('text');
  const [regexFlags, setRegexFlags] = React.useState('i');
  const [symbolKind, setSymbolKind] = React.useState<string>('all');
  const [language, setLanguage] = React.useState('');
  const [directory, setDirectory] = React.useState('');
  const [fileExtension, setFileExtension] = React.useState('');
  const [repoFilterId, setRepoFilterId] = React.useState<string>('all');
  const [availableRepos, setAvailableRepos] = React.useState<RepositoryRow[]>([]);

  const [response, setResponse] = React.useState<SearchResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = React.useState(-1);

  React.useEffect(() => {
    if (repoId) return;
    fetch('/api/repos')
      .then((r) => r.json())
      .then((data) =>
        setAvailableRepos(
          (data.repositories ?? []).filter((r: RepositoryRow) => r.status === 'ready'),
        ),
      )
      .catch(() => undefined);
  }, [repoId]);

  const runSearch = React.useCallback(
    async (event?: React.FormEvent) => {
      event?.preventDefault();
      if (!query.trim()) return;

      setLoading(true);
      setError(null);
      setFocusedIndex(-1);
      try {
        const res = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            mode,
            regexFlags: mode === 'regex' ? regexFlags : undefined,
            repoId: repoId ?? (repoFilterId !== 'all' ? repoFilterId : undefined),
            filters: {
              language: language || undefined,
              directory: directory || undefined,
              fileExtension: fileExtension || undefined,
              symbolKind: mode === 'symbol' && symbolKind !== 'all' ? symbolKind : undefined,
            },
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error?.message ?? 'Search failed.');
          setResponse(null);
          return;
        }
        setResponse(data as SearchResponse);
      } catch {
        setError('Could not reach the server.');
      } finally {
        setLoading(false);
      }
    },
    [query, mode, regexFlags, symbolKind, repoId, repoFilterId, language, directory, fileExtension],
  );

  React.useEffect(() => {
    // Runs the deep-linked `?q=` search once on mount — a one-time action
    // triggered by the initial prop, not state derived from other state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initialQuery) void runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openResult(result: SearchResult) {
    const params = new URLSearchParams();
    params.set('file', result.filePath);
    params.set(
      'L',
      result.startLine === result.endLine
        ? String(result.startLine)
        : `${result.startLine}-${result.endLine}`,
    );
    router.push(`/repos/${result.repoId}?${params.toString()}`);
    onResultOpen?.();
  }

  function handleResultsKeyDown(event: React.KeyboardEvent) {
    const results = response?.results ?? [];
    if (results.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setFocusedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setFocusedIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter' && focusedIndex >= 0) {
      const target = results[focusedIndex];
      if (target) openResult(target);
    }
  }

  const hasFilters = Boolean(language || directory || fileExtension);

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={runSearch} className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Tabs value={mode} onValueChange={(v) => setMode(v as SearchMode)}>
            <TabsList>
              <TabsTrigger value="text">Text</TabsTrigger>
              <TabsTrigger value="regex">Regex</TabsTrigger>
              <TabsTrigger value="symbol">Symbol</TabsTrigger>
              <TabsTrigger value="semantic">Semantic</TabsTrigger>
              <TabsTrigger value="hybrid">Hybrid</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative flex-1">
            <Search className="text-ink-faint pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                repoId ? `Search ${repoName ?? 'this repository'}…` : MODE_PLACEHOLDER[mode]
              }
              className="h-9 pl-9"
            />
          </div>

          {mode === 'regex' && (
            <Input
              value={regexFlags}
              onChange={(e) => setRegexFlags(e.target.value)}
              placeholder="flags"
              className="font-mono-ui h-9 w-16 text-center"
              maxLength={5}
            />
          )}

          <Button type="submit" variant="primary" disabled={loading || !query.trim()}>
            {loading ? <Spinner className="text-void" /> : 'Search'}
          </Button>
        </div>

        {(mode === 'semantic' || mode === 'hybrid') && (
          <p className="text-ink-faint text-xs">
            {mode === 'semantic'
              ? 'Local embeddings (lexical/conceptual overlap) — not a neural model.'
              : 'Combines text, semantic, and symbol relevance into one ranking.'}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {!repoId && (
            <Select value={repoFilterId} onValueChange={setRepoFilterId}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="All repositories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All repositories</SelectItem>
                {availableRepos.map((repo) => (
                  <SelectItem key={repo.id} value={repo.id}>
                    {repo.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {mode === 'symbol' && (
            <Select value={symbolKind} onValueChange={setSymbolKind}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All kinds" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All kinds</SelectItem>
                {SYMBOL_KINDS.map((kind) => (
                  <SelectItem key={kind} value={kind}>
                    {kind}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Input
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            placeholder="Language (e.g. typescript)"
            className="h-8 w-48 text-xs"
          />
          <Input
            value={directory}
            onChange={(e) => setDirectory(e.target.value)}
            placeholder="Directory (e.g. src/lib)"
            className="h-8 w-48 text-xs"
          />
          <Input
            value={fileExtension}
            onChange={(e) => setFileExtension(e.target.value)}
            placeholder="Extension (e.g. tsx)"
            className="h-8 w-40 text-xs"
          />
          {hasFilters && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => {
                setLanguage('');
                setDirectory('');
                setFileExtension('');
              }}
            >
              <X className="size-3" />
              Clear filters
            </Button>
          )}
        </div>
      </form>

      {error && (
        <p
          role="alert"
          className="border-danger/30 bg-danger/10 text-danger rounded-sm border px-3 py-2 text-xs"
        >
          {error}
        </p>
      )}

      {response && (
        <div className="flex flex-col gap-2">
          <div className="text-ink-faint flex items-center justify-between text-xs">
            <span>
              {response.results.length === 0
                ? 'No results'
                : `${response.results.length}${response.truncated ? '+' : ''} result${response.results.length === 1 ? '' : 's'}`}{' '}
              in {response.tookMs}ms
            </span>
            {response.timedOut && (
              <span className="text-warn flex items-center gap-1">
                <AlertTriangle className="size-3" />
                Search timed out — results may be incomplete
              </span>
            )}
          </div>

          <div
            role="listbox"
            tabIndex={0}
            onKeyDown={handleResultsKeyDown}
            className="flex flex-col gap-1.5 outline-none"
          >
            {response.results.map((result, i) => (
              <ResultRow
                key={`${result.repoId}-${result.filePath}-${result.startLine}-${i}`}
                result={result}
                showRepo={!repoId}
                focused={focusedIndex === i}
                onOpen={() => openResult(result)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
