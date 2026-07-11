import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { api, apiPublic, getRefreshToken, setAccessToken, setRefreshToken } from '../api/client';

const WIDGET_TOKEN_KEY = 'metabole_widget_token';

/** Sul nativo: ottiene un token widget (lunga scadenza) e lo salva nello storage
 *  condiviso (SharedPreferences "CapacitorStorage") che il widget da home screen legge. */
async function syncWidgetToken() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { token } = await api<{ token: string }>('/auth/widget-token', { method: 'POST' });
    await Preferences.set({ key: WIDGET_TOKEN_KEY, value: token });
  } catch {
    /* il widget resterà sull'ultimo stato noto */
  }
}

export interface User {
  id: string;
  email: string;
  role: string;
  locale: string;
  status: string;
  emailVerifiedAt: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

export interface RegisterPayload {
  firstName: string;
  lastName: string;
  addressLine?: string;
  postalCode?: string;
  city?: string;
  province?: string;
  email: string;
  password: string;
  refCode?: string;
}

interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

interface AuthValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!getRefreshToken()) {
        setLoading(false);
        return;
      }
      try {
        setUser(await api<User>('/me')); // l'api rinnova l'access token in automatico
        void syncWidgetToken();
      } catch {
        setRefreshToken(null);
        setAccessToken(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function applyAuth(res: AuthResponse) {
    setAccessToken(res.accessToken);
    setRefreshToken(res.refreshToken);
    setUser(res.user);
    void syncWidgetToken();
  }

  async function login(email: string, password: string) {
    const res = await apiPublic<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    applyAuth(res);
  }

  async function register(data: RegisterPayload) {
    const body: Record<string, string> = {
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      email: data.email.trim(),
      password: data.password,
    };
    if (data.addressLine?.trim()) body.addressLine = data.addressLine.trim();
    if (data.postalCode?.trim()) body.postalCode = data.postalCode.trim();
    if (data.city?.trim()) body.city = data.city.trim();
    if (data.province?.trim()) body.province = data.province.trim().toUpperCase();
    if (data.refCode?.trim()) body.refCode = data.refCode.trim().toUpperCase();
    const res = await apiPublic<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(body) });
    applyAuth(res);
  }

  async function logout() {
    const refreshToken = getRefreshToken();
    try {
      if (refreshToken) await apiPublic('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) });
    } catch {
      /* logout locale comunque */
    }
    setRefreshToken(null);
    setAccessToken(null);
    setUser(null);
    if (Capacitor.isNativePlatform()) { try { await Preferences.remove({ key: WIDGET_TOKEN_KEY }); } catch { /* ignora */ } }
  }

  async function refreshMe() {
    try {
      setUser(await api<User>('/me'));
    } catch {
      /* ignora */
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fuori da AuthProvider');
  return ctx;
}
