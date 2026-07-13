import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Banner, Modal, Spinner, Toggle } from '../components/ui';
import { pageLabel } from '../lib/labels';
import type { RoleInfo } from '../lib/roles';

interface Matrix {
  pages: string[];
  roles: RoleInfo[];
  matrix: Record<string, { pageKey: string; canView: boolean; canManage: boolean }[]>;
}

interface CellVal {
  canView: boolean;
  canManage: boolean;
}
// Modifiche in sospeso (non ancora salvate), per cella `${role}|${pageKey}`.
type Edits = Record<string, CellVal>;

const cellKey = (role: string, pageKey: string) => `${role}|${pageKey}`;

export function Permissions() {
  const { can } = useAuth();
  const editable = can('permissions', 'manage');
  const [data, setData] = useState<Matrix | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [edits, setEdits] = useState<Edits>({});
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setData(await api<Matrix>('/admin/permissions'));
      setEdits({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  /** Valore dal server (baseline). */
  function serverCell(roleKey: string, pageKey: string): CellVal {
    const row = data?.matrix[roleKey]?.find((r) => r.pageKey === pageKey);
    return { canView: row?.canView ?? false, canManage: row?.canManage ?? false };
  }

  /** Valore effettivo mostrato: la modifica in sospeso se c'è, altrimenti il server. */
  function cell(roleKey: string, pageKey: string): CellVal {
    return edits[cellKey(roleKey, pageKey)] ?? serverCell(roleKey, pageKey);
  }

  /** Applica una modifica SOLO in locale (nessuna chiamata finché non si preme Salva). */
  function setLocal(roleKey: string, pageKey: string, patch: { canView?: boolean; canManage?: boolean }) {
    if (!editable) return;
    const cur = cell(roleKey, pageKey);
    const canView = patch.canView ?? cur.canView;
    // Regola: senza "vede" non può "gestire".
    const canManage = patch.canView === false ? false : patch.canManage ?? cur.canManage;
    const next: CellVal = { canView, canManage };
    const server = serverCell(roleKey, pageKey);
    const key = cellKey(roleKey, pageKey);
    setNotice(null);
    setEdits((e) => {
      const copy = { ...e };
      if (next.canView === server.canView && next.canManage === server.canManage) {
        delete copy[key]; // tornato uguale al server → non è più una modifica
      } else {
        copy[key] = next;
      }
      return copy;
    });
  }

  const dirtyKeys = useMemo(() => Object.keys(edits), [edits]);
  const dirtyCount = dirtyKeys.length;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      // Il backend aggiorna una cella per volta: invio in sequenza le modifiche in sospeso.
      for (const key of dirtyKeys) {
        const [role, pageKey] = key.split('|');
        const v = edits[key];
        await api('/admin/permissions', {
          method: 'PATCH',
          body: JSON.stringify({ role, pageKey, canView: v.canView, canManage: v.canManage }),
        });
      }
      setConfirming(false);
      await load();
      setNotice(`Permessi salvati (${dirtyCount} ${dirtyCount === 1 ? 'modifica' : 'modifiche'}).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Salvataggio non riuscito.');
      setConfirming(false);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner />;
  if (!data) return <Banner kind="err">{error ?? 'Errore'}</Banner>;

  const orderedPages = [...data.pages].sort((a, b) => pageLabel(a).localeCompare(pageLabel(b), 'it'));

  return (
    <>
      <Banner kind="info">
        Per ogni sezione e ruolo: <b>Vede</b> mostra la pagina nel menu, <b>Gestisce</b> permette anche di modificarne i
        contenuti. Le modifiche si applicano solo dopo <b>Salva</b>. L'accesso dell'admin ai permessi è bloccato (anti-lockout).
      </Banner>
      {error && <Banner kind="err">{error}</Banner>}
      {notice && <Banner kind="ok">{notice}</Banner>}

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
            {orderedPages.map((pageKey) => (
              <tr key={pageKey}>
                <td style={{ position: 'sticky', left: 0, background: '#fff', fontWeight: 600 }}>{pageLabel(pageKey)}</td>
                {data.roles.map((r) => {
                  const c = cell(r.key, pageKey);
                  const locked = r.key === 'admin' && pageKey === 'permissions';
                  const changed = cellKey(r.key, pageKey) in edits;
                  return (
                    <td key={r.key} style={{ textAlign: 'center', background: changed ? 'var(--chip)' : undefined }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        <div className="row" style={{ gap: 6, justifyContent: 'center' }}>
                          <span className="muted" style={{ fontSize: 11, width: 44, textAlign: 'right' }}>vede</span>
                          <Toggle
                            on={c.canView}
                            disabled={!editable || locked}
                            title={locked ? 'Bloccato (anti-lockout)' : 'Vede la sezione'}
                            onChange={(next) => setLocal(r.key, pageKey, { canView: next })}
                          />
                        </div>
                        <div className="row" style={{ gap: 6, justifyContent: 'center' }}>
                          <span className="muted" style={{ fontSize: 11, width: 44, textAlign: 'right' }}>gestisce</span>
                          <Toggle
                            on={c.canManage}
                            disabled={!editable || locked || !c.canView}
                            title={!c.canView ? 'Serve prima "vede"' : 'Può modificare'}
                            onChange={(next) => setLocal(r.key, pageKey, { canManage: next })}
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

      {/* Barra azioni: compare quando ci sono modifiche non salvate. */}
      {editable && dirtyCount > 0 && (
        <div className="perm-savebar">
          <span><i className="ti ti-alert-circle" /> {dirtyCount} {dirtyCount === 1 ? 'modifica non salvata' : 'modifiche non salvate'}</span>
          <div className="row" style={{ gap: 10 }}>
            <button className="btn ghost" onClick={() => setEdits({})} disabled={saving}>Annulla</button>
            <button className="btn" onClick={() => setConfirming(true)} disabled={saving}>
              <i className="ti ti-device-floppy" /> Salva
            </button>
          </div>
        </div>
      )}

      {confirming && (
        <Modal title="Confermi le modifiche ai permessi?" onClose={() => !saving && setConfirming(false)}>
          <p style={{ marginTop: 0 }}>
            Stai per applicare <b>{dirtyCount}</b> {dirtyCount === 1 ? 'modifica' : 'modifiche'} alla matrice dei permessi.
            I ruoli interessati vedranno cambiare le sezioni accessibili al loro prossimo accesso.
          </p>
          <div className="row" style={{ justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button className="btn ghost" onClick={() => setConfirming(false)} disabled={saving}>Annulla</button>
            <button className="btn" onClick={save} disabled={saving}>{saving ? 'Salvo…' : 'Sì, salva'}</button>
          </div>
        </Modal>
      )}
    </>
  );
}
