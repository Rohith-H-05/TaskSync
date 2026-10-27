import { Request } from 'express';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { prisma } from '../lib/prisma';
import { redis, redisPublisher } from '../lib/redis';
import { verifyToken, TokenPayload } from '../auth/jwt';
import { createLoaders, DataLoaders } from './loaders';

export interface GraphQLContext {
  req?: Request;
  prisma: PrismaClient;
  redis: Redis;
  redisPublisher: Redis;
  user: TokenPayload | null;
  loaders: DataLoaders;
}

export async function buildContext({ req }: { req?: Request }): Promise<GraphQLContext> {
  let user: TokenPayload | null = null;

  if (req && req.headers && req.headers.authorization) {
    const authHeader = req.headers.authorization;
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      user = verifyToken(token);
    }
  }

  return {
    req,
    prisma,
    redis,
    redisPublisher,
    user,
    loaders: createLoaders(prisma)
  };
}

