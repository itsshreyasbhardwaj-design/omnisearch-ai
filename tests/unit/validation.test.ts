import { describe, expect, it } from 'vitest';
import { loginSchema, registerSchema } from '@/lib/validation/auth';
import { createRepoSchema } from '@/lib/validation/repos';
import { searchRequestSchema } from '@/lib/validation/search';

describe('auth schemas', () => {
  it('accepts a valid registration', () => {
    const result = registerSchema.safeParse({ email: 'Ada@Example.com', password: 'longenough' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe('ada@example.com');
  });

  it('rejects a short password on register', () => {
    expect(registerSchema.safeParse({ email: 'a@b.com', password: 'short' }).success).toBe(false);
  });

  it('rejects an invalid email', () => {
    expect(
      registerSchema.safeParse({ email: 'not-an-email', password: 'longenough' }).success,
    ).toBe(false);
  });

  it('login allows any non-empty password (length is not re-validated)', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true);
  });
});

describe('createRepoSchema', () => {
  it('accepts a public GitHub URL', () => {
    const result = createRepoSchema.safeParse({
      sourceType: 'github',
      url: 'https://github.com/vercel/next.js',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a non-GitHub URL', () => {
    const result = createRepoSchema.safeParse({
      sourceType: 'github',
      url: 'https://gitlab.com/vercel/next.js',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a github URL with a path-traversal-like segment', () => {
    const result = createRepoSchema.safeParse({
      sourceType: 'github',
      url: 'https://github.com/../../etc/passwd',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a local path', () => {
    const result = createRepoSchema.safeParse({ sourceType: 'local', path: '/Users/me/code/app' });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown sourceType', () => {
    const result = createRepoSchema.safeParse({ sourceType: 'ftp', path: '/x' });
    expect(result.success).toBe(false);
  });
});

describe('searchRequestSchema', () => {
  it('defaults regexFlags and filters when omitted', () => {
    const result = searchRequestSchema.parse({ query: 'foo', mode: 'text' });
    expect(result.regexFlags).toBe('');
    expect(result.filters).toEqual({});
  });

  it('rejects an empty query', () => {
    expect(searchRequestSchema.safeParse({ query: '', mode: 'text' }).success).toBe(false);
  });

  it('rejects unsupported regex flags', () => {
    expect(
      searchRequestSchema.safeParse({ query: 'x', mode: 'regex', regexFlags: 'z' }).success,
    ).toBe(false);
  });

  it('accepts valid regex flags', () => {
    expect(
      searchRequestSchema.safeParse({ query: 'x', mode: 'regex', regexFlags: 'gi' }).success,
    ).toBe(true);
  });
});
