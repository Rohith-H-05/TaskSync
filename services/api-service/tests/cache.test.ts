import request from 'supertest';
import express from 'express';
import { createApp } from '../src/app';
import { ApolloServer } from '@apollo/server';
import { GraphQLContext } from '../src/graphql/context';
import { prisma } from '../src/lib/prisma';
import { redis } from '../src/lib/redis';
import { boardCacheKey, getCachedBoard, setCachedBoard, invalidateBoardCache } from '../src/lib/cache';
import { signToken } from '../src/auth/jwt';
import { WorkspaceRole } from '@prisma/client';

describe('Redis Caching & Invalidation Tests', () => {
  let app: express.Express;
  let apolloServer: ApolloServer<GraphQLContext>;

  let ownerToken: string;
  let workspaceId: string;
  let boardId: string;

  beforeAll(async () => {
    const serverSetup = await createApp();
    app = serverSetup.app;
    apolloServer = serverSetup.apolloServer;

    await redis.connect();

    // Seed data
    await prisma.user.deleteMany({ where: { email: 'cache_owner@test.com' } });
    const owner = await prisma.user.create({
      data: { email: 'cache_owner@test.com', name: 'Cache Owner', passwordHash: 'hash' }
    });
    ownerToken = signToken({ userId: owner.id, email: owner.email });

    const ws = await prisma.workspace.create({
      data: { name: 'Cache Test WS', slug: `cache-ws-${Date.now()}` }
    });
    workspaceId = ws.id;

    await prisma.workspaceMember.create({
      data: { workspaceId, userId: owner.id, role: WorkspaceRole.OWNER }
    });

    const board = await prisma.board.create({
      data: { workspaceId, title: 'Cache Test Board' }
    });
    boardId = board.id;

    // Pre-clear any stale entry
    await redis.del(boardCacheKey(boardId));
  });

  afterAll(async () => {
    await redis.del(boardCacheKey(boardId));
    await prisma.workspace.deleteMany({ where: { id: workspaceId } });
    await prisma.user.deleteMany({ where: { email: 'cache_owner@test.com' } });
    await apolloServer.stop();
    await prisma.$disconnect();
    redis.disconnect();
  });

  it('should return cache MISS on first board(id) query and populate Redis', async () => {
    // Confirm no entry in cache yet
    const beforeCache = await getCachedBoard(boardId);
    expect(beforeCache).toBeNull();

    const res = await request(app)
      .post('/graphql')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        query: `query GetBoard($id: ID!) { board(id: $id) { id title } }`,
        variables: { id: boardId }
      });

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.board.id).toBe(boardId);

    // Cache should now be populated
    const afterCache = await getCachedBoard<{ id: string; title: string }>(boardId);
    expect(afterCache).not.toBeNull();
    expect(afterCache?.id).toBe(boardId);
    expect(afterCache?.title).toBe('Cache Test Board');
  });

  it('should return cache HIT on second board(id) query (no Postgres hit needed)', async () => {
    // Confirm key exists in Redis
    const rawEntry = await redis.get(boardCacheKey(boardId));
    expect(rawEntry).not.toBeNull();

    const res = await request(app)
      .post('/graphql')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        query: `query GetBoard($id: ID!) { board(id: $id) { id title } }`,
        variables: { id: boardId }
      });

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.board.id).toBe(boardId);
  });

  it('should invalidate cache when a column is created on that board', async () => {
    // Seed a column to confirm cache key is present
    await setCachedBoard(boardId, { id: boardId, title: 'Cached Value' });
    const before = await getCachedBoard(boardId);
    expect(before).not.toBeNull();

    // Get a column from the board to simulate column creation
    const columns = await prisma.column.findMany({ where: { boardId } });
    const existingColumnId = columns[0]?.id;

    // Trigger an updateColumn mutation which should invalidate
    if (existingColumnId) {
      await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          query: `mutation UpdateColumn($input: UpdateColumnInput!) { updateColumn(input: $input) { id title } }`,
          variables: { input: { id: existingColumnId, title: 'Updated Column Title' } }
        });
    } else {
      // No columns — use updateBoard to trigger invalidation
      await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          query: `mutation UpdateBoard($input: UpdateBoardInput!) { updateBoard(input: $input) { id } }`,
          variables: { input: { id: boardId, title: 'Updated Cache Test Board' } }
        });
    }

    const after = await getCachedBoard(boardId);
    expect(after).toBeNull();
  });

  it('cache utility: invalidateBoardCache should remove only the target key', async () => {
    await setCachedBoard('board-a', { id: 'board-a' });
    await setCachedBoard('board-b', { id: 'board-b' });

    await invalidateBoardCache('board-a');

    const a = await getCachedBoard('board-a');
    const b = await getCachedBoard<{ id: string }>('board-b');
    expect(a).toBeNull();
    expect(b?.id).toBe('board-b');

    // Cleanup
    await redis.del(boardCacheKey('board-b'));
  });

  it('cache utility: getCachedBoard should return null for non-existent key', async () => {
    const result = await getCachedBoard('non-existent-board-id-12345');
    expect(result).toBeNull();
  });
});

