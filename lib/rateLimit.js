import redis from '@/lib/redis';

export async function checkFixedWindowRateLimit({ key, limit, windowSeconds }) {
  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, windowSeconds);
    }

    return {
      allowed: count <= limit,
      count,
      limit,
    };
  } catch (err) {
    console.error('Rate limit check failed:', err);
    return {
      allowed: true,
      count: 0,
      limit,
      degraded: true,
    };
  }
}
