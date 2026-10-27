import { authResolvers } from './auth';

export const resolvers = {
  Query: {
    ...authResolvers.Query,
    workspaces: () => [],
    workspace: () => null,
    board: () => null,
    tasks: () => ({
      edges: [],
      pageInfo: {
        hasNextPage: false,
        hasPreviousPage: false,
        startCursor: null,
        endCursor: null
      },
      totalCount: 0
    }),
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
    ...authResolvers.Mutation
  }
};
