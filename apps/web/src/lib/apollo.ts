import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

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

export const apolloClient = new ApolloClient({
  link: authLink.concat(httpLink),
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
