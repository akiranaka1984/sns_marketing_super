/**
 * Redis Response Cache Utility
 *
 * Provides TTL-based caching for tRPC query results using Redis.
 * Usage:
 *   const data = await withCache('accounts:list:123', 60, () => db.getAllAccounts(userId));
 */

import Redis from 'ioredis';
import { createLogger } from './logger';

const log = createLogger('cache');

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.REDIS_URL;
  if (!url) {
    log.warn('REDIS_URL not set, caching disabled');
    return null;
  }
  try {
    redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 100, 3000),
      lazyConnect: true,
    });
    redis.on('error', (err) => {
      log.error({ err }, 'Redis connection error');
    });
    return redis;
  } catch {
    log.warn('Failed to create Redis connection for cache');
    return null;
  }
}

/**
 * Execute a function with Redis caching.
 * Falls back to direct execution if Redis is unavailable.
 *
 * @param key - Cache key
 * @param ttlSeconds - Time-to-live in seconds
 * @param fn - Function to execute on cache miss
 */
export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  fn: () => Promise<T>
): Promise<T> {
  const client = getRedis();
  if (!client) return fn();

  const cacheKey = `cache:${key}`;

  try {
    const cached = await client.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as T;
    }
  } catch {
    // Cache read failed, execute function directly
  }

  const result = await fn();

  try {
    await client.setex(cacheKey, ttlSeconds, JSON.stringify(result));
  } catch {
    // Cache write failed, result still valid
  }

  return result;
}

/**
 * Invalidate a cache key or pattern
 */
export async function invalidateCache(pattern: string): Promise<void> {
  const client = getRedis();
  if (!client) return;

  try {
    const keys = await client.keys(`cache:${pattern}`);
    if (keys.length > 0) {
      await client.del(...keys);
    }
  } catch {
    // Invalidation failed, cache will expire naturally
  }
}
