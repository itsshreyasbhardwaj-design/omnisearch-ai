import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/guard';
import { getOwnedRepository } from '@/lib/repos/repoService';
import { listFilesForRepo } from '@/lib/repos/files';
import { toApiError } from '@/lib/api/errors';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await params;
    getOwnedRepository(user.id, id); // throws 404 if not owned — repo itself isn't needed further

    return NextResponse.json({ files: listFilesForRepo(id) });
  } catch (error) {
    return toApiError(error);
  }
}
