'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type Role = {
  id: string;
  key: string;
  name: string;
};

type SessionUser = {
  id: string;
  username: string;
  email: string;
  displayName: string;
  roles?: Role[];
  permissions: string[];
};

type Session = {
  accessToken: string;
  expiresAt: string;
  user: SessionUser;
  permissions: string[];
};

type AdminContextType = {
  session: Session | null;
  setSession: (session: Session | null) => void;
  status: string;
  setStatus: (status: string) => void;
  isBooting: boolean;
  login: (identity: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  apiBaseUrl: string;
};

const AdminContext = createContext<AdminContextType | undefined>(undefined);

const storageKey = 'sports-admin-session-v1';

export function AdminProvider({ children, apiBaseUrl }: { children: React.ReactNode; apiBaseUrl: string }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState('');
  const [isBooting, setIsBooting] = useState(true);

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) {
      setIsBooting(false);
      return;
    }

    try {
      const parsed = JSON.parse(saved) as Session;
      fetch(`${apiBaseUrl}/admin/auth/me`, {
        headers: {
          Authorization: `Bearer ${parsed.accessToken}`,
        },
      })
        .then(async (response) => {
          if (!response.ok) throw new Error('SESSION_EXPIRED');
          const data = await response.json();
          const nextSession = { ...parsed, user: data.user, permissions: data.permissions };
          setSession(nextSession);
          window.localStorage.setItem(storageKey, JSON.stringify(nextSession));
        })
        .catch(() => {
          window.localStorage.removeItem(storageKey);
          setStatus('登录已过期');
        })
        .finally(() => setIsBooting(false));
    } catch {
      setIsBooting(false);
    }
  }, [apiBaseUrl]);

  const login = async (identity: string, password: string) => {
    setStatus('');
    const response = await fetch(`${apiBaseUrl}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity, password }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || '登录失败');
    const nextSession = {
      accessToken: data.accessToken,
      expiresAt: data.expiresAt,
      user: data.user,
      permissions: data.user.permissions,
    };
    setSession(nextSession);
    window.localStorage.setItem(storageKey, JSON.stringify(nextSession));
  };

  const logout = async () => {
    if (session) {
      await fetch(`${apiBaseUrl}/admin/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.accessToken}` },
      }).catch(() => undefined);
    }
    setSession(null);
    window.localStorage.removeItem(storageKey);
  };

  return (
    <AdminContext.Provider value={{ session, setSession, status, setStatus, isBooting, login, logout, apiBaseUrl }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) throw new Error('useAdmin must be used within AdminProvider');
  return context;
}
