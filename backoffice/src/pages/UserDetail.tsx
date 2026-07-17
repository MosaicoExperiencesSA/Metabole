import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { Banner, Modal, RoleChip, Spinner, StatusChip } from '../components/ui';
import { useAuth } from '../auth/AuthContext';
import type { Role } from '../lib/labels';

interface UserData {
  id: string;
  email: string;
  role: Role;
  status: string;
  locale: string;
  mustChangePassword: boolean;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  title: string | null;
  addressLine: string | null;
  country: string | null;
  createdAt: string;
  customRole?: { label: string } | null;
  staff: { id: string; displayName: string; refCode: string | null } | null;
}

/** Scheda di un utente/staff: anagrafica modificabile + reset password. */
export function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const canManage = can('users', 'manage');
  const [u, setU] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pwd, setPwd] = useState<string | null>(null);

  const [form, setForm] = useState({ email: '', displayName: '', firstName: '', lastName: '', phone: '', title: '', addressLine: '', country: '' });

  async function load() {
    setLoading(true); setError(null);
    try {
      const d = await api<UserData>(`/admin/users/${id}`);
      setU(d);
      setForm({
        email: d.email ?? '',
        displayName: d.staff?.displayName ?? '',
        firstName: d.firstName ?? '', lastName: d.lastName ?? '',
        phone: d.phone ?? '', title: d.title ?? '',
        addressLine: d.addressLine ?? '', country: d.country ?? '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [id]);

  async function save() {
    if (!u) return;
    setSaving(true); setError(null); setNotice(null);
    try {
      const body: Record<string, unknown> = {
        firstName: form.firstName.trim(), lastName: form.lastName.trim(),
        phone: form.phone.trim(), title: form.title.trim(),
        addressLine: form.addressLine.trim(), country: form.country.trim(),
      };
      // Email di login: la invio solo se davvero cambiata (correzione admin).
      const newEmail = form.email.trim().toLowerCase();
      if (newEmail && newEmail !== u.email.toLowerCase()) body.email = newEmail;
      if (u.staff) body.displayName = form.displayName.trim();
      await api(`/admin/users/${u.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      setNotice('Dati salvati.');
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Salvataggio non riuscito.');
    } finally { setSaving(false); }
  }

  async function resetPassword() {
    if (!u) return;
    if (!confirm(`Reset password per ${u.email}?\nVerrà generata una provvisoria: l'utente dovrà cambiarla al primo accesso e le sessioni attive verranno chiuse.`)) return;
    setError(null);
    try {
      const r = await api<{ password: string }>(`/admin/users/${u.id}/reset-password`, { method: 'POST', body: JSON.stringify({}) });
      setPwd(r.password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset password non riuscito.');
    }
  }

  if (loading) return <Spinner />;
  if (!u) return <Banner kind="err">{error ?? 'Utente non trovato.'}</Banner>;

  const initial = (form.displayName || u.email).charAt(0).toUpperCase();

  return (
    <>
      <div className="spread" style={{ marginBottom: 16 }}>
        <Link to="/utenti" className="btn ghost sm"><i className="ti ti-arrow-left" /> Utenti</Link>
      </div>
      {error && <Banner kind="err">{error}</Banner>}
      {notice && <Banner kind="ok">{notice}</Banner>}

      <div className="card">
        <div className="row" style={{ gap: 14, alignItems: 'center', marginBottom: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--chip,#f0ede8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 20, color: 'var(--deep)' }}>{initial}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{form.displayName || `${form.firstName} ${form.lastName}`.trim() || u.email}</div>
            <div className="muted" style={{ fontSize: 13 }}>{u.email}</div>
          </div>
          <div className="row" style={{ gap: 6, marginLeft: 'auto', alignItems: 'center' }}>
            <RoleChip role={u.role} />
            <StatusChip status={u.status} />
            {u.mustChangePassword && <span className="chip amber" style={{ fontSize: 11 }}>cambio password al login</span>}
          </div>
        </div>

        <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
          <div className="field" style={{ minWidth: 240, flex: 1 }}><label>Email di login</label>
            <input className="input" type="email" value={form.email} disabled={!canManage} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="nome@metabole.eu" />
            <span className="muted" style={{ fontSize: 11 }}>Cambiandola, l’utente accede con la nuova email e le sessioni attive vengono chiuse.</span>
          </div>
        </div>
        <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
          {u.staff && (
            <div className="field" style={{ minWidth: 200, flex: 1 }}><label>Nome mostrato</label>
              <input className="input" value={form.displayName} disabled={!canManage} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} />
            </div>
          )}
          <div className="field" style={{ minWidth: 160, flex: 1 }}><label>Nome</label>
            <input className="input" value={form.firstName} disabled={!canManage} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} />
          </div>
          <div className="field" style={{ minWidth: 160, flex: 1 }}><label>Cognome</label>
            <input className="input" value={form.lastName} disabled={!canManage} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} />
          </div>
        </div>
        <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
          <div className="field" style={{ minWidth: 160, flex: 1 }}><label>Telefono</label>
            <input className="input" value={form.phone} disabled={!canManage} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+39 …" />
          </div>
          <div className="field" style={{ minWidth: 160, flex: 1 }}><label>Titolo / qualifica</label>
            <input className="input" value={form.title} disabled={!canManage} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Es. Dr.ssa, Coach" />
          </div>
        </div>
        <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
          <div className="field" style={{ minWidth: 260, flex: 2 }}><label>Indirizzo</label>
            <input className="input" value={form.addressLine} disabled={!canManage} onChange={(e) => setForm((f) => ({ ...f, addressLine: e.target.value }))} placeholder="Via e numero, città" />
          </div>
          <div className="field" style={{ minWidth: 140, flex: 1 }}><label>Paese</label>
            <input className="input" value={form.country} disabled={!canManage} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} placeholder="Italia" />
          </div>
        </div>

        {u.staff?.refCode && <p className="muted" style={{ fontSize: 12.5 }}>Codice referral: <b>{u.staff.refCode}</b></p>}

        {canManage && (
          <div className="spread" style={{ marginTop: 8 }}>
            <button className="btn ghost" onClick={resetPassword}><i className="ti ti-key" /> Reset password</button>
            <button className="btn" onClick={save} disabled={saving}><i className="ti ti-device-floppy" /> {saving ? 'Salvataggio…' : 'Salva'}</button>
          </div>
        )}
      </div>

      {pwd && (
        <Modal title="Password provvisoria generata" onClose={() => setPwd(null)}>
          <p style={{ marginTop: 0 }}>Nuova password per <b>{u.email}</b>. Comunicala all'utente: dovrà <b>cambiarla al primo accesso</b>. La vedi solo ora.</p>
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <code style={{ flex: 1, fontSize: 18, padding: '10px 14px', background: 'var(--chip,#f0ede8)', borderRadius: 8, letterSpacing: 1, userSelect: 'all' }}>{pwd}</code>
            <button className="btn ghost sm" onClick={() => { void navigator.clipboard?.writeText(pwd); }}><i className="ti ti-copy" /> Copia</button>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
            <button className="btn" onClick={() => setPwd(null)}>Ho copiato, chiudi</button>
          </div>
        </Modal>
      )}
    </>
  );
}
