import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth/session';

// Proxy (formerly "Middleware") always runs on the Node.js runtime as of
// Next.js 16, which is what lets this read the auto-generated session
// secret from disk via the same session.ts route handlers use.
const PUBLIC_PATHS = new Set(['/login', '/register']);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  const isAuthed = session !== null;

  if (pathname === '/') {
    return NextResponse.redirect(new URL(isAuthed ? '/dashboard' : '/login', request.url));
  }

  if (PUBLIC_PATHS.has(pathname)) {
    if (isAuthed) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  if (!isAuthed) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
