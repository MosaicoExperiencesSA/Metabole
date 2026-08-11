import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Banner, Modal, Pager, RoleChip, Spinner, StatusChip } from '../components/ui';
import { BottoneExcel, useTabella, type Colonna } from '../components/tabella';
import { ROLE_LABEL, STAFF_ROLES, type Role } from '../lib/labels';
import { fetchRoles, type RoleInfo } from '../lib/roles';

interface User {
  id: string;
  email: string;
  role: Role;
  customRoleKey: string | null;
  customRole: { key: string; label: string; color: string | null; baseRole: Role } | null;
  status: string;
  locale: string;
  createdAt: string;
  deletedAt: string | null;
  staff: { id: string; displayName: string; managerId: string | null; refCode: string | null } | null;
}

/** Traduce la scelta di un ruolo (chiave) nel payload {role, customRoleKey}. */
function rolePayload(selectedKey: string, roles: RoleInfo[]): { role: Role; customRoleKey: string | null } {
  const info = roles.find((r) => r.key === selectedKey);
  if (!info || info.isSystem) return { role: selectedKey as Role, customRoleKey: null };
  return { role: info.baseRole, customRoleKey: info.key };
}

export function Users() {
  const { user: me, can, impersonate } = useAuth();
  const canManage = can('users', 'manage');
  /** «Entra come» ha un permesso PROPRIO: gestire le utenze e guardare dentro un account sono due decisioni diverse. */
  const puoEntrare = can('impersonate', 'manage');
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<RoleInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Ruolo e archiviati filtrano sul SERVER (cambiarli ricarica la lista): restano sopra la tabella
  // e non diventano filtri di colonna, che sarebbero un secondo controllo sullo stesso dato.
  const [roleFilter, setRoleFilter] = useState<Role | ''>('');
  const [showArchived, setShowArchived] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [pwdReset, setPwdReset] = useState<{ email: string; password: string } | null>(null);

  async function resetPassword(u: User) {
    if (!confirm(`Reset password per ${u.email}?\nVerrà generata una password provvisoria: l'utente dovrà cambiarla al primo accesso e le sessioni attive verranno chiuse.`)) return;
    setError(null);
    try {
      const r = await api<{ password: string; email: string }>(`/admin/users/${u.id}/reset-password`, { method: 'POST', body: JSON.stringify({}) });
      setPwdReset({ email: r.email, password: r.password });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset password non riuscito.');
    }
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const base = roleFilter ? `?role=${roleFilter}` : '?scope=staff';
      const query = showArchived ? `${base}&includeArchived=true` : base;
      const [res, roleList] = await Promise.all([
        api<{ items: User[] }>(`/admin/users${query}`),
        roles.length ? Promise.resolve(roles) : fetchRoles(),
      ]);
      setUsers(res.items);
      if (!roles.length) setRoles(roleList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter, showArchived]);

  async function archive(u: User) {
    if (!confirm(`Archiviare l'account ${u.email}?\nVerrà sospeso e nascosto, ma potrai ripristinarlo.`)) return;
    try {
      await api(`/admin/users/${u.id}`, { method: 'DELETE' });
      setNotice(`${u.email} archiviato.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Archiviazione non riuscita.');
    }
  }

  async function restore(u: User) {
    try {
      await api(`/admin/users/${u.id}/restore`, { method: 'POST' });
      setNotice(`${u.email} ripristinato.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ripristino non riuscito.');
    }
  }

  function effectiveKey(u: User): string {
    return u.customRole?.key ?? u.role;
  }

  async function changeRole(u: User, selectedKey: string) {
    try {
      await api(`/admin/users/${u.id}`, { method: 'PATCH', body: JSON.stringify(rolePayload(selectedKey, roles)) });
      const label = roles.find((r) => r.key === selectedKey)?.label ?? selectedKey;
      setNotice(`Ruolo di ${u.email} aggiornato a ${label}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Modifica non riuscita.');
    }
  }

  async function generateRefCode(u: User) {
    // Codice a scelta (es. cambio MOREND01 → MORENO01) oppure vuoto = automatico.
    // Cambiare il codice è SICURO: le clienti/lead sono legate all'id della coach, non
    // alla stringa del codice → nessun dato perso.
    const current = u.staff?.refCode ?? '';
    const input = prompt(
      `Ref code per ${u.email}\n(3-12 lettere/numeri; lascia vuoto per generarne uno automatico)`,
      current,
    );
    if (input === null) return; // annullato
    const code = input.trim().toUpperCase();
    if (code && !/^[A-Z0-9]{3,12}$/.test(code)) {
      setError('Ref code non valido: da 3 a 12 caratteri, solo lettere e numeri.');
      return;
    }
    if (code && code === current.toUpperCase()) return; // nessun cambiamento
    try {
      const r = await api<{ refCode: string }>(`/crm/coaches/${u.id}/refcode`, {
        method: 'POST',
        body: JSON.stringify(code ? { code } : {}),
      });
      // Il backend crea la scheda Staff se mancava (coordinatrici storiche): aggiorniamo comunque la riga.
      setUsers((us) => us.map((x) => (x.id === u.id
        ? { ...x, staff: x.staff ? { ...x.staff, refCode: r.refCode } : { id: '', displayName: x.email, managerId: null, refCode: r.refCode } }
        : x)));
      setNotice(`Ref code di ${u.email}: ${r.refCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operazione non riuscita.');
    }
  }

  async function changeManager(u: User, managerStaffId: string) {
    try {
      await api(`/admin/users/${u.id}/manager`, { method: 'PATCH', body: JSON.stringify({ managerId: managerStaffId || null }) });
      setUsers((us) => us.map((x) => (x.id === u.id && x.staff ? { ...x, staff: { ...x.staff, managerId: managerStaffId || null } } : x)));
      setNotice(`Responsabile di ${u.email} aggiornato.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Modifica non riuscita.');
    }
  }

  async function toggleStatus(u: User) {
    const next = u.status === 'active' ? 'suspended' : 'active';
    try {
      await api(`/admin/users/${u.id}`, { method: 'PATCH', body: JSON.stringify({ status: next }) });
      setNotice(`${u.email} ${next === 'suspended' ? 'sospeso' : 'riattivato'}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Modifica non riuscita.');
    }
  }

  async function doImpersonate(u: User) {
    setError(null);
    try {
      await impersonate(u.id, u.email);
      setNotice(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impersonazione non riuscita.');
    }
  }

  const roleLabelOf = (u: User) => u.customRole?.label ?? ROLE_LABEL[u.role] ?? u.role;
  const managerNameOf = (u: User) => (u.staff?.managerId ? users.find((x) => x.staff?.id === u.staff!.managerId)?.staff?.displayName ?? '' : '');
  const statoLabelOf = (u: User) => (u.status === 'active' ? 'Attivo' : u.status === 'suspended' ? 'Sospeso' : u.status);

  const COLONNE: Colonna<User>[] = [
    // Il nome visibile sta nel valore anche se la cella mostra la sola email: la ricerca in alto
    // cercava per email, nome o ref code e deve continuare a trovare per nome. L'ordinamento resta
    // di fatto sull'email, che è la parte davanti.
    { chiave: 'email', titolo: 'Email', valore: (u) => `${u.email} ${u.staff?.displayName ?? ''}`.trim(), filtro: 'testo' },
    // Nessun filtro: il ruolo lo filtra il server, con la tendina sopra la tabella.
    { chiave: 'role', titolo: 'Ruolo', valore: roleLabelOf },
    { chiave: 'manager', titolo: 'Responsabile', valore: managerNameOf, filtro: 'scelta', etichettaTutti: 'Tutti' },
    { chiave: 'refcode', titolo: 'Ref code', valore: (u) => u.staff?.refCode },
    { chiave: 'status', titolo: 'Stato', valore: statoLabelOf, filtro: 'scelta', etichettaTutti: 'Tutti' },
    { chiave: 'locale', titolo: 'Lingua', valore: (u) => u.locale.toUpperCase(), filtro: 'scelta', etichettaTutti: 'Tutte' },
    { chiave: 'azioni', titolo: 'Azioni', stile: { textAlign: 'right' } },
  ];

  // Senza `ordineIniziale` l'elenco resta nell'ordine del server (dall'ultimo creato), che è quello
  // con cui la pagina si è sempre aperta.
  // `testaFissa`: l'elenco scorre dentro la card, quindi titoli E riga dei filtri restano incollati
  // in alto. Prima lo faceva lo `stile` di ogni colonna, che però non arrivava ai filtri: per
  // cambiare un filtro si doveva tornare in cima (segnalato l'11/8).
  const t = useTabella(users, COLONNE, { testaFissa: true, nomeExcel: 'Utenti staff' });

  return (
    <>
      <div className="spread" style={{ marginBottom: 18 }}>
        <div className="row" style={{ gap: 14, alignItems: 'center' }}>
          <select className="select" style={{ width: 200 }} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as Role | '')}>
            <option value="">Tutti i ruoli</option>
            {STAFF_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
          <input
            className="input"
            style={{ width: 240 }}
            placeholder="Cerca in tutte le colonne…"
            value={t.ricerca}
            onChange={(e) => t.setRicerca(e.target.value)}
          />
          <label className="row" style={{ gap: 6, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            Mostra archiviati
          </label>
          {t.filtriAttivi && (
            <button className="btn ghost sm" onClick={t.azzera} title="Pulisci i filtri">
              <i className="ti ti-x" /> Pulisci
            </button>
          )}
          <BottoneExcel tabella={t} />
        </div>
        {canManage && (
          <button className="btn" onClick={() => setShowCreate(true)}>
            <i className="ti ti-plus" /> Nuovo membro dello staff
          </button>
        )}
      </div>

      {error && <Banner kind="err">{error}</Banner>}
      {notice && <Banner kind="ok">{notice}</Banner>}

      <div className="card" style={{ padding: 0, overflow: 'auto', maxHeight: 'calc(100vh - 240px)' }}>
        {loading ? (
          <Spinner />
        ) : t.conteggio.mostrate === 0 ? (
          <div className="empty">Nessun membro dello staff per questi filtri.</div>
        ) : (
          <table className="grid">
            <thead>
              {t.intestazione()}
              {t.rigaFiltri()}
            </thead>
            <tbody>
              {t.pagina.map((u) => {
                const isSelf = u.id === me?.id;
                const archived = !!u.deletedAt;
                return (
                  <tr key={u.id} style={archived ? { opacity: 0.55 } : undefined}>
                    <td>
                      <Link to={`/utenti/${u.id}`} className="link" title="Apri la scheda"><b>{u.email}</b></Link>
                      {isSelf && <span className="muted"> · tu</span>}
                      {archived && <span className="chip gray" style={{ fontSize: 10, marginLeft: 6 }}>archiviato</span>}
                    </td>
                    <td>
                      {canManage && !isSelf ? (
                        <select
                          className="select"
                          style={{ width: 185, padding: '6px 10px' }}
                          value={effectiveKey(u)}
                          onChange={(e) => changeRole(u, e.target.value)}
                        >
                          <optgroup label="Ruoli di sistema">
                            {roles.filter((r) => r.isSystem).map((r) => (
                              <option key={r.key} value={r.key}>{r.label}</option>
                            ))}
                          </optgroup>
                          {roles.some((r) => !r.isSystem) && (
                            <optgroup label="Personalizzati">
                              {roles.filter((r) => !r.isSystem).map((r) => (
                                <option key={r.key} value={r.key}>{r.label}</option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                      ) : u.customRole ? (
                        <span className="chip" style={{ background: (u.customRole.color ?? '#6c5ab7') + '22', color: u.customRole.color ?? '#6c5ab7' }}>
                          {u.customRole.label}
                        </span>
                      ) : (
                        <RoleChip role={u.role} />
                      )}
                    </td>
                    <td>
                      {canManage && u.staff ? (
                        <select
                          className="select"
                          style={{ width: 170, padding: '6px 10px' }}
                          value={u.staff.managerId ?? ''}
                          onChange={(e) => changeManager(u, e.target.value)}
                          title="Responsabile diretto (manager coach / capo nutrizionista)"
                        >
                          <option value="">— nessuno —</option>
                          {users.filter((x) => x.staff && x.staff.id !== u.staff!.id).map((x) => (
                            <option key={x.staff!.id} value={x.staff!.id}>{x.staff!.displayName}</option>
                          ))}
                        </select>
                      ) : u.staff?.managerId ? (
                        <span className="muted">{users.find((x) => x.staff?.id === u.staff!.managerId)?.staff?.displayName ?? '—'}</span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      {u.role === 'coach' || u.role === 'coach_coordinator' || u.role === 'sales' ? (
                        <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                          {u.staff?.refCode ? <code style={{ fontSize: 12 }}>{u.staff.refCode}</code> : <span className="muted" style={{ fontSize: 12 }}>—</span>}
                          {canManage && (
                            <button className="btn ghost sm" onClick={() => generateRefCode(u)} title={u.staff?.refCode ? 'Cambia/rigenera codice (puoi digitarlo)' : 'Genera o imposta codice'}>
                              {u.staff?.refCode ? '↻' : 'Genera'}
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <StatusChip status={u.status} />
                    </td>
                    <td className="muted">{u.locale.toUpperCase()}</td>
                    <td>
                      <div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                        {archived ? (
                          canManage && (
                            <button className="btn ghost sm" onClick={() => restore(u)} title="Ripristina l'account">
                              <i className="ti ti-arrow-back-up" /> Ripristina
                            </button>
                          )
                        ) : (
                          <>
                            {puoEntrare && u.role !== 'admin' && u.status === 'active' && (
                              <button className="btn ghost sm" onClick={() => doImpersonate(u)} title="Guarda l'app con i suoi occhi, in sola lettura: per 30 minuti, e resta scritto nell'audit">
                                <i className="ti ti-eye" /> Entra come
                              </button>
                            )}
                            {canManage && !isSelf && (
                              <button className={`btn sm ${u.status === 'active' ? 'danger' : 'ghost'}`} onClick={() => toggleStatus(u)}>
                                {u.status === 'active' ? 'Sospendi' : 'Riattiva'}
                              </button>
                            )}
                            {canManage && (
                              <button className="btn ghost sm" onClick={() => resetPassword(u)} title="Reset password (genera una provvisoria)">
                                <i className="ti ti-key" />
                              </button>
                            )}
                            {canManage && !isSelf && (
                              <button className="btn ghost sm" onClick={() => archive(u)} title="Archivia (rimuovi) l'account">
                                <i className="ti ti-archive" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <Pager {...t.pager} />
      </div>

      {showCreate && (
        <CreateStaffModal
          roles={roles}
          onClose={() => setShowCreate(false)}
          onCreated={(email) => {
            setShowCreate(false);
            setNotice(`Utente ${email} creato.`);
            void load();
          }}
        />
      )}

      {pwdReset && (
        <Modal title="Password provvisoria generata" onClose={() => setPwdReset(null)}>
          <p style={{ marginTop: 0 }}>Nuova password per <b>{pwdReset.email}</b>. Comunicala all'utente: dovrà <b>cambiarla al primo accesso</b>. La vedi solo ora.</p>
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <code style={{ flex: 1, fontSize: 18, padding: '10px 14px', background: 'var(--chip,#f0ede8)', borderRadius: 8, letterSpacing: 1, userSelect: 'all' }}>{pwdReset.password}</code>
            <button className="btn ghost sm" onClick={() => { void navigator.clipboard?.writeText(pwdReset.password); }} title="Copia"><i className="ti ti-copy" /> Copia</button>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
            <button className="btn" onClick={() => setPwdReset(null)}>Ho copiato, chiudi</button>
          </div>
        </Modal>
      )}
    </>
  );
}

function CreateStaffModal({ roles, onClose, onCreated }: { roles: RoleInfo[]; onClose: () => void; onCreated: (email: string) => void }) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [roleKey, setRoleKey] = useState<string>('coach');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (password.length < 8) {
      setError('La password deve avere almeno 8 caratteri.');
      return;
    }
    setBusy(true);
    try {
      const { role, customRoleKey } = rolePayload(roleKey, roles);
      await api('/admin/users', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password, role, customRoleKey: customRoleKey ?? undefined, displayName: displayName.trim() || undefined }),
      });
      onCreated(email.trim());
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setError('Email già registrata.');
      else setError(err instanceof Error ? err.message : 'Creazione non riuscita.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Nuovo membro dello staff" onClose={onClose}>
      {error && <Banner kind="err">{error}</Banner>}
      <div className="field">
        <label>Nome visibile</label>
        <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Es. Marta Rossi" />
      </div>
      <div className="field">
        <label>Email</label>
        <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="field">
        <label>Ruolo</label>
        <select className="select" value={roleKey} onChange={(e) => setRoleKey(e.target.value)}>
          <optgroup label="Ruoli di sistema">
            {roles.filter((r) => r.isSystem).map((r) => (
              <option key={r.key} value={r.key}>{r.label}</option>
            ))}
          </optgroup>
          {roles.some((r) => !r.isSystem) && (
            <optgroup label="Personalizzati">
              {roles.filter((r) => !r.isSystem).map((r) => (
                <option key={r.key} value={r.key}>{r.label}</option>
              ))}
            </optgroup>
          )}
        </select>
      </div>
      <div className="field">
        <label>Password provvisoria (min. 8 caratteri)</label>
        <input className="input" type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="La persona potrà cambiarla" />
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
        <button className="btn ghost" onClick={onClose} disabled={busy}>
          Annulla
        </button>
        <button className="btn" onClick={submit} disabled={busy || !email}>
          {busy ? 'Creo…' : 'Crea utente'}
        </button>
      </div>
    </Modal>
  );
}
