import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../api/client';
import { Banner, Spinner } from '../components/ui';

interface Thread {
  id: string;
  counterpart: string;
  lastMessageAt: string | null;
  client: { id: string; email: string; clientProfile: { name: string | null } | null } | null;
}
interface Msg {
  id: string;
  senderRole: string;
  body: string;
  sentAt: string;
}

const nameOf = (t: Thread) => t.client?.clientProfile?.name || t.client?.email || 'Cliente';

/** Chat staff ↔ cliente (coach/nutrizionista). Legge le API staff/threads + threads/:id/messages. */
export function Chat() {
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [sel, setSel] = useState<Thread | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<Thread[]>('/staff/threads').then(setThreads).catch(() => setThreads([]));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [msgs]);

  async function open(t: Thread) {
    setSel(t);
    setMsgs([]);
    setError(null);
    try {
      setMsgs(await api<Msg[]>(`/threads/${t.id}/messages`));
    } catch {
      setMsgs([]);
    }
  }

  async function send() {
    if (!sel || !text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/threads/${sel.id}/messages`, { method: 'POST', body: JSON.stringify({ body: text.trim() }) });
      setText('');
      setMsgs(await api<Msg[]>(`/threads/${sel.id}/messages`));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Invio non riuscito');
    } finally {
      setBusy(false);
    }
  }

  if (threads === null) return <Spinner />;

  return (
    <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 150px)' }}>
      <div className="card" style={{ width: 290, overflowY: 'auto', padding: 8 }}>
        {threads.length === 0 && <div className="muted" style={{ padding: 12 }}>Nessuna conversazione.</div>}
        {threads.map((t) => (
          <button
            key={t.id}
            onClick={() => open(t)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '10px 12px',
              border: 'none',
              background: sel?.id === t.id ? '#EAF6F1' : 'transparent',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            <b>{nameOf(t)}</b>
            <div className="muted" style={{ fontSize: 12 }}>
              {t.lastMessageAt ? new Date(t.lastMessageAt).toLocaleString('it-IT') : 'nuova conversazione'}
            </div>
          </button>
        ))}
      </div>

      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0, minWidth: 0 }}>
        {!sel ? (
          <div className="muted" style={{ margin: 'auto' }}>Seleziona una conversazione</div>
        ) : (
          <>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #eee' }}>
              <b>{nameOf(sel)}</b>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {msgs.map((m) => {
                const mine = m.senderRole !== 'client';
                return (
                  <div
                    key={m.id}
                    style={{
                      alignSelf: mine ? 'flex-end' : 'flex-start',
                      maxWidth: '75%',
                      background: mine ? '#12A386' : '#F2EFE8',
                      color: mine ? '#fff' : '#25302c',
                      padding: '8px 12px',
                      borderRadius: 12,
                    }}
                  >
                    <div style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{m.body}</div>
                    <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>{new Date(m.sentAt).toLocaleString('it-IT')}</div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>
            {error && <div style={{ padding: '0 16px 8px' }}><Banner kind="err">{error}</Banner></div>}
            <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid #eee' }}>
              <input
                className="input"
                style={{ flex: 1 }}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void send(); }}
                placeholder="Scrivi un messaggio…"
              />
              <button className="btn" onClick={() => void send()} disabled={busy}>{busy ? '…' : 'Invia'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
