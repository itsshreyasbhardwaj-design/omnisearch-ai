import type { AskResponse, Repository, SearchOptions, SearchResponse, User } from './types';

export * from './types';

export interface OmniSearchClientOptions {
  /** e.g. "http://localhost:3000" — no trailing slash needed. */
  baseUrl: string;
  /** Injectable for testing; defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
}

interface ApiErrorBody {
  error?: { message?: string; code?: string };
}

export class OmniSearchApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = 'OmniSearchApiError';
    this.code = code;
    this.status = status;
  }
}

/**
 * The API authenticates with an httpOnly session cookie, not a bearer
 * token — this client is meant for Node.js callers (a script, a CI job, an
 * MCP server), which can hold and replay that cookie itself. It cannot run
 * in a browser: browsers never expose an httpOnly Set-Cookie value to JS.
 */
export class OmniSearchClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private sessionCookie: string | null = null;

  constructor(options: OmniSearchClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private extractSessionCookie(headers: Headers): string | null {
    const getSetCookie = (headers as { getSetCookie?: () => string[] }).getSetCookie;
    const cookies = getSetCookie ? getSetCookie.call(headers) : null;
    const first = cookies && cookies.length > 0 ? cookies[0] : headers.get('set-cookie');
    if (!first) return null;
    return first.split(';')[0] ?? null;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);
    if (this.sessionCookie) headers.set('Cookie', this.sessionCookie);
    if (init?.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await this.fetchImpl(`${this.baseUrl}${path}`, { ...init, headers });
    const data = (await response.json().catch(() => ({}))) as T & ApiErrorBody;

    if (!response.ok) {
      throw new OmniSearchApiError(
        data.error?.message ?? `Request to ${path} failed with status ${response.status}.`,
        data.error?.code ?? 'unknown',
        response.status,
      );
    }

    return data;
  }

  /** Authenticates and holds the session cookie for subsequent calls on this client instance. */
  async login(email: string, password: string): Promise<User> {
    const response = await this.fetchImpl(`${this.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = (await response.json().catch(() => ({}))) as { user?: User } & ApiErrorBody;
    if (!response.ok) {
      throw new OmniSearchApiError(
        data.error?.message ?? 'Login failed.',
        data.error?.code ?? 'unknown',
        response.status,
      );
    }
    const cookie = this.extractSessionCookie(response.headers);
    if (cookie) this.sessionCookie = cookie;
    if (!data.user)
      throw new OmniSearchApiError('Login response was missing a user.', 'malformed-response', 500);
    return data.user;
  }

  async register(email: string, password: string): Promise<User> {
    const response = await this.fetchImpl(`${this.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = (await response.json().catch(() => ({}))) as { user?: User } & ApiErrorBody;
    if (!response.ok) {
      throw new OmniSearchApiError(
        data.error?.message ?? 'Registration failed.',
        data.error?.code ?? 'unknown',
        response.status,
      );
    }
    const cookie = this.extractSessionCookie(response.headers);
    if (cookie) this.sessionCookie = cookie;
    if (!data.user)
      throw new OmniSearchApiError(
        'Register response was missing a user.',
        'malformed-response',
        500,
      );
    return data.user;
  }

  async search(
    query: string,
    mode: SearchResponse['mode'] = 'text',
    options: SearchOptions = {},
  ): Promise<SearchResponse> {
    return this.request<SearchResponse>('/api/search', {
      method: 'POST',
      body: JSON.stringify({
        query,
        mode,
        repoId: options.repoId,
        repoIds: options.repoIds,
        regexFlags: options.regexFlags,
        filters: options.filters ?? {},
      }),
    });
  }

  async regexSearch(pattern: string, options?: SearchOptions): Promise<SearchResponse> {
    return this.search(pattern, 'regex', options);
  }

  async symbolSearch(query: string, options?: SearchOptions): Promise<SearchResponse> {
    return this.search(query, 'symbol', options);
  }

  async semanticSearch(query: string, options?: SearchOptions): Promise<SearchResponse> {
    return this.search(query, 'semantic', options);
  }

  async hybridSearch(query: string, options?: SearchOptions): Promise<SearchResponse> {
    return this.search(query, 'hybrid', options);
  }

  async ask(question: string, options: SearchOptions = {}): Promise<AskResponse> {
    return this.request<AskResponse>('/api/ask', {
      method: 'POST',
      body: JSON.stringify({
        question,
        repoId: options.repoId,
        repoIds: options.repoIds,
        filters: options.filters ?? {},
      }),
    });
  }

  async listRepositories(): Promise<Repository[]> {
    const data = await this.request<{ repositories: Repository[] }>('/api/repos');
    return data.repositories;
  }

  async getRepository(repoId: string): Promise<Repository> {
    const data = await this.request<{ repository: Repository }>(
      `/api/repos/${encodeURIComponent(repoId)}`,
    );
    return data.repository;
  }
}
