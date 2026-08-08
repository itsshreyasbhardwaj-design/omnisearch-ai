import path from 'node:path';

const CANDIDATE_EXTENSIONS = [
  '',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.py',
  '.go',
  '.rs',
  '.java',
  '.cs',
  '.php',
];
const INDEX_BASENAMES = ['index.ts', 'index.tsx', 'index.js', 'index.jsx', '__init__.py'];

/**
 * Resolves a relative import specifier ('./foo', '../bar') to a repo-relative
 * file path present in the index. Only relative specifiers are attempted —
 * a bare specifier ('react', 'fmt', 'os') names an external package, and
 * reporting that as "unresolved" is the honest answer, not a bug.
 */
export function resolveImportSpecifier(
  specifier: string,
  fromFilePath: string,
  repoFilePaths: ReadonlySet<string>,
): string | null {
  if (!specifier.startsWith('.')) return null;

  const fromDir = path.posix.dirname(fromFilePath);
  const base = path.posix.normalize(path.posix.join(fromDir, specifier));

  for (const ext of CANDIDATE_EXTENSIONS) {
    const candidate = `${base}${ext}`;
    if (repoFilePaths.has(candidate)) return candidate;
  }

  for (const indexFile of INDEX_BASENAMES) {
    const candidate = path.posix.join(base, indexFile);
    if (repoFilePaths.has(candidate)) return candidate;
  }

  return null;
}
