import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { account, ID } from './appwrite';
import type { Models } from 'appwrite';

type AuthState = {
  user: Models.User<Models.Preferences> | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Models.User<Models.Preferences> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const current = await account.get();
      setUser(current);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      setError(null);
      try {
        await account.createEmailPasswordSession(email, password);
        await refresh();
      } catch (e: any) {
        setError(e?.message ?? 'Sign in failed');
        throw e;
      }
    },
    [refresh]
  );

  const signUp = useCallback(
    async (email: string, password: string, name: string) => {
      setError(null);
      try {
        await account.create(ID.unique(), email, password, name);
        await account.createEmailPasswordSession(email, password);
        await refresh();
      } catch (e: any) {
        setError(e?.message ?? 'Sign up failed');
        throw e;
      }
    },
    [refresh]
  );

  const signOut = useCallback(async () => {
    try {
      await account.deleteSession('current');
    } finally {
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, error, signIn, signUp, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
