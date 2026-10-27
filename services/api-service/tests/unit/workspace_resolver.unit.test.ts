import { workspaceResolvers } from '../../src/graphql/resolvers/workspace';
import { GraphQLContext } from '../../src/graphql/context';
import { ErrorCode } from '../../src/lib/errors';
import * as rbac from '../../src/auth/rbac';
import { WorkspaceRole } from '@prisma/client';

describe('Workspace Resolver Unit Tests', () => {
  const mockOwnerId = '11111111-1111-1111-1111-111111111111';
  const mockMemberId = '22222222-2222-2222-2222-222222222222';
  const mockWorkspaceId = '33333333-3333-3333-3333-333333333333';

  let mockPrisma: any;
  let mockCtx: GraphQLContext;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPrisma = {
      workspace: {
        findUnique: jest.fn(),
        create: jest.fn()
      },
      workspaceMember: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn()
      },
      user: {
        findUnique: jest.fn()
      },
      $transaction: jest.fn((callback) => callback(mockPrisma))
    };

    mockCtx = {
      req: undefined,
      prisma: mockPrisma,
      redis: {} as any,
      redisPublisher: {} as any,
      user: { userId: mockOwnerId, email: 'owner@tasksync.local' },
      loaders: {} as any
    };
  });

  describe('createWorkspace', () => {
    it('throws UNAUTHENTICATED if context has no user', async () => {
      mockCtx.user = null;

      await expect(
        workspaceResolvers.Mutation.createWorkspace(
          {},
          { input: { name: 'Engineering' } },
          mockCtx
        )
      ).rejects.toMatchObject({
        extensions: { code: ErrorCode.UNAUTHENTICATED }
      });
    });

    it('rejects empty workspace name with BAD_USER_INPUT', async () => {
      await expect(
        workspaceResolvers.Mutation.createWorkspace(
          {},
          { input: { name: '   ' } },
          mockCtx
        )
      ).rejects.toMatchObject({
        extensions: { code: ErrorCode.BAD_USER_INPUT }
      });
    });

    it('creates workspace and assigns creator as OWNER in a transaction', async () => {
      const mockCreatedWs = {
        id: mockWorkspaceId,
        name: 'Design Team',
        slug: 'design-team-xyz123',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.workspace.create.mockResolvedValueOnce(mockCreatedWs);
      mockPrisma.workspaceMember.create.mockResolvedValueOnce({
        id: 'member-1',
        workspaceId: mockWorkspaceId,
        userId: mockOwnerId,
        role: WorkspaceRole.OWNER,
        createdAt: new Date()
      });

      const result = await workspaceResolvers.Mutation.createWorkspace(
        {},
        { input: { name: 'Design Team' } },
        mockCtx
      );

      expect(result).toEqual(mockCreatedWs);
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('addWorkspaceMember & RBAC', () => {
    it('rejects non-owner callers with FORBIDDEN', async () => {
      jest.spyOn(rbac, 'requireWorkspaceRole').mockRejectedValueOnce({
        extensions: { code: ErrorCode.FORBIDDEN },
        message: 'Permission denied: Requires role OWNER.'
      });

      await expect(
        workspaceResolvers.Mutation.addWorkspaceMember(
          {},
          {
            input: {
              workspaceId: mockWorkspaceId,
              email: 'newuser@tasksync.local',
              role: WorkspaceRole.MEMBER
            }
          },
          mockCtx
        )
      ).rejects.toMatchObject({
        extensions: { code: ErrorCode.FORBIDDEN }
      });
    });

    it('throws NOT_FOUND if invited user has not registered', async () => {
      jest.spyOn(rbac, 'requireWorkspaceRole').mockResolvedValueOnce({} as any);
      mockPrisma.user.findUnique.mockResolvedValueOnce(null); // User does not exist

      await expect(
        workspaceResolvers.Mutation.addWorkspaceMember(
          {},
          {
            input: {
              workspaceId: mockWorkspaceId,
              email: 'unregistered@tasksync.local',
              role: WorkspaceRole.MEMBER
            }
          },
          mockCtx
        )
      ).rejects.toMatchObject({
        extensions: { code: ErrorCode.NOT_FOUND }
      });
    });

    it('throws CONFLICT if invited user is already a member', async () => {
      jest.spyOn(rbac, 'requireWorkspaceRole').mockResolvedValueOnce({} as any);
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: mockMemberId,
        email: 'existing@tasksync.local'
      });
      mockPrisma.workspaceMember.findUnique.mockResolvedValueOnce({
        id: 'membership-exists',
        workspaceId: mockWorkspaceId,
        userId: mockMemberId,
        role: WorkspaceRole.MEMBER
      });

      await expect(
        workspaceResolvers.Mutation.addWorkspaceMember(
          {},
          {
            input: {
              workspaceId: mockWorkspaceId,
              email: 'existing@tasksync.local',
              role: WorkspaceRole.MEMBER
            }
          },
          mockCtx
        )
      ).rejects.toMatchObject({
        extensions: { code: ErrorCode.CONFLICT }
      });
    });
  });

  describe('updateWorkspaceMemberRole (Ownership Demotion Guard)', () => {
    it('prevents demoting the sole owner of a workspace', async () => {
      jest.spyOn(rbac, 'requireWorkspaceRole').mockResolvedValueOnce({} as any);

      // Only 1 owner exists in workspace
      mockPrisma.workspaceMember.count.mockResolvedValueOnce(1);
      // Target member being demoted is currently that OWNER
      mockPrisma.workspaceMember.findUnique.mockResolvedValueOnce({
        id: 'sole-owner-membership',
        workspaceId: mockWorkspaceId,
        userId: mockOwnerId,
        role: WorkspaceRole.OWNER
      });

      await expect(
        workspaceResolvers.Mutation.updateWorkspaceMemberRole(
          {},
          {
            input: {
              workspaceId: mockWorkspaceId,
              userId: mockOwnerId,
              role: WorkspaceRole.MEMBER // attempt demotion
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
