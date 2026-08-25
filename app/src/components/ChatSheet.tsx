import { Fragment, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { oraBreve, separatoreGiorno } from '../lib/oraChat';
import { CancellaMessaggio, useCancellaMessaggio } from './cancellaMessaggio';
import { TestoConGrassetto } from './TestoConGrassetto';
import { portaInFondo } from '../lib/scorri-in-fondo';

interface Thread { id: string; counterpart: string; counterpartName: string }
interface Msg {
  id: string;
  senderRole: string;
  /** Chi l'ha scritto: decide se mostrare la ✕. ⚠️ Gaia non ce l'ha, e non si cancella. */
  senderUserId?: string | null;
  body: string;
  sentAt: string;
}

/** Chat reale: thread con assistente AI e con la coach/nutrizionista (se assegnate). */
export default function ChatSheet() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [thread, setThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  /**
   * ⛔ **«Chi scrive può cancellare»** (Simone, 21/8), in tutte le chat. La regola, la conferma e la
   * chiamata stanno in `cancellaMessaggio`: quattro chat in questo prodotto, e la ✕ ne aveva una.
   */
  const canc = useCancellaMessaggio({
    threadId: thread?.id,
    ricarica: async () => {
      if (thread) setMessages(await api<Msg[]>(`/threads/${thread.id}/messages`));
    },
  });
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

  /**
   * ⛔ **La chat si apre sull'ultimo messaggio** (Simone, 23/8), e si scorre la SCATOLA, non
   * `scrollIntoView` su un segnaposto: quello scorre anche tutti gli antenati, cioè fa saltare la
   * pagina. Due giri, perché al primo disegno le altezze non sono ancora quelle vere — vedi
   * `lib/scorri-in-fondo.ts`.
   */
  useEffect(() => {
    portaInFondo(endRef.current);
    const t = requestAnimationFrame(() => portaInFondo(endRef.current));
    return () => cancelAnimationFrame(t);
    // ⚠️ `thread?.id` e l'ARRAY, non `messages.length` (rilievo del 25/8): adesso la scatola è la
    // stessa per tutti i thread, e passando da Gaia alla coach con lo stesso numero di messaggi lo
    // scorrimento restava dov'era — cioè a metà di una conversazione appena aperta.
  }, [thread?.id, messages]);

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

      <div ref={endRef} className="chat-col" style={{ maxHeight: '46vh', overflowY: 'auto' }}>
        {messages.length === 0 && <div className="muted" style={{ fontSize: 13, textAlign: 'center', padding: '10px 0' }}>Scrivi il primo messaggio 👋</div>}
          {messages.map((m, i) => {
            const giorno = separatoreGiorno(messages[i - 1]?.sentAt, m.sentAt);
            return (
              <Fragment key={m.id}>
                {giorno && <div className="chat-giorno">{giorno}</div>}
                <div
                  className={m.senderRole === 'client' ? 'bubble-out' : 'bubble-in'}
                  // ⚠️ Serve alla ✕, che si posiziona sull'angolo della bolla.
                  style={{ position: 'relative' }}
                >
                  {/* «Chi scrive può cancellare» (Simone, 21/8): compare solo sui propri. */}
                  <CancellaMessaggio messaggio={m} gancio={canc} />
                  {/* ⚠️ Il grassetto si DISEGNA (25/8): i testi di Gaia lo scrivono da mesi in
                      markdown e la cliente leggeva gli asterischi in mezzo alla frase. Vedi il
                      riquadro in `TestoConGrassetto`. */}
                  <TestoConGrassetto testo={m.body} />
                  {/* L'ora dentro la bolla, in fondo: il giorno lo dice il separatore sopra. */}
                  <span className="bubble-ora">{oraBreve(m.sentAt)}</span>
                </div>
              </Fragment>
            );
          })}
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
