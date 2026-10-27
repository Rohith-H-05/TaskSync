import DataLoader from 'dataloader';
import { PrismaClient, User, Task, Column, WorkspaceMember } from '@prisma/client';

export interface DataLoaders {
  userLoader: DataLoader<string, User | null>;
  tasksByColumnLoader: DataLoader<string, Task[]>;
  columnsByBoardLoader: DataLoader<string, Column[]>;
  workspaceMembersLoader: DataLoader<string, WorkspaceMember[]>;
}

export function createLoaders(prisma: PrismaClient): DataLoaders {
  // Batch load users by ID
  const userLoader = new DataLoader<string, User | null>(async (userIds) => {
    const users = await prisma.user.findMany({
      where: { id: { in: [...userIds] } }
    });
    const userMap = new Map(users.map((u) => [u.id, u]));
    return userIds.map((id) => userMap.get(id) || null);
  });

  // Batch load tasks by column ID (ordered by position ASC)
  const tasksByColumnLoader = new DataLoader<string, Task[]>(async (columnIds) => {
    const tasks = await prisma.task.findMany({
      where: { columnId: { in: [...columnIds] } },
      orderBy: { position: 'asc' }
    });

    const tasksByColumn = new Map<string, Task[]>();
    for (const colId of columnIds) {
      tasksByColumn.set(colId, []);
    }
    for (const task of tasks) {
      tasksByColumn.get(task.columnId)?.push(task);
    }

    return columnIds.map((colId) => tasksByColumn.get(colId) || []);
  });

  // Batch load columns by board ID (ordered by position ASC)
  const columnsByBoardLoader = new DataLoader<string, Column[]>(async (boardIds) => {
    const columns = await prisma.column.findMany({
      where: { boardId: { in: [...boardIds] } },
      orderBy: { position: 'asc' }
    });

    const columnsByBoard = new Map<string, Column[]>();
    for (const bId of boardIds) {
      columnsByBoard.set(bId, []);
    }
    for (const col of columns) {
      columnsByBoard.get(col.boardId)?.push(col);
    }

    return boardIds.map((bId) => columnsByBoard.get(bId) || []);
  });

  // Batch load workspace members by workspace ID
  const workspaceMembersLoader = new DataLoader<string, WorkspaceMember[]>(async (workspaceIds) => {
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: { in: [...workspaceIds] } },
      include: { user: true }
    });

    const membersByWorkspace = new Map<string, WorkspaceMember[]>();
    for (const wsId of workspaceIds) {
      membersByWorkspace.set(wsId, []);
    }
    for (const m of members) {
      membersByWorkspace.get(m.workspaceId)?.push(m);
    }

    return workspaceIds.map((wsId) => membersByWorkspace.get(wsId) || []);
  });

  return {
    userLoader,
    tasksByColumnLoader,
    columnsByBoardLoader,
    workspaceMembersLoader
  };
}
