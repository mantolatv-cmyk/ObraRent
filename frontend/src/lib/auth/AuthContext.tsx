'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { ClientUser, LoginPayload, RegisterPayload } from '@/lib/types';

interface AuthContextValue {
  user: ClientUser | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (payload: LoginPayload) => Promise<ClientUser>;
  register: (payload: RegisterPayload) => Promise<ClientUser>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = 'mantovani_token';
const USER_KEY = 'mantovani_user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ClientUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Initialize from localStorage on browser mount
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      const storedUser = localStorage.getItem(USER_KEY);
      if (storedToken) {
        setToken(storedToken);
        if (storedUser) {
          try {
            setUser(JSON.parse(storedUser) as ClientUser);
          } catch {
            // ignore JSON parse error
          }
        }
        // Validate with backend in background
        api.getMe()
          .then((freshUser) => {
            setUser(freshUser);
            localStorage.setItem(USER_KEY, JSON.stringify(freshUser));
          })
          .catch(() => {
            // If token expired or invalid, clear session
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
            setToken(null);
            setUser(null);
          })
          .finally(() => {
            setLoading(false);
          });
        return;
      }
    } catch {
      // localStorage may fail in restricted environments
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (payload: LoginPayload): Promise<ClientUser> => {
    const res = await api.login(payload);
    setToken(res.token);
    setUser(res.client);
    try {
      localStorage.setItem(TOKEN_KEY, res.token);
      localStorage.setItem(USER_KEY, JSON.stringify(res.client));
    } catch {
      // ignore storage errors
    }
    return res.client;
  }, []);

  const register = useCallback(async (payload: RegisterPayload): Promise<ClientUser> => {
    const res = await api.register(payload);
    setToken(res.token);
    setUser(res.client);
    try {
      localStorage.setItem(TOKEN_KEY, res.token);
      localStorage.setItem(USER_KEY, JSON.stringify(res.client));
    } catch {
      // ignore storage errors
    }
    return res.client;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch {
      // ignore storage errors
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const freshUser = await api.getMe();
      setUser(freshUser);
      localStorage.setItem(USER_KEY, JSON.stringify(freshUser));
    } catch {
      logout();
    }
  }, [logout]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        loading,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um <AuthProvider>');
  }
  return context;
}
