import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/guard';
import { listRecentSearches } from '@/lib/search/history';
import { toApiError } from '@/lib/api/errors';

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json({ history: listRecentSearches(user.id) });
  } catch (error) {
    return toApiError(error);
  }
}
