# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.0] — Phase 1-2

### Added

- Repository ingestion from a public GitHub URL, a local filesystem path, or
  a `.zip` upload, with gitignore-aware filtering, binary/size skipping, and
  incremental (content-hash) re-indexing.
- Text search (SQLite FTS5, `bm25()` ranking, highlighted snippets) and regex
  search (worker-thread isolated, hard timeout, nested-quantifier ReDoS
  pre-check).
- Filters by repository, language, directory, and file extension.
- File explorer and a Shiki-highlighted code viewer with find-in-file and
  GitHub-style `#L10-L24` line links.
- Local account system (scrypt password hashing, signed session cookies) with
  per-user repository isolation.
- Command palette (`⌘K`), `/` to search, dark/light themes.
- Bundled demo repository and `pnpm seed:demo` for a credential-free first run.
- Unit, integration, and end-to-end (Playwright) test suites; CI running
  lint, typecheck, tests, build, and e2e.
