import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const redisSubscriber = new Redis(REDIS_URL);

console.log('📬 TaskSync Notification Service starting up...');

redisSubscriber.on('connect', () => {
  console.log('✅ Connected to Redis for task notifications');
});

redisSubscriber.on('error', (err) => {
  console.error('❌ Redis subscription error:', err.message);
});

// Subscribe to task events channel
const CHANNEL = 'task-events';
redisSubscriber.subscribe(CHANNEL, (err, count) => {
  if (err) {
    console.error(`Failed to subscribe to ${CHANNEL}:`, err);
    return;
  }
  console.log(`📡 Subscribed to "${CHANNEL}" (${count} active channel subscription)`);
});

redisSubscriber.on('message', (channel, message) => {
  if (channel === CHANNEL) {
    try {
      const event = JSON.parse(message);
      console.log(`[Notification Service] Received event [${event.type}] for board [${event.boardId}]:`, event);
    } catch (e) {
      console.error('Failed to parse event message:', message);
    }
  }
});

const shutdown = () => {
  console.log('🛑 Shutting down Notification Service...');
  redisSubscriber.disconnect();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

