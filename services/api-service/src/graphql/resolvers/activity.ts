import { ActivityLog, WorkspaceRole, Prisma } from '@prisma/client';
import { GraphQLContext } from '../context';
import { requireAuth, requireBoardAccess } from '../../auth/rbac';
import { pubsub } from '../../lib/pubsub';

interface ActivityCursor {
  id: string;
  createdAt: string;
}

function encodeCursor(log: ActivityLog): string {
  return Buffer.from(
    JSON.stringify({ id: log.id, createdAt: log.createdAt.toISOString() })
  ).toString('base64');
}

function decodeCursor(cursor: string): ActivityCursor | null {
  try {
    const raw = Buffer.from(cursor, 'base64').toString('utf8');
    return JSON.parse(raw) as ActivityCursor;
  } catch {
    return null;
  }
}

export const activityResolvers = {
  Query: {
    boardActivity: async (
      _parent: unknown,
      args: { boardId: string; first?: number; after?: string },
      ctx: GraphQLContext
    ) => {
      const authUser = requireAuth(ctx.user);

      // Verify access to the board (at least VIEWER)
      await requireBoardAccess(args.boardId, authUser.userId, [
        WorkspaceRole.OWNER,
        WorkspaceRole.MEMBER,
        WorkspaceRole.VIEWER
      ]);

      const limit = Math.min(Math.max(args.first || 20, 1), 100);
      const where: Prisma.ActivityLogWhereInput = {
        boardId: args.boardId
      };

      if (args.after) {
        const cursor = decodeCursor(args.after);
        if (cursor) {
          where.createdAt = {
            lt: new Date(cursor.createdAt)
          };
        }
      }

      const [totalCount, logs] = await Promise.all([
        ctx.prisma.activityLog.count({ where: { boardId: args.boardId } }),
        ctx.prisma.activityLog.findMany({
          where,
          take: limit + 1,
          orderBy: { createdAt: 'desc' }
        })
      ]);

      const hasNextPage = logs.length > limit;
      const nodes = hasNextPage ? logs.slice(0, limit) : logs;
      const edges = nodes.map((log) => ({
        cursor: encodeCursor(log),
        node: log
      }));

      return {
        edges,
        pageInfo: {
          hasNextPage,
          hasPreviousPage: !!args.after,
          startCursor: edges.length > 0 ? edges[0].cursor : null,
          endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null
        },
        totalCount
      };
    }
  },

  Subscription: {
    boardUpdated: {
      subscribe: async (
        _parent: unknown,
        args: { boardId: string },
        ctx: GraphQLContext
      ) => {
        // Enforce authentication on the WebSocket subscription connection
        const authUser = requireAuth(ctx.user);
        await requireBoardAccess(args.boardId, authUser.userId, [
          WorkspaceRole.OWNER,
          WorkspaceRole.MEMBER,
          WorkspaceRole.VIEWER
        ]);

        return pubsub.asyncIterableIterator(`boardUpdated:${args.boardId}`);
      }
    }
  },

  ActivityLog: {
    task: async (parent: ActivityLog, _args: unknown, ctx: GraphQLContext) => {
      if (!parent.taskId) return null;
      return ctx.prisma.task.findUnique({ where: { id: parent.taskId } });
    },
    user: async (parent: ActivityLog, _args: unknown, ctx: GraphQLContext) => {
      return ctx.loaders.userLoader.load(parent.userId);
    }
  }
};

