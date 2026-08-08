import { NextResponse } from 'next/server';
import { createSessionToken, sessionCookieOptions, SESSION_COOKIE } from '@/lib/auth/session';
import { authenticateUser } from '@/lib/auth/users';
import { loginSchema } from '@/lib/validation/auth';
import { checkRateLimit, clientKeyFromRequest } from '@/lib/rate-limit/limiter';
import { apiError, toApiError } from '@/lib/api/errors';

const AUTH_RATE_LIMIT = Number(process.env.OMNISEARCH_AUTH_RATE_LIMIT_PER_MINUTE ?? 10);

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(clientKeyFromRequest(request, 'auth:login'), AUTH_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return apiError('Too many attempts. Try again shortly.', 'rate-limited', 429, {
      'Retry-After': String(rateLimit.retryAfterSeconds),
    });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { email, password } = loginSchema.parse(body);

    const user = authenticateUser(email, password);
    if (!user) {
      return apiError('Incorrect email or password.', 'invalid-credentials', 401);
    }

    const token = await createSessionToken(user.id, user.email);
    const response = NextResponse.json({ user });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return response;
  } catch (error) {
    return toApiError(error);
  }
}
