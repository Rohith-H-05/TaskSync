import request from 'supertest';
import express from 'express';
import { createApp } from '../../src/app';
import { ApolloServer } from '@apollo/server';
import { GraphQLContext } from '../../src/graphql/context';
import { prisma } from '../../src/lib/prisma';
import { signToken } from '../../src/auth/jwt';

describe('Multi-User Collaborative Workflow Integration Test', () => {
  let app: express.Express;
  let apolloServer: ApolloServer<GraphQLContext>;

  let aliceToken: string;
  let aliceId: string;
  let bobToken: string;
  let bobId: string;

  let workspaceId: string;
  let boardId: string;
  let colBacklogId: string;
  let colInProgressId: string;
  let taskId: string;

  beforeAll(async () => {
    const serverSetup = await createApp();
    app = serverSetup.app;
    apolloServer = serverSetup.apolloServer;

    // Clean up test users
    await prisma.user.deleteMany({
      where: {
        email: { in: ['collab_alice@tasksync.test', 'collab_bob@tasksync.test'] }
      }
    });

    // Create test users Alice and Bob
    const alice = await prisma.user.create({
      data: { email: 'collab_alice@tasksync.test', name: 'Alice Admin', passwordHash: 'hash' }
    });
    aliceId = alice.id;
    aliceToken = signToken({ userId: alice.id, email: alice.email });

    const bob = await prisma.user.create({
      data: { email: 'collab_bob@tasksync.test', name: 'Bob Engineer', passwordHash: 'hash' }
    });
    bobId = bob.id;
    bobToken = signToken({ userId: bob.id, email: bob.email });
  });

  afterAll(async () => {
    if (workspaceId) {
      await prisma.workspace.delete({ where: { id: workspaceId } }).catch(() => {});
    }
    await prisma.user.deleteMany({
      where: {
        email: { in: ['collab_alice@tasksync.test', 'collab_bob@tasksync.test'] }
      }
    });
    await apolloServer.stop();
    await prisma.$disconnect();
  });

  it('Step 1: Alice creates a workspace and is assigned OWNER role', async () => {
    const res = await request(app)
      .post('/graphql')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        query: `
          mutation CreateWorkspace($input: CreateWorkspaceInput!) {
            createWorkspace(input: $input) {
              id
              name
              slug
            }
          }
        `,
        variables: { input: { name: 'Apollo Mission' } }
      });

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.createWorkspace.name).toBe('Apollo Mission');
    workspaceId = res.body.data.createWorkspace.id;

    // Verify Alice is indeed assigned as OWNER in DB
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: aliceId
        }
      }
    });
    expect(membership?.role).toBe('OWNER');
  });

  it('Step 2: Alice invites Bob as a VIEWER', async () => {
    const res = await request(app)
      .post('/graphql')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        query: `
          mutation AddMember($input: AddWorkspaceMemberInput!) {
            addWorkspaceMember(input: $input) {
              id
              role
              user {
                id
                email
              }
            }
          }
        `,
        variables: {
          input: {
            workspaceId,
            email: 'collab_bob@tasksync.test',
            role: 'VIEWER'
          }
        }
      });

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.addWorkspaceMember.role).toBe('VIEWER');
    expect(res.body.data.addWorkspaceMember.user.email).toBe('collab_bob@tasksync.test');
  });

  it('Step 3: Alice creates a board with two columns', async () => {
    // Create Board
    const boardRes = await request(app)
      .post('/graphql')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        query: `
          mutation CreateBoard($input: CreateBoardInput!) {
            createBoard(input: $input) {
              id
              title
            }
          }
        `,
        variables: { input: { workspaceId, title: 'Sprint Board' } }
      });

    expect(boardRes.body.errors).toBeUndefined();
    boardId = boardRes.body.data.createBoard.id;

    // Create Backlog Column
    const col1 = await request(app)
      .post('/graphql')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        query: `
          mutation CreateColumn($input: CreateColumnInput!) {
            createColumn(input: $input) {
              id
              title
            }
          }
        `,
        variables: { input: { boardId, title: 'Backlog', position: 1000.0 } }
      });
    colBacklogId = col1.body.data.createColumn.id;

    // Create In Progress Column
    const col2 = await request(app)
      .post('/graphql')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        query: `
          mutation CreateColumn($input: CreateColumnInput!) {
            createColumn(input: $input) {
              id
              title
            }
          }
        `,
        variables: { input: { boardId, title: 'In Progress', position: 2000.0 } }
      });
    colInProgressId = col2.body.data.createColumn.id;
  });

  it('Step 4: Alice creates a task in the Backlog column', async () => {
    const res = await request(app)
      .post('/graphql')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        query: `
          mutation CreateTask($input: CreateTaskInput!) {
            createTask(input: $input) {
              id
              title
              position
              columnId
            }
          }
        `,
        variables: {
          input: {
            boardId,
            columnId: colBacklogId,
            title: 'Design GraphQL Schema',
            position: 1000.0
          }
        }
      });

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.createTask.title).toBe('Design GraphQL Schema');
    taskId = res.body.data.createTask.id;
  });

  it('Step 5: Bob as VIEWER can read the board but CANNOT mutate tasks (FORBIDDEN)', async () => {
    // Read succeeds
    const readRes = await request(app)
      .post('/graphql')
      .set('Authorization', `Bearer ${bobToken}`)
      .send({
        query: `
          query GetBoard($id: ID!) {
            board(id: $id) {
              id
              title
              columns {
                id
                tasks {
                  id
                  title
                }
              }
            }
          }
        `,
        variables: { id: boardId }
      });

    expect(readRes.body.errors).toBeUndefined();
    expect(readRes.body.data.board.title).toBe('Sprint Board');
    const allTasks = readRes.body.data.board.columns.flatMap((c: any) => c.tasks);
    expect(allTasks.some((t: any) => t.id === taskId)).toBe(true);

    // Mutation fails (Move Task)
    const moveRes = await request(app)
      .post('/graphql')
      .set('Authorization', `Bearer ${bobToken}`)
      .send({
        query: `
          mutation MoveTask($input: MoveTaskInput!) {
            moveTask(input: $input) {
              id
              columnId
            }
          }
        `,
        variables: {
          input: {
            id: taskId,
            targetColumnId: colInProgressId,
            newPosition: 500.0
          }
        }
      });

    expect(moveRes.body.errors).toBeDefined();
    expect(moveRes.body.errors[0].extensions.code).toBe('FORBIDDEN');
  });

  it('Step 6: Alice promotes Bob to MEMBER', async () => {
    const res = await request(app)
      .post('/graphql')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        query: `
          mutation UpdateRole($input: UpdateWorkspaceMemberRoleInput!) {
            updateWorkspaceMemberRole(input: $input) {
              id
              role
            }
          }
        `,
        variables: {
          input: {
            workspaceId,
            userId: bobId,
            role: 'MEMBER'
          }
        }
      });

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.updateWorkspaceMemberRole.role).toBe('MEMBER');
  });

  it('Step 7: Bob (now MEMBER) moves the task to In Progress successfully', async () => {
    const res = await request(app)
      .post('/graphql')
      .set('Authorization', `Bearer ${bobToken}`)
      .send({
        query: `
          mutation MoveTask($input: MoveTaskInput!) {
            moveTask(input: $input) {
              id
              columnId
              position
            }
          }
        `,
        variables: {
          input: {
            id: taskId,
            targetColumnId: colInProgressId,
            newPosition: 1500.0
          }
        }
      });

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.moveTask.columnId).toBe(colInProgressId);
    expect(res.body.data.moveTask.position).toBe(1500.0);
  });
});
