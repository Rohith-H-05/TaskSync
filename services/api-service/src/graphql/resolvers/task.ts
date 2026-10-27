import { z } from 'zod';
import { WorkspaceRole, Task, Prisma } from '@prisma/client';
import { GraphQLContext } from '../context';
import { requireAuth, requireBoardAccess } from '../../auth/rbac';
import { createGraphQLError, ErrorCode } from '../../lib/errors';
import { emitBoardEvent, BoardEventType } from '../../lib/pubsub';

const createTaskSchema = z.object({
  boardId: z.string().uuid(),
  columnId: z.string().uuid(),
  title: z.string().min(1, 'Task title is required').trim(),
  description: z.string().optional().nullable(),
  assigneeId: z.string().uuid().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  position: z.number()
});

const updateTaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).trim().optional(),
  description: z.string().optional().nullable(),
  assigneeId: z.string().uuid().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable()
});

const moveTaskSchema = z.object({
  id: z.string().uuid(),
  targetColumnId: z.string().uuid(),
  newPosition: z.number()
});

const taskFilterSchema = z.object({
  searchQuery: z.string().optional().nullable(),
  assigneeId: z.string().uuid().optional().nullable()
});

interface TaskCursor {
  id: string;
  position: number;
}

function encodeCursor(task: Task): string {
  return Buffer.from(JSON.stringify({ id: task.id, position: task.position })).toString('base64');
}

function decodeCursor(cursor: string): TaskCursor | null {
  try {
    const raw = Buffer.from(cursor, 'base64').toString('utf8');
    return JSON.parse(raw) as TaskCursor;
  } catch {
    return null;
  }
}

/**
 * Rebalances task positions in a column if spacing has decayed below float precision limit (1e-6)
 */
async function checkAndRebalanceColumn(prisma: Prisma.TransactionClient | GraphQLContext['prisma'], columnId: string) {
  const tasks = await prisma.task.findMany({
    where: { columnId },
    orderBy: { position: 'asc' },
    select: { id: true, position: true }
  });

  let needsRebalance = false;
  for (let i = 0; i < tasks.length - 1; i++) {
    if (Math.abs(tasks[i + 1].position - tasks[i].position) < 1e-6) {
      needsRebalance = true;
      break;
    }
  }

  if (needsRebalance) {
    console.log(`[TaskSync] Auto-rebalancing fractional positions in column ${columnId}`);
    // Spread tasks with 1000.0 increments
    for (let i = 0; i < tasks.length; i++) {
      await prisma.task.update({
        where: { id: tasks[i].id },
        data: { position: (i + 1) * 1000.0 }
      });
    }
  }
}

export const taskResolvers = {
  Query: {
    tasks: async (
      _parent: unknown,
      args: {
        boardId: string;
        columnId?: string;
        filter?: z.infer<typeof taskFilterSchema>;
        first?: number;
        after?: string;
      },
      ctx: GraphQLContext
    ) => {
      const authUser = requireAuth(ctx.user);

      // Verify read access (OWNER, MEMBER, or VIEWER)
      await requireBoardAccess(args.boardId, authUser.userId, [
        WorkspaceRole.OWNER,
        WorkspaceRole.MEMBER,
        WorkspaceRole.VIEWER
      ]);

      const limit = Math.min(Math.max(args.first || 20, 1), 100);
      const where: Prisma.TaskWhereInput = {
        boardId: args.boardId,
        ...(args.columnId && { columnId: args.columnId }),
        ...(args.filter?.assigneeId && { assigneeId: args.filter.assigneeId }),
        ...(args.filter?.searchQuery && {
          OR: [
            { title: { contains: args.filter.searchQuery, mode: 'insensitive' } },
            { description: { contains: args.filter.searchQuery, mode: 'insensitive' } }
          ]
        })
      };

      // Cursor filtering
      if (args.after) {
        const cursor = decodeCursor(args.after);
        if (cursor) {
          where.OR = [
            { position: { gt: cursor.position } },
            {
              AND: [
                { position: { equals: cursor.position } },
                { id: { gt: cursor.id } }
              ]
            }
          ];
        }
      }

      const [totalCount, tasks] = await Promise.all([
        ctx.prisma.task.count({ where }),
        ctx.prisma.task.findMany({
          where,
          take: limit + 1,
          orderBy: [{ position: 'asc' }, { id: 'asc' }]
        })
      ]);

      const hasNextPage = tasks.length > limit;
      const nodes = hasNextPage ? tasks.slice(0, limit) : tasks;
      const edges = nodes.map((task) => ({
        cursor: encodeCursor(task),
        node: task
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

  Mutation: {
    createTask: async (
      _parent: unknown,
      args: { input: z.infer<typeof createTaskSchema> },
      ctx: GraphQLContext
    ) => {
      const authUser = requireAuth(ctx.user);
      const validation = createTaskSchema.safeParse(args.input);
      if (!validation.success) {
        throw createGraphQLError(
          validation.error.errors[0]?.message || 'Invalid input',
          ErrorCode.BAD_USER_INPUT
        );
      }

      const { boardId, columnId, title, description, assigneeId, dueDate, position } = validation.data;

      // Ensure caller is OWNER or MEMBER (VIEWER rejected)
      await requireBoardAccess(boardId, authUser.userId, [
        WorkspaceRole.OWNER,
        WorkspaceRole.MEMBER
      ]);

      // Verify column belongs to board
      const column = await ctx.prisma.column.findFirst({
        where: { id: columnId, boardId }
      });
      if (!column) {
        throw createGraphQLError('Column does not belong to specified board', ErrorCode.BAD_USER_INPUT);
      }

      const task = await ctx.prisma.task.create({
        data: {
          boardId,
          columnId,
          title,
          description: description || null,
          assigneeId: assigneeId || null,
          dueDate: dueDate ? new Date(dueDate) : null,
          position
        }
      });

      const actorUser = await ctx.loaders.userLoader.load(authUser.userId);
      emitBoardEvent({
        type: BoardEventType.TASK_CREATED,
        boardId,
        columnId,
        taskId: task.id,
        task,
        actor: {
          id: authUser.userId,
          email: authUser.email,
          name: actorUser?.name || authUser.email
        },
        timestamp: new Date().toISOString()
      }).catch(console.error);

      return task;
    },

    updateTask: async (
      _parent: unknown,
      args: { input: z.infer<typeof updateTaskSchema> },
      ctx: GraphQLContext
    ) => {
      const authUser = requireAuth(ctx.user);
      const validation = updateTaskSchema.safeParse(args.input);
      if (!validation.success) {
        throw createGraphQLError(
          validation.error.errors[0]?.message || 'Invalid input',
          ErrorCode.BAD_USER_INPUT
        );
      }

      const { id, title, description, assigneeId, dueDate } = validation.data;

      const existingTask = await ctx.prisma.task.findUnique({
        where: { id }
      });
      if (!existingTask) {
        throw createGraphQLError('Task not found', ErrorCode.NOT_FOUND);
      }

      // Ensure caller is OWNER or MEMBER (VIEWER rejected)
      await requireBoardAccess(existingTask.boardId, authUser.userId, [
        WorkspaceRole.OWNER,
        WorkspaceRole.MEMBER
      ]);

      const updated = await ctx.prisma.task.update({
        where: { id },
        data: {
          ...(title !== undefined && { title }),
          ...(description !== undefined && { description }),
          ...(assigneeId !== undefined && { assigneeId }),
          ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null })
        }
      });

      const actorUser = await ctx.loaders.userLoader.load(authUser.userId);
      emitBoardEvent({
        type: BoardEventType.TASK_UPDATED,
        boardId: existingTask.boardId,
        columnId: existingTask.columnId,
        taskId: id,
        task: updated,
        actor: {
          id: authUser.userId,
          email: authUser.email,
          name: actorUser?.name || authUser.email
        },
        timestamp: new Date().toISOString()
      }).catch(console.error);

      return updated;
    },

    deleteTask: async (
      _parent: unknown,
      args: { id: string },
      ctx: GraphQLContext
    ) => {
      const authUser = requireAuth(ctx.user);

      const existingTask = await ctx.prisma.task.findUnique({
        where: { id: args.id }
      });
      if (!existingTask) {
        throw createGraphQLError('Task not found', ErrorCode.NOT_FOUND);
      }

      // Ensure caller is OWNER or MEMBER (VIEWER rejected)
      await requireBoardAccess(existingTask.boardId, authUser.userId, [
        WorkspaceRole.OWNER,
        WorkspaceRole.MEMBER
      ]);

      await ctx.prisma.task.delete({
        where: { id: args.id }
      });

      const actorUser = await ctx.loaders.userLoader.load(authUser.userId);
      emitBoardEvent({
        type: BoardEventType.TASK_DELETED,
        boardId: existingTask.boardId,
        columnId: existingTask.columnId,
        taskId: args.id,
        actor: {
          id: authUser.userId,
          email: authUser.email,
          name: actorUser?.name || authUser.email
        },
        timestamp: new Date().toISOString()
      }).catch(console.error);

      return true;
    },

    moveTask: async (
      _parent: unknown,
      args: { input: z.infer<typeof moveTaskSchema> },
      ctx: GraphQLContext
    ) => {
      const authUser = requireAuth(ctx.user);
      const validation = moveTaskSchema.safeParse(args.input);
      if (!validation.success) {
        throw createGraphQLError(
          validation.error.errors[0]?.message || 'Invalid input',
          ErrorCode.BAD_USER_INPUT
        );
      }

      const { id, targetColumnId, newPosition } = validation.data;

      const existingTask = await ctx.prisma.task.findUnique({
        where: { id }
      });
      if (!existingTask) {
        throw createGraphQLError('Task not found', ErrorCode.NOT_FOUND);
      }

      // Ensure caller is OWNER or MEMBER (VIEWER rejected)
      await requireBoardAccess(existingTask.boardId, authUser.userId, [
        WorkspaceRole.OWNER,
        WorkspaceRole.MEMBER
      ]);

      // Move task to target column with fractional position
      const updated = await ctx.prisma.task.update({
        where: { id },
        data: {
          columnId: targetColumnId,
          position: newPosition
        }
      });

      const actorUser = await ctx.loaders.userLoader.load(authUser.userId);
      emitBoardEvent({
        type: BoardEventType.TASK_MOVED,
        boardId: existingTask.boardId,
        columnId: targetColumnId,
        taskId: id,
        task: updated,
        actor: {
          id: authUser.userId,
          email: authUser.email,
          name: actorUser?.name || authUser.email
        },
        timestamp: new Date().toISOString()
      }).catch(console.error);

      // Background rebalance check if float gap is critically narrow
      checkAndRebalanceColumn(ctx.prisma, targetColumnId).catch((err) => {
        console.error('Error during auto-rebalance:', err);
      });

      return updated;
    }
  },

  Task: {
    assignee: async (parent: Task, _args: unknown, ctx: GraphQLContext) => {
      if (!parent.assigneeId) return null;
      return ctx.loaders.userLoader.load(parent.assigneeId);
    }
  }
};

