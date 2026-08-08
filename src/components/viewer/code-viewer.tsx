'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { codeToHtml } from 'shiki';
import { ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useTheme } from '@/components/layout/theme-provider';
import { cn } from '@/lib/utils';

const LANGUAGE_ALIASES: Record<string, string> = {
  csharp: 'csharp',
  shell: 'bash',
};

function shikiLang(language: string | null): string {
  if (!language) return 'text';
  return LANGUAGE_ALIASES[language] ?? language;
}

/** Parses GitHub-style `?L=10` or `?L=10-24` into a [start, end] line range. */
function parseLineParam(value: string | null): [number, number] | null {
  if (!value) return null;
  const match = /^(\d+)(?:-(\d+))?$/.exec(value);
  if (!match) return null;
  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : start;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 1) return null;
  return start <= end ? [start, end] : [end, start];
}

export interface CodeViewerProps {
  filePath: string;
  content: string;
  language: string | null;
}

export function CodeViewer({ filePath, content, language }: CodeViewerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme } = useTheme();
  const containerRef = React.useRef<HTMLDivElement>(null);

  const [html, setHtml] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [findQuery, setFindQuery] = React.useState('');
  const [findIndex, setFindIndex] = React.useState(0);

  const lines = React.useMemo(() => content.split('\n'), [content]);
  const matchingLines = React.useMemo(() => {
    if (!findQuery.trim()) return [];
    const needle = findQuery.toLowerCase();
    const hits: number[] = [];
    lines.forEach((line, i) => {
      if (line.toLowerCase().includes(needle)) hits.push(i + 1);
    });
    return hits;
  }, [findQuery, lines]);

  React.useEffect(() => {
    let cancelled = false;
    // Clears the previous file's highlighted HTML immediately so a file
    // switch shows a loading state instead of stale code while the async
    // highlighter (an external library call) resolves for the new content.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHtml(null);
    codeToHtml(content, {
      lang: shikiLang(language),
      theme: theme === 'dark' ? 'github-dark' : 'github-light',
    })
      .catch(() =>
        codeToHtml(content, {
          lang: 'text',
          theme: theme === 'dark' ? 'github-dark' : 'github-light',
        }),
      )
      .then((result) => {
        if (!cancelled) setHtml(result);
      });
    return () => {
      cancelled = true;
    };
  }, [content, language, theme]);

  const highlightRange = React.useMemo(() => parseLineParam(searchParams.get('L')), [searchParams]);

  const decorateAndScroll = React.useCallback(
    (behavior: ScrollBehavior) => {
      const container = containerRef.current;
      if (!container) return;
      const lineEls = container.querySelectorAll<HTMLElement>('.line');
      lineEls.forEach((el, i) => {
        el.id = `L${i + 1}`;
        el.dataset.line = String(i + 1);
        el.classList.toggle(
          'omni-line-highlight',
          highlightRange !== null && i + 1 >= highlightRange[0] && i + 1 <= highlightRange[1],
        );
      });
      if (highlightRange) {
        document
          .getElementById(`L${highlightRange[0]}`)
          ?.scrollIntoView({ behavior, block: 'center' });
      }
    },
    [highlightRange],
  );

  React.useEffect(() => {
    decorateAndScroll('auto');
  }, [html, decorateAndScroll]);

  function setLineParam(line: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('L', String(line));
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  function jumpToFind(direction: 1 | -1) {
    if (matchingLines.length === 0) return;
    const nextIndex = (findIndex + direction + matchingLines.length) % matchingLines.length;
    setFindIndex(nextIndex);
    const line = matchingLines[nextIndex];
    if (line) {
      document.getElementById(`L${line}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="border-line flex h-full flex-col overflow-hidden rounded-md border">
      <div className="border-line bg-raised/40 flex items-center gap-2 border-b px-3 py-2">
        <span className="font-mono-ui text-ink-muted truncate text-xs">{filePath}</span>
        <div className="ml-auto flex items-center gap-1.5">
          <Input
            value={findQuery}
            onChange={(e) => {
              setFindQuery(e.target.value);
              setFindIndex(0);
            }}
            placeholder="Find in file"
            className="h-7 w-40 text-xs"
          />
          {findQuery && (
            <span className="text-ink-faint text-[11px] whitespace-nowrap">
              {matchingLines.length > 0 ? `${findIndex + 1}/${matchingLines.length}` : '0/0'}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => jumpToFind(-1)}
            disabled={matchingLines.length === 0}
          >
            <ChevronUp className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => jumpToFind(1)}
            disabled={matchingLines.length === 0}
          >
            <ChevronDown className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleCopy}
            aria-label="Copy file contents"
          >
            {copied ? <Check className="text-ready size-3.5" /> : <Copy className="size-3.5" />}
          </Button>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 overflow-auto text-[13px] leading-5">
        {html === null ? (
          <div className="flex h-32 items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <div
            className={cn(
              '[&_.shiki]:!bg-transparent [&_.shiki]:p-3',
              '[&_.line]:hover:bg-hover/60 [&_.line]:relative [&_.line]:block [&_.line]:cursor-pointer [&_.line]:pl-14',
              '[&_.line]:before:text-ink-ghost [&_.line]:before:absolute [&_.line]:before:left-0 [&_.line]:before:w-10 [&_.line]:before:text-right [&_.line]:before:content-[attr(data-line)] [&_.line]:before:select-none',
              '[&_.omni-line-highlight]:bg-beam/10 [&_.omni-line-highlight]:before:text-beam',
            )}
            onClick={(event) => {
              const lineEl = (event.target as HTMLElement).closest<HTMLElement>('.line');
              if (lineEl?.dataset.line) setLineParam(Number(lineEl.dataset.line));
            }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </div>
    </div>
  );
}
