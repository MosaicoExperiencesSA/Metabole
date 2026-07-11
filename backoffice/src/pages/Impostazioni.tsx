import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Banner } from '../components/ui';
import { ThemeSelect } from '../theme';
import { DASHBOARD_MODULES, DEFAULT_MODULE_IDS } from '../lib/dashboardModules';

export function Impostazioni() {
  const { user, refreshUser, can } = useAuth();

  // --- Dati account ---
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', title: '' });
  const [savingAcc, setSavingAcc] = useState(false);
  const [accMsg, setAccMsg] = useState<string | null>(null);
  const [accErr, setAccErr] = useState<string | null>(null);

  useEffect(() => {
    if (user) setForm({
      firstName: user.firstName ?? '', lastName: user.lastName ?? '', email: user.email ?? '',
      phone: user.phone ?? '', title: user.title ?? '',
    });
  }, [user]);

  async function saveAccount() {
    setSavingAcc(true); setAccErr(null); setAccMsg(null);
    try {
      await api('/me/account', { method: 'PATCH', body: JSON.stringify(form) });
      await refreshUser();
      setAccMsg('Dati aggiornati.');
    } catch (err) {
      setAccErr(err instanceof ApiError ? err.message : 'Salvataggio non riuscito.');
    } finally { setSavingAcc(false); }
  }

  // --- Password ---
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwErr, setPwErr] = useState<string | null>(null);

  async function changePassword() {
    setPwErr(null); setPwMsg(null);
    if (pw.next.length < 8) { setPwErr('La nuova password deve avere almeno 8 caratteri.'); return; }
    if (pw.next !== pw.confirm) { setPwErr('Le due password non coincidono.'); return; }
    setSavingPw(true);
    try {
      await api('/me/password', { method: 'PATCH', body: JSON.stringify({ currentPassword: pw.current, newPassword: pw.next }) });
      setPw({ current: '', next: '', confirm: '' });
      setPwMsg('Password aggiornata.');
    } catch (err) {
      setPwErr(err instanceof ApiError ? err.message : 'Cambio password non riuscito.');
    } finally { setSavingPw(false); }
  }

  // --- Moduli dashboard ---
  const availableModules = DASHBOARD_MODULES.filter((m) => can(m.pageKey));
  const [modules, setModules] = useState<string[] | null>(null);
  const [modMsg, setModMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const prefs = await api<{ dashboardModules: string[] | null }>('/me/preferences');
        setModules(prefs.dashboardModules ?? DEFAULT_MODULE_IDS);
      } catch { setModules(DEFAULT_MODULE_IDS); }
    })();
  }, []);

  async function toggleModule(id: string) {
    const cur = modules ?? DEFAULT_MODULE_IDS;
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    setModules(next);
    setModMsg(null);
    try {
      const ordered = availableModules.filter((m) => next.includes(m.id)).map((m) => m.id);
      await api('/me/preferences', { method: 'PUT', body: JSON.stringify({ dashboardModules: ordered }) });
      setModMsg('Preferenze dashboard salvate.');
    } catch { setModMsg('Salvataggio non riuscito.'); }
  }

  const chosen = modules ?? DEFAULT_MODULE_IDS;

  return (
    <>
      {/* Dati personali */}
      <div className="card">
        <h2 style={{ marginTop: 0 }}>I miei dati</h2>
        {accErr && <Banner kind="err">{accErr}</Banner>}
        {accMsg && <Banner kind="ok">{accMsg}</Banner>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
          <Field label="Nome"><input className="input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></Field>
          <Field label="Cognome"><input className="input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></Field>
          <Field label="Titolo / qualifica"><input className="input" placeholder="es. Coach, Dr.ssa" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="Email"><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Telefono"><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        </div>
        <button className="btn" style={{ marginTop: 14 }} onClick={saveAccount} disabled={savingAcc}>
          <i className="ti ti-device-floppy" /> {savingAcc ? 'Salvo…' : 'Salva dati'}
        </button>
      </div>

      {/* Password */}
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Cambia password</h2>
        {pwErr && <Banner kind="err">{pwErr}</Banner>}
        {pwMsg && <Banner kind="ok">{pwMsg}</Banner>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
          <Field label="Password attuale"><input className="input" type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></Field>
          <Field label="Nuova password"><input className="input" type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></Field>
          <Field label="Conferma nuova"><input className="input" type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></Field>
        </div>
        <button className="btn" style={{ marginTop: 14 }} onClick={changePassword} disabled={savingPw || !pw.current || !pw.next}>
          <i className="ti ti-key" /> {savingPw ? 'Aggiorno…' : 'Aggiorna password'}
        </button>
      </div>

      {/* Tema */}
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Tema</h2>
        <p className="hint" style={{ marginTop: 0 }}>Il tema si applica subito e resta salvato sul tuo account.</p>
        <ThemeSelect />
      </div>

      {/* Moduli dashboard */}
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Moduli in dashboard</h2>
        <p className="hint" style={{ marginTop: 0 }}>Scegli i riquadri (anteprime delle pagine) da mostrare in dashboard. {modMsg && <b style={{ color: 'var(--ok-ink)' }}>· {modMsg}</b>}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 8 }}>
          {availableModules.map((m) => {
            const on = chosen.includes(m.id);
            return (
              <label key={m.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', borderRadius: 10, cursor: 'pointer', border: '1px solid var(--line)', background: on ? 'var(--chip)' : 'transparent' }}>
                <input type="checkbox" checked={on} onChange={() => toggleModule(m.id)} />
                <i className={`ti ${m.icon}`} style={{ fontSize: 18 }} />
                <span style={{ flex: 1 }}>
                  <b style={{ display: 'block', fontSize: 14 }}>{m.label}</b>
                  <span className="muted" style={{ fontSize: 12 }}>{m.preview}</span>
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span className="muted" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>{label}</span>
      {children}
    </label>
  );
}
