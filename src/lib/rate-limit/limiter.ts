/**
 * In-memory fixed-window rate limiter. No Redis: this app targets a single
 * local/self-hosted instance, and a per-process limiter is enough to blunt
 * brute-force and runaway-search abuse without adding an external service.
 * A multi-instance deployment would need a shared store instead.
 */

interface Bucket {
  count: number;
  windowStart: number;
}

declare global {
  var __omnisearchRateLimitBuckets: Map<string, Bucket> | undefined;
}

function buckets(): Map<string, Bucket> {
  if (!globalThis.__omnisearchRateLimitBuckets) {
    globalThis.__omnisearchRateLimitBuckets = new Map();
  }
  return globalThis.__omnisearchRateLimitBuckets;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function checkRateLimit(key: string, limitPerMinute: number): RateLimitResult {
  const now = Date.now();
  const windowMs = 60_000;
  const store = buckets();
  const existing = store.get(key);

  if (!existing || now - existing.windowStart >= windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: limitPerMinute - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= limitPerMinute) {
    const retryAfterSeconds = Math.ceil((existing.windowStart + windowMs - now) / 1000);
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  existing.count += 1;
  return { allowed: true, remaining: limitPerMinute - existing.count, retryAfterSeconds: 0 };
}

export function clientKeyFromRequest(request: Request, scope: string): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0]?.trim() : 'local';
  return `${scope}:${ip ?? 'unknown'}`;
}
