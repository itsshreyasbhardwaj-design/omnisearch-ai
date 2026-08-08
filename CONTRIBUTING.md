# Contributing to OmniSearch AI

Thanks for wanting to help. This guide covers what you need to get productive
quickly.

By participating you agree to the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Setup

```bash
git clone https://github.com/<your-username>/omnisearch-ai.git
cd omnisearch-ai
pnpm install
pnpm seed:demo   # indexes the bundled demo repo under a demo account
pnpm dev
```

Node.js 20+ and pnpm 11+. Nothing else — no database to install, no API key,
no account. See [`.env.example`](./.env.example) for what's configurable
(everything in it is optional).

## Before you open a pull request

```bash
pnpm verify
```

That runs format-check, lint, typecheck, tests, and a production build in
sequence — exactly what CI does. For end-to-end tests:

```bash
pnpm test:e2e
```

## Good first contributions

**A language for `LANGUAGE_BY_EXTENSION`** in
[`src/lib/ingestion/languageDetect.ts`](./src/lib/ingestion/languageDetect.ts)
— a one-line data change if OmniSearch doesn't recognize an extension you use.

**A search filter** — the API and `SearchFilters` type already carry
`language`/`directory`/`fileExtension`; a filter the UI doesn't expose yet is
a small, self-contained addition in
[`src/components/search/search-panel.tsx`](./src/components/search/search-panel.tsx).

**A `SearchProvider`** — symbol search, semantic search, and hybrid ranking
are the biggest gaps against the long-term vision (see the README roadmap).
[ARCHITECTURE.md](./ARCHITECTURE.md#the-searchprovider-seam) explains the
interface it needs to implement.

## Architecture rules

These are enforced by review, and breaking them is the main reason a pull
request gets change requests.

1. **`lib/` does not import from `app/` or `components/`.** Everything under
   `lib/` should be usable from a plain script — `scripts/seed-demo.ts` is
   the proof: it calls straight into `lib/auth` and `lib/repos` with no HTTP
   involved.
2. **Every route that touches a repository calls `getOwnedRepository()`**
   (or a helper that does), never a raw `SELECT * FROM repositories WHERE
id = ?`. This is the entire cross-user isolation guarantee — see
   [SECURITY.md](./SECURITY.md).
3. **Snippets and file content only reach the DOM through
   `src/lib/search/highlight.ts`'s escaping helpers**, or through a
   component that escapes on its own (the code viewer highlights via Shiki,
   which escapes). No new `dangerouslySetInnerHTML` fed from unescaped
   indexed content.
4. **No feature ships half-working.** If a search mode, filter, or button
   doesn't actually do what it says, it doesn't go in the UI — see "No fake
   features" in the README.

## Commit style

[Conventional Commits](https://www.conventionalcommits.org/):
`feat(search): add directory filter`, `fix(ingestion): handle empty zip`,
`ci: cache playwright browsers`.
