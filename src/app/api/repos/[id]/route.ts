import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/guard';
import { deleteRepository, getOwnedRepository } from '@/lib/repos/repoService';
import { toApiError } from '@/lib/api/errors';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await params;
    return NextResponse.json({ repository: getOwnedRepository(user.id, id) });
  } catch (error) {
    return toApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await deleteRepository(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toApiError(error);
  }
}
