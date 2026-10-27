import { ApolloClient, InMemoryCache, createHttpLink, split } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';
import { getMainDefinition } from '@apollo/client/utilities';

const httpLink = createHttpLink({
  uri: '/graphql'
});

const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('tasksync_token');
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : ''
    }
  };
});

// Configure WebSocket client for real-time GraphQL Subscriptions
const wsLink = typeof window !== 'undefined'
  ? new GraphQLWsLink(
      createClient({
        url: `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/graphql`,
        connectionParams: () => {
          const token = localStorage.getItem('tasksync_token');
          return {
            Authorization: token ? `Bearer ${token}` : ''
          };
        },
        retryAttempts: 10,
        shouldRetry: () => true
      })
    )
  : null;

// Split link: route subscriptions to WebSocket, queries and mutations to HTTP
const splitLink = typeof window !== 'undefined' && wsLink
  ? split(
      ({ query }) => {
        const definition = getMainDefinition(query);
        return (
          definition.kind === 'OperationDefinition' &&
          definition.operation === 'subscription'
        );
      },
      wsLink,
      authLink.concat(httpLink)
    )
  : authLink.concat(httpLink);

export const apolloClient = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache({
    typePolicies: {
      Board: {
        fields: {
          columns: {
            merge(_existing, incoming) {
              return incoming;
            }
          }
        }
      },
      Column: {
        fields: {
          tasks: {
            merge(_existing, incoming) {
              return incoming;
            }
          }
        }
      }
    }
  })
});
