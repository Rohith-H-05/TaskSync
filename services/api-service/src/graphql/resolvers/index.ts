import { authResolvers } from './auth';
import { workspaceResolvers } from './workspace';
import { boardResolvers } from './board';
import { columnResolvers } from './column';
import { taskResolvers } from './task';
import { activityResolvers } from './activity';

export const resolvers = {
  Query: {
    ...authResolvers.Query,
    ...workspaceResolvers.Query,
    ...boardResolvers.Query,
    ...taskResolvers.Query,
    ...activityResolvers.Query
  },

  Mutation: {
    ...authResolvers.Mutation,
    ...workspaceResolvers.Mutation,
    ...boardResolvers.Mutation,
    ...columnResolvers.Mutation,
    ...taskResolvers.Mutation
  },

  Subscription: {
    ...activityResolvers.Subscription
  },

  Workspace: workspaceResolvers.Workspace,
  WorkspaceMember: workspaceResolvers.WorkspaceMember,
  Board: boardResolvers.Board,
  Column: columnResolvers.Column,
  Task: taskResolvers.Task,
  ActivityLog: activityResolvers.ActivityLog
};

