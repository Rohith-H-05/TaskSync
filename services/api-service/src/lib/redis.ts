import Redis from 'ioredis';
import { env } from './env';

// Primary client for caching
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
  lazyConnect: true
});

// Dedicated publisher for Redis Pub/Sub events
export const redisPublisher = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true
});

// Dedicated subscriber for Redis Pub/Sub events
export const redisSubscriber = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true
});

redis.on('error', (err) => console.error('Redis Cache Client Error:', err.message));
redisPublisher.on('error', (err) => console.error('Redis Publisher Client Error:', err.message));
redisSubscriber.on('error', (err) => console.error('Redis Subscriber Client Error:', err.message));

