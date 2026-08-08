import { nanoid } from 'nanoid';
import { getDb } from '@/lib/db/client';
import type { UserRow } from '@/types/db';
import { hashPassword, verifyPassword } from './password';

export interface PublicUser {
  id: string;
  email: string;
  createdAt: string;
}

function toPublic(row: UserRow): PublicUser {
  return { id: row.id, email: row.email, createdAt: row.created_at };
}

export function findUserByEmail(email: string): UserRow | undefined {
  return getDb().prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim()) as
    UserRow | undefined;
}

export function findUserById(id: string): UserRow | undefined {
  return getDb().prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
}

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super('An account with this email already exists.');
    this.name = 'EmailAlreadyRegisteredError';
  }
}

export function createUser(email: string, password: string): PublicUser {
  const normalizedEmail = email.toLowerCase().trim();
  if (findUserByEmail(normalizedEmail)) {
    throw new EmailAlreadyRegisteredError();
  }

  const row: UserRow = {
    id: nanoid(),
    email: normalizedEmail,
    password_hash: hashPassword(password),
    created_at: new Date().toISOString(),
  };

  getDb()
    .prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)')
    .run(row.id, row.email, row.password_hash, row.created_at);

  return toPublic(row);
}

export function authenticateUser(email: string, password: string): PublicUser | null {
  const row = findUserByEmail(email);
  if (!row) return null;
  if (!verifyPassword(password, row.password_hash)) return null;
  return toPublic(row);
}

export function toPublicUser(row: UserRow): PublicUser {
  return toPublic(row);
}
