/**
 * Fast, synchronous pre-flight check for the classic catastrophic-backtracking
 * shapes — a quantified group that is itself quantified, e.g. `(a+)+`,
 * `(a*)*`, `(a+)*`. This is a heuristic, not a proof: it catches the common
 * cases immediately with a clear error instead of waiting for the worker
 * timeout, but the timeout in `regexSearch.ts` is the real backstop for
 * patterns this doesn't recognize.
 */
const NESTED_QUANTIFIER = /\([^()]*[+*][^()]*\)[+*]/;

export function looksCatastrophic(pattern: string): boolean {
  return NESTED_QUANTIFIER.test(pattern);
}

export function validateRegexSyntax(pattern: string, flags: string): string | null {
  try {
    new RegExp(pattern, flags);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'Invalid regular expression.';
  }
}
