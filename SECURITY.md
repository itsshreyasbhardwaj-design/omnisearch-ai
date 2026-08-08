# Security Policy

## Reporting a vulnerability

Please **do not open a public issue** for a security vulnerability.

Report it privately through
[GitHub Security Advisories](https://github.com/itsshreyasbhardwaj-design/omnisearch-ai/security/advisories/new).

Please include:

- What the vulnerability allows an attacker to do
- Steps to reproduce, ideally with a minimal proof of concept
- The affected version or commit

You can expect an acknowledgement within a few days and an assessment within two
weeks. We will keep you informed as a fix progresses and will credit you in the
advisory unless you prefer otherwise.

## Scope

OmniSearch indexes and serves back arbitrary source code — including code it
did not write and content it renders as HTML — so the areas we care most about
are:

- **Cross-repository isolation** — one user reading another user's indexed
  repository, files, or search results
- **Path traversal** — the code-viewer file-serving route, or ZIP extraction,
  escaping the intended repository root
- **Regular-expression denial of service** — a crafted pattern hanging the
  regex-search worker or the server process
- **Cross-site scripting** — indexed source code (which is fundamentally
  untrusted input) reaching the DOM unescaped via a search snippet or the code
  viewer
- **Archive handling** — decompression bombs or resource exhaustion during ZIP
  ingestion
- **Authentication** — session forgery, password hash weaknesses, or
  bypassing the login/registration rate limits

## Design guarantees

These are the properties OmniSearch intends to hold. A reproducible break in
any of them is a valid vulnerability report.

1. **Every repository is owned by exactly one user.** `getOwnedRepository()`
   is the single chokepoint every API route uses before touching a repo's
   files, search index, or metadata; an unowned repo id resolves as
   not-found, never as forbidden, so its existence isn't leaked either.
2. **Search snippets and code are HTML-escaped before a `<mark>` is ever
   inserted.** `src/lib/search/highlight.ts` is the only place that happens —
   there is no `dangerouslySetInnerHTML` fed directly from unescaped file
   content anywhere else in the codebase.
3. **Regex search runs in a `worker_thread` with a hard wall-clock timeout.**
   A pattern that matches the classic nested-quantifier ReDoS shape is
   rejected before it ever runs; anything else that hangs gets the worker
   forcibly terminated instead of blocking the server.
4. **File-serving and ZIP extraction resolve every path against the
   repository root and reject anything that escapes it** (`path traversal` /
   `zip-slip`), before touching the filesystem.
5. **Passwords are hashed with scrypt** (Node's built-in, memory-hard KDF)
   with a random salt per user, verified with a timing-safe comparison.
6. **Sessions are signed JWTs in an `httpOnly`, `sameSite=lax` cookie.** The
   signing secret is either set explicitly or generated once and persisted
   with `0600` permissions — it is never sent to the browser.

## Deployment notes

- Rate limiting (auth and search) is **in-process**. On a multi-instance
  deployment it becomes per-instance rather than global — put a shared
  limiter in front of a public instance.
- **Local-path ingestion reads any directory the server process can read.**
  This is a local developer tool by design (index a folder you already have
  on the machine running it) — do not expose an instance with local-path
  ingestion enabled to untrusted users without adding your own access
  control in front of it.
- GitHub ingestion only clones **public** repositories with no token — no
  GitHub credentials are ever handled by this phase of the app.
- Without `OMNISEARCH_SESSION_SECRET` set explicitly, sessions are tied to
  the generated secret file under the data directory; wiping the data
  directory invalidates every session.
