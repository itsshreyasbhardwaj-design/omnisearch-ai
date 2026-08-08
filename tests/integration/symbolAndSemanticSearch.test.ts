import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let tempDataDir: string;

beforeAll(async () => {
  tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'omnisearch-phase3-'));
  process.env.OMNISEARCH_DATA_DIR = tempDataDir;
});

afterAll(() => {
  fs.rmSync(tempDataDir, { recursive: true, force: true });
  delete process.env.OMNISEARCH_DATA_DIR;
});

describe('symbol, semantic, and hybrid search against the demo repo fixture', () => {
  it('symbol search finds authenticateUser as an exported function', async () => {
    const { createUser } = await import('@/lib/auth/users');
    const { createLocalRepository, resolveRepoRoot } = await import('@/lib/repos/repoService');
    const { symbolProvider } = await import('@/lib/search/symbolProvider');

    const user = createUser('symbols@example.com', 'password123');
    const demoRepoPath = path.join(process.cwd(), 'tests/fixtures/demo-repo');
    const repo = await createLocalRepository(user.id, demoRepoPath, 'demo-repo');
    const repoRef = { id: repo.id, name: repo.name, rootDir: resolveRepoRoot(repo) };

    const result = await symbolProvider.search('authenticateUser', [repoRef], {});
    const match = result.results.find((r) => r.filePath === 'src/auth/authService.ts');
    expect(match).toBeDefined();
    expect(match?.matchType).toBe('SYMBOL MATCH');
    expect(match?.explanation).toContain('Function');
  });

  it('symbol search finds the Go HandleHealthCheck function as exported', async () => {
    const { createUser } = await import('@/lib/auth/users');
    const { createLocalRepository, resolveRepoRoot } = await import('@/lib/repos/repoService');
    const { symbolProvider } = await import('@/lib/search/symbolProvider');

    const user = createUser('symbols-go@example.com', 'password123');
    const demoRepoPath = path.join(process.cwd(), 'tests/fixtures/demo-repo');
    const repo = await createLocalRepository(user.id, demoRepoPath, 'demo-repo');
    const repoRef = { id: repo.id, name: repo.name, rootDir: resolveRepoRoot(repo) };

    const result = await symbolProvider.search('HandleHealthCheck', [repoRef], {});
    expect(result.results[0]).toMatchObject({ filePath: 'pkg/health/health.go' });
    expect(result.results[0]?.explanation).toContain('exported');
  });

  it('semantic search surfaces the auth file for a paraphrased query', async () => {
    const { createUser } = await import('@/lib/auth/users');
    const { createLocalRepository, resolveRepoRoot } = await import('@/lib/repos/repoService');
    const { semanticProvider } = await import('@/lib/search/semanticProvider');

    const user = createUser('semantic@example.com', 'password123');
    const demoRepoPath = path.join(process.cwd(), 'tests/fixtures/demo-repo');
    const repo = await createLocalRepository(user.id, demoRepoPath, 'demo-repo');
    const repoRef = { id: repo.id, name: repo.name, rootDir: resolveRepoRoot(repo) };

    const result = await semanticProvider.search(
      'verify user email and password credentials',
      [repoRef],
      {},
    );
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results.some((r) => r.filePath.includes('auth'))).toBe(true);
  });

  it('hybrid search merges signals and labels its match type', async () => {
    const { createUser } = await import('@/lib/auth/users');
    const { createLocalRepository, resolveRepoRoot } = await import('@/lib/repos/repoService');
    const { hybridProvider } = await import('@/lib/search/hybridRanking');

    const user = createUser('hybrid@example.com', 'password123');
    const demoRepoPath = path.join(process.cwd(), 'tests/fixtures/demo-repo');
    const repo = await createLocalRepository(user.id, demoRepoPath, 'demo-repo');
    const repoRef = { id: repo.id, name: repo.name, rootDir: resolveRepoRoot(repo) };

    const result = await hybridProvider.search('authenticateUser', [repoRef], {});
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results[0]?.matchType).toBe('HYBRID MATCH');
    expect(result.results[0]?.explanation).toContain('Matched via');
  });

  it('find_dependencies-style queries resolve a relative import within the repo', async () => {
    const { createUser } = await import('@/lib/auth/users');
    const { createLocalRepository, resolveRepoRoot } = await import('@/lib/repos/repoService');
    const { whatFileImports, whatImportsFile } = await import('@/lib/dependencies/queries');

    const user = createUser('deps@example.com', 'password123');
    const demoRepoPath = path.join(process.cwd(), 'tests/fixtures/demo-repo');
    const repo = await createLocalRepository(user.id, demoRepoPath, 'demo-repo');
    void resolveRepoRoot(repo);

    const imports = whatFileImports(repo.id, 'src/api/orders.ts');
    expect(imports.some((i) => i.path === 'src/auth/authService.ts')).toBe(true);

    const importers = whatImportsFile(repo.id, 'src/auth/authService.ts');
    expect(importers.some((i) => i.path === 'src/api/orders.ts')).toBe(true);
  });
});
