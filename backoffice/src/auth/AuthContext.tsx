import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  api,
  getAccessToken,
  setAccessToken,
  setRefreshToken,
  getRefreshToken,
} from '../api/client';
import type { Role } from '../lib/labels';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  locale: string;
}

interface LoginResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

interface Permissions {
  role: Role;
  pages: { pageKey: string; canView: boolean; canManage: boolean }[];
}

interface AuthState {
  user: AuthUser | null;
  permissions: Permissions | null;
  loading: boolean;
  impersonating: { email: string; role: Role } | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  impersonate: (userId: string, email: string) => Promise<void>;
  stopImpersonation: () => void;
  can: (pageKey: string, level?: 'view' | 'manage') => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [permissions, setPermissions] = useState<Permissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [impersonating, setImpersonating] = useState<{ email: string; role: Role } | null>(null);
  // Sessione admin messa da parte durante l'impersonazione, per tornare indietro
  // (access + refresh: così il ritorno non dipende dal rinnovo del token).
  const [adminSession, setAdminSession] = useState<{ access: string | null; refresh: string | null } | null>(null);

  async function loadSession() {
    const [me, perms] = await Promise.all([
      api<AuthUser>('/me'),
      api<Permissions>('/me/permissions'),
    ]);
    setUser(me);
    setPermissions(perms);
  }

  // All'avvio: se c'è un refresh token salvato, ripristina la sessione.
  useEffect(() => {
    (async () => {
      if (getRefreshToken()) {
        try {
          await loadSession();
        } catch {
          setRefreshToken(null);
          setAccessToken(null);
        }
      }
      setLoading(false);
    })();
  }, []);

  async function login(email: string, password: string) {
    const res = await api<LoginResponse>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) },
      false,
    );
    setAccessToken(res.accessToken);
    setRefreshToken(res.refreshToken);
    await loadSession();
  }

  async function logout() {
    const refreshToken = getRefreshToken();
    try {
      if (refreshToken) await api('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) });
    } catch {
      /* logout è best-effort */
    }
    setRefreshToken(null);
    setAccessToken(null);
    setUser(null);
    setPermissions(null);
    setImpersonating(null);
    setAdminSession(null);
  }

  async function impersonate(userId: string, email: string) {
    // Chiama l'endpoint con il token ADMIN corrente, poi mette da parte l'intera
    // sessione admin (access + refresh) e assume il token di impersonazione.
    const res = await api<{ accessToken: string; user?: { role: Role } }>(
      '/admin/impersonate',
      { method: 'POST', body: JSON.stringify({ userId }) },
    );
    setAdminSession({ access: getAccessToken(), refresh: getRefreshToken() });
    // Durante l'impersonazione niente refresh token in memoria: così un eventuale
    // 401 non rinnova per errore la sessione admin (che va preservata intatta).
    setRefreshToken(null);
    setAccessToken(res.accessToken);
    const me = await api<AuthUser>('/me');
    setImpersonating({ email, role: me.role });
    setUser(me);
    try {
      setPermissions(await api<Permissions>('/me/permissions'));
    } catch {
      setPermissions({ role: me.role, pages: [] });
    }
  }

  async function stopImpersonation() {
    if (!adminSession) return;
    // Ripristina esattamente la sessione admin di prima (access + refresh).
    setAccessToken(adminSession.access);
    setRefreshToken(adminSession.refresh);
    setImpersonating(null);
    setAdminSession(null);
    try {
      await loadSession();
    } catch {
      await logout();
    }
  }

  function can(pageKey: string, level: 'view' | 'manage' = 'view'): boolean {
    if (!permissions) return false;
    const p = permissions.pages.find((x) => x.pageKey === pageKey);
    if (!p) return false;
    return level === 'manage' ? p.canManage : p.canView;
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        permissions,
        loading,
        impersonating,
        login,
        logout,
        impersonate,
        stopImpersonation,
        can,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fuori da AuthProvider');
  return ctx;
}
