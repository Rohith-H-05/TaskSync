import { hashPassword, verifyPassword } from '../src/auth/password';
import { signToken, verifyToken } from '../src/auth/jwt';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import request from 'supertest';
import express from 'express';
import { ApolloServer } from '@apollo/server';
import { GraphQLContext } from '../src/graphql/context';

describe('Authentication Unit & Integration Tests', () => {
  let app: express.Express;
  let apolloServer: ApolloServer<GraphQLContext>;

  beforeAll(async () => {
    const serverSetup = await createApp();
    app = serverSetup.app;
    apolloServer = serverSetup.apolloServer;

    // Clean up test users
    await prisma.user.deleteMany({
      where: {
        email: {
          in: ['testuser@example.com', 'testuser2@example.com']
        }
      }
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email: {
          in: ['testuser@example.com', 'testuser2@example.com']
        }
      }
    });
    await apolloServer.stop();
    await prisma.$disconnect();
  });

  describe('Password Hashing', () => {
    it('should securely hash passwords and verify them correctly', async () => {
      const rawPassword = 'securePassword123!';
      const hash = await hashPassword(rawPassword);

      expect(hash).not.toEqual(rawPassword);
      expect(hash.startsWith('$2')).toBe(true);

      const isValid = await verifyPassword(rawPassword, hash);
      expect(isValid).toBe(true);

      const isInvalid = await verifyPassword('wrongPassword', hash);
      expect(isInvalid).toBe(false);
    });
  });

  describe('JWT Token Handling', () => {
    it('should sign and verify valid JWT tokens', () => {
      const payload = { userId: '123e4567-e89b-12d3-a456-426614174000', email: 'dev@tasksync.io' };
      const token = signToken(payload);

      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(20);

      const verified = verifyToken(token);
      expect(verified).not.toBeNull();
      expect(verified?.userId).toBe(payload.userId);
      expect(verified?.email).toBe(payload.email);
    });

    it('should return null for malformed or invalid tokens', () => {
      const verified = verifyToken('invalid.token.string');
      expect(verified).toBeNull();
    });
  });

  describe('GraphQL Auth Resolvers', () => {
    it('should register a new user successfully and return JWT', async () => {
      const registerMutation = `
        mutation Register($input: RegisterInput!) {
          register(input: $input) {
            token
            user {
              id
              email
              name
            }
          }
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .send({
          query: registerMutation,
          variables: {
            input: {
              email: 'testuser@example.com',
              password: 'password123',
              name: 'Test Engineer'
            }
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeUndefined();
      const data = response.body.data.register;
      expect(data.token).toBeDefined();
      expect(data.user.email).toBe('testuser@example.com');
      expect(data.user.name).toBe('Test Engineer');
      expect(data.user.id).toBeDefined();
    });

    it('should prevent registration with duplicate email', async () => {
      const registerMutation = `
        mutation Register($input: RegisterInput!) {
          register(input: $input) {
            token
          }
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .send({
          query: registerMutation,
          variables: {
            input: {
              email: 'testuser@example.com',
              password: 'password123',
              name: 'Duplicate Test'
            }
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].extensions.code).toBe('CONFLICT');
    });

    it('should login with correct credentials', async () => {
      const loginMutation = `
        mutation Login($input: LoginInput!) {
          login(input: $input) {
            token
            user {
              email
              name
            }
          }
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .send({
          query: loginMutation,
          variables: {
            input: {
              email: 'testuser@example.com',
              password: 'password123'
            }
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeUndefined();
      expect(response.body.data.login.token).toBeDefined();
      expect(response.body.data.login.user.email).toBe('testuser@example.com');
    });

    it('should reject login with invalid password', async () => {
      const loginMutation = `
        mutation Login($input: LoginInput!) {
          login(input: $input) {
            token
          }
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .send({
          query: loginMutation,
          variables: {
            input: {
              email: 'testuser@example.com',
              password: 'wrongPassword'
            }
          }
        });

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].extensions.code).toBe('UNAUTHENTICATED');
    });

    it('should return current user with me query when authorized', async () => {
      // First login to get token
      const loginRes = await request(app)
        .post('/graphql')
        .send({
          query: `
            mutation Login($input: LoginInput!) {
              login(input: $input) {
                token
              }
            }
          `,
          variables: {
            input: {
              email: 'testuser@example.com',
              password: 'password123'
            }
          }
        });

      const token = loginRes.body.data.login.token;

      // Query me with Authorization header
      const meRes = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${token}`)
        .send({
          query: `
            query Me {
              me {
                email
                name
              }
            }
          `
        });

      expect(meRes.status).toBe(200);
      expect(meRes.body.errors).toBeUndefined();
      expect(meRes.body.data.me.email).toBe('testuser@example.com');
      expect(meRes.body.data.me.name).toBe('Test Engineer');
    });

    it('should reject me query with UNAUTHENTICATED when token is missing', async () => {
      const meRes = await request(app)
        .post('/graphql')
        .send({
          query: `
            query Me {
              me {
                email
              }
            }
          `
        });

      expect(meRes.status).toBe(200);
      expect(meRes.body.errors).toBeDefined();
      expect(meRes.body.errors[0].extensions.code).toBe('UNAUTHENTICATED');
    });
  });
});

