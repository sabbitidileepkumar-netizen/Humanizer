type Bucket = { count: number; expiresAt: number };
const buckets = new Map<string, Bucket>();

/** Per-process guardrail. Production deployments with multiple instances should use a shared limiter. */
export function allowRewrite(key: string, now = Date.now(), max = 12, windowMs = 60_000): boolean {
  if (buckets.size > 1_000) {
    for (const [bucketKey, bucket] of buckets) if (bucket.expiresAt <= now) buckets.delete(bucketKey);
  }
  const current = buckets.get(key);
  if (!current || current.expiresAt <= now) {
    buckets.set(key, { count: 1, expiresAt: now + windowMs });
    return true;
  }
  if (current.count >= max) return false;
  current.count += 1;
  return true;
}
