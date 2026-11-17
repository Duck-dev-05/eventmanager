/**
 * Small in-process fixed-window limiter for credential endpoints.
 *
 * Deliberately dependency-free: it protects a single Node process (which is
 * how this app is deployed today — see docs/BACKUP_AND_DEPLOYMENT.md). If the
 * app is ever run as several instances, move this to a shared store.
 */

type Bucket = { count: number; resetAt: number };

const globalForRateLimits = globalThis as unknown as {
  eventpulseRateLimits?: Map<string, Bucket>;
};

function buckets() {
  globalForRateLimits.eventpulseRateLimits ??= new Map();
  return globalForRateLimits.eventpulseRateLimits;
}

export type RateLimitResult =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterSeconds: number };

/** Counts one hit against `key`. Call it before doing the expensive work. */
export function checkRateLimit({
  key,
  limit,
  windowMs,
  now = Date.now(),
}: {
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
}): RateLimitResult {
  const store = buckets();

  // Keep the map from growing forever on a long-running process.
  if (store.size > 5000) {
    for (const [entryKey, bucket] of store) {
      if (bucket.resetAt <= now) store.delete(entryKey);
    }
  }

  const bucket = store.get(key);

  if (!bucket || bucket.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  return { allowed: true, remaining: limit - bucket.count };
}

/** Clears a bucket after a successful attempt so honest users are not punished. */
export function resetRateLimit(key: string) {
  buckets().delete(key);
}

export function retryMessage(retryAfterSeconds: number) {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}
