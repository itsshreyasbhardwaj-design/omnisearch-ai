import { describe, expect, it } from 'vitest';
import { looksCatastrophic, validateRegexSyntax } from '@/lib/search/regexSafety';

describe('looksCatastrophic', () => {
  it('flags classic nested-quantifier ReDoS shapes', () => {
    expect(looksCatastrophic('(a+)+')).toBe(true);
    expect(looksCatastrophic('(a*)*')).toBe(true);
    expect(looksCatastrophic('(a+)*b')).toBe(true);
  });

  it('does not claim to catch every ReDoS shape — e.g. redundant alternation', () => {
    // (a|a)+ is catastrophic too, but it's not a *nested quantifier* — the
    // worker timeout in regexSearch.ts is what actually catches this one.
    expect(looksCatastrophic('^(a|a)+$')).toBe(false);
  });

  it('allows ordinary patterns', () => {
    expect(looksCatastrophic('TODO|FIXME')).toBe(false);
    expect(looksCatastrophic('function\\s+\\w+\\(')).toBe(false);
    expect(looksCatastrophic('^import .* from')).toBe(false);
    expect(looksCatastrophic('[a-z]+@[a-z]+\\.[a-z]+')).toBe(false);
  });
});

describe('validateRegexSyntax', () => {
  it('returns null for valid patterns', () => {
    expect(validateRegexSyntax('foo.*bar', 'i')).toBeNull();
  });

  it('returns an error message for invalid patterns', () => {
    expect(validateRegexSyntax('(unclosed', '')).not.toBeNull();
  });

  it('returns an error message for invalid flags', () => {
    expect(validateRegexSyntax('foo', 'q')).not.toBeNull();
  });
});
