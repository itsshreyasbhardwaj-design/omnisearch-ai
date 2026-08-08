/**
 * Indexes the bundled demo repository (tests/fixtures/demo-repo) under a
 * fixed local demo account so `pnpm seed:demo` gives you something to
 * search immediately — no GitHub URL, no external credentials, nothing to
 * configure. Safe to re-run: it reuses the existing account and repo if
 * both already exist, and re-indexing is a no-op for unchanged files.
 */
import path from 'node:path';
import { getDb } from '../src/lib/db/client';
import { createUser, findUserByEmail } from '../src/lib/auth/users';
import { listRepositoriesForUser, createLocalRepository } from '../src/lib/repos/repoService';

const DEMO_EMAIL = 'demo@omnisearch.local';
const DEMO_PASSWORD = 'omnisearch-demo';
const DEMO_REPO_NAME = 'demo-repo';

async function main() {
  // Touch the DB so migrations run before anything else.
  getDb();

  const existingUser = findUserByEmail(DEMO_EMAIL);
  let userId: string;
  if (existingUser) {
    userId = existingUser.id;
    console.log(`Using existing demo account: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  } else {
    userId = createUser(DEMO_EMAIL, DEMO_PASSWORD).id;
    console.log(`Created demo account: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  }

  const existingRepos = listRepositoriesForUser(userId);
  const existing = existingRepos.find((repo) => repo.name === DEMO_REPO_NAME);

  if (existing) {
    console.log(`"${DEMO_REPO_NAME}" is already indexed (${existing.file_count} files). Skipping.`);
    return;
  }

  const demoRepoPath = path.join(process.cwd(), 'tests/fixtures/demo-repo');
  console.log(`Indexing ${demoRepoPath}…`);
  const repo = await createLocalRepository(userId, demoRepoPath, DEMO_REPO_NAME);

  console.log(`Indexed "${repo.name}": ${repo.file_count} files, ${repo.total_size_bytes} bytes.`);
  console.log('\nStart the app with `pnpm dev`, then sign in with:');
  console.log(`  email:    ${DEMO_EMAIL}`);
  console.log(`  password: ${DEMO_PASSWORD}`);
}

main().catch((error) => {
  console.error('Seeding failed:', error);
  process.exitCode = 1;
});
