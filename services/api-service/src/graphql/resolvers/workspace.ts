import { z } from 'zod';
import { WorkspaceRole, Workspace, WorkspaceMember } from '@prisma/client';
import { GraphQLContext } from '../context';
import { requireAuth, requireWorkspaceRole } from '../../auth/rbac';
import { createGraphQLError, ErrorCode } from '../../lib/errors';

const createWorkspaceSchema = z.object({
  name: z.string().min(1, 'Workspace name is required').trim()
});

const addMemberSchema = z.object({
  workspaceId: z.string().uuid(),
  email: z.string().email().toLowerCase().trim(),
  role: z.nativeEnum(WorkspaceRole)
});

const updateMemberRoleSchema = z.object({
  workspaceId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.nativeEnum(WorkspaceRole)
});

function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '') || 'workspace';
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return `${base}-${randomSuffix}`;
}

export const workspaceResolvers = {
  Query: {
    workspaces: async (_parent: unknown, _args: unknown, ctx: GraphQLContext) => {
      const authUser = requireAuth(ctx.user);

      // Return all workspaces where the caller has a membership
      const memberships = await ctx.prisma.workspaceMember.findMany({
        where: { userId: authUser.userId },
        include: { workspace: true },
        orderBy: { createdAt: 'desc' }
      });

      return memberships.map((m) => m.workspace);
    },

    workspace: async (_parent: unknown, args: { id: string }, ctx: GraphQLContext) => {
      const authUser = requireAuth(ctx.user);

      // Verify caller is a member (OWNER, MEMBER, or VIEWER)
      await requireWorkspaceRole(args.id, authUser.userId, [
        WorkspaceRole.OWNER,
        WorkspaceRole.MEMBER,
        WorkspaceRole.VIEWER
      ]);

      const workspace = await ctx.prisma.workspace.findUnique({
        where: { id: args.id }
      });

      if (!workspace) {
        throw createGraphQLError('Workspace not found', ErrorCode.NOT_FOUND);
      }

      return workspace;
    }
  },

  Mutation: {
    createWorkspace: async (
      _parent: unknown,
      args: { input: z.infer<typeof createWorkspaceSchema> },
      ctx: GraphQLContext
    ) => {
      const authUser = requireAuth(ctx.user);
      const validation = createWorkspaceSchema.safeParse(args.input);
      if (!validation.success) {
        throw createGraphQLError(
          validation.error.errors[0]?.message || 'Invalid input',
          ErrorCode.BAD_USER_INPUT
        );
      }

      const { name } = validation.data;
      const slug = generateSlug(name);

      // Create workspace and immediately assign creator as OWNER in a single transaction
      const workspace = await ctx.prisma.$transaction(async (tx) => {
        const ws = await tx.workspace.create({
          data: {
            name,
            slug
          }
        });

        await tx.workspaceMember.create({
          data: {
            workspaceId: ws.id,
            userId: authUser.userId,
            role: WorkspaceRole.OWNER
          }
        });

        return ws;
      });

      return workspace;
    },

    addWorkspaceMember: async (
      _parent: unknown,
      args: { input: z.infer<typeof addMemberSchema> },
      ctx: GraphQLContext
    ) => {
      const authUser = requireAuth(ctx.user);
      const validation = addMemberSchema.safeParse(args.input);
      if (!validation.success) {
        throw createGraphQLError(
          validation.error.errors[0]?.message || 'Invalid input',
          ErrorCode.BAD_USER_INPUT
        );
      }

      const { workspaceId, email, role } = validation.data;

      // Only OWNER can add members
      await requireWorkspaceRole(workspaceId, authUser.userId, [WorkspaceRole.OWNER]);

      const targetUser = await ctx.prisma.user.findUnique({
        where: { email }
      });

      if (!targetUser) {
        throw createGraphQLError(
          `User with email "${email}" not found. User must register first.`,
          ErrorCode.NOT_FOUND
        );
      }

      const existingMember = await ctx.prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId: targetUser.id
          }
        }
      });

      if (existingMember) {
        throw createGraphQLError('User is already a member of this workspace', ErrorCode.CONFLICT);
      }

      return ctx.prisma.workspaceMember.create({
        data: {
          workspaceId,
          userId: targetUser.id,
          role
        },
        include: { user: true }
      });
    },

    updateWorkspaceMemberRole: async (
      _parent: unknown,
      args: { input: z.infer<typeof updateMemberRoleSchema> },
      ctx: GraphQLContext
    ) => {
      const authUser = requireAuth(ctx.user);
      const validation = updateMemberRoleSchema.safeParse(args.input);
      if (!validation.success) {
        throw createGraphQLError(
          validation.error.errors[0]?.message || 'Invalid input',
          ErrorCode.BAD_USER_INPUT
        );
      }

      const { workspaceId, userId, role } = validation.data;

      // Only OWNER can update roles
      await requireWorkspaceRole(workspaceId, authUser.userId, [WorkspaceRole.OWNER]);

      // If demoting an OWNER, ensure at least one other OWNER remains
      if (role !== WorkspaceRole.OWNER) {
        const ownerCount = await ctx.prisma.workspaceMember.count({
          where: {
            workspaceId,
            role: WorkspaceRole.OWNER
          }
        });

        const targetMember = await ctx.prisma.workspaceMember.findUnique({
          where: { workspaceId_userId: { workspaceId, userId } }
        });

        if (targetMember?.role === WorkspaceRole.OWNER && ownerCount <= 1) {
          throw createGraphQLError(
            'Cannot demote the sole owner of the workspace',
            ErrorCode.BAD_USER_INPUT
          );
        }
      }

      return ctx.prisma.workspaceMember.update({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId
          }
        },
        data: { role },
        include: { user: true }
      });
    },

    removeWorkspaceMember: async (
      _parent: unknown,
      args: { workspaceId: string; userId: string },
      ctx: GraphQLContext
    ) => {
      const authUser = requireAuth(ctx.user);
      const { workspaceId, userId } = args;

      // Caller must be an OWNER, or user removing themselves
      if (authUser.userId !== userId) {
        await requireWorkspaceRole(workspaceId, authUser.userId, [WorkspaceRole.OWNER]);
      }

      // Check if removing the last owner
      const targetMember = await ctx.prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } }
      });

      if (!targetMember) {
        throw createGraphQLError('Member not found in workspace', ErrorCode.NOT_FOUND);
      }

      if (targetMember.role === WorkspaceRole.OWNER) {
        const ownerCount = await ctx.prisma.workspaceMember.count({
          where: { workspaceId, role: WorkspaceRole.OWNER }
        });
        if (ownerCount <= 1) {
          throw createGraphQLError(
            'Cannot remove the sole owner of the workspace',
            ErrorCode.BAD_USER_INPUT
          );
        }
      }

      await ctx.prisma.workspaceMember.delete({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId
          }
        }
      });

      return true;
    }
  },

  Workspace: {
    members: async (parent: Workspace, _args: unknown, ctx: GraphQLContext) => {
      return ctx.loaders.workspaceMembersLoader.load(parent.id);
    },
    boards: async (parent: Workspace, _args: unknown, ctx: GraphQLContext) => {
      return ctx.prisma.board.findMany({
        where: { workspaceId: parent.id },
        orderBy: { createdAt: 'desc' }
      });
    }
  },

  WorkspaceMember: {
    user: async (parent: WorkspaceMember, _args: unknown, ctx: GraphQLContext) => {
      return ctx.loaders.userLoader.load(parent.userId);
    }
  }
};

