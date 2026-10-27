import { z } from 'zod';
import { WorkspaceRole, Board } from '@prisma/client';
import { GraphQLContext } from '../context';
import { requireAuth, requireWorkspaceRole, requireBoardAccess } from '../../auth/rbac';
import { createGraphQLError, ErrorCode } from '../../lib/errors';
import { getCachedBoard, setCachedBoard, invalidateBoardCache } from '../../lib/cache';

const createBoardSchema = z.object({
  workspaceId: z.string().uuid(),
  title: z.string().trim().min(1, 'Board title is required'),
  description: z.string().optional()
});

const updateBoardSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).optional(),
  description: z.string().optional().nullable()
});

export const boardResolvers = {
  Query: {
    board: async (_parent: unknown, args: { id: string }, ctx: GraphQLContext) => {
      const authUser = requireAuth(ctx.user);

      // Verify board exists and caller has read access (OWNER, MEMBER, or VIEWER)
      await requireBoardAccess(args.id, authUser.userId, [
        WorkspaceRole.OWNER,
        WorkspaceRole.MEMBER,
        WorkspaceRole.VIEWER
      ]);

      // ── Cache-Aside Read ──────────────────────────────────────────────────────
      // 1. Check Redis for cached board aggregate (key: board:{id})
      const cacheHit = await getCachedBoard<Board>(args.id);
      if (cacheHit) {
        console.log(`[Cache] HIT  board:${args.id}`);
        return cacheHit;
      }
      console.log(`[Cache] MISS board:${args.id} — querying Postgres`);

      // 2. Cache MISS → fetch from Postgres via Prisma
      const board = await ctx.prisma.board.findUnique({
        where: { id: args.id }
      });

      if (!board) {
        throw createGraphQLError('Board not found', ErrorCode.NOT_FOUND);
      }

      // 3. Hydrate cache for subsequent requests (fire-and-forget, non-blocking)
      setCachedBoard(args.id, board).catch(console.error);

      return board;
    }
  },

  Mutation: {
    createBoard: async (
      _parent: unknown,
      args: { input: z.infer<typeof createBoardSchema> },
      ctx: GraphQLContext
    ) => {
      const authUser = requireAuth(ctx.user);
      const validation = createBoardSchema.safeParse(args.input);
      if (!validation.success) {
        throw createGraphQLError(
          validation.error.errors[0]?.message || 'Invalid input',
          ErrorCode.BAD_USER_INPUT
        );
      }

      const { workspaceId, title, description } = validation.data;

      // Only OWNER or MEMBER can create boards in a workspace (VIEWER rejected)
      await requireWorkspaceRole(workspaceId, authUser.userId, [
        WorkspaceRole.OWNER,
        WorkspaceRole.MEMBER
      ]);

      // Create board with default starter columns in a single transaction
      const board = await ctx.prisma.$transaction(async (tx) => {
        const newBoard = await tx.board.create({
          data: {
            workspaceId,
            title,
            description: description || null
          }
        });

        // Initialize standard Kanban workflow columns
        await tx.column.createMany({
          data: [
            { boardId: newBoard.id, title: 'To Do', position: 1000.0 },
            { boardId: newBoard.id, title: 'In Progress', position: 2000.0 },
            { boardId: newBoard.id, title: 'Done', position: 3000.0 }
          ]
        });

        return newBoard;
      });

      // No cache to invalidate on create — new board has no cache entry yet
      return board;
    },

    updateBoard: async (
      _parent: unknown,
      args: { input: z.infer<typeof updateBoardSchema> },
      ctx: GraphQLContext
    ) => {
      const authUser = requireAuth(ctx.user);
      const validation = updateBoardSchema.safeParse(args.input);
      if (!validation.success) {
        throw createGraphQLError(
          validation.error.errors[0]?.message || 'Invalid input',
          ErrorCode.BAD_USER_INPUT
        );
      }

      const { id, title, description } = validation.data;

      // Ensure caller is OWNER or MEMBER (VIEWER rejected)
      await requireBoardAccess(id, authUser.userId, [
        WorkspaceRole.OWNER,
        WorkspaceRole.MEMBER
      ]);

      const updated = await ctx.prisma.board.update({
        where: { id },
        data: {
          ...(title !== undefined && { title }),
          ...(description !== undefined && { description })
        }
      });

      // Invalidate Redis cache — board metadata changed
      invalidateBoardCache(id).catch(console.error);

      return updated;
    },

    deleteBoard: async (
      _parent: unknown,
      args: { id: string },
      ctx: GraphQLContext
    ) => {
      const authUser = requireAuth(ctx.user);

      // Only OWNER or MEMBER can delete board
      await requireBoardAccess(args.id, authUser.userId, [
        WorkspaceRole.OWNER,
        WorkspaceRole.MEMBER
      ]);

      await ctx.prisma.board.delete({
        where: { id: args.id }
      });

      // Invalidate Redis cache — board deleted
      invalidateBoardCache(args.id).catch(console.error);

      return true;
    }
  },

  Board: {
    columns: async (parent: Board, _args: unknown, ctx: GraphQLContext) => {
      return ctx.loaders.columnsByBoardLoader.load(parent.id);
    }
  }
};

