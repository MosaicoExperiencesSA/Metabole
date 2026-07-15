import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../api/client';

export interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  /** Ricarica manualmente (es. dopo un'azione). */
  reload: () => void;
}

/**
 * Carica un endpoint GET e ne espone stato/errore/loading + reload.
 * `path` può cambiare: al cambio, ricarica.
 */
export function useApi<T>(path: string | null, deps: unknown[] = []): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(path !== null);
  const [nonce, setNonce] = useState(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (path === null) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    api<T>(path)
      .then((d) => {
        if (alive.current) setData(d);
      })
      .catch((e: unknown) => {
        if (!alive.current) return;
        setError(e instanceof ApiError ? e.message : 'Errore di rete');
      })
      .finally(() => {
        if (alive.current) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, nonce, ...deps]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, error, loading, reload };
}

/**
 * Esegue un'azione (POST/PATCH/PUT/DELETE) tenendo traccia di loading/errore.
 * Ritorna [run, { loading, error }].
 */
export function useAction<TArgs extends unknown[]>(
  fn: (...args: TArgs) => Promise<unknown>,
): [(...args: TArgs) => Promise<boolean>, { loading: boolean; error: string | null }] {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (...args: TArgs): Promise<boolean> => {
      setLoading(true);
      setError(null);
      try {
        await fn(...args);
        return true;
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Errore di rete');
        return false;
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return [run, { loading, error }];
}
