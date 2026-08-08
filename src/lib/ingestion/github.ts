import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import { parseGithubOwnerRepo } from '@/lib/validation/repos';

const execFileAsync = promisify(execFile);

export class GithubCloneError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GithubCloneError';
  }
}

/**
 * Shallow-clones a public GitHub repository. Uses `execFile` (argv array,
 * no shell) rather than a template-string `exec` call, so the URL can never
 * be interpreted as shell syntax — the regex validation in
 * `parseGithubOwnerRepo` is a second, independent guard on top of that.
 */
export async function cloneGithubRepo(url: string, destDir: string): Promise<void> {
  const parsed = parseGithubOwnerRepo(url);
  if (!parsed) {
    throw new GithubCloneError('Not a valid public GitHub repository URL.');
  }

  await fs.rm(destDir, { recursive: true, force: true });
  await fs.mkdir(destDir, { recursive: true });

  const canonicalUrl = `https://github.com/${parsed.owner}/${parsed.repo}.git`;

  try {
    await execFileAsync(
      'git',
      ['clone', '--depth', '1', '--single-branch', '--no-tags', canonicalUrl, destDir],
      { timeout: 120_000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } },
    );
  } catch (error) {
    await fs.rm(destDir, { recursive: true, force: true });
    const message = error instanceof Error ? error.message : String(error);
    throw new GithubCloneError(
      `Could not clone ${parsed.owner}/${parsed.repo}. It may be private, renamed, or removed. (${message.split('\n')[0]})`,
    );
  }
}

export function suggestedRepoName(url: string): string {
  const parsed = parseGithubOwnerRepo(url);
  return parsed ? `${parsed.owner}/${parsed.repo}` : url;
}
