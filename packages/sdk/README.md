# @omnisearch/sdk

A small, fully-typed Node.js client for the OmniSearch AI REST API.

```ts
import { OmniSearchClient } from '@omnisearch/sdk';

const omni = new OmniSearchClient({ baseUrl: 'http://localhost:3000' });
await omni.login('you@example.com', 'your-password');

const repos = await omni.listRepositories();

const results = await omni.search('authenticateUser');
const symbols = await omni.symbolSearch('authenticateUser');
const semantic = await omni.semanticSearch("verify a user's credentials");
const hybrid = await omni.hybridSearch('authenticateUser');
const regex = await omni.regexSearch('TODO|FIXME');

const answer = await omni.ask('Where is authentication implemented?');
console.log(answer.synthesized ? answer.summary : 'Evidence:', answer.citations);
```

## Notes

- This is a **Node.js client**, not a browser one: the API authenticates
  with an `httpOnly` session cookie, and browsers never expose an `httpOnly`
  `Set-Cookie` value to JavaScript. `login()`/`register()` capture the
  cookie and replay it on later requests made with the same client
  instance.
- Every method mirrors a real endpoint on the running OmniSearch server —
  nothing here is mocked or aspirational. See the root
  [`ARCHITECTURE.md`](../../ARCHITECTURE.md) for what each search mode
  actually does server-side.

## Development

```bash
pnpm --filter @omnisearch/sdk build      # tsc → dist/
pnpm --filter @omnisearch/sdk typecheck
pnpm --filter @omnisearch/sdk test
```
