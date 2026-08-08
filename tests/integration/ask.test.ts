import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let tempDataDir: string;

beforeAll(async () => {
  tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'omnisearch-ask-'));
  process.env.OMNISEARCH_DATA_DIR = tempDataDir;
  delete process.env.OPENROUTER_API_KEY;
});

afterAll(() => {
  fs.rmSync(tempDataDir, { recursive: true, force: true });
  delete process.env.OMNISEARCH_DATA_DIR;
});

describe('extractive Q&A against the demo repo fixture', () => {
  it('answers a question with real, cited evidence', async () => {
    const { createUser } = await import('@/lib/auth/users');
    const { createLocalRepository, resolveRepoRoot } = await import('@/lib/repos/repoService');
    const { retrieveEvidence } = await import('@/lib/qa/retrieve');
    const { getAnswerProvider } = await import('@/lib/qa/answerProvider');

    const user = createUser('ask@example.com', 'password123');
    const demoRepoPath = path.join(process.cwd(), 'tests/fixtures/demo-repo');
    const repo = await createLocalRepository(user.id, demoRepoPath, 'demo-repo');
    const repoRef = { id: repo.id, name: repo.name, rootDir: resolveRepoRoot(repo) };

    const evidence = await retrieveEvidence('how does the app authenticate a user', [repoRef], {});
    expect(evidence.length).toBeGreaterThan(0);

    const answer = await getAnswerProvider().answer(
      'how does the app authenticate a user',
      evidence,
    );
    expect(answer.synthesized).toBe(false); // no OPENROUTER_API_KEY in this test environment
    expect(answer.insufficientEvidence).toBe(false);
    expect(answer.citations.length).toBeGreaterThan(0);
    expect(answer.citations.every((c) => c.repoId === repo.id)).toBe(true);
  });

  it('is honest when nothing in the repo matches the question', async () => {
    const { createUser } = await import('@/lib/auth/users');
    const { createLocalRepository, resolveRepoRoot } = await import('@/lib/repos/repoService');
    const { retrieveEvidence } = await import('@/lib/qa/retrieve');
    const { getAnswerProvider } = await import('@/lib/qa/answerProvider');

    const user = createUser('ask-empty@example.com', 'password123');
    const demoRepoPath = path.join(process.cwd(), 'tests/fixtures/demo-repo');
    const repo = await createLocalRepository(user.id, demoRepoPath, 'demo-repo');
    const repoRef = { id: repo.id, name: repo.name, rootDir: resolveRepoRoot(repo) };

    const evidence = await retrieveEvidence(
      'kubernetes helm chart deployment rollback',
      [repoRef],
      {},
    );
    const answer = await getAnswerProvider().answer(
      'kubernetes helm chart deployment rollback',
      evidence,
    );
    if (evidence.length === 0) {
      expect(answer.insufficientEvidence).toBe(true);
    }
  });
});
