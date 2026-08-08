import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { dataDir, sessionSecretPath } from '@/lib/paths';

export const SESSION_COOKIE = 'omnisearch_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface SessionPayload extends JWTPayload {
  sub: string;
  email: string;
}

let cachedSecret: Uint8Array | null = null;

/**
 * No secret in the environment → generate one and persist it to the data
 * dir (0600) so restarts keep the same sessions instead of logging every
 * user out. This is the local-first default; production/shared deployments
 * should set OMNISEARCH_SESSION_SECRET explicitly (see .env.example).
 */
function getSecret(): Uint8Array {
  if (cachedSecret) return cachedSecret;

  const fromEnv = process.env.OMNISEARCH_SESSION_SECRET;
  if (fromEnv && fromEnv.length >= 16) {
    cachedSecret = new TextEncoder().encode(fromEnv);
    return cachedSecret;
  }

  const secretPath = sessionSecretPath();
  fs.mkdirSync(dataDir(), { recursive: true });

  if (fs.existsSync(secretPath)) {
    cachedSecret = new Uint8Array(fs.readFileSync(secretPath));
    return cachedSecret;
  }

  const generated = randomBytes(32);
  fs.writeFileSync(secretPath, generated, { mode: 0o600 });
  cachedSecret = new Uint8Array(generated);
  return cachedSecret;
}

export async function createSessionToken(userId: string, email: string): Promise<string> {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify<SessionPayload>(token, getSecret());
    if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') return null;
    return payload;
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  };
}
