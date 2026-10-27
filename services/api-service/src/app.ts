import express from 'express';
import cors from 'cors';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import depthLimit from 'graphql-depth-limit';
import { typeDefs } from './graphql/typeDefs';
import { resolvers } from './graphql/resolvers';
import { buildContext, GraphQLContext } from './graphql/context';
import { healthRouter } from './routes/health';
import { env } from './lib/env';

export async function createApp(): Promise<{ app: express.Express; apolloServer: ApolloServer<GraphQLContext> }> {
  const app = express();

  // Standard middleware
  app.use(
    cors({
      origin: [env.CLIENT_URL, 'http://localhost:5173', 'http://localhost:3000'],
      credentials: true
    })
  );
  app.use(express.json());

  // Mount health check routes
  app.use('/', healthRouter);

  // Initialize Apollo Server
  const apolloServer = new ApolloServer<GraphQLContext>({
    typeDefs,
    resolvers,
    validationRules: [depthLimit(6)], // Prevent deeply nested DoS queries
    formatError: (formattedError, error) => {
      // Preserve custom extensions (e.g. UNAUTHENTICATED, FORBIDDEN, BAD_USER_INPUT)
      return {
        message: formattedError.message,
        extensions: {
          code: formattedError.extensions?.code || 'INTERNAL_SERVER_ERROR',
          details: formattedError.extensions?.details,
          timestamp: formattedError.extensions?.timestamp
        }
      };
    }
  });

  await apolloServer.start();

  app.use(
    '/graphql',
    expressMiddleware(apolloServer, {
      context: buildContext
    })
  );

  return { app, apolloServer };
}

