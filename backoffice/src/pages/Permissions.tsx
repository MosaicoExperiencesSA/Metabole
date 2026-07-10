import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Banner, Spinner, Toggle } from '../components/ui';
import { pageLabel } from '../lib/labels';
import type { RoleInfo } from '../lib/roles';

interface Matrix {
  pages: string[];
  roles: RoleInfo[];
  matrix: Record<string, { pageKey: string; canView: boolean; canManage: boolean }[]>;
}

export function Permissions() {
  const { can } = useAuth();
  const editable = can('permissions', 'manage');
  const [data, setData] = useState<Matrix | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingCell, setSavingCell] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setData(await api<Matrix>('/admin/permissions'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function cell(roleKey: string, pageKey: string) {
    const row = data?.matrix[roleKey]?.find((r) => r.pageKey === pageKey);
    return { canView: row?.canView ?? false, canManage: row?.canManage ?? false };
  }

  async function setPerm(roleKey: string, pageKey: string, patch: { canView?: boolean; canManage?: boolean }) {
    const id = `${roleKey}:${pageKey}`;
    setSavingCell(id);
    setError(null);
    const current = cell(roleKey, pageKey);
    const body = {
      role: roleKey,
      pageKey,
      canView: patch.canView ?? current.canView,
      canManage: patch.canView === false ? false : patch.canManage ?? current.canManage,
    };
    try {
      await api('/admin/permissions', { method: 'PATCH', body: JSON.stringify(body) });
      setData((m) => {
        if (!m) return m;
        const list = (m.matrix[roleKey] ?? []).filter((r) => r.pageKey !== pageKey);
        list.push({ pageKey, canView: body.canView, canManage: body.canManage });
        return { ...m, matrix: { ...m.matrix, [roleKey]: list } };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Modifica non riuscita.');
    } finally {
      setSavingCell(null);
    }
  }

  if (loading) return <Spinner />;
  if (!data) return <Banner kind="err">{error ?? 'Errore'}</Banner>;

  return (
    <>
      <Banner kind="info">
        Per ogni sezione e ruolo: <b>Vede</b> mostra la pagina nel menu, <b>Gestisce</b> permette anche di modificarne i
        contenuti. I ruoli personalizzati compaiono qui come gli altri. L'accesso dell'admin ai permessi è bloccato (anti-lockout).
      </Banner>
      {error && <Banner kind="err">{error}</Banner>}

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="grid">
          <thead>
            <tr>
              <th style={{ position: 'sticky', left: 0, background: '#fff' }}>Sezione</th>
              {data.roles.map((r) => (
                <th key={r.key} style={{ textAlign: 'center' }}>
                  <span style={{ color: r.color ?? undefined }}>{r.label}</span>
                  {!r.isSystem && <div style={{ fontSize: 9, fontWeight: 400, color: 'var(--muted)' }}>personalizzato</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.pages.map((pageKey) => (
              <tr key={pageKey}>
                <td style={{ position: 'sticky', left: 0, background: '#fff', fontWeight: 600 }}>{pageLabel(pageKey)}</td>
                {data.roles.map((r) => {
                  const c = cell(r.key, pageKey);
                  const locked = r.key === 'admin' && pageKey === 'permissions';
                  const id = `${r.key}:${pageKey}`;
                  return (
                    <td key={r.key} style={{ textAlign: 'center', opacity: savingCell === id ? 0.5 : 1 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        <div className="row" style={{ gap: 6, justifyContent: 'center' }}>
                          <span className="muted" style={{ fontSize: 11, width: 44, textAlign: 'right' }}>vede</span>
                          <Toggle
                            on={c.canView}
                            disabled={!editable || locked}
                            title={locked ? 'Bloccato (anti-lockout)' : 'Vede la sezione'}
                            onChange={(next) => setPerm(r.key, pageKey, { canView: next })}
                          />
                        </div>
                        <div className="row" style={{ gap: 6, justifyContent: 'center' }}>
                          <span className="muted" style={{ fontSize: 11, width: 44, textAlign: 'right' }}>gestisce</span>
                          <Toggle
                            on={c.canManage}
                            disabled={!editable || locked || !c.canView}
                            title={!c.canView ? 'Serve prima "vede"' : 'Può modificare'}
                            onChange={(next) => setPerm(r.key, pageKey, { canManage: next })}
                          />
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
