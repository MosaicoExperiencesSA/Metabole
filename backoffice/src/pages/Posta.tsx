import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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

/** Estrae l'indirizzo email da "Nome <a@b.it>" (o restituisce la stringa se già pulita). */
const addressOf = (from: string) => {
  const m = from.match(/<([^>]+)>/);
  return (m ? m[1] : from).trim();
};

/** Divide "Mario Rossi <m@rossi.it>" in nome + indirizzo per un'intestazione leggibile. */
function MessageHeader({ from, date }: { from: string; date: string }) {
  const m = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  const name = m?.[1]?.trim();
  const addr = m ? m[2].trim() : from.trim();
  const initial = (name || addr || '?').charAt(0).toUpperCase();
  return (
    <div className="row" style={{ gap: 12, alignItems: 'center', paddingBottom: 14, marginBottom: 14, borderBottom: '1px solid var(--line,#eee)' }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--chip,#f0ede8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--deep,#7a5)', flex: '0 0 auto' }}>{initial}</div>
      <div style={{ minWidth: 0 }}>
        {name && <div style={{ fontWeight: 600, lineHeight: 1.2 }}>{name}</div>}
        <div className="muted" style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{addr}</div>
      </div>
      <div className="muted" style={{ fontSize: 12.5, marginLeft: 'auto', whiteSpace: 'nowrap' }}>{date}</div>
    </div>
  );
}

/** Corpo del messaggio: se c'è l'HTML lo mostra in un iframe isolato (niente script,
 * link in nuova scheda); altrimenti il testo con URL cliccabili e tipografia leggibile. */
function MessageBody({ html, text }: { html: string | null; text: string }) {
  if (html && html.trim()) {
    const doc = `<!doctype html><html><head><meta charset="utf-8"><base target="_blank">
<style>
  html,body{margin:0;padding:0}
  body{font:15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#2b2b2b;padding:4px 2px;word-break:break-word}
  img{max-width:100%;height:auto}
  a{color:#0a7d55}
  table{max-width:100%}
  blockquote{margin:0 0 0 12px;padding-left:12px;border-left:3px solid #e4e0d8;color:#555}
  pre{white-space:pre-wrap;word-break:break-word}
</style></head><body>${html}</body></html>`;
    return (
      <iframe
        title="Messaggio"
        srcDoc={doc}
        sandbox="allow-popups allow-popups-to-escape-sandbox"
        style={{ width: '100%', height: '55vh', border: 0, borderRadius: 8, background: '#fff' }}
      />
    );
  }
  const body = (text || '').trim();
  if (!body) return <div className="muted" style={{ padding: '8px 0' }}>(messaggio vuoto)</div>;
  return (
    <div style={{ maxHeight: '55vh', overflow: 'auto', fontSize: 15, lineHeight: 1.6, color: 'var(--ink,#2b2b2b)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      <Linkified text={body} />
    </div>
  );
}

/** Rende cliccabili gli URL nel testo, togliendo le parentesi quadre del formato
 * testo-semplice (es. "Registro [https://…]" → link). Sicuro: nessun HTML grezzo. */
function Linkified({ text }: { text: string }) {
  // Cattura URL eventualmente racchiusi tra parentesi quadre.
  const re = /\[?(https?:\/\/[^\s\]<>]+)\]?/g;
  const out: (string | JSX.Element)[] = [];
  let last = 0, m: RegExpExecArray | null, k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const url = m[1].replace(/[.,;:)]+$/, ''); // niente punteggiatura finale nel link
    out.push(
      <a key={k++} href={url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--deep,#0a7d55)', wordBreak: 'break-all' }}>
        {url}
      </a>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}

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
      <div className="card" style={{ maxWidth: 520, textAlign: 'center' }}>
        <div style={{ fontSize: 34, marginBottom: 6 }}><i className="ti ti-mail-off" style={{ color: 'var(--muted)' }} /></div>
        <h3 style={{ marginTop: 0 }}>Casella non ancora collegata</h3>
        <p className="muted">
          Per usare la posta devi prima collegare la tua casella <b>@metabole.eu</b>. La colleghi dalle Impostazioni:
          bastano indirizzo e password.
        </p>
        {error && <Banner kind="err">{error}</Banner>}
        <Link className="btn" to="/impostazioni" style={{ marginTop: 8 }}>
          <i className="ti ti-settings" /> Vai in Impostazioni e collega la casella
        </Link>
      </div>
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
        <Modal title={open.subject || '(nessun oggetto)'} onClose={() => setOpen(null)} wide>
          <MessageHeader from={open.from} date={fmtDate(open.date)} />
          <MessageBody html={open.html} text={open.text} />
          <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
            <button className="btn ghost" onClick={() => { setCompose({ to: addressOf(open.from), subject: open.subject.startsWith('Re:') ? open.subject : `Re: ${open.subject}`, text: '' }); setOpen(null); }}>Rispondi</button>
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
