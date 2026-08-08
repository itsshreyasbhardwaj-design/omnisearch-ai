import { describe, expect, it, vi } from 'vitest';
import { OmniSearchApiError, OmniSearchClient } from '../src/index';

function jsonResponse(body: unknown, init: { status?: number; setCookie?: string } = {}) {
  const headers = new Headers();
  if (init.setCookie) headers.set('set-cookie', init.setCookie);
  return new Response(JSON.stringify(body), { status: init.status ?? 200, headers });
}

describe('OmniSearchClient', () => {
  it('sends the query, mode, and filters exactly as given', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        query: 'authenticateUser',
        mode: 'text',
        results: [],
        truncated: false,
        tookMs: 3,
      }),
    );
    const client = new OmniSearchClient({ baseUrl: 'http://localhost:3000', fetchImpl });

    await client.search('authenticateUser', 'text', { filters: { language: 'typescript' } });

    expect(fetchImpl).toHaveBeenCalledWith(
      'http://localhost:3000/api/search',
      expect.objectContaining({ method: 'POST' }),
    );
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      query: 'authenticateUser',
      mode: 'text',
      filters: { language: 'typescript' },
    });
  });

  it('symbolSearch/semanticSearch/hybridSearch/regexSearch set the right mode', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ query: 'x', mode: 'symbol', results: [], truncated: false, tookMs: 1 }),
      );
    const client = new OmniSearchClient({ baseUrl: 'http://localhost:3000', fetchImpl });

    await client.symbolSearch('x');
    expect(JSON.parse((fetchImpl.mock.calls[0]?.[1] as RequestInit).body as string).mode).toBe(
      'symbol',
    );

    await client.semanticSearch('x');
    expect(JSON.parse((fetchImpl.mock.calls[1]?.[1] as RequestInit).body as string).mode).toBe(
      'semantic',
    );

    await client.hybridSearch('x');
    expect(JSON.parse((fetchImpl.mock.calls[2]?.[1] as RequestInit).body as string).mode).toBe(
      'hybrid',
    );

    await client.regexSearch('x');
    expect(JSON.parse((fetchImpl.mock.calls[3]?.[1] as RequestInit).body as string).mode).toBe(
      'regex',
    );
  });

  it('captures the session cookie on login and replays it on later requests', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          { user: { id: 'u1', email: 'a@b.com', createdAt: '2026-01-01' } },
          { setCookie: 'omnisearch_session=abc123; Path=/; HttpOnly' },
        ),
      )
      .mockResolvedValueOnce(jsonResponse({ repositories: [] }));

    const client = new OmniSearchClient({ baseUrl: 'http://localhost:3000', fetchImpl });
    const user = await client.login('a@b.com', 'password123');
    expect(user.email).toBe('a@b.com');

    await client.listRepositories();
    const [, secondInit] = fetchImpl.mock.calls[1] as [string, RequestInit];
    const headers = new Headers(secondInit.headers);
    expect(headers.get('Cookie')).toBe('omnisearch_session=abc123');
  });

  it('throws OmniSearchApiError with the server-provided message and code on failure', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ error: { message: 'Nope', code: 'nope' } }, { status: 400 }),
      );
    const client = new OmniSearchClient({ baseUrl: 'http://localhost:3000', fetchImpl });

    await expect(client.search('x')).rejects.toMatchObject({
      message: 'Nope',
      code: 'nope',
      status: 400,
    });
    await expect(client.search('x')).rejects.toBeInstanceOf(OmniSearchApiError);
  });
});
