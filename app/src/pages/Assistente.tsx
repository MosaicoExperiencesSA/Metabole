import { Fragment, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { oraBreve, separatoreGiorno } from '../lib/oraChat';
import AppHeader from '../components/AppHeader';

/**
 * Chat del team — un'unica pagina per Gaia (AI), coach e nutrizionista, sul sistema
 * di thread reale (GET /me/threads, GET|POST /threads/:id/messages).
 * `?who=ai|coach|nutritionist` sceglie l'interlocutore (default: Gaia).
 * I messaggi si aggiornano da soli ogni 12 secondi: le risposte dello staff
 * arrivano senza ricaricare la pagina.
 *
 * `?intent=sostituzione` arriva dal pulsante «Sostituisci» della home: fa scrivere a Gaia
 * il primo messaggio del dialogo (elenca i piatti di oggi e chiede quale alimento cambiare),
 * così la cliente trova la conversazione già cominciata invece di un campo di testo vuoto e
 * il dubbio su come si chiede. Vedi `progetto/PROGETTO_gaia-cambio-menu.md`.
 */

interface Thread { id: string; counterpart: string; counterpartName: string }
interface Msg { id: string; senderRole: string; body: string; sentAt: string }

const POLL_MS = 12_000;

export default function Assistente() {
  const [params] = useSearchParams();
  const who = ['ai', 'coach', 'nutritionist'].includes(params.get('who') ?? '') ? (params.get('who') as string) : 'ai';
  const intent = params.get('intent');
  // La giornata da cui arriva («?giorno=AAAA-MM-GG», dalla schermata del menu). Vuota = oggi.
  const giorno = /^\d{4}-\d{2}-\d{2}$/.test(params.get('giorno') ?? '') ? params.get('giorno') : null;
  const [thread, setThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);
  // L'apertura del dialogo scrive un messaggio: va fatta UNA volta sola. Senza questa guardia
  // un secondo render (o il ritorno alla pagina) farebbe ripetere a Gaia la stessa domanda.
  const intentoAvviato = useRef(false);

  useEffect(() => {
    setLoading(true);
    setThread(null);
    setMessages([]);
    if (intent === 'sostituzione' && who === 'ai' && !intentoAvviato.current) {
      intentoAvviato.current = true;
      // §16.2 — il giorno che la cliente stava guardando, se ci arriva dalla schermata del menu.
      // Senza, Gaia le elenca i piatti di oggi mentre lei ha davanti quelli di domani.
      api<{ threadId: string }>('/me/threads/sostituzione', {
        method: 'POST',
        body: JSON.stringify(giorno ? { data: giorno } : {}),
      })
        .then((r) => setThread({ id: r.threadId, counterpart: 'ai', counterpartName: 'Gaia' }))
        .catch(() => {
          // L'apertura può fallire (menu di oggi assente, rete): la chat resta usabile a mano.
          intentoAvviato.current = false;
          return api<Thread[]>('/me/threads')
            .then((ts) => setThread(ts.find((x) => x.counterpart === 'ai') ?? ts[0] ?? null))
            .catch(() => {});
        })
        .finally(() => setLoading(false));
      return;
    }
    api<Thread[]>('/me/threads')
      .then((ts) => setThread(ts.find((x) => x.counterpart === who) ?? (who === 'ai' ? ts[0] ?? null : null)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [who, intent, giorno]);

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
            {messages.map((m, i) => {
              const giorno = separatoreGiorno(messages[i - 1]?.sentAt, m.sentAt);
              return (
                <Fragment key={m.id}>
                  {giorno && <div className="chat-giorno">{giorno}</div>}
                  <div className={m.senderRole === 'client' ? 'bubble-out' : 'bubble-in'}>
                    {m.body}
                    {/* L'ora dentro la bolla, in fondo: il giorno lo dice il separatore sopra. */}
                    <span className="bubble-ora">{oraBreve(m.sentAt)}</span>
                  </div>
                </Fragment>
              );
            })}
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
