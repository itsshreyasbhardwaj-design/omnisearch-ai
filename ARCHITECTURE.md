# Architecture

This document describes how OmniSearch is put together today (text + regex
search, local-first) and where the seams are for what's not built yet
(symbol/semantic/hybrid search, AI Q&A, MCP, SDK — see the README roadmap).

## Module boundaries

```
src/
  app/            Next.js App Router — pages and API routes only.
                  Route handlers are thin: parse input, call a lib/ service,
                  shape the response. No business logic lives here.
  components/     React components. UI only — no database access, no
                  filesystem access. Talk to the server via fetch() to the
                  API routes, or receive server-fetched data as props.
  lib/
    db/           SQLite connection + migrations. The only module that
                  opens a database handle.
    auth/         Password hashing, session (JWT) issuance/verification,
                  the requireUser()/getCurrentUser() guards.
    ingestion/    Turns a source (GitHub URL, local path, ZIP) into files
                  on disk: cloning, extraction, gitignore-aware filtering,
                  language detection.
    indexing/     Turns files on disk into search index rows: chunking,
                  content-hash diffing (incremental re-index), FTS5
                  population.
    search/       Query time: the SearchProvider interface, the SQLite FTS5
                  text provider, the worker-thread regex engine, ranking,
                  and HTML-safe snippet highlighting.
    repos/        Repository CRUD + the ownership boundary
                  (getOwnedRepository) every route goes through.
    validation/   Zod schemas for every API route's input.
    rate-limit/   In-memory per-process rate limiter.
```

The rule that matters most: **`lib/` never imports from `app/` or
`components/`.** Everything under `lib/` is plain TypeScript that could run
outside Next.js — which is exactly what `scripts/seed-demo.ts` does, calling
straight into `lib/auth` and `lib/repos` without going through HTTP.

## Data flow: adding a repository

```
POST /api/repos
  → lib/validation/repos.ts     (zod: which source type, is the URL/path sane)
  → lib/ingestion/{github,zip,localPath}.ts
       github: git clone --depth 1 (execFile, argv array, no shell)
       zip:    unzipper, with a zip-slip path check on every entry
       local:  validated to exist and be a directory; read in place
  → lib/indexing/indexer.ts
       walk the tree (lib/ingestion/fileFilter.ts: gitignore + binary +
       size filtering) → hash each file → lib/indexing/incremental.ts
       diffs against what's already indexed → unchanged files are
       skipped entirely → changed/new files are chunked
       (lib/indexing/chunking.ts, ~60-line windows) → chunks written to
       the chunks_fts FTS5 virtual table
  → repositories row flips pending → indexing → ready (or error, with
    the message preserved)
```

Re-running this (`POST /api/repos/:id/reindex`) is the same pipeline —
incremental indexing isn't a separate mode, it's just what the content-hash
diff does on every run.

## Data flow: search

```
POST /api/search
  → lib/validation/search.ts    (mode: text | regex, filters, repo scope)
  → ownership check: unscoped search only ever sees repos owned by the
    caller; a repoId-scoped search re-checks ownership of that one repo
  → text mode:  lib/search/sqliteFtsProvider.ts
                  FTS5 MATCH + bm25() ranking + snippet(), every query
                  token quoted so user text can't be parsed as FTS5 query
                  syntax (AND/OR/NOT/prefix*/column:)
  → regex mode: lib/search/regexSearch.ts
                  1. reject syntactically invalid patterns
                  2. reject the classic nested-quantifier ReDoS shape
                     (lib/search/regexSafety.ts) before ever running it
                  3. spawn regexWorker.cjs in a worker_thread per repo,
                     with a hard wall-clock timeout — the worker gets
                     forcibly terminated if it doesn't finish, which is
                     the real backstop for patterns step 2 didn't catch
  → both paths produce SearchResult[] with a pre-escaped, <mark>-wrapped
    snippetHtml (lib/search/highlight.ts) — nothing renders raw file
    content as HTML anywhere else
  → recorded to search_history for the calling user
```

## The `SearchProvider` seam

```ts
interface SearchProvider {
  search(query, repos, filters): Promise<{ results; truncated }>;
}
```

`sqliteFtsProvider` implements this today. Symbol search, semantic search, and
hybrid ranking (phases 3-5 of the roadmap) are additional providers behind the
same interface — the API route and every UI component that renders a
`SearchResult` don't need to change when one is added, because the
`matchType` field (`'TEXT MATCH' | 'REGEX MATCH'`, extended later) is already
how results announce which provider produced them.

Language detection is the same shape: `lib/ingestion/languageDetect.ts` is a
flat extension → language table today; a `LanguageParser` interface for
AST-aware extraction (phase 3) slots in without touching the indexer's
control flow, because the indexer only depends on the `language` string it
gets back.

## Storage

SQLite (`better-sqlite3`) is the only datastore. One file:
`<OMNISEARCH_DATA_DIR>/omnisearch.db`. Full-text search is SQLite's own FTS5
extension — no separate search service, no vector database, nothing to run
alongside the Next.js process. `git clone`d and extracted repositories live
as plain files under `<OMNISEARCH_DATA_DIR>/repos/<repoId>/`; local-path
repositories are read from wherever they already are on disk.

This is a deliberate simplification for the current phase, not a permanent
constraint — `resolveRepoRoot()` and the `SearchProvider` interface are the
two seams a Postgres + pgvector backend would plug into later without a
rewrite (see the README roadmap).

## Why not a job queue

Indexing runs synchronously inside the `POST /api/repos` request handler.
There's no background worker, no queue, no polling endpoint. For a
self-hosted tool indexing repositories at the scale a single developer or
small team works with, this is simpler and has fewer moving parts than a job
queue — the tradeoff is a slower HTTP response while a large repository
indexes. If that stops being the right tradeoff, `indexRepository()` in
`lib/indexing/indexer.ts` is already the one function a queue would call.
