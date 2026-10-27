import { GraphQLError } from 'graphql';

export enum ErrorCode {
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  BAD_USER_INPUT = 'BAD_USER_INPUT',
  CONFLICT = 'CONFLICT',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR'
}

export function createGraphQLError(
  message: string,
  code: ErrorCode,
  details?: Record<string, unknown>
): GraphQLError {
  return new GraphQLError(message, {
    extensions: {
      code,
      details,
      timestamp: new Date().toISOString()
    }
  });
}
