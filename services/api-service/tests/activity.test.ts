import request from 'supertest';
import express from 'express';
import { createApp } from '../src/app';
import { ApolloServer } from '@apollo/server';
import { GraphQLContext } from '../src/graphql/context';
import { prisma } from '../src/lib/prisma';
import { signToken } from '../src/auth/jwt';
import { WorkspaceRole, TaskAction } from '@prisma/client';

describe('Activity Feed & Redis Pub/Sub Integration Tests', () => {
  let app: express.Express;
  let apolloServer: ApolloServer<GraphQLContext>;

  let userToken: string;
  let user: { id: string; email: string };
  let workspaceId: string;
  let boardId: string;

  beforeAll(async () => {
    const serverSetup = await createApp();
    app = serverSetup.app;
    apolloServer = serverSetup.apolloServer;

    // Create user
    await prisma.user.deleteMany({ where: { email: 'activity_user@test.com' } });
    user = await prisma.user.create({
      data: { email: 'activity_user@test.com', name: 'Activity User', passwordHash: 'hash' }
    });
    userToken = signToken({ userId: user.id, email: user.email });

    // Create workspace & board
    const ws = await prisma.workspace.create({
      data: { name: 'Activity WS', slug: `activity-ws-${Date.now()}` }
    });
    workspaceId = ws.id;

    await prisma.workspaceMember.create({
      data: { workspaceId, userId: user.id, role: WorkspaceRole.OWNER }
    });

    const b = await prisma.board.create({
      data: { workspaceId, title: 'Activity Board' }
    });
    boardId = b.id;

    // Seed 4 ActivityLog entries with staggered timestamps
    await prisma.activityLog.createMany({
      data: [
        {
          boardId,
          userId: user.id,
          action: TaskAction.CREATED,
          details: { title: 'First Task', actorName: 'Activity User' },
          createdAt: new Date(Date.now() - 4000)
        },
        {
          boardId,
          userId: user.id,
          action: TaskAction.MOVED,
          details: { title: 'First Task moved to In Progress', actorName: 'Activity User' },
          createdAt: new Date(Date.now() - 3000)
        },
        {
          boardId,
          userId: user.id,
          action: TaskAction.UPDATED,
          details: { title: 'First Task updated priority', actorName: 'Activity User' },
          createdAt: new Date(Date.now() - 2000)
        },
        {
          boardId,
          userId: user.id,
          action: TaskAction.DELETED,
          details: { title: 'Old Task removed', actorName: 'Activity User' },
          createdAt: new Date(Date.now() - 1000)
        }
      ]
    });
  });

  afterAll(async () => {
    await prisma.workspace.deleteMany({ where: { id: workspaceId } });
    await prisma.user.deleteMany({ where: { email: 'activity_user@test.com' } });
    await apolloServer.stop();
    await prisma.$disconnect();
  });

  it('should query boardActivity with cursor pagination', async () => {
    const query = `
      query GetBoardActivity($boardId: ID!, $first: Int, $after: String) {
        boardActivity(boardId: $boardId, first: $first, after: $after) {
          totalCount
          pageInfo {
            hasNextPage
            endCursor
          }
          edges {
            cursor
            node {
              id
              action
              details
              user {
                email
              }
            }
          }
        }
      }
    `;

    // Page 1: fetch first 2
    const res1 = await request(app)
      .post('/graphql')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        query,
        variables: { boardId, first: 2 }
      });

    expect(res1.status).toBe(200);
    expect(res1.body.errors).toBeUndefined();
    const data1 = res1.body.data.boardActivity;
    expect(data1.totalCount).toBe(4);
    expect(data1.edges.length).toBe(2);
    expect(data1.pageInfo.hasNextPage).toBe(true);
    expect(data1.edges[0].node.action).toBe('DELETED'); // newest first
    expect(data1.edges[0].node.user.email).toBe('activity_user@test.com');

    const endCursor = data1.pageInfo.endCursor;

    // Page 2: fetch next 2 using after cursor
    const res2 = await request(app)
      .post('/graphql')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        query,
        variables: { boardId, first: 2, after: endCursor }
      });

    expect(res2.status).toBe(200);
    expect(res2.body.errors).toBeUndefined();
    const data2 = res2.body.data.boardActivity;
    expect(data2.edges.length).toBe(2);
    expect(data2.edges[0].node.id).not.toBe(data1.edges[0].node.id);
  });
});
