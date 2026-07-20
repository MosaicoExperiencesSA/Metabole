import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import AppHeader from '../components/AppHeader';

/**
 * Chat del team — un'unica pagina per Gaia (AI), coach e nutrizionista, sul sistema
 * di thread reale (GET /me/threads, GET|POST /threads/:id/messages).
 * `?who=ai|coach|nutritionist` sceglie l'interlocutore (default: Gaia).
 * I messaggi si aggiornano da soli ogni 12 secondi: le risposte dello staff
 * arrivano senza ricaricare la pagina.
 */

interface Thread { id: string; counterpart: string; counterpartName: string }
interface Msg { id: string; senderRole: string; body: string; sentAt: string }

const POLL_MS = 12_000;

export default function Assistente() {
  const [params] = useSearchParams();
  const who = ['ai', 'coach', 'nutritionist'].includes(params.get('who') ?? '') ? (params.get('who') as string) : 'ai';
  const [thread, setThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    setThread(null);
    setMessages([]);
    api<Thread[]>('/me/threads')
      .then((ts) => setThread(ts.find((x) => x.counterpart === who) ?? (who === 'ai' ? ts[0] ?? null : null)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [who]);

  // Primo caricamento + aggiornamento automatico (le risposte dello staff arrivano da sole).
  useEffect(() => {
    if (!thread) return;
    let alive = true;
    const load = () => {
      api<Msg[]>(`/threads/${thread.id}/messages`)
        .then((ms) => { if (alive) setMessages(ms); })
        .catch(() => { /* tentativo successivo */ });
    };
    load();
    const timer = setInterval(load, POLL_MS);
    return () => { alive = false; clearInterval(timer); };
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

  const title = who === 'ai' ? 'Gaia' : thread?.counterpartName ?? (who === 'coach' ? 'La tua coach' : 'Nutrizionista');
  const emptyHint = who === 'ai'
    ? 'Scrivi il primo messaggio 👋'
    : 'Scrivi il primo messaggio: risponde negli orari di lavoro 👋';

  return (
    <div className="home">
      <AppHeader title={title} />

      {loading ? (
        <div className="center" style={{ minHeight: 120 }}><div className="spin" /></div>
      ) : !thread ? (
        <div className="card"><p className="muted" style={{ margin: 0 }}>
          {who === 'ai' ? "L'assistente non è ancora disponibile per il tuo account." : 'Ti verrà assegnata a breve: intanto puoi scrivere a Gaia.'}
        </p></div>
      ) : (
        <>
          <div className="chat-col" style={{ minHeight: '50vh' }}>
            {messages.length === 0 && <div className="muted" style={{ fontSize: 13, textAlign: 'center', padding: '10px 0' }}>{emptyHint}</div>}
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
