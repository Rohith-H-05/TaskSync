import Redis from 'ioredis';
import { PrismaClient, TaskAction } from '@prisma/client';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';

// Load environment configuration
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const SMTP_HOST = process.env.SMTP_HOST || 'localhost';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '1025', 10);
const SMTP_FROM = process.env.SMTP_FROM || 'TaskSync <noreply@tasksync.local>';

const prisma = new PrismaClient();
const redisSubscriber = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  retryStrategy: (times) => Math.min(times * 100, 3000)
});

// Mailpit local SMTP transporter
const mailer = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: false
});

console.log('📬 TaskSync Notification Service initializing...');

function mapEventToTaskAction(eventType: string): TaskAction {
  if (eventType.includes('CREATE')) return TaskAction.CREATED;
  if (eventType.includes('MOVE')) return TaskAction.MOVED;
  if (eventType.includes('DELETE')) return TaskAction.DELETED;
  return TaskAction.UPDATED;
}

export async function processTaskEvent(event: {
  type: string;
  boardId: string;
  taskId?: string;
  columnId?: string;
  task?: { title?: string; assigneeId?: string };
  column?: { title?: string };
  actor: { id: string; email: string; name: string };
  timestamp: string;
}) {
  console.log(`\n⚡ [Worker] Processing event: ${event.type} for Board: ${event.boardId}`);

  try {
    // 1. Durably record in PostgreSQL ActivityLog
    const action = mapEventToTaskAction(event.type);
    const details = {
      type: event.type,
      title: event.task?.title || event.column?.title || 'Unknown',
      actorName: event.actor.name,
      actorEmail: event.actor.email,
      timestamp: event.timestamp
    };

    const logRecord = await prisma.activityLog.create({
      data: {
        boardId: event.boardId,
        taskId: event.taskId || null,
        userId: event.actor.id,
        action,
        details
      }
    });

    console.log(`📝 [Worker] Persisted ActivityLog #${logRecord.id} (${action})`);

    // 2. Dispatch email notification via Mailpit
    try {
      const subject = `[TaskSync] ${event.type}: ${details.title}`;
      const text = `Hello,\n\n${event.actor.name} (${event.actor.email}) performed action ${event.type} on "${details.title}".\n\nTimestamp: ${event.timestamp}\nBoard ID: ${event.boardId}`;

      await mailer.sendMail({
        from: SMTP_FROM,
        to: event.actor.email, // in dev, notifies the actor or assignee
        subject,
        text
      });
      console.log(`✉️  [Worker] Notification dispatched to Mailpit (${subject})`);
    } catch (mailErr) {
      console.warn('⚠️  [Worker] Mailpit delivery skipped:', (mailErr as Error).message);
    }
  } catch (dbErr) {
    console.error('❌ [Worker] Failed to persist activity log:', dbErr);
  }
}

const CHANNEL = 'task-events';

redisSubscriber.on('connect', () => {
  console.log('✅ Connected to Redis Pub/Sub');
  redisSubscriber.subscribe(CHANNEL, (err, count) => {
    if (err) {
      console.error(`❌ Failed to subscribe to ${CHANNEL}:`, err);
    } else {
      console.log(`📡 Listening on Redis channel "${CHANNEL}" (${count} subscription active)`);
    }
  });
});

redisSubscriber.on('message', async (channel, message) => {
  if (channel === CHANNEL) {
    try {
      const event = JSON.parse(message);
      await processTaskEvent(event);
    } catch (parseErr) {
      console.error('❌ Malformed event payload received on Redis channel:', message);
    }
  }
});

const shutdown = async () => {
  console.log('\n🛑 Gracefully stopping Notification Service...');
  redisSubscriber.disconnect();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
