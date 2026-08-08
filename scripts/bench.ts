/**
 * Relevance evaluation harness: runs benchmarks/queries.json against a
 * freshly-indexed copy of the demo repo fixture and reports Precision@1,
 * Precision@5, MRR, and per-mode latency — the metrics the spec's
 * "RELEVANCE EVALUATION" section asks for, computed for real rather than
 * asserted. A query counts as a "hit" at rank R if `expectedFile` is the
 * R-th result; MRR is the mean of 1/R (0 when not found in the returned set).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { computeRelevanceMetrics } from '../src/lib/evaluation/metrics';

interface BenchmarkCase {
  id: string;
  query: string;
  mode: 'text' | 'regex' | 'symbol' | 'semantic' | 'hybrid';
  regexFlags?: string;
  expectedFile: string;
}

interface CaseResult {
  id: string;
  mode: string;
  rank: number | null;
  latencyMs: number;
}

async function main() {
  const tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'omnisearch-bench-'));
  process.env.OMNISEARCH_DATA_DIR = tempDataDir;

  try {
    const { createUser } = await import('../src/lib/auth/users');
    const { createLocalRepository, resolveRepoRoot } = await import('../src/lib/repos/repoService');
    const { sqliteFtsProvider } = await import('../src/lib/search/sqliteFtsProvider');
    const { symbolProvider } = await import('../src/lib/search/symbolProvider');
    const { semanticProvider } = await import('../src/lib/search/semanticProvider');
    const { hybridProvider } = await import('../src/lib/search/hybridRanking');
    const { searchRegex } = await import('../src/lib/search/regexSearch');

    const user = createUser('bench@omnisearch.local', 'password123');
    const demoRepoPath = path.join(process.cwd(), 'tests/fixtures/demo-repo');
    const repo = await createLocalRepository(user.id, demoRepoPath, 'demo-repo');
    const repoRef = { id: repo.id, name: repo.name, rootDir: resolveRepoRoot(repo) };

    const cases = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'benchmarks/queries.json'), 'utf8'),
    ) as BenchmarkCase[];

    const results: CaseResult[] = [];

    for (const testCase of cases) {
      const startedAt = Date.now();
      let filePaths: string[];

      if (testCase.mode === 'regex') {
        const outcome = await searchRegex(testCase.query, testCase.regexFlags ?? '', [repoRef], {});
        filePaths = outcome.results.map((r) => r.filePath);
      } else {
        const provider = {
          text: sqliteFtsProvider,
          symbol: symbolProvider,
          semantic: semanticProvider,
          hybrid: hybridProvider,
        }[testCase.mode];
        const outcome = await provider.search(testCase.query, [repoRef], {});
        filePaths = outcome.results.map((r) => r.filePath);
      }

      const latencyMs = Date.now() - startedAt;
      const rankIndex = filePaths.indexOf(testCase.expectedFile);
      results.push({
        id: testCase.id,
        mode: testCase.mode,
        rank: rankIndex === -1 ? null : rankIndex + 1,
        latencyMs,
      });
    }

    report(results);
  } finally {
    fs.rmSync(tempDataDir, { recursive: true, force: true });
  }
}

function report(results: CaseResult[]) {
  const metrics = computeRelevanceMetrics(results);

  console.log('\nid'.padEnd(30) + 'mode'.padEnd(10) + 'rank'.padEnd(8) + 'latency');
  console.log('-'.repeat(56));
  for (const r of results) {
    console.log(
      r.id.padEnd(30) + r.mode.padEnd(10) + String(r.rank ?? 'miss').padEnd(8) + `${r.latencyMs}ms`,
    );
  }

  console.log('\n=== Summary ===');
  console.log(`Queries:      ${metrics.queries}`);
  console.log(`Precision@1:  ${metrics.precisionAt1.toFixed(2)}`);
  console.log(`Precision@5:  ${metrics.precisionAt5.toFixed(2)}`);
  console.log(`MRR:          ${metrics.mrr.toFixed(3)}`);
  console.log(`Avg latency:  ${metrics.avgLatencyMs.toFixed(1)}ms`);
}

main().catch((error) => {
  console.error('Benchmark run failed:', error);
  process.exitCode = 1;
});
