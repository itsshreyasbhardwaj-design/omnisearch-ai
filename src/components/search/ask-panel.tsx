'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Sparkles } from 'lucide-react';
import { Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { ResultRow } from './result-row';
import type { SearchResult } from '@/lib/search/types';

interface AskResponse {
  question: string;
  provider: string;
  synthesized: boolean;
  summary: string;
  citations: SearchResult[];
  insufficientEvidence: boolean;
}

export function AskPanel({ repoId }: { repoId?: string }) {
  const router = useRouter();
  const [question, setQuestion] = React.useState('');
  const [response, setResponse] = React.useState<AskResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!question.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, repoId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? 'Could not answer that.');
        setResponse(null);
        return;
      }
      setResponse(data as AskResponse);
    } catch {
      setError('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }

  function openCitation(result: SearchResult) {
    const params = new URLSearchParams();
    params.set('file', result.filePath);
    params.set(
      'L',
      result.startLine === result.endLine
        ? String(result.startLine)
        : `${result.startLine}-${result.endLine}`,
    );
    router.push(`/repos/${result.repoId}?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <Textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Where is authentication implemented? How does a user sign up? What calls authenticateUser?"
          rows={3}
        />
        <div className="flex items-center justify-between">
          <p className="text-ink-faint flex items-center gap-1 text-xs">
            <Sparkles className="size-3" />
            Answers are grounded in retrieved evidence with citations — never fabricated.
          </p>
          <Button type="submit" variant="primary" disabled={loading || !question.trim()}>
            {loading ? <Spinner className="text-void" /> : 'Ask'}
          </Button>
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
        <div className="flex flex-col gap-3">
          <div className="border-line bg-surface/40 rounded-md border p-3">
            <div className="mb-2 flex items-center gap-2">
              <Badge variant={response.synthesized ? 'beam' : 'default'}>
                {response.synthesized ? 'AI-synthesized' : 'Extractive (no AI configured)'}
              </Badge>
              {response.insufficientEvidence && (
                <span className="text-warn flex items-center gap-1 text-[11px]">
                  <AlertTriangle className="size-3" />
                  Insufficient evidence
                </span>
              )}
            </div>
            <p className="text-ink text-sm whitespace-pre-wrap">{response.summary}</p>
          </div>

          {response.citations.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-ink-faint text-xs font-medium">
                Citations ({response.citations.length})
              </p>
              {response.citations.map((citation, i) => (
                <ResultRow
                  key={`${citation.repoId}-${citation.filePath}-${citation.startLine}-${i}`}
                  result={citation}
                  showRepo={!repoId}
                  focused={false}
                  onOpen={() => openCitation(citation)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
