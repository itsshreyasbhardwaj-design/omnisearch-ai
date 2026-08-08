import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/guard';
import { reindexRepository } from '@/lib/repos/repoService';
import { toApiError } from '@/lib/api/errors';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const repository = await reindexRepository(user.id, id);
    return NextResponse.json({ repository });
  } catch (error) {
    return toApiError(error);
  }
}
