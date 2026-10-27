import { WorkspaceRole, WorkspaceMember } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { createGraphQLError, ErrorCode } from '../lib/errors';
import { TokenPayload } from './jwt';

export interface AuthContextUser extends TokenPayload {
  name?: string;
}

export function requireAuth(user?: AuthContextUser | null): AuthContextUser {
  if (!user || !user.userId) {
    throw createGraphQLError('Authentication required. Please provide a valid Bearer token.', ErrorCode.UNAUTHENTICATED);
  }
  return user;
}

/**
 * Validates that the user is a member of the workspace with at least one of the allowed roles.
 * Viewers cannot mutate workspace or board resources.
 */
export async function requireWorkspaceRole(
  workspaceId: string,
  userId: string,
  allowedRoles: WorkspaceRole[]
): Promise<WorkspaceMember> {
  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId
      }
    }
  });

  if (!membership) {
    throw createGraphQLError(
      'Access denied: You are not a member of this workspace.',
      ErrorCode.FORBIDDEN
    );
  }

  if (!allowedRoles.includes(membership.role)) {
    throw createGraphQLError(
      `Permission denied: Requires role ${allowedRoles.join(' or ')}. Your role is ${membership.role}.`,
      ErrorCode.FORBIDDEN
    );
  }

  return membership;
}

/**
 * Validates workspace access via boardId
 */
export async function requireBoardAccess(
  boardId: string,
  userId: string,
  allowedRoles: WorkspaceRole[]
): Promise<{ board: { id: string; workspaceId: string }; membership: WorkspaceMember }> {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { id: true, workspaceId: true }
  });

  if (!board) {
    throw createGraphQLError('Board not found.', ErrorCode.NOT_FOUND);
  }

  const membership = await requireWorkspaceRole(board.workspaceId, userId, allowedRoles);
  return { board, membership };
}

