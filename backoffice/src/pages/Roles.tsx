import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Banner, Modal, Spinner } from '../components/ui';
import { ROLE_LABEL, STAFF_ROLES, type Role } from '../lib/labels';
import { fetchRoles, type RoleInfo } from '../lib/roles';

export function Roles() {
  const { can } = useAuth();
  const canManage = can('permissions', 'manage'); // la gestione ruoli segue i permessi
  const [roles, setRoles] = useState<RoleInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setRoles(await fetchRoles());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function remove(role: RoleInfo) {
    if (!confirm(`Eliminare il ruolo "${role.label}"? Gli utenti che ce l'hanno torneranno al ruolo di base (${ROLE_LABEL[role.baseRole]}).`)) return;
    try {
      const res = await api<{ reassigned: number }>(`/admin/roles/${role.key}`, { method: 'DELETE' });
      setNotice(`Ruolo "${role.label}" eliminato${res.reassigned ? ` · ${res.reassigned} utente/i riportati a ${ROLE_LABEL[role.baseRole]}` : ''}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Eliminazione non riuscita.');
    }
  }

  const system = roles.filter((r) => r.isSystem);
  const custom = roles.filter((r) => !r.isSystem);

  return (
    <>
      <div className="spread" style={{ marginBottom: 18 }}>
        <p className="muted" style={{ margin: 0, maxWidth: 560 }}>
          I ruoli di sistema sono fissi e portano le regole del prodotto. Puoi creare <b>ruoli personalizzati</b> — etichetta, colore e sezioni su misura — che ereditano i permessi di un ruolo di base.
        </p>
        {canManage && (
          <button className="btn" onClick={() => setShowCreate(true)}>
            <i className="ti ti-plus" /> Nuovo ruolo
          </button>
        )}
      </div>

      {error && <Banner kind="err">{error}</Banner>}
      {notice && <Banner kind="ok">{notice}</Banner>}

      {loading ? (
        <Spinner />
      ) : (
        <>
          <div className="card">
            <h2>Ruoli di sistema</h2>
            <p className="hint">Non modificabili né eliminabili: sono il cuore della logica di Metabole.</p>
            <div className="row" style={{ gap: 10 }}>
              {system.map((r) => (
                <span key={r.key} className="chip" style={{ background: (r.color ?? '#12a386') + '22', color: r.color ?? '#0e7c66' }}>
                  {r.label}
                </span>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '18px 20px 8px' }}>
              <h2 style={{ margin: 0 }}>Ruoli personalizzati</h2>
            </div>
            {custom.length === 0 ? (
              <div className="empty">Nessun ruolo personalizzato. Creane uno con "Nuovo ruolo".</div>
            ) : (
              <table className="grid">
                <thead>
                  <tr>
                    <th>Ruolo</th>
                    <th>Basato su</th>
                    <th style={{ textAlign: 'right' }}>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {custom.map((r) => (
                    <tr key={r.key}>
                      <td>
                        <span className="chip" style={{ background: (r.color ?? '#6c5ab7') + '22', color: r.color ?? '#6c5ab7' }}>
                          {r.label}
                        </span>
                      </td>
                      <td className="muted">{ROLE_LABEL[r.baseRole]}</td>
                      <td style={{ textAlign: 'right' }}>
                        {canManage && (
                          <button className="btn danger sm" onClick={() => remove(r)}>
                            Elimina
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <p className="muted" style={{ fontSize: 13 }}>
            La visibilità delle sezioni per ogni ruolo (anche personalizzato) si regola in <b>Permessi</b>.
          </p>
        </>
      )}

      {showCreate && (
        <CreateRoleModal
          onClose={() => setShowCreate(false)}
          onCreated={(label) => {
            setShowCreate(false);
            setNotice(`Ruolo "${label}" creato. Regola le sue sezioni in Permessi.`);
            void load();
          }}
        />
      )}
    </>
  );
}

function CreateRoleModal({ onClose, onCreated }: { onClose: () => void; onCreated: (label: string) => void }) {
  const [label, setLabel] = useState('');
  const [baseRole, setBaseRole] = useState<Role>('coach');
  const [color, setColor] = useState('#6c5ab7');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (label.trim().length < 2) {
      setError('Dai un nome al ruolo (almeno 2 caratteri).');
      return;
    }
    setBusy(true);
    try {
      await api('/admin/roles', { method: 'POST', body: JSON.stringify({ label: label.trim(), baseRole, color }) });
      onCreated(label.trim());
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) setError(err.message);
      else setError(err instanceof Error ? err.message : 'Creazione non riuscita.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Nuovo ruolo personalizzato" onClose={onClose}>
      {error && <Banner kind="err">{error}</Banner>}
      <div className="field">
        <label>Nome del ruolo</label>
        <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Es. Segreteria, Fisioterapista…" autoFocus />
      </div>
      <div className="field">
        <label>Basato sul ruolo di sistema</label>
        <select className="select" value={baseRole} onChange={(e) => setBaseRole(e.target.value as Role)}>
          {STAFF_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
        <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
          Il nuovo ruolo eredita i permessi reali di questo, e parte con le sue stesse sezioni visibili (poi le regoli in Permessi).
        </p>
      </div>
      <div className="field">
        <label>Colore</label>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 56, height: 36, border: '1px solid var(--line)', borderRadius: 8, background: '#fff', padding: 2 }} />
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
        <button className="btn ghost" onClick={onClose} disabled={busy}>
          Annulla
        </button>
        <button className="btn" onClick={submit} disabled={busy || !label.trim()}>
          {busy ? 'Creo…' : 'Crea ruolo'}
        </button>
      </div>
    </Modal>
  );
}
