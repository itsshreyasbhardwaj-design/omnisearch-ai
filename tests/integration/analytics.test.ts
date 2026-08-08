import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let tempDataDir: string;

beforeAll(async () => {
  tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'omnisearch-analytics-'));
  process.env.OMNISEARCH_DATA_DIR = tempDataDir;
});

afterAll(() => {
  fs.rmSync(tempDataDir, { recursive: true, force: true });
  delete process.env.OMNISEARCH_DATA_DIR;
});

describe('analytics summary', () => {
  it('reflects real search and file-access activity, scoped to the requesting user', async () => {
    const { createUser } = await import('@/lib/auth/users');
    const { createLocalRepository } = await import('@/lib/repos/repoService');
    const { recordSearch } = await import('@/lib/search/history');
    const { recordFileAccess } = await import('@/lib/analytics/fileAccess');
    const { getAnalyticsSummary } = await import('@/lib/analytics/metrics');

    const owner = createUser('analytics-owner@example.com', 'password123');
    const outsider = createUser('analytics-outsider@example.com', 'password123');
    const demoRepoPath = path.join(process.cwd(), 'tests/fixtures/demo-repo');
    const repo = await createLocalRepository(owner.id, demoRepoPath, 'demo-repo');

    recordSearch(owner.id, repo.id, 'authenticateUser', 'text', 2, 12);
    recordSearch(owner.id, repo.id, 'nothing matches this', 'text', 0, 8);
    recordFileAccess(owner.id, repo.id, 'src/auth/authService.ts');
    recordFileAccess(owner.id, repo.id, 'src/auth/authService.ts');

    const ownerSummary = getAnalyticsSummary(owner.id);
    expect(ownerSummary.totalSearches).toBe(2);
    expect(ownerSummary.zeroResultCount).toBe(1);
    expect(ownerSummary.zeroResultRate).toBeCloseTo(0.5);
    expect(ownerSummary.topRepos[0]).toMatchObject({ repoId: repo.id, count: 2 });
    expect(ownerSummary.topFiles[0]).toMatchObject({ path: 'src/auth/authService.ts', count: 2 });
    expect(ownerSummary.totalRepositories).toBe(1);

    const outsiderSummary = getAnalyticsSummary(outsider.id);
    expect(outsiderSummary.totalSearches).toBe(0);
    expect(outsiderSummary.topRepos).toEqual([]);
    expect(outsiderSummary.topFiles).toEqual([]);
  });
});
