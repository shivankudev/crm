import { redisConnection } from "@/lib/redis";

/**
 * Simple fixed-window counter backed by Redis (already in the stack for
 * BullMQ). Good enough for slowing down credential stuffing / brute force
 * on an internal tool — not trying to be a general-purpose limiter.
 */
export async function checkAndRecordAttempt(
  key: string,
  opts: { limit: number; windowSeconds: number }
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const fullKey = `ratelimit:${key}`;
  const count = await redisConnection.incr(fullKey);
  if (count === 1) {
    await redisConnection.expire(fullKey, opts.windowSeconds);
  }
  if (count > opts.limit) {
    const ttl = await redisConnection.ttl(fullKey);
    return { allowed: false, retryAfterSeconds: ttl > 0 ? ttl : opts.windowSeconds };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

export async function resetAttempts(key: string): Promise<void> {
  await redisConnection.del(`ratelimit:${key}`);
}
