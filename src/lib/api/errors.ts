import { NextResponse } from 'next/server';
import { z } from 'zod';
import { UnauthorizedError } from '@/lib/auth/guard';

export interface ApiErrorBody {
  error: { message: string; code: string };
}

export function apiError(
  message: string,
  code: string,
  status: number,
  headers?: Record<string, string>,
): NextResponse<ApiErrorBody> {
  return NextResponse.json({ error: { message, code } }, { status, headers });
}

/** Central error → HTTP response mapping so every route handler shapes errors the same way. */
export function toApiError(error: unknown): NextResponse<ApiErrorBody> {
  if (error instanceof UnauthorizedError) {
    return apiError(error.message, 'unauthorized', 401);
  }
  if (error instanceof z.ZodError) {
    const first = error.issues[0];
    const path = first?.path.join('.') ?? 'request';
    return apiError(`${path}: ${first?.message ?? 'Invalid input.'}`, 'invalid-input', 400);
  }
  if (error instanceof ApiVisibleError) {
    return apiError(error.message, error.code, error.status);
  }

  console.error('[omnisearch] Unhandled API error:', error);
  return apiError('Something went wrong while processing the request.', 'internal', 500);
}

/** Throw this for any expected, user-facing failure (not-found, bad input, conflict, ...). */
export class ApiVisibleError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = 'ApiVisibleError';
    this.code = code;
    this.status = status;
  }
}
