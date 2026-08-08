import { hashPassword, verifyPassword } from './password';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
}

const users = new Map<string, User>();

/** Registers a new user, or throws if the email is already taken. */
export function registerUser(email: string, password: string): User {
  if (users.has(email)) {
    throw new Error('Email already registered');
  }
  const user: User = { id: crypto.randomUUID(), email, passwordHash: hashPassword(password) };
  users.set(email, user);
  return user;
}

/** Authenticates a user by email and password, returning null on failure. */
export function authenticateUser(email: string, password: string): User | null {
  const user = users.get(email);
  if (!user) return null;
  if (!verifyPassword(password, user.passwordHash)) return null;
  return user;
}

// TODO: add rate limiting to authenticateUser before this ships to production.
export function validateSessionToken(token: string): boolean {
  // FIXME: this is a placeholder — real token validation happens in session.ts
  return token.length > 0;
}
