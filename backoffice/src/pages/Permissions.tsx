import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Banner, Spinner, Toggle } from '../components/ui';
import { pageLabel, ROLE_LABEL, type Role } from '../lib/labels';

interface Matrix {
  pages: string[];
  roles: Record<string, { pageKey: string; canView: boolean; canManage: boolean }[]>;
}

// I clienti non hanno pagine di backoffice: la matrice riguarda lo staff.
const STAFF_COLS: Role[] = ['coach', 'nutritionist', 'head_nutritionist', 'sales', 'admin'];

export function Permissions() {
  const { can } = useAuth();
  const editable = can('permissions', 'manage');
  const [matrix, setMatrix] = useState<Matrix | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingCell, setSavingCell] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setMatrix(await api<Matrix>('/admin/permissions'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function cell(role: Role, pageKey: string) {
    const row = matrix?.roles[role]?.find((r) => r.pageKey === pageKey);
    return { canView: row?.canView ?? false, canManage: row?.canManage ?? false };
  }

  async function setPerm(role: Role, pageKey: string, patch: { canView?: boolean; canManage?: boolean }) {
    const id = `${role}:${pageKey}`;
    setSavingCell(id);
    setError(null);
    // Se tolgo la visibilità, tolgo anche la gestione (non si gestisce ciò che non si vede).
    const current = cell(role, pageKey);
    const body = {
      role,
      pageKey,
      canView: patch.canView ?? current.canView,
      canManage: patch.canView === false ? false : patch.canManage ?? current.canManage,
    };
    try {
      await api('/admin/permissions', { method: 'PATCH', body: JSON.stringify(body) });
      // aggiorno localmente
      setMatrix((m) => {
        if (!m) return m;
        const list = (m.roles[role] ?? []).filter((r) => r.pageKey !== pageKey);
        list.push({ pageKey, canView: body.canView, canManage: body.canManage });
        return { ...m, roles: { ...m.roles, [role]: list } };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Modifica non riuscita.');
    } finally {
      setSavingCell(null);
    }
  }

  if (loading) return <Spinner />;
  if (!matrix) return <Banner kind="err">{error ?? 'Errore'}</Banner>;

  return (
    <>
      <Banner kind="info">
        Per ogni sezione e ruolo: <b>Vede</b> mostra la pagina nel menu, <b>Gestisce</b> permette anche di modificarne i
        contenuti. L'accesso dell'admin ai permessi è bloccato per sicurezza (anti-lockout).
      </Banner>
      {error && <Banner kind="err">{error}</Banner>}

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="grid">
          <thead>
            <tr>
              <th style={{ position: 'sticky', left: 0, background: '#fff' }}>Sezione</th>
              {STAFF_COLS.map((r) => (
                <th key={r} style={{ textAlign: 'center' }}>
                  {ROLE_LABEL[r]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.pages.map((pageKey) => (
              <tr key={pageKey}>
                <td style={{ position: 'sticky', left: 0, background: '#fff', fontWeight: 600 }}>{pageLabel(pageKey)}</td>
                {STAFF_COLS.map((role) => {
                  const c = cell(role, pageKey);
                  const locked = role === 'admin' && pageKey === 'permissions';
                  const id = `${role}:${pageKey}`;
                  return (
                    <td key={role} style={{ textAlign: 'center', opacity: savingCell === id ? 0.5 : 1 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        <div className="row" style={{ gap: 6, justifyContent: 'center' }}>
                          <span className="muted" style={{ fontSize: 11, width: 44, textAlign: 'right' }}>
                            vede
                          </span>
                          <Toggle
                            on={c.canView}
                            disabled={!editable || locked}
                            title={locked ? 'Bloccato (anti-lockout)' : 'Vede la sezione'}
                            onChange={(next) => setPerm(role, pageKey, { canView: next })}
                          />
                        </div>
                        <div className="row" style={{ gap: 6, justifyContent: 'center' }}>
                          <span className="muted" style={{ fontSize: 11, width: 44, textAlign: 'right' }}>
                            gestisce
                          </span>
                          <Toggle
                            on={c.canManage}
                            disabled={!editable || locked || !c.canView}
                            title={!c.canView ? 'Serve prima "vede"' : 'Può modificare'}
                            onChange={(next) => setPerm(role, pageKey, { canManage: next })}
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
