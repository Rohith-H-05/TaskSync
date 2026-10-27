import request from 'supertest';
import express from 'express';
import { createApp } from '../src/app';
import { ApolloServer } from '@apollo/server';
import { GraphQLContext } from '../src/graphql/context';
import { prisma } from '../src/lib/prisma';
import { signToken } from '../src/auth/jwt';
import { WorkspaceRole } from '@prisma/client';

describe('Boards, Columns, Tasks & Fractional DND Tests', () => {
  let app: express.Express;
  let apolloServer: ApolloServer<GraphQLContext>;

  let ownerToken: string;
  let memberToken: string;
  let viewerToken: string;
  let workspaceId: string;
  let boardId: string;
  let todoColId: string;
  let inProgressColId: string;

  beforeAll(async () => {
    const serverSetup = await createApp();
    app = serverSetup.app;
    apolloServer = serverSetup.apolloServer;

    // Clean up
    await prisma.user.deleteMany({
      where: {
        email: {
          in: ['bt_owner@test.com', 'bt_member@test.com', 'bt_viewer@test.com']
        }
      }
    });

    // Create users
    const owner = await prisma.user.create({
      data: { email: 'bt_owner@test.com', name: 'Owner', passwordHash: 'hash' }
    });
    const member = await prisma.user.create({
      data: { email: 'bt_member@test.com', name: 'Member', passwordHash: 'hash' }
    });
    const viewer = await prisma.user.create({
      data: { email: 'bt_viewer@test.com', name: 'Viewer', passwordHash: 'hash' }
    });

    ownerToken = signToken({ userId: owner.id, email: owner.email });
    memberToken = signToken({ userId: member.id, email: member.email });
    viewerToken = signToken({ userId: viewer.id, email: viewer.email });

    // Create workspace with memberships
    const ws = await prisma.workspace.create({
      data: { name: 'Board Test WS', slug: `bt-ws-${Date.now()}` }
    });
    workspaceId = ws.id;

    await prisma.workspaceMember.createMany({
      data: [
        { workspaceId, userId: owner.id, role: WorkspaceRole.OWNER },
        { workspaceId, userId: member.id, role: WorkspaceRole.MEMBER },
        { workspaceId, userId: viewer.id, role: WorkspaceRole.VIEWER }
      ]
    });
  });

  afterAll(async () => {
    await prisma.workspace.deleteMany({ where: { id: workspaceId } });
    await prisma.user.deleteMany({
      where: {
        email: {
          in: ['bt_owner@test.com', 'bt_member@test.com', 'bt_viewer@test.com']
        }
      }
    });
    await apolloServer.stop();
    await prisma.$disconnect();
  });

  it('should create a board and auto-seed 3 Kanban columns (To Do, In Progress, Done)', async () => {
    const query = `
      mutation CreateBoard($input: CreateBoardInput!) {
        createBoard(input: $input) {
          id
          title
          columns {
            id
            title
            position
          }
        }
      }
    `;

    const res = await request(app)
      .post('/graphql')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        query,
        variables: {
          input: {
            workspaceId,
            title: 'Sprint 1 Kanban'
          }
        }
      });

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeUndefined();
    const b = res.body.data.createBoard;
    expect(b.title).toBe('Sprint 1 Kanban');
    expect(b.columns.length).toBe(3);
    expect(b.columns[0].title).toBe('To Do');
    expect(b.columns[1].title).toBe('In Progress');
    expect(b.columns[2].title).toBe('Done');

    boardId = b.id;
    todoColId = b.columns[0].id;
    inProgressColId = b.columns[1].id;
  });

  it('should allow VIEWER to read board and columns', async () => {
    const query = `
      query GetBoard($id: ID!) {
        board(id: $id) {
          id
          title
          columns {
            title
          }
        }
      }
    `;

    const res = await request(app)
      .post('/graphql')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        query,
        variables: { id: boardId }
      });

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.board.title).toBe('Sprint 1 Kanban');
    expect(res.body.data.board.columns.length).toBe(3);
  });

  it('should REJECT mutation from VIEWER with FORBIDDEN error code', async () => {
    const query = `
      mutation CreateTask($input: CreateTaskInput!) {
        createTask(input: $input) {
          id
        }
      }
    `;

    const res = await request(app)
      .post('/graphql')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        query,
        variables: {
          input: {
            boardId,
            columnId: todoColId,
            title: 'Unauthorized Task',
            position: 1000.0
          }
        }
      });

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeDefined();
    expect(res.body.errors[0].extensions.code).toBe('FORBIDDEN');
  });

  let task1Id: string;
  let task2Id: string;
  let task3Id: string;

  it('should allow MEMBER to create tasks with fractional positions', async () => {
    const query = `
      mutation CreateTask($input: CreateTaskInput!) {
        createTask(input: $input) {
          id
          title
          position
        }
      }
    `;

    // Create Task A (pos: 1000.0)
    const res1 = await request(app)
      .post('/graphql')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        query,
        variables: {
          input: {
            boardId,
            columnId: todoColId,
            title: 'Task Alpha (Backend Setup)',
            description: 'Setup initial node express app',
            position: 1000.0
          }
        }
      });
    task1Id = res1.body.data.createTask.id;
    expect(res1.body.data.createTask.position).toBe(1000.0);

    // Create Task B (pos: 2000.0)
    const res2 = await request(app)
      .post('/graphql')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        query,
        variables: {
          input: {
            boardId,
            columnId: todoColId,
            title: 'Task Beta (Frontend Setup)',
            description: 'Setup vite react app',
            position: 2000.0
          }
        }
      });
    task2Id = res2.body.data.createTask.id;
    expect(res2.body.data.createTask.position).toBe(2000.0);

    // Create Task C (pos: 3000.0)
    const res3 = await request(app)
      .post('/graphql')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        query,
        variables: {
          input: {
            boardId,
            columnId: todoColId,
            title: 'Task Gamma (Testing)',
            description: 'Run integration test suite',
            position: 3000.0
          }
        }
      });
    task3Id = res3.body.data.createTask.id;
    expect(res3.body.data.createTask.position).toBe(3000.0);
  });

  it('should move a task between two cards using fractional position (pos: 1500.0)', async () => {
    const query = `
      mutation MoveTask($input: MoveTaskInput!) {
        moveTask(input: $input) {
          id
          columnId
          position
        }
      }
    `;

    // Move Task C between Task A (1000.0) and Task B (2000.0) -> position 1500.0
    const res = await request(app)
      .post('/graphql')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        query,
        variables: {
          input: {
            id: task3Id,
            targetColumnId: todoColId,
            newPosition: 1500.0
          }
        }
      });

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.moveTask.position).toBe(1500.0);

    // Verify ordering in column via tasks query
    const boardQuery = `
      query GetBoard($id: ID!) {
        board(id: $id) {
          columns {
            id
            tasks {
              id
              title
              position
            }
          }
        }
      }
    `;

    const boardRes = await request(app)
      .post('/graphql')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        query: boardQuery,
        variables: { id: boardId }
      });

    const todoCol = boardRes.body.data.board.columns.find((c: { id: string }) => c.id === todoColId);
    expect(todoCol.tasks.map((t: { id: string }) => t.id)).toEqual([task1Id, task3Id, task2Id]);
  });

  it('should move a task across columns to In Progress', async () => {
    const query = `
      mutation MoveTask($input: MoveTaskInput!) {
        moveTask(input: $input) {
          id
          columnId
          position
        }
      }
    `;

    const res = await request(app)
      .post('/graphql')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        query,
        variables: {
          input: {
            id: task1Id,
            targetColumnId: inProgressColId,
            newPosition: 1000.0
          }
        }
      });

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.moveTask.columnId).toBe(inProgressColId);
  });

  it('should paginate tasks using cursor pagination and filter by search query', async () => {
    const paginationQuery = `
      query GetTasks($boardId: ID!, $first: Int, $after: String, $filter: TaskFilterInput) {
        tasks(boardId: $boardId, first: $first, after: $after, filter: $filter) {
          totalCount
          pageInfo {
            hasNextPage
            hasPreviousPage
            endCursor
          }
          edges {
            cursor
            node {
              id
              title
            }
          }
        }
      }
    `;

    // Query page 1 (first: 1)
    const page1Res = await request(app)
      .post('/graphql')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        query: paginationQuery,
        variables: {
          boardId,
          first: 1
        }
      });

    expect(page1Res.status).toBe(200);
    expect(page1Res.body.errors).toBeUndefined();
    const p1 = page1Res.body.data.tasks;
    expect(p1.totalCount).toBe(3);
    expect(p1.edges.length).toBe(1);
    expect(p1.pageInfo.hasNextPage).toBe(true);

    const endCursor = p1.pageInfo.endCursor;

    // Query page 2 using after cursor
    const page2Res = await request(app)
      .post('/graphql')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        query: paginationQuery,
        variables: {
          boardId,
          first: 1,
          after: endCursor
        }
      });

    const p2 = page2Res.body.data.tasks;
    expect(p2.edges.length).toBe(1);
    expect(p2.edges[0].node.id).not.toBe(p1.edges[0].node.id);

    // Query with search filter
    const searchRes = await request(app)
      .post('/graphql')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        query: paginationQuery,
        variables: {
          boardId,
          filter: { searchQuery: 'Backend' }
        }
      });

    const searchData = searchRes.body.data.tasks;
    expect(searchData.totalCount).toBe(1);
    expect(searchData.edges[0].node.title).toContain('Backend');
  });
});

