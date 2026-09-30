// Best-effort in-memory fixed-window limiter. Per server instance only (resets on cold start),
// which is enough to slow down token guessing against the public ingest endpoint.
const buckets = new Map<string, { count:number; resetAt:number }>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  if (buckets.size > 5000) for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  bucket.count++;
  return { ok: bucket.count <= limit, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
}

/** True when `key` already used up its window, without counting this call. */
export function isLimited(key: string, limit: number) {
  const bucket = buckets.get(key);
  return !!bucket && bucket.resetAt > Date.now() && bucket.count >= limit;
}

export function clientIp(req: Request) {
  return (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
}
