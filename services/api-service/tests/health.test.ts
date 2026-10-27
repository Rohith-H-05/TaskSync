import request from 'supertest';
import express from 'express';
import { createApp } from '../src/app';
import { ApolloServer } from '@apollo/server';
import { GraphQLContext } from '../src/graphql/context';
import { prisma } from '../src/lib/prisma';
import { redis } from '../src/lib/redis';

describe('Health Endpoints Tests', () => {
  let app: express.Express;
  let apolloServer: ApolloServer<GraphQLContext>;

  beforeAll(async () => {
    const serverSetup = await createApp();
    app = serverSetup.app;
    apolloServer = serverSetup.apolloServer;
  });

  afterAll(async () => {
    await apolloServer.stop();
    await prisma.$disconnect();
    redis.disconnect();
  });

  describe('GET /health (Liveness Probe)', () => {
    it('should return HTTP 200 with status ok and uptime', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(typeof response.body.uptime).toBe('number');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('GET /health/ready (Readiness Probe)', () => {
    it('should return HTTP 200 when database and redis are healthy', async () => {
      const response = await request(app).get('/health/ready');
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ready');
      expect(response.body.checks).toEqual({
        database: 'ok',
        redis: 'ok'
      });
      expect(response.body.timestamp).toBeDefined();
    });
  });
});
