import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'tests/fixtures/**',
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
    '.omnisearch/**',
    '.omnisearch-e2e/**',
    // packages/* are separate workspace members with their own lint/build
    // tooling (see packages/sdk) — the root app's eslint config doesn't
    // apply to them.
    'packages/**',
    // Plain CommonJS Node worker script loaded by filesystem path at
    // runtime (see src/lib/search/regexSearch.ts) — not part of the
    // TS/ESM app graph, so TypeScript-aware rules like no-require-imports
    // don't apply to it.
    'src/lib/search/regexWorker.cjs',
  ]),
]);

export default eslintConfig;
