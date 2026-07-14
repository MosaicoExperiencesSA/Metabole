import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Banner } from '../components/ui';
import { ThemeSelect } from '../theme';
import { DASHBOARD_MODULES, DEFAULT_MODULE_IDS } from '../lib/dashboardModules';

/** Riduce un'immagine a un quadrato 256×256 (cover, ritaglio centrato) e la ritorna come data URL JPEG. */
function fileToAvatarDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) { reject(new Error('Il file non è un\'immagine.')); return; }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const size = 256;
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Impossibile elaborare l\'immagine.')); return; }
      const scale = Math.max(size / img.width, size / img.height);
      const w = img.width * scale, h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Immagine non leggibile.')); };
    img.src = url;
  });
}

export function Impostazioni() {
  const { user, refreshUser, can } = useAuth();

  // --- Dati account ---
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', title: '' });
  const [savingAcc, setSavingAcc] = useState(false);
  const [accMsg, setAccMsg] = useState<string | null>(null);
  const [accErr, setAccErr] = useState<string | null>(null);

  // --- Foto profilo (avatar) ---
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoErr, setPhotoErr] = useState<string | null>(null);

  async function onPhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoErr(null); setAccMsg(null); setPhotoBusy(true);
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      await api('/me/account', { method: 'PATCH', body: JSON.stringify({ photoUrl: dataUrl }) });
      await refreshUser();
      setAccMsg('Foto profilo aggiornata.');
    } catch (err) {
      setPhotoErr(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally { setPhotoBusy(false); }
  }

  async function removePhoto() {
    setPhotoErr(null); setAccMsg(null); setPhotoBusy(true);
    try {
      await api('/me/account', { method: 'PATCH', body: JSON.stringify({ photoUrl: null }) });
      await refreshUser();
      setAccMsg('Foto rimossa.');
    } catch (err) {
      setPhotoErr(err instanceof Error ? err.message : 'Operazione non riuscita.');
    } finally { setPhotoBusy(false); }
  }

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

  // --- Casella di posta @metabole.eu ---
  const [mail, setMail] = useState<{ configured: boolean; email: string | null } | null>(null);
  const [mailForm, setMailForm] = useState({ email: '', password: '' });
  const [mailBusy, setMailBusy] = useState(false);
  const [mailMsg, setMailMsg] = useState<string | null>(null);
  const [mailErr, setMailErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setMail(await api<{ configured: boolean; email: string | null }>('/me/mailbox'));
      } catch {
        setMail({ configured: false, email: null }); // se il ruolo non ha la casella, resta scollegata
      }
    })();
  }, []);

  async function connectMailbox() {
    setMailErr(null); setMailMsg(null);
    if (!mailForm.email.trim() || !mailForm.password) { setMailErr('Inserisci indirizzo e password della casella.'); return; }
    setMailBusy(true);
    try {
      const r = await api<{ email: string }>('/me/mailbox', { method: 'PUT', body: JSON.stringify({ email: mailForm.email.trim(), password: mailForm.password }) });
      setMail({ configured: true, email: r.email });
      setMailForm({ email: '', password: '' });
      setMailMsg('Casella collegata. Ora la trovi nel menu «Posta».');
    } catch (err) {
      setMailErr(err instanceof ApiError ? err.message : 'Collegamento non riuscito. Controlla indirizzo e password.');
    } finally { setMailBusy(false); }
  }

  async function disconnectMailbox() {
    if (!confirm('Scollegare la casella di posta? La password salvata verrà rimossa.')) return;
    setMailErr(null); setMailMsg(null); setMailBusy(true);
    try {
      await api('/me/mailbox', { method: 'DELETE' });
      setMail({ configured: false, email: null });
      setMailMsg('Casella scollegata.');
    } catch (err) {
      setMailErr(err instanceof ApiError ? err.message : 'Operazione non riuscita.');
    } finally { setMailBusy(false); }
  }

  // --- Moduli dashboard ---
  const availableModules = DASHBOARD_MODULES.filter((m) => can(m.pageKey));
  const [modules, setModules] = useState<string[] | null>(null);
  const [modMsg, setModMsg] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const prefs = await api<{ dashboardModules: string[] | null }>('/me/preferences');
        setModules(prefs.dashboardModules ?? DEFAULT_MODULE_IDS);
      } catch { setModules(DEFAULT_MODULE_IDS); }
    })();
  }, []);

  async function saveModules(next: string[]) {
    setModules(next);
    setModMsg(null);
    try {
      await api('/me/preferences', { method: 'PUT', body: JSON.stringify({ dashboardModules: next }) });
      setModMsg('Preferenze dashboard salvate.');
    } catch { setModMsg('Salvataggio non riuscito.'); }
  }

  const chosen = (modules ?? DEFAULT_MODULE_IDS).filter((id) => availableModules.some((m) => m.id === id));

  function toggleModule(id: string) {
    const next = chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id];
    void saveModules(next);
  }

  /** Sposta il modulo trascinato PRIMA di quello su cui si rilascia. */
  function reorder(fromId: string, toId: string) {
    if (fromId === toId) return;
    const next = [...chosen];
    const from = next.indexOf(fromId);
    if (from < 0) return;
    next.splice(from, 1);
    const to = next.indexOf(toId);
    next.splice(to < 0 ? next.length : to, 0, fromId);
    void saveModules(next);
  }

  const selectedModules = chosen.map((id) => availableModules.find((m) => m.id === id)).filter(Boolean) as typeof availableModules;
  const unselectedModules = availableModules.filter((m) => !chosen.includes(m.id));

  return (
    <>
      {/* Dati personali */}
      <div className="card">
        <h2 style={{ marginTop: 0 }}>I miei dati</h2>
        {accErr && <Banner kind="err">{accErr}</Banner>}
        {accMsg && <Banner kind="ok">{accMsg}</Banner>}

        {/* Foto profilo (icona in alto a destra) */}
        <div className="row" style={{ gap: 16, alignItems: 'center', marginBottom: 18 }}>
          <span
            style={{
              width: 64, height: 64, borderRadius: '50%', flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 700, fontSize: 22, background: user?.photoUrl ? undefined : 'var(--teal)',
              backgroundImage: user?.photoUrl ? `url(${user.photoUrl})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center',
            }}
          >
            {user?.photoUrl ? '' : (user?.firstName?.[0] ?? user?.email?.[0] ?? '?').toUpperCase()}
          </span>
          <div>
            <div className="row" style={{ gap: 8 }}>
              <label className="btn ghost sm" style={{ cursor: photoBusy ? 'default' : 'pointer' }}>
                <i className="ti ti-upload" /> {photoBusy ? 'Carico…' : (user?.photoUrl ? 'Cambia foto' : 'Carica foto')}
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onPhotoFile} style={{ display: 'none' }} disabled={photoBusy} />
              </label>
              {user?.photoUrl && <button className="btn ghost sm" onClick={removePhoto} disabled={photoBusy}>Rimuovi</button>}
            </div>
            {photoErr && <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 6 }}>{photoErr}</div>}
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Usata come icona in alto a destra. Ridotta a un quadrato in automatico.</div>
          </div>
        </div>

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

      {/* Casella di posta @metabole.eu */}
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Casella di posta</h2>
        <p className="hint" style={{ marginTop: 0 }}>
          Collega la tua casella <b>@metabole.eu</b> per leggere e inviare email dal menu «Posta». La password viene
          salvata cifrata e usata solo per la tua posta. Server: mail.metabole.eu (IMAP 993 / SMTP 465).
        </p>
        {mailErr && <Banner kind="err">{mailErr}</Banner>}
        {mailMsg && <Banner kind="ok">{mailMsg}</Banner>}

        {mail === null ? (
          <p className="muted" style={{ fontSize: 13 }}>Carico…</p>
        ) : mail.configured ? (
          <div className="row" style={{ gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="chip" style={{ gap: 6 }}><i className="ti ti-mail-check" /> Collegata: <b>{mail.email}</b></span>
            <button className="btn ghost sm" onClick={disconnectMailbox} disabled={mailBusy}>
              <i className="ti ti-plug-connected-x" /> {mailBusy ? 'Attendi…' : 'Scollega'}
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
              <Field label="Indirizzo email"><input className="input" placeholder="nome@metabole.eu" autoComplete="off" value={mailForm.email} onChange={(e) => setMailForm({ ...mailForm, email: e.target.value })} /></Field>
              <Field label="Password della casella"><input className="input" type="password" autoComplete="off" value={mailForm.password} onChange={(e) => setMailForm({ ...mailForm, password: e.target.value })} /></Field>
            </div>
            <button className="btn" style={{ marginTop: 14 }} onClick={connectMailbox} disabled={mailBusy || !mailForm.email.trim() || !mailForm.password}>
              <i className="ti ti-plug-connected" /> {mailBusy ? 'Collego…' : 'Collega casella'}
            </button>
          </>
        )}
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
        <p className="hint" style={{ marginTop: 0 }}>Trascina per riordinare i riquadri; l'ordine si riflette in dashboard. {modMsg && <b style={{ color: 'var(--ok-ink)' }}>· {modMsg}</b>}</p>

        {selectedModules.length === 0 ? (
          <div className="empty" style={{ padding: '18px 12px' }}>Nessun modulo attivo. Aggiungine qui sotto.</div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {selectedModules.map((m) => (
              <div
                key={m.id}
                draggable
                onDragStart={() => setDragId(m.id)}
                onDragEnd={() => setDragId(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { if (dragId) reorder(dragId, m.id); setDragId(null); }}
                style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--chip)', cursor: 'grab', opacity: dragId === m.id ? 0.4 : 1 }}
              >
                <i className="ti ti-grip-vertical" style={{ fontSize: 18, color: 'var(--muted)' }} />
                <i className={`ti ${m.icon}`} style={{ fontSize: 18 }} />
                <span style={{ flex: 1 }}>
                  <b style={{ display: 'block', fontSize: 14 }}>{m.label}</b>
                  <span className="muted" style={{ fontSize: 12 }}>{m.preview}</span>
                </span>
                <button className="btn ghost sm" onClick={() => toggleModule(m.id)} title="Rimuovi dalla dashboard"><i className="ti ti-x" /></button>
              </div>
            ))}
          </div>
        )}

        {unselectedModules.length > 0 && (
          <>
            <p className="muted" style={{ fontSize: 12, margin: '14px 0 6px' }}>Aggiungi altri moduli</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {unselectedModules.map((m) => (
                <button key={m.id} className="chip" onClick={() => toggleModule(m.id)} style={{ cursor: 'pointer', gap: 6 }}>
                  <i className={`ti ${m.icon}`} /> {m.label} <i className="ti ti-plus" style={{ fontSize: 13 }} />
                </button>
              ))}
            </div>
          </>
        )}
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
