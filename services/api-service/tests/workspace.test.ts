import request from 'supertest';
import express from 'express';
import { createApp } from '../src/app';
import { ApolloServer } from '@apollo/server';
import { GraphQLContext } from '../src/graphql/context';
import { prisma } from '../src/lib/prisma';
import { signToken } from '../src/auth/jwt';

describe('Workspace & RBAC Integration Tests', () => {
  let app: express.Express;
  let apolloServer: ApolloServer<GraphQLContext>;

  let ownerToken: string;
  let ownerUser: { id: string; email: string };
  let memberToken: string;
  let memberUser: { id: string; email: string };
  let viewerToken: string;
  let viewerUser: { id: string; email: string };
  let outsiderToken: string;
  let outsiderUser: { id: string; email: string };

  beforeAll(async () => {
    const serverSetup = await createApp();
    app = serverSetup.app;
    apolloServer = serverSetup.apolloServer;

    // Clean up test users
    await prisma.user.deleteMany({
      where: {
        email: {
          in: ['ws_owner@test.com', 'ws_member@test.com', 'ws_viewer@test.com', 'ws_outsider@test.com']
        }
      }
    });

    // Seed test users
    ownerUser = await prisma.user.create({
      data: { email: 'ws_owner@test.com', name: 'Owner User', passwordHash: 'hash' }
    });
    memberUser = await prisma.user.create({
      data: { email: 'ws_member@test.com', name: 'Member User', passwordHash: 'hash' }
    });
    viewerUser = await prisma.user.create({
      data: { email: 'ws_viewer@test.com', name: 'Viewer User', passwordHash: 'hash' }
    });
    outsiderUser = await prisma.user.create({
      data: { email: 'ws_outsider@test.com', name: 'Outsider User', passwordHash: 'hash' }
    });

    ownerToken = signToken({ userId: ownerUser.id, email: ownerUser.email });
    memberToken = signToken({ userId: memberUser.id, email: memberUser.email });
    viewerToken = signToken({ userId: viewerUser.id, email: viewerUser.email });
    outsiderToken = signToken({ userId: outsiderUser.id, email: outsiderUser.email });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email: {
          in: ['ws_owner@test.com', 'ws_member@test.com', 'ws_viewer@test.com', 'ws_outsider@test.com']
        }
      }
    });
    await apolloServer.stop();
    await prisma.$disconnect();
  });

  let createdWorkspaceId: string;

  it('should create a workspace and make caller the OWNER', async () => {
    const query = `
      mutation CreateWorkspace($input: CreateWorkspaceInput!) {
        createWorkspace(input: $input) {
          id
          name
          slug
          members {
            role
            user {
              id
              email
            }
          }
        }
      }
    `;

    const res = await request(app)
      .post('/graphql')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        query,
        variables: { input: { name: 'Acme Engineering' } }
      });

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeUndefined();
    const ws = res.body.data.createWorkspace;
    expect(ws.name).toBe('Acme Engineering');
    expect(ws.slug).toContain('acme-engineering');
    expect(ws.members.length).toBe(1);
    expect(ws.members[0].role).toBe('OWNER');
    expect(ws.members[0].user.id).toBe(ownerUser.id);

    createdWorkspaceId = ws.id;
  });

  it('should allow OWNER to add a member with VIEWER role', async () => {
    const query = `
      mutation AddMember($input: AddWorkspaceMemberInput!) {
        addWorkspaceMember(input: $input) {
          id
          role
          user {
            email
          }
        }
      }
    `;

    const res = await request(app)
      .post('/graphql')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        query,
        variables: {
          input: {
            workspaceId: createdWorkspaceId,
            email: 'ws_viewer@test.com',
            role: 'VIEWER'
          }
        }
      });

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.addWorkspaceMember.role).toBe('VIEWER');
    expect(res.body.data.addWorkspaceMember.user.email).toBe('ws_viewer@test.com');
  });

  it('should allow VIEWER to read workspace details', async () => {
    const query = `
      query GetWorkspace($id: ID!) {
        workspace(id: $id) {
          id
          name
          members {
            role
          }
        }
      }
    `;

    const res = await request(app)
      .post('/graphql')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        query,
        variables: { id: createdWorkspaceId }
      });

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.workspace.name).toBe('Acme Engineering');
    expect(res.body.data.workspace.members.length).toBe(2);
  });

  it('should forbid outsider from accessing workspace', async () => {
    const query = `
      query GetWorkspace($id: ID!) {
        workspace(id: $id) {
          id
          name
        }
      }
    `;

    const res = await request(app)
      .post('/graphql')
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({
        query,
        variables: { id: createdWorkspaceId }
      });

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeDefined();
    expect(res.body.errors[0].extensions.code).toBe('FORBIDDEN');
  });

  it('should prevent non-OWNER from adding members', async () => {
    const query = `
      mutation AddMember($input: AddWorkspaceMemberInput!) {
        addWorkspaceMember(input: $input) {
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
            workspaceId: createdWorkspaceId,
            email: 'ws_member@test.com',
            role: 'MEMBER'
          }
        }
      });

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeDefined();
    expect(res.body.errors[0].extensions.code).toBe('FORBIDDEN');
  });

  it('should prevent removing the sole OWNER of the workspace', async () => {
    const query = `
      mutation RemoveMember($workspaceId: ID!, $userId: ID!) {
        removeWorkspaceMember(workspaceId: $workspaceId, userId: $userId)
      }
    `;

    const res = await request(app)
      .post('/graphql')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        query,
        variables: {
          workspaceId: createdWorkspaceId,
          userId: ownerUser.id
        }
      });

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeDefined();
    expect(res.body.errors[0].message).toContain('sole owner');
  });
});
