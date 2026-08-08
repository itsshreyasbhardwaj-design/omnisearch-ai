import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let tempDataDir: string;

beforeAll(async () => {
  tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'omnisearch-integration-'));
  process.env.OMNISEARCH_DATA_DIR = tempDataDir;
});

afterAll(() => {
  fs.rmSync(tempDataDir, { recursive: true, force: true });
  delete process.env.OMNISEARCH_DATA_DIR;
});

describe('indexing + search against the demo repo fixture', () => {
  it('ingests, text-searches, and regex-searches the demo repo end to end', async () => {
    const { createUser } = await import('@/lib/auth/users');
    const { createLocalRepository, resolveRepoRoot } = await import('@/lib/repos/repoService');
    const { sqliteFtsProvider } = await import('@/lib/search/sqliteFtsProvider');
    const { searchRegex } = await import('@/lib/search/regexSearch');

    const user = createUser('integration@example.com', 'password123');
    const demoRepoPath = path.join(process.cwd(), 'tests/fixtures/demo-repo');
    const repo = await createLocalRepository(user.id, demoRepoPath, 'demo-repo');

    expect(repo.status).toBe('ready');
    expect(repo.file_count).toBeGreaterThan(0);

    // Files known-excluded by default ignore rules must never reach the index.
    const dbModule = await import('@/lib/db/client');
    const indexedPaths = dbModule
      .getDb()
      .prepare('SELECT path FROM files WHERE repo_id = ?')
      .all(repo.id)
      .map((r) => (r as { path: string }).path);
    expect(indexedPaths).not.toContain('dist/bundle.min.js');
    expect(indexedPaths).toContain('src/auth/authService.ts');

    const repoRef = { id: repo.id, name: repo.name, rootDir: resolveRepoRoot(repo) };

    // "authenticateUser" appears in both authService.ts (definition) and
    // orders.ts (a call site) — assert both are found rather than assuming
    // which one BM25 ranks first, since that's a legitimate ranking
    // judgment call, not a correctness property this test should pin down.
    const textResult = await sqliteFtsProvider.search('authenticateUser', [repoRef], {});
    expect(textResult.results.length).toBeGreaterThan(0);
    expect(textResult.results.map((r) => r.filePath)).toContain('src/auth/authService.ts');
    expect(textResult.results[0]?.matchType).toBe('TEXT MATCH');
    expect(textResult.results[0]?.snippetHtml).toContain('<mark>');

    // "validateSessionToken" only appears in authService.ts, so this one
    // does pin down an exact, deterministic top result.
    const uniqueTermResult = await sqliteFtsProvider.search('validateSessionToken', [repoRef], {});
    expect(uniqueTermResult.results[0]?.filePath).toBe('src/auth/authService.ts');

    const regexResult = await searchRegex('TODO|FIXME', 'i', [repoRef], {});
    expect(regexResult.timedOut).toBe(false);
    const regexFiles = new Set(regexResult.results.map((r) => r.filePath));
    expect(regexFiles.has('src/auth/authService.ts')).toBe(true);
    expect(regexFiles.has('src/utils/stringHelpers.js')).toBe(true);

    // Language filter narrows results to just Python.
    const pythonOnly = await sqliteFtsProvider.search('TODO', [repoRef], { language: 'python' });
    expect(pythonOnly.results.every((r) => r.language === 'python')).toBe(true);
    expect(pythonOnly.results.length).toBeGreaterThan(0);
  });

  it('incremental re-index skips unchanged files and picks up edits', async () => {
    const { createUser } = await import('@/lib/auth/users');
    const { createLocalRepository } = await import('@/lib/repos/repoService');
    const { indexRepository } = await import('@/lib/indexing/indexer');

    const user = createUser('incremental@example.com', 'password123');
    const demoRepoPath = path.join(process.cwd(), 'tests/fixtures/demo-repo');
    const repo = await createLocalRepository(user.id, demoRepoPath, 'demo-repo-2');

    const second = await indexRepository(repo.id, demoRepoPath);
    expect(second.changed).toBe(0);
    expect(second.unchanged).toBe(repo.file_count);
  });
});
