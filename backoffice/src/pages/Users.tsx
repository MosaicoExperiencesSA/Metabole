import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Banner, Modal, RoleChip, Spinner, StatusChip } from '../components/ui';
import { ROLE_LABEL, STAFF_ROLES, type Role } from '../lib/labels';

interface User {
  id: string;
  email: string;
  role: Role;
  status: string;
  locale: string;
  createdAt: string;
}

export function Users() {
  const { user: me, can, impersonate } = useAuth();
  const canManage = can('users', 'manage');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<Role | ''>('');
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const query = roleFilter ? `?role=${roleFilter}` : '?scope=staff';
      const res = await api<{ items: User[] }>(`/admin/users${query}`);
      setUsers(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter]);

  async function changeRole(u: User, role: Role) {
    try {
      await api(`/admin/users/${u.id}`, { method: 'PATCH', body: JSON.stringify({ role }) });
      setNotice(`Ruolo di ${u.email} aggiornato a ${ROLE_LABEL[role]}.`);
      await load();
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

  return (
    <>
      <div className="spread" style={{ marginBottom: 18 }}>
        <div className="row">
          <select className="select" style={{ width: 200 }} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as Role | '')}>
            <option value="">Tutti i ruoli</option>
            {STAFF_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </div>
        {canManage && (
          <button className="btn" onClick={() => setShowCreate(true)}>
            <i className="ti ti-plus" /> Nuovo membro dello staff
          </button>
        )}
      </div>

      {error && <Banner kind="err">{error}</Banner>}
      {notice && <Banner kind="ok">{notice}</Banner>}

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <Spinner />
        ) : users.length === 0 ? (
          <div className="empty">Nessun utente per questo filtro.</div>
        ) : (
          <table className="grid">
            <thead>
              <tr>
                <th>Email</th>
                <th>Ruolo</th>
                <th>Stato</th>
                <th>Lingua</th>
                <th style={{ textAlign: 'right' }}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.id === me?.id;
                return (
                  <tr key={u.id}>
                    <td>
                      <b>{u.email}</b>
                      {isSelf && <span className="muted"> · tu</span>}
                    </td>
                    <td>
                      {canManage && !isSelf ? (
                        <select
                          className="select"
                          style={{ width: 175, padding: '6px 10px' }}
                          value={u.role}
                          onChange={(e) => changeRole(u, e.target.value as Role)}
                        >
                          {STAFF_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABEL[r]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <RoleChip role={u.role} />
                      )}
                    </td>
                    <td>
                      <StatusChip status={u.status} />
                    </td>
                    <td className="muted">{u.locale.toUpperCase()}</td>
                    <td>
                      <div className="row" style={{ justifyContent: 'flex-end' }}>
                        {canManage && u.role !== 'admin' && u.status === 'active' && (
                          <button className="btn ghost sm" onClick={() => doImpersonate(u)} title="Entra nell'app come questo utente">
                            <i className="ti ti-eye" /> Entra come
                          </button>
                        )}
                        {canManage && !isSelf && (
                          <button className={`btn sm ${u.status === 'active' ? 'danger' : 'ghost'}`} onClick={() => toggleStatus(u)}>
                            {u.status === 'active' ? 'Sospendi' : 'Riattiva'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <CreateStaffModal
          onClose={() => setShowCreate(false)}
          onCreated={(email) => {
            setShowCreate(false);
            setNotice(`Utente ${email} creato.`);
            void load();
          }}
        />
      )}
    </>
  );
}

function CreateStaffModal({ onClose, onCreated }: { onClose: () => void; onCreated: (email: string) => void }) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<Role>('coach');
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
      await api('/admin/users', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password, role, displayName: displayName.trim() || undefined }),
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
        <select className="select" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {STAFF_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
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
