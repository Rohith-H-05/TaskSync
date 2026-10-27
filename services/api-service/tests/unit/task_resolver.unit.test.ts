import { taskResolvers } from '../../src/graphql/resolvers/task';
import { GraphQLContext } from '../../src/graphql/context';
import { ErrorCode } from '../../src/lib/errors';
import * as rbac from '../../src/auth/rbac';
import { WorkspaceRole } from '@prisma/client';

// Mock dependencies
jest.mock('../../src/lib/pubsub', () => ({
  emitBoardEvent: jest.fn().mockResolvedValue(undefined),
  BoardEventType: {
    TASK_CREATED: 'TASK_CREATED',
    TASK_UPDATED: 'TASK_UPDATED',
    TASK_MOVED: 'TASK_MOVED',
    TASK_DELETED: 'TASK_DELETED'
  }
}));

jest.mock('../../src/lib/cache', () => ({
  invalidateBoardCache: jest.fn().mockResolvedValue(undefined)
}));

describe('Task Resolver Unit Tests', () => {
  const mockUserId = '11111111-1111-1111-1111-111111111111';
  const mockBoardId = '22222222-2222-2222-2222-222222222222';
  const mockColumnId = '33333333-3333-3333-3333-333333333333';
  const mockTaskId = '44444444-4444-4444-4444-444444444444';

  let mockPrisma: any;
  let mockCtx: GraphQLContext;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPrisma = {
      task: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn()
      },
      column: {
        findFirst: jest.fn(),
        findMany: jest.fn()
      },
      board: {
        findUnique: jest.fn()
      },
      $transaction: jest.fn((callback) => callback(mockPrisma))
    };

    mockCtx = {
      req: undefined,
      prisma: mockPrisma,
      redis: {} as any,
      redisPublisher: {} as any,
      user: { userId: mockUserId, email: 'unit-test@tasksync.local' },
      loaders: {
        userLoader: {
          load: jest.fn().mockResolvedValue({ id: mockUserId, name: 'Unit User', email: 'unit-test@tasksync.local' })
        }
      } as any
    };
  });

  describe('Authentication & Authorization Guards', () => {
    it('throws UNAUTHENTICATED error if user is not logged in', async () => {
      mockCtx.user = null;

      await expect(
        taskResolvers.Mutation.createTask(
          {},
          {
            input: {
              boardId: mockBoardId,
              columnId: mockColumnId,
              title: 'Unauthorized Task',
              position: 1000.0
            }
          },
          mockCtx
        )
      ).rejects.toMatchObject({
        extensions: { code: ErrorCode.UNAUTHENTICATED }
      });
    });

    it('rejects VIEWER role with FORBIDDEN on createTask mutation', async () => {
      jest.spyOn(rbac, 'requireBoardAccess').mockRejectedValueOnce({
        extensions: { code: ErrorCode.FORBIDDEN },
        message: 'Permission denied: Requires role OWNER or MEMBER. Your role is VIEWER.'
      });

      await expect(
        taskResolvers.Mutation.createTask(
          {},
          {
            input: {
              boardId: mockBoardId,
              columnId: mockColumnId,
              title: 'Attempted Task by Viewer',
              position: 1000.0
            }
          },
          mockCtx
        )
      ).rejects.toMatchObject({
        extensions: { code: ErrorCode.FORBIDDEN }
      });
    });

    it('rejects invalid inputs with BAD_USER_INPUT (e.g. whitespace-only title)', async () => {
      await expect(
        taskResolvers.Mutation.createTask(
          {},
          {
            input: {
              boardId: mockBoardId,
              columnId: mockColumnId,
              title: '   ', // whitespace only
              position: 1000.0
            }
          },
          mockCtx
        )
      ).rejects.toMatchObject({
        extensions: { code: ErrorCode.BAD_USER_INPUT }
      });
    });
  });

  describe('Task Creation & Movement', () => {
    it('creates a task successfully when caller is MEMBER', async () => {
      jest.spyOn(rbac, 'requireBoardAccess').mockResolvedValueOnce({
        board: { id: mockBoardId, workspaceId: 'ws-123' },
        membership: { id: 'm-1', workspaceId: 'ws-123', userId: mockUserId, role: WorkspaceRole.MEMBER, createdAt: new Date() }
      });

      mockPrisma.column.findFirst.mockResolvedValueOnce({
        id: mockColumnId,
        boardId: mockBoardId
      });

      const createdTaskMock = {
        id: mockTaskId,
        boardId: mockBoardId,
        columnId: mockColumnId,
        title: 'New Unit Task',
        description: null,
        position: 1000.0,
        assigneeId: null,
        dueDate: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockPrisma.task.create.mockResolvedValueOnce(createdTaskMock);

      const result = await taskResolvers.Mutation.createTask(
        {},
        {
          input: {
            boardId: mockBoardId,
            columnId: mockColumnId,
            title: 'New Unit Task',
            position: 1000.0
          }
        },
        mockCtx
      );

      expect(result).toEqual(createdTaskMock);
      expect(mockPrisma.task.create).toHaveBeenCalledTimes(1);
    });

    it('rejects task creation if column does not belong to specified board', async () => {
      jest.spyOn(rbac, 'requireBoardAccess').mockResolvedValueOnce({
        board: { id: mockBoardId, workspaceId: 'ws-123' },
        membership: { id: 'm-1', workspaceId: 'ws-123', userId: mockUserId, role: WorkspaceRole.OWNER, createdAt: new Date() }
      });

      mockPrisma.column.findFirst.mockResolvedValueOnce(null); // column not found

      await expect(
        taskResolvers.Mutation.createTask(
          {},
          {
            input: {
              boardId: mockBoardId,
              columnId: mockColumnId,
              title: 'Task in wrong column',
              position: 1000.0
            }
          },
          mockCtx
        )
      ).rejects.toMatchObject({
        extensions: { code: ErrorCode.BAD_USER_INPUT }
      });
    });
  });
});
