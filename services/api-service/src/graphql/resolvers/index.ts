import { authResolvers } from './auth';
import { workspaceResolvers } from './workspace';
import { boardResolvers } from './board';
import { columnResolvers } from './column';
import { taskResolvers } from './task';

export const resolvers = {
  Query: {
    ...authResolvers.Query,
    ...workspaceResolvers.Query,
    ...boardResolvers.Query,
    ...taskResolvers.Query,
    boardActivity: () => ({
      edges: [],
      pageInfo: {
        hasNextPage: false,
        hasPreviousPage: false,
        startCursor: null,
        endCursor: null
      },
      totalCount: 0
    })
  },

  Mutation: {
    ...authResolvers.Mutation,
    ...workspaceResolvers.Mutation,
    ...boardResolvers.Mutation,
    ...columnResolvers.Mutation,
    ...taskResolvers.Mutation
  },

  Workspace: workspaceResolvers.Workspace,
  WorkspaceMember: workspaceResolvers.WorkspaceMember,
  Board: boardResolvers.Board,
  Column: columnResolvers.Column,
  Task: taskResolvers.Task
};

