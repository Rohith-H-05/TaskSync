import { z } from 'zod';
import { WorkspaceRole, Column } from '@prisma/client';
import { GraphQLContext } from '../context';
import { requireAuth, requireBoardAccess } from '../../auth/rbac';
import { createGraphQLError, ErrorCode } from '../../lib/errors';

const createColumnSchema = z.object({
  boardId: z.string().uuid(),
  title: z.string().min(1, 'Column title is required').trim(),
  position: z.number()
});

const updateColumnSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1, 'Column title is required').trim()
});

const moveColumnSchema = z.object({
  id: z.string().uuid(),
  newPosition: z.number()
});

export const columnResolvers = {
  Mutation: {
    createColumn: async (
      _parent: unknown,
      args: { input: z.infer<typeof createColumnSchema> },
      ctx: GraphQLContext
    ) => {
      const authUser = requireAuth(ctx.user);
      const validation = createColumnSchema.safeParse(args.input);
      if (!validation.success) {
        throw createGraphQLError(
          validation.error.errors[0]?.message || 'Invalid input',
          ErrorCode.BAD_USER_INPUT
        );
      }

      const { boardId, title, position } = validation.data;

      // Ensure caller is OWNER or MEMBER (VIEWER rejected)
      await requireBoardAccess(boardId, authUser.userId, [
        WorkspaceRole.OWNER,
        WorkspaceRole.MEMBER
      ]);

      const column = await ctx.prisma.column.create({
        data: {
          boardId,
          title,
          position
        }
      });

      return column;
    },

    updateColumn: async (
      _parent: unknown,
      args: { input: z.infer<typeof updateColumnSchema> },
      ctx: GraphQLContext
    ) => {
      const authUser = requireAuth(ctx.user);
      const validation = updateColumnSchema.safeParse(args.input);
      if (!validation.success) {
        throw createGraphQLError(
          validation.error.errors[0]?.message || 'Invalid input',
          ErrorCode.BAD_USER_INPUT
        );
      }

      const { id, title } = validation.data;

      const column = await ctx.prisma.column.findUnique({
        where: { id }
      });
      if (!column) {
        throw createGraphQLError('Column not found', ErrorCode.NOT_FOUND);
      }

      // Ensure caller is OWNER or MEMBER
      await requireBoardAccess(column.boardId, authUser.userId, [
        WorkspaceRole.OWNER,
        WorkspaceRole.MEMBER
      ]);

      const updated = await ctx.prisma.column.update({
        where: { id },
        data: { title }
      });

      return updated;
    },

    deleteColumn: async (
      _parent: unknown,
      args: { id: string },
      ctx: GraphQLContext
    ) => {
      const authUser = requireAuth(ctx.user);

      const column = await ctx.prisma.column.findUnique({
        where: { id: args.id }
      });
      if (!column) {
        throw createGraphQLError('Column not found', ErrorCode.NOT_FOUND);
      }

      // Ensure caller is OWNER or MEMBER
      await requireBoardAccess(column.boardId, authUser.userId, [
        WorkspaceRole.OWNER,
        WorkspaceRole.MEMBER
      ]);

      await ctx.prisma.column.delete({
        where: { id: args.id }
      });

      return true;
    },

    moveColumn: async (
      _parent: unknown,
      args: { input: z.infer<typeof moveColumnSchema> },
      ctx: GraphQLContext
    ) => {
      const authUser = requireAuth(ctx.user);
      const validation = moveColumnSchema.safeParse(args.input);
      if (!validation.success) {
        throw createGraphQLError(
          validation.error.errors[0]?.message || 'Invalid input',
          ErrorCode.BAD_USER_INPUT
        );
      }

      const { id, newPosition } = validation.data;

      const column = await ctx.prisma.column.findUnique({
        where: { id }
      });
      if (!column) {
        throw createGraphQLError('Column not found', ErrorCode.NOT_FOUND);
      }

      // Ensure caller is OWNER or MEMBER
      await requireBoardAccess(column.boardId, authUser.userId, [
        WorkspaceRole.OWNER,
        WorkspaceRole.MEMBER
      ]);

      const updated = await ctx.prisma.column.update({
        where: { id },
        data: { position: newPosition }
      });

      return updated;
    }
  },

  Column: {
    tasks: async (parent: Column, _args: unknown, ctx: GraphQLContext) => {
      return ctx.loaders.tasksByColumnLoader.load(parent.id);
    }
  }
};
