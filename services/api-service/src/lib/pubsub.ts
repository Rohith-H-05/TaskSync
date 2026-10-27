import { PubSub } from 'graphql-subscriptions';
import { redisPublisher } from './redis';

export const pubsub = new PubSub();

export enum BoardEventType {
  TASK_CREATED = 'TASK_CREATED',
  TASK_UPDATED = 'TASK_UPDATED',
  TASK_MOVED = 'TASK_MOVED',
  TASK_DELETED = 'TASK_DELETED',
  COLUMN_CREATED = 'COLUMN_CREATED',
  COLUMN_UPDATED = 'COLUMN_UPDATED',
  COLUMN_MOVED = 'COLUMN_MOVED',
  COLUMN_DELETED = 'COLUMN_DELETED'
}

export interface BoardEventPayload {
  type: BoardEventType;
  boardId: string;
  columnId?: string;
  taskId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  task?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  column?: any;
  actor: {
    id: string;
    email: string;
    name: string;
  };
  timestamp: string;
}

/**
 * Publishes a board mutation event:
 * 1. To Apollo Server's internal PubSub for active WebSocket subscribers on boardUpdated:boardId
 * 2. To the Redis channel 'task-events' for the external notification-service and activity logger
 */
export async function emitBoardEvent(event: BoardEventPayload): Promise<void> {
  const channel = `boardUpdated:${event.boardId}`;

  // 1. In-process PubSub for GraphQL Subscriptions
  await pubsub.publish(channel, { boardUpdated: event });

  // 2. Redis Pub/Sub for background notification-service
  try {
    await redisPublisher.publish('task-events', JSON.stringify(event));
  } catch (err) {
    console.error('Failed to publish event to Redis channel task-events:', err);
  }
}

