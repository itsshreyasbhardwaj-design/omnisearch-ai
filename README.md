<div align="center">

# OmniSearch AI

**Search your repositories like they're one codebase.**

Text search, regex search, filters, and a code viewer that feels like an IDE —
unified across every repository you connect, running entirely on your own
machine.

[![CI](https://github.com/itsshreyasbhardwaj-design/omnisearch-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/itsshreyasbhardwaj-design/omnisearch-ai/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6.svg)](https://www.typescriptlang.org)
[![Runs at $0](https://img.shields.io/badge/runs%20at-%240-2ed8a7.svg)](#zero-cost-by-default)

</div>

---

> **Screenshot placeholder** — `docs/screenshots/search.png`
>
> The global search page: a text-search query, filtered to one repository,
> with the matched span highlighted in the snippet and the result open in the
> code viewer alongside it.

## Why

Searching a codebase today means switching between `grep`, GitHub's search,
your IDE's search, and a chat window — none of which agree with each other,
and none of which cover more than one repository at a time.

OmniSearch AI unifies that into one fast, keyboard-first search engine for
your repositories: `/` to search, arrow keys to move through results, `⌘K`
for a command palette, and results that tell you exactly why they matched —
file, line range, match type, and a highlighted snippet — not just a file
name.

**This is phase 1-2 of a larger plan** (see [Roadmap](#roadmap)). What's here
today is real and fully working: repository ingestion, text search, regex
search, a file explorer, and a code viewer. Symbol search, semantic search,
AI repository Q&A, and cross-repository search are designed for but not yet
built — the [Search modes](#search-modes) section below is explicit about
which is which.

## Zero cost by default

OmniSearch runs on an empty `.env`. No Postgres, no Redis, no Clerk account,
no OpenRouter key, no Docker, no signup:

- **Storage**: SQLite (`better-sqlite3`) — one file, zero setup. Full-text
  search is SQLite's own FTS5 extension, not a separate service.
- **Auth**: a real local account system (scrypt-hashed passwords, signed
  session cookies) — no Clerk, no external identity provider required to run.
- **Search**: text and regex search run entirely in-process.

This is a deliberate architectural choice, not a limitation waiting to be
lifted — see [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the seams
(`SearchProvider`, `resolveRepoRoot()`) that a Postgres/pgvector/AI backend
would plug into for the later phases, without a rewrite.

## Quick start

```bash
git clone https://github.com/itsshreyasbhardwaj-design/omnisearch-ai.git
cd omnisearch-ai
pnpm install
pnpm seed:demo   # indexes the bundled demo repo, prints a login you can use
pnpm dev
```

Open http://localhost:3000, sign in with the credentials `pnpm seed:demo`
printed, and search. Node.js 20+ and pnpm 11+ — nothing else.

To index your own code instead: sign up, then **Add repository** → a public
GitHub URL, a local path on your machine, or a `.zip` upload.

## Search modes

| Mode                    | Status     | Notes                                                                     |
| ----------------------- | ---------- | ------------------------------------------------------------------------- |
| Text search             | ✅ Built   | SQLite FTS5, `bm25()` ranking, highlighted snippets                       |
| Regex search            | ✅ Built   | Runs in a `worker_thread` with a hard timeout — see [Security](#security) |
| Symbol search           | 🗺️ Planned | AST-aware extraction (phase 3)                                            |
| Semantic search         | 🗺️ Planned | Embeddings + vector similarity (phase 4)                                  |
| Hybrid search           | 🗺️ Planned | Lexical + semantic + symbol + structural (phase 4)                        |
| AI repository questions | 🗺️ Planned | Retrieval-grounded Q&A with citations (phase 5)                           |

Filters (repository, language, directory, file extension) work today across
both built modes. Search history is recorded per account; cross-repository
search, saved searches, and an analytics dashboard are on the roadmap.

## Features

- **Repository ingestion** — public GitHub URL (`git clone --depth 1`, no
  token needed), a local filesystem path, or a `.zip` upload (path-traversal
  and decompression-bomb guarded).
- **Incremental indexing** — every file is content-hashed; re-indexing a
  repository only touches files that actually changed.
- **File explorer** — a real tree, not a flat list.
- **Code viewer** — Shiki syntax highlighting, line numbers, find-in-file,
  GitHub-style `#L10-L24` deep links, copy button.
- **Keyboard-first** — `/` focuses search, `⌘K`/`Ctrl K` opens the command
  palette, arrow keys move through results, `Enter` opens the focused one.
- **Dark and light themes.**
- **Per-user isolation** — every repository is owned by exactly one account;
  see [`SECURITY.md`](./SECURITY.md) for the guarantee and how it's enforced.

## Architecture

Ingestion, indexing, search, and the API are separate `lib/` modules with a
one-way dependency rule (`lib/` never imports from `app/` or `components/`) —
see [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full data-flow diagrams and
the `SearchProvider` interface that later search modes implement.

```
Repository source → ingestion → indexing (chunk + hash + FTS5) → search
                                                                  ↑
                                          API routes (ownership-checked) ↔ UI
```

## Configuration

Every variable in [`.env.example`](./.env.example) is optional. Copy it to
`.env` only if you want to change a default (data directory, upload/file size
limits, rate limits) or set an explicit session secret for a shared
deployment.

## Development

```bash
pnpm dev             # start the dev server
pnpm test            # unit + integration tests (vitest)
pnpm test:coverage   # ...with a coverage report
pnpm test:e2e        # end-to-end tests (playwright) — builds + starts the app
pnpm verify           # format check + lint + typecheck + test + build — what CI runs
```

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the architecture rules
contributions are expected to follow.

## Roadmap

Phases below match the original project plan; **1-2 are built**, 3-7 are not.

- [x] **Phase 1-2** — architecture, auth, database, repository ingestion, text
      search, regex search, file explorer, code viewer
- [ ] **Phase 3** — AST parsing, symbol extraction, dependency graph
- [ ] **Phase 4** — embeddings, semantic search, hybrid retrieval (Postgres +
      pgvector)
- [ ] **Phase 5** — AI repository questions with citation validation
      (OpenRouter)
- [ ] **Phase 6** — cross-repository search, analytics dashboard, MCP server,
      TypeScript SDK
- [ ] **Phase 7** — performance hardening, expanded security review, full
      accessibility pass

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## Security

See [`SECURITY.md`](./SECURITY.md) for the threat model, the guarantees this
codebase intends to hold, and how to report a vulnerability privately.

## License

[MIT](./LICENSE)
