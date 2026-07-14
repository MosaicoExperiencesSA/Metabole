import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { Banner, Modal, Spinner } from '../components/ui';

interface MailStatus {
  configured: boolean;
  email: string | null;
}
interface InboxItem {
  uid: number;
  from: string;
  fromName: string;
  subject: string;
  date: string | null;
  seen: boolean;
}
interface FullMessage {
  uid: number;
  from: string;
  to: string;
  subject: string;
  date: string | null;
  text: string;
  html: string | null;
}

const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');

/** Casella di posta @metabole.eu dell'operatore (MVP: posta in arrivo + scrivi). */
export function Posta() {
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState<MailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [loadingInbox, setLoadingInbox] = useState(false);
  const [open, setOpen] = useState<FullMessage | null>(null);
  const [compose, setCompose] = useState<{ to: string; subject: string; text: string } | null>(null);

  async function loadStatus() {
    setLoading(true);
    try {
      const s = await api<MailStatus>('/me/mailbox');
      setStatus(s);
      if (s.configured) void loadInbox();
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setError('Sezione riservata allo staff.');
      else setError(err instanceof Error ? err.message : 'Caricamento non riuscito.');
    } finally {
      setLoading(false);
    }
  }

  async function loadInbox() {
    setLoadingInbox(true);
    setError(null);
    try {
      setInbox(await api<InboxItem[]>('/me/mailbox/inbox?limit=30'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lettura della posta non riuscita.');
    } finally {
      setLoadingInbox(false);
    }
  }

  useEffect(() => { void loadStatus(); }, []);

  // Precompila la composizione se si arriva da "Scrivi al cliente" (?to=&subject=)
  useEffect(() => {
    const to = params.get('to');
    if (to && status?.configured) {
      setCompose({ to, subject: params.get('subject') ?? '', text: params.get('body') ?? '' });
      params.delete('to'); params.delete('subject'); params.delete('body');
      setParams(params, { replace: true });
    }
  }, [status, params, setParams]);

  async function openMessage(it: InboxItem) {
    setError(null);
    try {
      const msg = await api<FullMessage>(`/me/mailbox/message/${it.uid}`);
      setOpen(msg);
      setInbox((rs) => rs.map((x) => (x.uid === it.uid ? { ...x, seen: true } : x)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Apertura del messaggio non riuscita.');
    }
  }

  if (loading) return <Spinner />;

  if (!status?.configured) {
    return (
      <MailboxSetup
        onDone={(email) => { setStatus({ configured: true, email }); setNotice('Casella collegata.'); void loadInbox(); }}
        error={error}
      />
    );
  }

  return (
    <>
      <div className="spread" style={{ marginBottom: 16 }}>
        <p className="muted" style={{ margin: 0 }}>Casella <b>{status.email}</b> — posta in arrivo.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn ghost" onClick={() => void loadInbox()} disabled={loadingInbox}><i className="ti ti-refresh" /> Aggiorna</button>
          <button className="btn" onClick={() => setCompose({ to: '', subject: '', text: '' })}><i className="ti ti-pencil" /> Scrivi</button>
        </div>
      </div>

      {error && <Banner kind="err">{error}</Banner>}
      {notice && <Banner kind="ok">{notice}</Banner>}

      <div className="card" style={{ padding: 0 }}>
        {loadingInbox ? (
          <div style={{ padding: 24 }}><Spinner /></div>
        ) : inbox.length === 0 ? (
          <div className="empty">Nessun messaggio.</div>
        ) : (
          <table className="grid">
            <thead>
              <tr><th style={{ width: 220 }}>Mittente</th><th>Oggetto</th><th style={{ width: 130 }}>Data</th></tr>
            </thead>
            <tbody>
              {inbox.map((it) => (
                <tr key={it.uid} style={{ cursor: 'pointer', fontWeight: it.seen ? 400 : 600 }} onClick={() => void openMessage(it)}>
                  <td>{it.fromName || it.from}</td>
                  <td>{it.subject}</td>
                  <td className="muted">{fmtDate(it.date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {open && (
        <Modal title={open.subject || '(nessun oggetto)'} onClose={() => setOpen(null)}>
          <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
            Da: {open.from}<br />Data: {fmtDate(open.date)}
          </div>
          <div style={{ whiteSpace: 'pre-wrap', maxHeight: '50vh', overflow: 'auto', borderTop: '1px solid var(--border,#eee)', paddingTop: 12 }}>
            {open.text || (open.html ? '(messaggio in HTML — testo non disponibile)' : '(vuoto)')}
          </div>
          <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
            <button className="btn ghost" onClick={() => { setCompose({ to: open.from.replace(/.*<(.+)>.*/, '$1'), subject: open.subject.startsWith('Re:') ? open.subject : `Re: ${open.subject}`, text: '' }); setOpen(null); }}>Rispondi</button>
            <button className="btn" onClick={() => setOpen(null)}>Chiudi</button>
          </div>
        </Modal>
      )}

      {compose && (
        <ComposeModal
          initial={compose}
          onClose={() => setCompose(null)}
          onSent={() => { setCompose(null); setNotice('Email inviata.'); }}
        />
      )}
    </>
  );
}

function MailboxSetup({ onDone, error }: { onDone: (email: string) => void; error: string | null }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    if (!email.trim() || !password) { setErr('Inserisci indirizzo e password della casella.'); return; }
    setBusy(true);
    try {
      const r = await api<{ email: string }>('/me/mailbox', { method: 'PUT', body: JSON.stringify({ email: email.trim(), password }) });
      onDone(r.email);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Collegamento non riuscito.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 480 }}>
      <h3 style={{ marginTop: 0 }}>Collega la tua casella @metabole.eu</h3>
      <p className="muted">La password viene salvata cifrata e usata solo per leggere e inviare la tua posta. Server: mail.metabole.eu (IMAP 993 / SMTP 465).</p>
      {(err || error) && <Banner kind="err">{err || error}</Banner>}
      <div className="field">
        <label>Indirizzo email</label>
        <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@metabole.eu" autoComplete="off" />
      </div>
      <div className="field">
        <label>Password della casella</label>
        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" />
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
        <button className="btn" onClick={submit} disabled={busy || !email.trim() || !password}>{busy ? 'Collego…' : 'Collega casella'}</button>
      </div>
    </div>
  );
}

function ComposeModal({ initial, onClose, onSent }: { initial: { to: string; subject: string; text: string }; onClose: () => void; onSent: () => void }) {
  const [to, setTo] = useState(initial.to);
  const [subject, setSubject] = useState(initial.subject);
  const [text, setText] = useState(initial.text);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    if (!to.trim()) { setErr('Inserisci il destinatario.'); return; }
    if (!text.trim()) { setErr('Il messaggio è vuoto.'); return; }
    setBusy(true);
    try {
      await api('/me/mailbox/send', { method: 'POST', body: JSON.stringify({ to: to.trim(), subject: subject.trim(), text }) });
      onSent();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Invio non riuscito.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Scrivi email" onClose={onClose}>
      {err && <Banner kind="err">{err}</Banner>}
      <div className="field">
        <label>A</label>
        <input className="input" value={to} onChange={(e) => setTo(e.target.value)} placeholder="destinatario@esempio.it" />
      </div>
      <div className="field">
        <label>Oggetto</label>
        <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} />
      </div>
      <div className="field">
        <label>Messaggio</label>
        <textarea className="input" rows={8} value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
        <button className="btn ghost" onClick={onClose} disabled={busy}>Annulla</button>
        <button className="btn" onClick={submit} disabled={busy || !to.trim() || !text.trim()}>{busy ? 'Invio…' : 'Invia'}</button>
      </div>
    </Modal>
  );
}
