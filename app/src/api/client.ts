/**
 * Client API Metabole per l'app cliente.
 * - access token JWT in memoria + refresh token in localStorage;
 * - refresh automatico e trasparente al primo 401;
 * - errori normalizzati ({ status, message }).
 * (In Capacitor il localStorage della webview persiste tra le sessioni.)
 */

const API_BASE = (import.meta.env.VITE_API_URL ?? 'https://metabole-backend.onrender.com').replace(/\/$/, '');
const REFRESH_KEY = 'metabole_app_refresh';

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}
export function getAccessToken(): string | null {
  return accessToken;
}
export const API_BASE_URL = API_BASE;
export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}
export function setRefreshToken(token: string | null) {
  if (token) localStorage.setItem(REFRESH_KEY, token);
  else localStorage.removeItem(REFRESH_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function messageFrom(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && 'message' in body) {
    const m = (body as { message: unknown }).message;
    if (Array.isArray(m)) return m.join(' · ');
    if (typeof m === 'string') return m;
  }
  return fallback;
}

async function rawRequest(path: string, options: RequestInit, withAuth: boolean): Promise<Response> {
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
  if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  if (withAuth && accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
  return fetch(`${API_BASE}/api/v1${path}`, { ...options, headers });
}

async function tryRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  const res = await rawRequest('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) }, false);
  if (!res.ok) {
    setRefreshToken(null);
    setAccessToken(null);
    return false;
  }
  const data = (await res.json()) as { accessToken: string; refreshToken: string };
  setAccessToken(data.accessToken);
  setRefreshToken(data.refreshToken);
  return true;
}

/** Chiamata autenticata con refresh automatico. */
export async function api<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  let res = await rawRequest(path, options, true);
  if (res.status === 401 && (await tryRefresh())) {
    res = await rawRequest(path, options, true);
  }
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, messageFrom(body, `Errore ${res.status}`));
  return body as T;
}

/** Chiamata pubblica (login/register/refresh). */
export async function apiPublic<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await rawRequest(path, options, false);
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, messageFrom(body, `Errore ${res.status}`));
  return body as T;
}
