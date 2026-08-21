import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Banner, Spinner } from '../components/ui';
import {
  BottoneCancellaMessaggio,
  ConfermaCancellaMessaggio,
  useCancellaMessaggio,
} from '../components/cancellaMessaggio';

interface Thread {
  id: string;
  counterpart: string;
  lastMessageAt: string | null;
  /** §Chat (12/8): la cliente ha scritto dopo l'ultima volta che questa persona ha aperto. */
  daLeggere?: boolean;
  client: { id: string; email: string; clientProfile: { name: string | null } | null } | null;
}
interface Msg {
  id: string;
  senderRole: string;
  /** Chi l'ha scritto davvero: decide se mostrare la ✕ per cancellarlo. Vedi `cancellaMessaggio`. */
  senderUserId?: string | null;
  body: string;
  sentAt: string;
}

const nameOf = (t: Thread) => t.client?.clientProfile?.name || t.client?.email || 'Cliente';

/** Chat staff ↔ cliente (coach/nutrizionista). Legge le API staff/threads + threads/:id/messages. */
export function Chat() {
  const { user: me } = useAuth();
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

  /**
   * ⚠️ `?cliente=<id>` e `?thread=<id>` aprono direttamente quella conversazione.
   *
   * I due indirizzi erano **già linkati** — dalla finestra delle azioni del motore
   * (`/chat?cliente=…`) e ora dalla campanella — ma questa pagina non li leggeva: si atterrava
   * sull'elenco con nessuna conversazione aperta, e la persona andava ritrovata a mano. Un rimando
   * che non rimanda è peggio di nessun rimando, perché sembra un guasto.
   */
  const [query] = useSearchParams();
  const cercato = query.get('thread');
  const cercataCliente = query.get('cliente');
  useEffect(() => {
    if (!threads || sel) return;
    const trovato = cercato
      ? threads.find((t) => t.id === cercato)
      : cercataCliente
        ? threads.find((t) => t.client?.id === cercataCliente)
        : null;
    // Se quella conversazione non c'è (ancora), si resta sull'elenco: è la stessa persona, solo
    // un clic più lontana, e un errore qui non aiuterebbe nessuno.
    if (trovato) void open(trovato);
  }, [threads, cercato, cercataCliente]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [msgs]);

  async function open(t: Thread) {
    setSel(t);
    setMsgs([]);
    setError(null);
    try {
      setMsgs(await api<Msg[]>(`/threads/${t.id}/messages`));
      // Aprirla È averla letta: il server lo registra da sé, qui si spegne il pallino subito
      // invece di lasciarlo acceso fino al prossimo caricamento della pagina.
      setThreads((prec) => prec?.map((x) => (x.id === t.id ? { ...x, daLeggere: false } : x)) ?? prec);
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

  /**
   * ⛔ **LA ✕ ANCHE QUI** (Simone, 21/8). C'era solo nella scheda cliente, dall'11/8: la stessa
   * conversazione, letta da due schermate, e da questa non si poteva cancellare niente. La regola,
   * la conferma e la chiamata stanno in `components/cancellaMessaggio` — una sola, così le due
   * schermate non possono più dire due cose diverse sullo stesso gesto.
   */
  const canc = useCancellaMessaggio({
    threadId: sel?.id ?? null,
    ioSono: me?.id,
    ricarica: async () => { if (sel) setMsgs(await api<Msg[]>(`/threads/${sel.id}/messages`)); },
    onErrore: setError,
  });

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
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <b style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {nameOf(t)}
              </b>
              {/* Il pallino sparisce appena si apre la conversazione: il server registra la
                  lettura, e `open()` toglie il pallino qui senza aspettare il giro dopo. */}
              {t.daLeggere && (
                <span
                  title="Ha scritto dall'ultima volta che hai aperto"
                  style={{ width: 8, height: 8, borderRadius: '50%', background: '#D93025', flex: 'none' }}
                />
              )}
            </div>
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
                      // ⚠️ Serve alla ✕, che si posiziona sull'angolo della bolla.
                      position: 'relative',
                      alignSelf: mine ? 'flex-end' : 'flex-start',
                      maxWidth: '75%',
                      background: mine ? '#12A386' : '#F2EFE8',
                      color: mine ? '#fff' : '#25302c',
                      padding: '8px 12px',
                      borderRadius: 12,
                    }}
                  >
                    {/* ⚠️ `mine` guarda il RUOLO (è staff?), `canc.mio` guarda la PERSONA. Sono due
                        domande diverse: un messaggio del capo nutrizionista è «mine» per la coach
                        che legge, ma non è suo e non deve poterlo cancellare. */}
                    {canc.mio(m) && (
                      <BottoneCancellaMessaggio
                        disabilitato={canc.inCorso === m.id}
                        onClick={() => canc.setDaCancellare(m)}
                      />
                    )}
                    <div style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{m.body}</div>
                    <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>{new Date(m.sentAt).toLocaleString('it-IT')}</div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>
            {error && <div style={{ padding: '0 16px 8px' }}><Banner kind="err">{error}</Banner></div>}
            {/*
              ⛔ **QUATTRO RIGHE, NON UNA** (Simone, 21/8). Era un `<input>` a riga singola: chi
              risponde a una domanda clinica scrive dieci righe, e le rileggeva **due parole alla
              volta** dentro una feritoia che scorre. Un campo che non fa vedere quello che si è
              scritto è un campo che fa mandare messaggi non riletti.

              ⛔ **E con quattro righe l'Invio non può più spedire.** Prima `Enter` mandava, ed era
              coerente con una riga sola. Su un campo che serve ad andare a capo, mandare a capo
              spedirebbe il messaggio a metà — e in una conversazione con una paziente il mezzo
              messaggio resta lì, letto. Adesso `Invio` va a capo, e si spedisce col bottone o con
              **⌘/Ctrl + Invio**, che è la scorciatoia che chi scrive molto conosce già.
            */}
            <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid #eee', alignItems: 'flex-end' }}>
              <textarea
                className="input"
                rows={4}
                style={{ flex: 1, resize: 'vertical', minHeight: 88, lineHeight: 1.45, fontFamily: 'inherit' }}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void send(); } }}
                placeholder="Scrivi un messaggio…  (⌘/Ctrl + Invio per inviare)"
              />
              <button className="btn" onClick={() => void send()} disabled={busy || !text.trim()}>{busy ? '…' : 'Invia'}</button>
            </div>
          </>
        )}
      </div>

      {canc.daCancellare && (
        <ConfermaCancellaMessaggio
          messaggio={canc.daCancellare}
          inCorso={!!canc.inCorso}
          onAnnulla={() => canc.setDaCancellare(null)}
          onConferma={() => void canc.cancella(canc.daCancellare!)}
        />
      )}
    </div>
  );
}
