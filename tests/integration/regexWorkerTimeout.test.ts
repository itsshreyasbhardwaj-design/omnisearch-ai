import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runWorkerForRepo } from '@/lib/search/regexSearch';

/**
 * `looksCatastrophic` (tested separately) catches the common ReDoS shapes
 * before a worker is ever spawned. This test proves the second, real line
 * of defense: if a catastrophic pattern reaches the worker anyway, the
 * worker gets killed on a wall-clock budget instead of hanging the process.
 * `(a+)+$` against a run of 'a's with no trailing match is the textbook
 * exponential-blowup case — at 34 characters it's already far beyond what
 * any machine computes in the 150ms budget used here, so this is fast and
 * deterministic rather than a timing gamble.
 */
describe('regex worker timeout', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'omnisearch-redos-'));
    fs.writeFileSync(path.join(root, 'evil.txt'), `${'a'.repeat(34)}!`);
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('terminates a catastrophic-backtracking pattern within the timeout budget', async () => {
    const outcome = await runWorkerForRepo(
      root,
      [{ path: 'evil.txt', language: null }],
      '(a+)+$',
      '',
      150,
    );

    expect(outcome.timedOut).toBe(true);
    expect(outcome.results).toEqual([]);
  }, 5_000);

  it('does not time out on an ordinary pattern', async () => {
    const outcome = await runWorkerForRepo(
      root,
      [{ path: 'evil.txt', language: null }],
      'a+',
      '',
      2_000,
    );

    expect(outcome.timedOut).toBe(false);
    expect(outcome.results.length).toBeGreaterThan(0);
  });
});
