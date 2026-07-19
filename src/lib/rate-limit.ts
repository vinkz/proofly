import 'server-only';

/**
 * Best-effort in-memory sliding-window rate limiter for public endpoints that
 * proxy paid third-party APIs (e.g. address lookup). It curbs naive hammering
 * from a single source and keeps a scripted loop from draining a provider's key
 * balance during launch.
 *
 * Caveat: state is per-instance. Under Fluid Compute a client spread across
 * several warm instances gets a proportionally higher effective limit, and cold
 * starts reset the window. For hard multi-instance guarantees, move this to a
 * shared store (Upstash Redis) or a Vercel WAF rate-limit rule. This is a floor,
 * not a ceiling.
 */

type Hit = { count: number; resetAt: number };

const buckets = new Map<string, Hit>();

// Bound memory: evict expired buckets once the map grows past this many keys.
const MAX_TRACKED_KEYS = 10_000;

function sweep(now: number) {
  if (buckets.size < MAX_TRACKED_KEYS) return;
  for (const [key, hit] of buckets) {
    if (hit.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    return { ok: false, remaining: 0, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) };
  }

  existing.count += 1;
  return { ok: true, remaining: limit - existing.count, retryAfterSeconds: 0 };
}

/**
 * Derives a best-effort client identifier from the platform-provided forwarding
 * headers. On Vercel `x-forwarded-for` is set from the edge and cannot be spoofed
 * by the client for the left-most entry; we take the first hop.
 */
export function clientKeyFromRequest(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}
