import { z } from 'zod';

const GITHUB_URL_PATTERN =
  /^https:\/\/github\.com\/([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38}))\/([a-zA-Z0-9._-]{1,100})(?:\.git)?\/?$/;

export const createGithubRepoSchema = z.object({
  sourceType: z.literal('github'),
  name: z.string().trim().min(1).max(200).optional(),
  url: z
    .string()
    .trim()
    .regex(
      GITHUB_URL_PATTERN,
      'Enter a public GitHub repository URL, e.g. https://github.com/owner/repo',
    ),
});

export const createLocalRepoSchema = z.object({
  sourceType: z.literal('local'),
  name: z.string().trim().min(1).max(200).optional(),
  path: z.string().trim().min(1, 'Enter an absolute path on this machine.'),
});

export const createRepoSchema = z.discriminatedUnion('sourceType', [
  createGithubRepoSchema,
  createLocalRepoSchema,
]);

export type CreateRepoInput = z.infer<typeof createRepoSchema>;

export function parseGithubOwnerRepo(url: string): { owner: string; repo: string } | null {
  const match = GITHUB_URL_PATTERN.exec(url.trim());
  if (!match) return null;
  const owner = match[1];
  const repoRaw = match[2];
  if (!owner || !repoRaw) return null;
  return { owner, repo: repoRaw.replace(/\.git$/, '') };
}
