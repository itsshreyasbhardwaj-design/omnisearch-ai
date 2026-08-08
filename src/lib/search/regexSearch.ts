import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { getDb } from '@/lib/db/client';
import { looksCatastrophic, validateRegexSyntax } from './regexSafety';
import { highlightSpan } from './highlight';
import type { SearchFilters, SearchResult } from './types';

const WORKER_PATH = path.join(process.cwd(), 'src/lib/search/regexWorker.cjs');
const TIMEOUT_MS = 5_000;
const MAX_MATCHES_PER_REPO = 100;
const MAX_FILES_SCANNED_PER_REPO = 8_000;
const RESULT_CAP = 100;

export class InvalidRegexError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidRegexError';
  }
}

interface CandidateFile {
  path: string;
  language: string | null;
}

function candidateFiles(repoId: string, filters: SearchFilters): CandidateFile[] {
  const conditions = ['repo_id = ?'];
  const params: (string | number)[] = [repoId];

  if (filters.language) {
    conditions.push('language = ?');
    params.push(filters.language);
  }
  if (filters.directory) {
    conditions.push("path LIKE ? ESCAPE '\\'");
    params.push(
      `${filters.directory.replace(/^\/+|\/+$/g, '').replace(/[\\%_]/g, (c) => `\\${c}`)}/%`,
    );
  }
  if (filters.fileExtension) {
    conditions.push("path LIKE ? ESCAPE '\\'");
    params.push(
      `%.${filters.fileExtension.replace(/^\./, '').replace(/[\\%_]/g, (c) => `\\${c}`)}`,
    );
  }

  return getDb()
    .prepare(`SELECT path, language FROM files WHERE ${conditions.join(' AND ')} LIMIT ?`)
    .all(...params, MAX_FILES_SCANNED_PER_REPO) as CandidateFile[];
}

interface WorkerDoneMessage {
  type: 'done';
  results: {
    path: string;
    language: string | null;
    lineNumber: number;
    lineText: string;
    matchStart: number;
    matchLength: number;
  }[];
  filesScanned: number;
  truncated: boolean;
}
interface WorkerErrorMessage {
  type: 'error';
  message: string;
}

/**
 * `timeoutMs` is a parameter (not just the module constant) so tests can
 * exercise the real termination path — a genuinely catastrophic pattern
 * against a short budget — without waiting out the production timeout.
 */
export function runWorkerForRepo(
  rootDir: string,
  files: CandidateFile[],
  pattern: string,
  flags: string,
  timeoutMs = TIMEOUT_MS,
): Promise<{ results: WorkerDoneMessage['results']; truncated: boolean; timedOut: boolean }> {
  return new Promise((resolve) => {
    const worker = new Worker(WORKER_PATH, {
      workerData: {
        rootDir,
        files,
        pattern,
        flags,
        maxMatches: MAX_MATCHES_PER_REPO,
        maxFilesScanned: MAX_FILES_SCANNED_PER_REPO,
      },
    });

    let settled = false;
    const finish = (value: {
      results: WorkerDoneMessage['results'];
      truncated: boolean;
      timedOut: boolean;
    }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      resolve(value);
    };

    const timer = setTimeout(() => {
      finish({ results: [], truncated: false, timedOut: true });
    }, timeoutMs);

    worker.on('message', (message: WorkerDoneMessage | WorkerErrorMessage) => {
      if (message.type === 'error') {
        finish({ results: [], truncated: false, timedOut: false });
        return;
      }
      finish({ results: message.results, truncated: message.truncated, timedOut: false });
    });

    worker.on('error', () => {
      finish({ results: [], truncated: false, timedOut: false });
    });
  });
}

export async function searchRegex(
  pattern: string,
  flags: string,
  repos: { id: string; name: string; rootDir: string }[],
  filters: SearchFilters,
): Promise<{ results: SearchResult[]; truncated: boolean; timedOut: boolean }> {
  const syntaxError = validateRegexSyntax(pattern, flags);
  if (syntaxError) throw new InvalidRegexError(syntaxError);
  if (looksCatastrophic(pattern)) {
    throw new InvalidRegexError(
      'This pattern has a nested repeating group (e.g. (a+)+), which can hang on adversarial input. Simplify it and try again.',
    );
  }

  const perRepo = await Promise.all(
    repos.map(async (repo) => {
      const files = candidateFiles(repo.id, filters);
      const outcome = await runWorkerForRepo(repo.rootDir, files, pattern, flags);
      return { repo, outcome };
    }),
  );

  const timedOut = perRepo.some((r) => r.outcome.timedOut);
  let truncated = perRepo.some((r) => r.outcome.truncated);

  const merged: SearchResult[] = [];
  for (const { repo, outcome } of perRepo) {
    for (const match of outcome.results) {
      merged.push({
        repoId: repo.id,
        repoName: repo.name,
        filePath: match.path,
        language: match.language,
        matchType: 'REGEX MATCH',
        score: 100,
        startLine: match.lineNumber,
        endLine: match.lineNumber,
        snippetHtml: highlightSpan(match.lineText, match.matchStart, match.matchLength),
        highlightLine: match.lineNumber,
      });
    }
  }

  if (merged.length > RESULT_CAP) {
    truncated = true;
  }

  return { results: merged.slice(0, RESULT_CAP), truncated, timedOut };
}
