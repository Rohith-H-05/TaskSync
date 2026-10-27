import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';

export const healthRouter = Router();

// Liveness probe
healthRouter.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Readiness probe: checks Postgres and Redis
healthRouter.get('/health/ready', async (_req: Request, res: Response) => {
  const checks: Record<string, 'ok' | 'error'> = {
    database: 'error',
    redis: 'error'
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch (err) {
    console.error('Healthcheck DB Error:', err);
  }

  try {
    const pingResponse = await redis.ping();
    if (pingResponse === 'PONG') {
      checks.redis = 'ok';
    }
  } catch (err) {
    console.error('Healthcheck Redis Error:', err);
  }

  const isHealthy = Object.values(checks).every((status) => status === 'ok');

  return res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ready' : 'degraded',
    checks,
    timestamp: new Date().toISOString()
  });
});
