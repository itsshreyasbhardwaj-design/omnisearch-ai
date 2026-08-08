import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

let tempDataDir: string;

beforeAll(async () => {
  tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'omnisearch-mcp-'));
  process.env.OMNISEARCH_DATA_DIR = tempDataDir;
});

afterAll(() => {
  fs.rmSync(tempDataDir, { recursive: true, force: true });
  delete process.env.OMNISEARCH_DATA_DIR;
});

afterEach(() => {
  delete process.env.OMNISEARCH_MCP_USER_EMAIL;
});

describe('resolveMcpUser', () => {
  it('throws a clear error when no accounts exist', async () => {
    const { resolveMcpUser, McpConfigError } = await import('@/lib/mcp/context');
    expect(() => resolveMcpUser()).toThrow(McpConfigError);
  });

  it('defaults to the single existing account when there is exactly one', async () => {
    const { createUser } = await import('@/lib/auth/users');
    const { resolveMcpUser } = await import('@/lib/mcp/context');

    const created = createUser('mcp-solo@example.com', 'password123');
    const resolved = resolveMcpUser();
    expect(resolved.id).toBe(created.id);
  });

  it('requires OMNISEARCH_MCP_USER_EMAIL when multiple accounts exist, and honors it', async () => {
    const { createUser } = await import('@/lib/auth/users');
    const { resolveMcpUser, McpConfigError } = await import('@/lib/mcp/context');

    // A second account — now ambiguous without the env var.
    const second = createUser('mcp-second@example.com', 'password123');
    expect(() => resolveMcpUser()).toThrow(McpConfigError);

    process.env.OMNISEARCH_MCP_USER_EMAIL = 'mcp-second@example.com';
    expect(resolveMcpUser().id).toBe(second.id);
  });

  it('throws for an email that does not match any account', async () => {
    const { resolveMcpUser, McpConfigError } = await import('@/lib/mcp/context');
    process.env.OMNISEARCH_MCP_USER_EMAIL = 'nobody@example.com';
    expect(() => resolveMcpUser()).toThrow(McpConfigError);
  });
});

describe('findRepoByName', () => {
  it('finds a repository owned by the user by exact name, and throws with available names otherwise', async () => {
    const { createUser } = await import('@/lib/auth/users');
    const { createLocalRepository } = await import('@/lib/repos/repoService');
    const { findRepoByName, McpConfigError } = await import('@/lib/mcp/context');

    const user = createUser('mcp-repo@example.com', 'password123');
    const demoRepoPath = path.join(process.cwd(), 'tests/fixtures/demo-repo');
    const repo = await createLocalRepository(user.id, demoRepoPath, 'demo-repo');

    expect(findRepoByName(user.id, 'demo-repo').id).toBe(repo.id);
    expect(() => findRepoByName(user.id, 'nonexistent')).toThrow(McpConfigError);
  });
});
