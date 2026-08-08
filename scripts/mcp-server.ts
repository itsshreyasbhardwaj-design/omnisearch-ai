#!/usr/bin/env node
/**
 * An MCP server exposing OmniSearch's search/symbol/dependency/Q&A/file
 * capabilities to AI coding agents over stdio. Runs as one local account
 * (see lib/mcp/context.ts) — the same trust model as local-path ingestion:
 * a tool meant to run on the machine of the person who owns the data.
 *
 * Usage: `pnpm mcp` (equivalent to the `omnisearch-mcp` bin entry).
 */
import path from 'node:path';
import fs from 'node:fs/promises';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getDb } from '../src/lib/db/client';
import { resolveMcpUser, findRepoByName, McpConfigError } from '../src/lib/mcp/context';
import { listRepositoriesForUser, resolveRepoRoot } from '../src/lib/repos/repoService';
import { sqliteFtsProvider } from '../src/lib/search/sqliteFtsProvider';
import { symbolProvider } from '../src/lib/search/symbolProvider';
import { hybridProvider } from '../src/lib/search/hybridRanking';
import { searchRegex, InvalidRegexError } from '../src/lib/search/regexSearch';
import { whatFileImports, whatImportsFile } from '../src/lib/dependencies/queries';
import { retrieveEvidence } from '../src/lib/qa/retrieve';
import { getAnswerProvider } from '../src/lib/qa/answerProvider';

function textResult(data: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
      },
    ],
  };
}

function errorResult(message: string) {
  return {
    content: [{ type: 'text' as const, text: `Error: ${message}` }],
    isError: true as const,
  };
}

function assertWithinRoot(rootDir: string, resolved: string): boolean {
  return resolved === rootDir || resolved.startsWith(rootDir + path.sep);
}

async function main() {
  getDb(); // opens the DB and runs migrations before anything else touches it
  const user = resolveMcpUser();

  const server = new McpServer({ name: 'omnisearch-ai', version: '0.1.0' });

  function reposFor(repoName?: string) {
    const owned = listRepositoriesForUser(user.id).filter((r) => r.status === 'ready');
    const scoped = repoName ? owned.filter((r) => r.name === repoName) : owned;
    return scoped.map((r) => ({ id: r.id, name: r.name, rootDir: resolveRepoRoot(r) }));
  }

  server.registerTool(
    'search_code',
    {
      title: 'Search code',
      description:
        'Search indexed repositories by text (fast exact/fuzzy), regex, or hybrid (lexical + semantic + symbol) relevance.',
      inputSchema: {
        query: z.string().describe('The search query, or a regex pattern when mode is "regex"'),
        mode: z.enum(['text', 'regex', 'hybrid']).default('text'),
        repoName: z.string().optional().describe('Limit to one repository by name'),
        regexFlags: z.string().max(5).optional().default(''),
      },
    },
    async ({ query, mode, repoName, regexFlags }) => {
      const repos = reposFor(repoName);
      if (repos.length === 0) return errorResult('No ready repositories to search.');

      if (mode === 'regex') {
        try {
          const outcome = await searchRegex(query, regexFlags ?? '', repos, {});
          return textResult(outcome.results);
        } catch (error) {
          if (error instanceof InvalidRegexError) return errorResult(error.message);
          throw error;
        }
      }

      const provider = mode === 'hybrid' ? hybridProvider : sqliteFtsProvider;
      const outcome = await provider.search(query, repos, {});
      return textResult(outcome.results);
    },
  );

  server.registerTool(
    'search_symbols',
    {
      title: 'Search symbols',
      description:
        'Search for functions, classes, interfaces, types, methods, and components by name.',
      inputSchema: {
        name: z.string(),
        repoName: z.string().optional(),
        kind: z
          .string()
          .optional()
          .describe('function | method | class | interface | type | variable | component'),
      },
    },
    async ({ name, repoName, kind }) => {
      const repos = reposFor(repoName);
      if (repos.length === 0) return errorResult('No ready repositories to search.');
      const outcome = await symbolProvider.search(name, repos, { symbolKind: kind });
      return textResult(outcome.results);
    },
  );

  server.registerTool(
    'find_dependencies',
    {
      title: 'Find dependencies',
      description:
        "Find what a file imports and what imports it, within one repository's dependency graph.",
      inputSchema: {
        repoName: z.string(),
        file: z.string().describe('Repo-relative file path'),
      },
    },
    async ({ repoName, file }) => {
      try {
        const repo = findRepoByName(user.id, repoName);
        return textResult({
          imports: whatFileImports(repo.id, file),
          importedBy: whatImportsFile(repo.id, file),
        });
      } catch (error) {
        if (error instanceof McpConfigError) return errorResult(error.message);
        throw error;
      }
    },
  );

  server.registerTool(
    'ask_repository',
    {
      title: 'Ask repository',
      description:
        'Ask a natural-language question about the repository. Returns cited evidence (file/line); also AI-synthesized if OPENROUTER_API_KEY is configured on the server.',
      inputSchema: {
        question: z.string(),
        repoName: z.string().optional(),
      },
    },
    async ({ question, repoName }) => {
      const repos = reposFor(repoName);
      const evidence = await retrieveEvidence(question, repos, {});
      const answer = await getAnswerProvider().answer(question, evidence);
      return textResult(answer);
    },
  );

  server.registerTool(
    'get_file',
    {
      title: 'Get file',
      description: "Read a file's full content from an indexed repository.",
      inputSchema: {
        repoName: z.string(),
        path: z.string(),
      },
    },
    async ({ repoName, path: filePath }) => {
      try {
        const repo = findRepoByName(user.id, repoName);
        const rootDir = path.resolve(resolveRepoRoot(repo));
        const resolved = path.resolve(rootDir, filePath);
        if (!assertWithinRoot(rootDir, resolved)) return errorResult('Invalid file path.');

        const content = await fs.readFile(resolved, 'utf8');
        return textResult({ path: filePath, content });
      } catch (error) {
        if (error instanceof McpConfigError) return errorResult(error.message);
        return errorResult(`Could not read ${filePath}: ${(error as Error).message}`);
      }
    },
  );

  server.registerTool(
    'get_context',
    {
      title: 'Get context',
      description:
        'Get a window of lines around a specific line in a file — useful after a search hit.',
      inputSchema: {
        repoName: z.string(),
        path: z.string(),
        line: z.number().int().min(1),
        window: z.number().int().min(1).max(200).optional().default(20),
      },
    },
    async ({ repoName, path: filePath, line, window }) => {
      try {
        const repo = findRepoByName(user.id, repoName);
        const rootDir = path.resolve(resolveRepoRoot(repo));
        const resolved = path.resolve(rootDir, filePath);
        if (!assertWithinRoot(rootDir, resolved)) return errorResult('Invalid file path.');

        const content = await fs.readFile(resolved, 'utf8');
        const lines = content.split('\n');
        const start = Math.max(1, line - window);
        const end = Math.min(lines.length, line + window);
        return textResult({
          path: filePath,
          startLine: start,
          endLine: end,
          content: lines.slice(start - 1, end).join('\n'),
        });
      } catch (error) {
        if (error instanceof McpConfigError) return errorResult(error.message);
        return errorResult(`Could not read ${filePath}: ${(error as Error).message}`);
      }
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('omnisearch-mcp failed to start:', error);
  process.exitCode = 1;
});
