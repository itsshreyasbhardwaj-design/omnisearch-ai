import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import ignore, { type Ignore } from 'ignore';

/** Skipped even if a repo has no .gitignore at all — build output and VCS internals are never source. */
export const DEFAULT_IGNORE_PATTERNS = [
  '.git/',
  'node_modules/',
  'dist/',
  'build/',
  '.next/',
  'out/',
  'target/',
  'vendor/',
  'coverage/',
  '.venv/',
  'venv/',
  '__pycache__/',
  '.pytest_cache/',
  '.cache/',
  '.turbo/',
  '.DS_Store',
  '*.min.js',
  '*.map',
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
];

/** Extensions we never attempt to read as text, regardless of size. */
const BINARY_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'ico',
  'bmp',
  'tiff',
  'avif',
  'mp3',
  'mp4',
  'wav',
  'ogg',
  'webm',
  'mov',
  'avi',
  'mkv',
  'flac',
  'zip',
  'tar',
  'gz',
  'bz2',
  'xz',
  '7z',
  'rar',
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'woff',
  'woff2',
  'ttf',
  'otf',
  'eot',
  'exe',
  'dll',
  'so',
  'dylib',
  'bin',
  'wasm',
  'class',
  'jar',
  'pyc',
  'db',
  'sqlite',
  'sqlite3',
]);

export function isBinaryPath(relPath: string): boolean {
  const match = /\.([a-z0-9]+)$/i.exec(relPath);
  const ext = match?.[1]?.toLowerCase();
  return ext !== undefined && BINARY_EXTENSIONS.has(ext);
}

/** Null bytes in the first chunk are the standard heuristic for "not text." */
export function isBinaryContent(buffer: Buffer): boolean {
  const sampleLength = Math.min(buffer.length, 8000);
  for (let i = 0; i < sampleLength; i += 1) {
    if (buffer[i] === 0) return true;
  }
  return false;
}

export interface FileFilterOptions {
  maxFileSizeBytes: number;
}

export function defaultFilterOptions(): FileFilterOptions {
  const maxKb = Number(process.env.OMNISEARCH_MAX_FILE_SIZE_KB ?? 2048);
  return { maxFileSizeBytes: maxKb * 1024 };
}

export interface DiscoveredFile {
  absPath: string;
  relPath: string;
  sizeBytes: number;
}

/**
 * Walks `rootDir`, layering each directory's own .gitignore onto the base
 * matcher as it's encountered — a reasonable approximation of real gitignore
 * scoping without needing a full git checkout to ask git itself.
 */
export async function walkRepository(
  rootDir: string,
  options: FileFilterOptions = defaultFilterOptions(),
): Promise<DiscoveredFile[]> {
  const baseMatcher = ignore().add(DEFAULT_IGNORE_PATTERNS);
  const results: DiscoveredFile[] = [];

  async function walk(dirAbs: string, dirRel: string, inherited: Ignore) {
    let matcher = inherited;
    const gitignorePath = path.join(dirAbs, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      try {
        const contents = await fsp.readFile(gitignorePath, 'utf8');
        matcher = ignore().add(inherited).add(contents);
      } catch {
        // Unreadable .gitignore shouldn't abort ingestion — fall back to the inherited matcher.
      }
    }

    const entries = await fsp.readdir(dirAbs, { withFileTypes: true });
    for (const entry of entries) {
      const entryRel = dirRel ? `${dirRel}/${entry.name}` : entry.name;
      const matchPath = entry.isDirectory() ? `${entryRel}/` : entryRel;
      if (matcher.ignores(matchPath)) continue;

      const entryAbs = path.join(dirAbs, entry.name);
      if (entry.isSymbolicLink()) continue; // never follow symlinks out of the repo root
      if (entry.isDirectory()) {
        await walk(entryAbs, entryRel, matcher);
        continue;
      }
      if (!entry.isFile()) continue;
      if (isBinaryPath(entryRel)) continue;

      const stat = await fsp.stat(entryAbs);
      if (stat.size === 0 || stat.size > options.maxFileSizeBytes) continue;

      results.push({ absPath: entryAbs, relPath: entryRel, sizeBytes: stat.size });
    }
  }

  await walk(rootDir, '', baseMatcher);
  return results;
}
