import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 } as const;

/**
 * scrypt (Node's built-in `crypto.scryptSync`) rather than bcrypt — it's a
 * memory-hard KDF with no extra native dependency beyond better-sqlite3,
 * which matters for a tool whose whole pitch is "clone, install, run."
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, KEY_LENGTH, SCRYPT_PARAMS);
  return `scrypt:${salt.toString('hex')}:${derived.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, saltHex, hashHex] = parts;
  if (!saltHex || !hashHex) return false;

  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(password, salt, expected.length, SCRYPT_PARAMS);

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function isPasswordStrongEnough(password: string): boolean {
  return password.length >= 8;
}
