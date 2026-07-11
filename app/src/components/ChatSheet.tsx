import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';

interface Thread { id: string; counterpart: string; counterpartName: string }
interface Msg { id: string; senderRole: string; body: string; sentAt: string }

/** Chat reale: thread con assistente AI e con la coach/nutrizionista (se assegnate). */
export default function ChatSheet() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [thread, setThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<Thread[]>('/me/threads')
      .then((ts) => {
        setThreads(ts);
        setThread(ts.find((x) => x.counterpart === 'coach') ?? ts.find((x) => x.counterpart === 'ai') ?? ts[0] ?? null);
      })
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

  if (loading) return <div className="center" style={{ minHeight: 120 }}><div className="spin" /></div>;

  return (
    <>
      {threads.length > 1 && (
        <div className="row" style={{ gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          {threads.map((t) => (
            <button key={t.id} className={`chip${thread?.id === t.id ? '' : ''}`} onClick={() => setThread(t)} style={{ cursor: 'pointer', background: thread?.id === t.id ? 'var(--teal)' : 'var(--cream)', color: thread?.id === t.id ? '#fff' : 'var(--teal-dark)' }}>
              {t.counterpartName}
            </button>
          ))}
        </div>
      )}

      <b style={{ fontSize: 15 }}>{thread?.counterpartName ?? 'Chat'}</b>
      {thread?.counterpart === 'ai' && <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>Ti rispondo subito; le domande sanitarie le giro alla nutrizionista.</div>}

      <div className="chat-col" style={{ maxHeight: '46vh', overflowY: 'auto' }}>
        {messages.length === 0 && <div className="muted" style={{ fontSize: 13, textAlign: 'center', padding: '10px 0' }}>Scrivi il primo messaggio 👋</div>}
        {messages.map((m) => (
          <div key={m.id} className={m.senderRole === 'client' ? 'bubble-out' : 'bubble-in'}>{m.body}</div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="chat-input">
        <input
          className="input"
          style={{ borderRadius: 22 }}
          placeholder="Scrivi un messaggio…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
        />
        <button className="btn" style={{ width: 'auto', padding: '10px 13px' }} onClick={send} disabled={sending}><i className="ti ti-send" /></button>
      </div>
    </>
  );
}
