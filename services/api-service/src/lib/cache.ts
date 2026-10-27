import { redis } from './redis';

const BOARD_CACHE_TTL_SECONDS = 3600; // 1 hour TTL

export function boardCacheKey(boardId: string): string {
  return `board:${boardId}`;
}

/**
 * Fetches a board aggregate from Redis cache.
 * Returns the parsed value on a cache HIT, or null on a cache MISS.
 * Instructs caller whether to read from Postgres.
 */
export async function getCachedBoard<T>(boardId: string): Promise<T | null> {
  try {
    const cached = await redis.get(boardCacheKey(boardId));
    if (cached) {
      return JSON.parse(cached) as T;
    }
    return null;
  } catch (err) {
    // Fail open: if Redis is unavailable, bypass cache and let Postgres serve the query
    console.error('[Cache] Redis GET error, bypassing cache:', err);
    return null;
  }
}

/**
 * Stores a board aggregate in Redis with TTL.
 * Silently fails if Redis is unavailable so user-facing operations are not blocked.
 */
export async function setCachedBoard<T>(boardId: string, data: T): Promise<void> {
  try {
    await redis.setex(boardCacheKey(boardId), BOARD_CACHE_TTL_SECONDS, JSON.stringify(data));
  } catch (err) {
    console.error('[Cache] Redis SETEX error:', err);
  }
}

/**
 * Invalidates the board cache entry atomically on any mutation.
 * Silently fails so mutation response is never blocked by a cache error.
 */
export async function invalidateBoardCache(boardId: string): Promise<void> {
  try {
    const deleted = await redis.del(boardCacheKey(boardId));
    if (deleted > 0) {
      console.log(`[Cache] Invalidated board:${boardId}`);
    }
  } catch (err) {
    console.error('[Cache] Redis DEL error:', err);
  }
}

