import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/guard';
import { getAnalyticsSummary } from '@/lib/analytics/metrics';
import { toApiError } from '@/lib/api/errors';

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json(getAnalyticsSummary(user.id));
  } catch (error) {
    return toApiError(error);
  }
}
