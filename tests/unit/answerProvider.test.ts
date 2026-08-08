import { afterEach, describe, expect, it } from 'vitest';
import {
  extractiveAnswerProvider,
  getAnswerProvider,
  openRouterAnswerProvider,
} from '@/lib/qa/answerProvider';
import type { SearchResult } from '@/lib/search/types';

const fakeResult: SearchResult = {
  repoId: 'r1',
  repoName: 'demo-repo',
  filePath: 'src/auth/authService.ts',
  language: 'typescript',
  matchType: 'HYBRID MATCH',
  score: 90,
  startLine: 22,
  endLine: 22,
  snippetHtml: 'export function authenticateUser',
  highlightLine: 22,
};

describe('extractiveAnswerProvider', () => {
  it('reports insufficient evidence when nothing was retrieved', async () => {
    const result = await extractiveAnswerProvider.answer('where is auth?', []);
    expect(result.insufficientEvidence).toBe(true);
    expect(result.synthesized).toBe(false);
    expect(result.citations).toEqual([]);
  });

  it('cites every piece of evidence and never claims to be AI-synthesized', async () => {
    const result = await extractiveAnswerProvider.answer('where is auth?', [fakeResult]);
    expect(result.synthesized).toBe(false);
    expect(result.insufficientEvidence).toBe(false);
    expect(result.citations).toEqual([fakeResult]);
    expect(result.summary).toContain('src/auth/authService.ts:L22');
  });
});

describe('getAnswerProvider', () => {
  const original = process.env.OPENROUTER_API_KEY;

  afterEach(() => {
    if (original === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = original;
  });

  it('selects the extractive provider when no API key is configured', () => {
    delete process.env.OPENROUTER_API_KEY;
    expect(getAnswerProvider()).toBe(extractiveAnswerProvider);
  });

  it('selects the OpenRouter provider when a key is configured', () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-key-not-real';
    expect(getAnswerProvider()).toBe(openRouterAnswerProvider);
  });
});

describe('openRouterAnswerProvider without a key', () => {
  it('falls back to the extractive behavior instead of ever making a network call', async () => {
    const original = process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    try {
      const result = await openRouterAnswerProvider.answer('where is auth?', [fakeResult]);
      expect(result.synthesized).toBe(false);
    } finally {
      if (original !== undefined) process.env.OPENROUTER_API_KEY = original;
    }
  });
});
