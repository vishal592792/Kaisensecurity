/**
 * Rate Limiter and Account Lockout Guard
 */

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const memoryRateLimitStore = new Map<string, RateLimitRecord>();

// Cleanup stale memory records every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of memoryRateLimitStore.entries()) {
    if (now > record.resetAt) {
      memoryRateLimitStore.delete(key);
    }
  }
}, 300000);

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetSeconds: number;
}

/**
 * Check rate limit for a specific identifier (IP, prefix, or account)
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): RateLimitResult {
  const now = Date.now();
  const record = memoryRateLimitStore.get(key);

  if (!record || now > record.resetAt) {
    const resetAt = now + windowSeconds * 1000;
    memoryRateLimitStore.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: limit - 1,
      resetSeconds: windowSeconds
    };
  }

  if (record.count >= limit) {
    const resetSeconds = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
    return {
      allowed: false,
      remaining: 0,
      resetSeconds
    };
  }

  record.count += 1;
  const resetSeconds = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
  return {
    allowed: true,
    remaining: limit - record.count,
    resetSeconds
  };
}

/**
 * Reset rate limit counter (e.g. on successful login)
 */
export function resetRateLimit(key: string): void {
  memoryRateLimitStore.delete(key);
}
