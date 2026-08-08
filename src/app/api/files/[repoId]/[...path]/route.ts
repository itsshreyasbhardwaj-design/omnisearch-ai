import path from 'node:path';
import fs from 'node:fs/promises';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/guard';
import { getOwnedRepository, resolveRepoRoot } from '@/lib/repos/repoService';
import { apiError, toApiError } from '@/lib/api/errors';

interface RouteContext {
  params: Promise<{ repoId: string; path: string[] }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { repoId, path: pathSegments } = await params;
    const repo = getOwnedRepository(user.id, repoId);

    const rootDir = path.resolve(resolveRepoRoot(repo));
    const relPath = pathSegments.join('/');
    const resolved = path.resolve(rootDir, relPath);

    // The repo's own root is trusted (it's what we cloned/extracted/were
    // given); every path segment coming from the URL is not — this is the
    // actual traversal guard.
    if (resolved !== rootDir && !resolved.startsWith(rootDir + path.sep)) {
      return apiError('Invalid file path.', 'invalid-path', 400);
    }

    let stat;
    try {
      stat = await fs.stat(resolved);
    } catch {
      return apiError('File not found.', 'file-not-found', 404);
    }
    if (!stat.isFile()) {
      return apiError('File not found.', 'file-not-found', 404);
    }

    const content = await fs.readFile(resolved, 'utf8');
    return NextResponse.json({
      path: relPath,
      content,
      sizeBytes: stat.size,
      lineCount: content.length === 0 ? 0 : content.split('\n').length,
    });
  } catch (error) {
    return toApiError(error);
  }
}
