import { getDb } from '@/lib/db/client';
import { listRepositoriesForUser } from '@/lib/repos/repoService';
import type { RepositoryRow, UserRow } from '@/types/db';

export class McpConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'McpConfigError';
  }
}

/**
 * The MCP server is a local dev tool running on one person's machine
 * alongside their editor/agent — same trust model as local-path repository
 * ingestion — so it operates as exactly one account, not per-request auth.
 */
export function resolveMcpUser(): UserRow {
  const email = process.env.OMNISEARCH_MCP_USER_EMAIL;
  const db = getDb();

  if (email) {
    const user = db
      .prepare('SELECT * FROM users WHERE email = ?')
      .get(email.toLowerCase().trim()) as UserRow | undefined;
    if (!user) {
      throw new McpConfigError(`No account found for OMNISEARCH_MCP_USER_EMAIL="${email}".`);
    }
    return user;
  }

  const users = db.prepare('SELECT * FROM users').all() as UserRow[];
  if (users.length === 1) {
    const only = users[0];
    if (!only) throw new McpConfigError('No accounts exist yet.');
    return only;
  }
  if (users.length === 0) {
    throw new McpConfigError(
      'No accounts exist yet — run `pnpm seed:demo` or register one at the app, then set OMNISEARCH_MCP_USER_EMAIL.',
    );
  }
  throw new McpConfigError(
    `Multiple accounts exist (${users.map((u) => u.email).join(', ')}) — set OMNISEARCH_MCP_USER_EMAIL to choose one.`,
  );
}

export function findRepoByName(userId: string, repoName: string): RepositoryRow {
  const repos = listRepositoriesForUser(userId);
  const match = repos.find((r) => r.name === repoName);
  if (!match) {
    const available = repos.map((r) => r.name).join(', ') || '(none)';
    throw new McpConfigError(
      `No repository named "${repoName}" for this account. Available: ${available}`,
    );
  }
  return match;
}
