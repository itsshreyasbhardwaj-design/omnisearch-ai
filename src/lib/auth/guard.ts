import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { findUserById } from './users';
import { SESSION_COOKIE, verifySessionToken } from './session';
import type { PublicUser } from './users';

export class UnauthorizedError extends Error {
  constructor(message = 'Authentication required.') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/** Server Components / Server Actions: resolves the signed-in user, or null. */
export async function getCurrentUser(): Promise<PublicUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = await verifySessionToken(token);
  if (!payload) return null;

  const row = findUserById(payload.sub);
  if (!row) return null;

  return { id: row.id, email: row.email, createdAt: row.created_at };
}

/** Route handlers: same resolution, but throws so callers can 401 uniformly. */
export async function requireUser(): Promise<PublicUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export function unauthorizedResponse(message = 'Authentication required.'): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}
