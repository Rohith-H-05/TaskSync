import React, { createContext, useContext, useState, useEffect } from 'react';
import { useQuery } from '@apollo/client';
import { ME_QUERY } from '../graphql/operations';
import { apolloClient } from '../lib/apollo';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('tasksync_token'));
  const [user, setUser] = useState<AuthUser | null>(null);

  const { data, loading, error } = useQuery(ME_QUERY, {
    skip: !token,
    fetchPolicy: 'network-only'
  });

  useEffect(() => {
    if (data?.me) {
      setUser(data.me);
    }
  }, [data]);

  useEffect(() => {
    if (error && token) {
      // Token is expired or invalid
      logout();
    }
  }, [error, token]);

  const login = (newToken: string, newUser: AuthUser) => {
    localStorage.setItem('tasksync_token', newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('tasksync_token');
    setToken(null);
    setUser(null);
    apolloClient.clearStore();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading: !!token && loading,
        login,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

