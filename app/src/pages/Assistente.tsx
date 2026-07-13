import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import AppHeader from '../components/AppHeader';

/**
 * Assistente AI — chat REALE con il sistema di thread (GET /me/threads,
 * GET|POST /threads/:id/messages). Punta al thread dell'assistente AI:
 * risponde subito e gira le domande sanitarie alla nutrizionista.
 */

interface Thread { id: string; counterpart: string; counterpartName: string }
interface Msg { id: string; senderRole: string; body: string; sentAt: string }

export default function Assistente() {
  const [thread, setThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<Thread[]>('/me/threads')
      .then((ts) => setThread(ts.find((x) => x.counterpart === 'ai') ?? ts[0] ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!thread) return;
    api<Msg[]>(`/threads/${thread.id}/messages`).then(setMessages).catch(() => setMessages([]));
  }, [thread?.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  async function send() {
    const body = text.trim();
    if (!body || !thread || sending) return;
    setText('');
    setSending(true);
    try {
      const res = await api<{ message: Msg; aiReply?: Msg }>(`/threads/${thread.id}/messages`, { method: 'POST', body: JSON.stringify({ body }) });
      setMessages((m) => [...m, res.message, ...(res.aiReply ? [res.aiReply] : [])]);
    } catch {
      /* ignora */
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="home">
      <AppHeader title="Gaia" />

      {loading ? (
        <div className="center" style={{ minHeight: 120 }}><div className="spin" /></div>
      ) : !thread ? (
        <div className="card"><p className="muted" style={{ margin: 0 }}>L'assistente non è ancora disponibile per il tuo account.</p></div>
      ) : (
        <>
          <div className="chat-col" style={{ minHeight: '50vh' }}>
            {messages.length === 0 && <div className="muted" style={{ fontSize: 13, textAlign: 'center', padding: '10px 0' }}>Scrivi il primo messaggio 👋</div>}
            {messages.map((m) => (
              <div key={m.id} className={m.senderRole === 'client' ? 'bubble-out' : 'bubble-in'}>{m.body}</div>
            ))}
            <div ref={endRef} />
          </div>

          <div className="chat-input">
            <input
              className="input"
              style={{ flex: 1, borderRadius: 22 }}
              placeholder="Scrivi…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
            />
            <button className="btn" style={{ width: 'auto', padding: '10px 13px' }} onClick={send} disabled={sending} aria-label="Invia"><i className="ti ti-send" /></button>
          </div>
        </>
      )}
    </div>
  );
}
