import { describe, expect, it } from 'vitest';
import { resolveImportSpecifier } from '@/lib/dependencies/resolver';

describe('resolveImportSpecifier', () => {
  const repoFiles = new Set([
    'src/api/orders.ts',
    'src/auth/authService.ts',
    'src/auth/password.ts',
    'src/utils/index.ts',
  ]);

  it('resolves a relative sibling import with an implied extension', () => {
    expect(resolveImportSpecifier('./authService', 'src/api/orders.ts', repoFiles)).toBeNull(); // wrong dir on purpose below
    expect(resolveImportSpecifier('../auth/authService', 'src/api/orders.ts', repoFiles)).toBe(
      'src/auth/authService.ts',
    );
  });

  it('resolves a directory import to its index file', () => {
    expect(resolveImportSpecifier('./utils', 'src/api/orders.ts', repoFiles)).toBeNull();
    expect(resolveImportSpecifier('../utils', 'src/api/orders.ts', repoFiles)).toBe(
      'src/utils/index.ts',
    );
  });

  it('does not resolve a bare package specifier — that is a real "external" answer', () => {
    expect(resolveImportSpecifier('react', 'src/api/orders.ts', repoFiles)).toBeNull();
  });

  it('returns null when the relative path does not exist in the repo', () => {
    expect(resolveImportSpecifier('./doesNotExist', 'src/api/orders.ts', repoFiles)).toBeNull();
  });
});
