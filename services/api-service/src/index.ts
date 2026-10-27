import http from 'http';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { createApp } from './app';
import { env } from './lib/env';
import { typeDefs } from './graphql/typeDefs';
import { resolvers } from './graphql/resolvers';
import { prisma } from './lib/prisma';
import { redis, redisPublisher, redisSubscriber } from './lib/redis';
import { verifyToken } from './auth/jwt';

async function bootstrap() {
  try {
    // Connect Redis clients
    await Promise.all([
      redis.connect(),
      redisPublisher.connect(),
      redisSubscriber.connect()
    ]);
    console.log('✅ Connected to Redis');

    // Create Express & Apollo instances
    const { app, apolloServer } = await createApp();
    const httpServer = http.createServer(app);

    // Setup WebSocket server for GraphQL subscriptions
    const wsServer = new WebSocketServer({
      server: httpServer,
      path: '/graphql'
    });

    const schema = makeExecutableSchema({ typeDefs, resolvers });

    const serverCleanup = useServer(
      {
        schema,
        context: async (ctx) => {
          // Extract token from connectionParams
          let user = null;
          const authHeader = (ctx.connectionParams?.Authorization || ctx.connectionParams?.authorization) as string | undefined;
          if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            user = verifyToken(token);
          }
          return {
            prisma,
            redis,
            redisPublisher,
            user
          };
        }
      },
      wsServer
    );

    const port = env.PORT;
    httpServer.listen(port, () => {
      console.log(`🚀 TaskSync API Server ready at http://localhost:${port}/graphql`);
      console.log(`🔌 GraphQL Subscriptions ready at ws://localhost:${port}/graphql`);
      console.log(`🩺 Health check endpoint at http://localhost:${port}/health`);
    });

    // Graceful shutdown
    const shutdown = async () => {
      console.log('\n🛑 Gracefully shutting down...');
      await serverCleanup.dispose();
      await apolloServer.stop();
      httpServer.close();
      await prisma.$disconnect();
      redis.disconnect();
      redisPublisher.disconnect();
      redisSubscriber.disconnect();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error('❌ Failed to start API Server:', error);
    process.exit(1);
  }
}

bootstrap();
