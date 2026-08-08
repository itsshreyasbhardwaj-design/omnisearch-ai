import { describe, expect, it } from 'vitest';
import { findMatchingLine } from '@/lib/search/lineMatch';

describe('findMatchingLine', () => {
  it('finds the line within a chunk that contains a token', () => {
    const chunk = 'const a = 1;\nfunction authenticateUser() {}\nconst b = 2;';
    expect(findMatchingLine(chunk, ['authenticateuser'], 10)).toBe(11);
  });

  it('is case-insensitive', () => {
    const chunk = 'FOO\nBar\nbaz';
    expect(findMatchingLine(chunk, ['bar'], 1)).toBe(2);
  });

  it('falls back to startLine when no token matches', () => {
    const chunk = 'one\ntwo\nthree';
    expect(findMatchingLine(chunk, ['nope'], 5)).toBe(5);
  });

  it('falls back to startLine when given no tokens', () => {
    expect(findMatchingLine('one\ntwo', [], 3)).toBe(3);
  });
});
