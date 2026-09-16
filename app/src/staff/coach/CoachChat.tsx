import { useEffect, useRef, useState } from 'react';
import { CancellaMessaggio, useCancellaMessaggio } from '../../components/cancellaMessaggio';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../../api/client';
import type { AllegatoDaInviare, AllegatoRicevuto } from '../../lib/allegati';
import { AllegatiInBolla, AllegatoInAttesa, BottoneAllega, useAllegatiPossibili } from '../../components/Allegati';
import { fullName, hourOnly, relDays } from '../format';
import { useApi } from '../hooks';
import { Async, Avatar, BackBar, Card, Empty, StaffShell, type TabItem } from '../ui';

interface Thread {
  id: string;
  counterpart: string | null;
  lastMessageAt: string | null;
  /**
   * §Chat (Simone, 12/8): «un pallino rosso in piccolo se il cliente ha scritto dall'ultima visita
   * nella pagina». Lo decide il server confrontando l'ultimo messaggio DELLA CLIENTE con l'ultima
   * volta che questa persona ha aperto la conversazione — non si può calcolare da qui.
   */
  daLeggere?: boolean;
  client: { id: string; email: string; clientProfile: { name: string | null } | null } | null;
}
interface Msg {
  id: string;
  senderRole: string;
  /** Chi l'ha scritto: decide se mostrare la ✕. ⚠️ Gaia non ce l'ha, e non si cancella. */
  senderUserId?: string | null;
  body: string;
  sentAt: string;
  /** Il file allegato (16/9), col link già firmato dal server. */
  allegati?: AllegatoRicevuto[];
}

export function CoachChatList({ tabs }: { tabs: TabItem[] }) {
  const nav = useNavigate();
  const state = useApi<Thread[]>('/staff/threads');

  /**
   * `?cliente=<id>` apre direttamente la sua conversazione.
   *
   * Serve a chi arriva da un'altra schermata sapendo CON CHI vuole parlare ma non quale sia il
   * thread — «Scrivi in chat» nella finestra delle azioni del motore, per esempio. Senza, si
   * atterrava sull'elenco e bisognava ritrovare la persona a mano: il rimando smetteva di essere
   * un rimando. Se quella conversazione non esiste ancora, si resta sull'elenco invece di dare un
   * errore: è la stessa persona, solo un tocco più lontana.
   */
  const [query] = useSearchParams();
  const cliente = query.get('cliente');
  useEffect(() => {
    if (!cliente || !state.data) return;
    const suo = state.data.find((t) => t.client?.id === cliente);
    if (suo) {
      const nome = suo.client?.clientProfile?.name || fullName(suo.counterpart, null, suo.client?.email);
      nav(`/chat/${suo.id}`, { replace: true, state: { name: nome } });
    }
  }, [cliente, state.data]);

  // Tornando indietro da una conversazione il suo pallino è appena stato spento sul server: senza
  // questo, resterebbe acceso finché non si cambia pagina, e sembrerebbe che non funzioni.
  useEffect(() => {
    const alRitorno = () => { if (document.visibilityState === 'visible') state.reload(); };
    window.addEventListener('focus', alRitorno);
    document.addEventListener('visibilitychange', alRitorno);
    return () => {
      window.removeEventListener('focus', alRitorno);
      document.removeEventListener('visibilitychange', alRitorno);
    };
  }, []);
  return (
    <StaffShell title="Chat" tabs={tabs}>
      <Async state={state} empty={<Empty icon="ti-message-off" text="Nessuna conversazione." />}>
        {(threads) => (
          <Card className="pad0">
            {threads.map((t) => {
              const name = t.client?.clientProfile?.name || fullName(t.counterpart, null, t.client?.email);
              return (
                <div
                  key={t.id}
                  className="sf-row"
                  onClick={() => nav(`/chat/${t.id}`, { state: { name } })}
                >
                  <Avatar name={name} />
                  <div className="sf-row-main">
                    <div className="sf-row-name" style={{ fontWeight: t.daLeggere ? 800 : undefined }}>
                      {name}
                    </div>
                    <div className="sf-row-sub">
                      {t.lastMessageAt ? `Ultimo messaggio ${relDays(t.lastMessageAt)}` : 'Nessun messaggio'}
                    </div>
                  </div>
                  {/* Il pallino sta PRIMA della freccia: è l'ultima cosa che si legge scorrendo, ed
                      è quella che dice se aprire. Piccolo, come ha chiesto Simone. */}
                  {t.daLeggere && (
                    <span
                      aria-label="Ha scritto"
                      title="Ha scritto dall'ultima volta che hai aperto"
                      style={{ width: 9, height: 9, borderRadius: '50%', background: '#D93025', flex: 'none' }}
                    />
                  )}
                  <i className="ti ti-chevron-right chev" />
                </div>
              );
            })}
          </Card>
        )}
      </Async>
    </StaffShell>
  );
}

export function CoachChatThread({ tabs }: { tabs: TabItem[] }) {
  const { threadId } = useParams();
  const loc = useLocation();
  const name = (loc.state as { name?: string } | null)?.name || 'Conversazione';
  /**
   * ⛔ La chat con la nutrizionista aperta da una coach (16/9) si LEGGE e basta: il server rifiuta
   * la scrittura, e un campo che non può spedire non si mostra.
   */
  const soloLettura = !!(loc.state as { soloLettura?: boolean } | null)?.soloLettura;
  const state = useApi<Msg[]>(threadId ? `/threads/${threadId}/messages` : null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  /**
   * ⛔ L'allegato (16/9). Qui si parla sempre in un thread di coach o nutrizionista (l'elenco è
   * `/staff/threads`, che Gaia non la contiene), quindi il pulsante c'è sempre — salvo gli iPhone
   * con una versione nativa vecchia (`useAllegatiPossibili`).
   */
  const puoAllegare = useAllegatiPossibili();
  const [allegato, setAllegato] = useState<AllegatoDaInviare | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  /**
   * ⛔ **Cambiando conversazione si azzera tutto** (revisione, 16/9). Toccando la notifica di
   * un'altra cliente la rotta resta la stessa (`/chat/:threadId`) e questa schermata NON si smonta:
   * senza questo, il referto scelto per una cliente partiva alla successiva.
   */
  useEffect(() => {
    setAllegato(null);
    setErrore(null);
    setText('');
  }, [threadId]);
  /**
   * ⛔ **«Chi scrive può cancellare»** (Simone, 21/8), in tutte e quattro le chat. Qui la ricarica è
   * già pronta: `state.reload()` è la stessa che usa il giro ogni dodici secondi, quindi quello che
   * si legge dopo la cancellazione è quello che il server ha davvero.
   */
  const canc = useCancellaMessaggio({ threadId, ricarica: () => state.reload() });

  useEffect(() => {
    /**
     * ⚠️ **Qui `scrollIntoView` è quello giusto, e resta** (25/8): questa lista non è una scatola con
     * la sua barra — è la pagina intera a scorrere, quindi «portare in vista l'ultimo messaggio» è
     * esattamente quello che serve. Dove invece la lista ha un'altezza sua (la chat in scheda
     * cliente, quella del back office, il foglio in app) si sposta la SCATOLA: vedi
     * `lib/scorri-in-fondo.ts`. Sono due primitive diverse per due situazioni diverse.
     */
    bottom.current?.scrollIntoView({ behavior: 'auto' });
  }, [state.data]);

  // I messaggi della cliente arrivano da soli, senza ricaricare la pagina.
  useEffect(() => {
    if (!threadId) return;
    const timer = setInterval(() => state.reload(), 12_000);
    return () => clearInterval(timer);
  }, [threadId]);

  async function send() {
    const body = text.trim();
    // ⚠️ `sending`: il pulsante è spento durante l'invio, l'Invio della tastiera no.
    if ((!body && !allegato) || !threadId || sending) return;
    setSending(true);
    setErrore(null);
    try {
      await api(`/threads/${threadId}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          ...(body ? { body } : {}),
          ...(allegato ? { allegato: { nome: allegato.nome, tipo: allegato.tipo, base64: allegato.base64 } } : {}),
        }),
      });
      setText('');
      setAllegato(null);
      state.reload();
    } catch (e) {
      // Il testo resta nel campo; se c'era un file si dice perché non è partito.
      if (allegato) setErrore(e instanceof ApiError ? e.message : 'Il file non è partito: riprova.');
    } finally {
      setSending(false);
    }
  }

  return (
    <StaffShell title={name} tabs={tabs}>
      <BackBar label="Chat" to="/chat" />
      <Async state={state} empty={<Empty icon="ti-message" text="Scrivi il primo messaggio." />}>
        {(msgs) => (
          <div className="sf-chat-wrap">
            {msgs.map((m) => {
              const mine = m.senderRole !== 'client';
              return (
                <div
                  key={m.id}
                  className={'sf-bubble ' + (mine ? 'out' : 'in')}
                  // ⚠️ Serve alla ✕, che si posiziona sull'angolo della bolla.
                  style={{ position: 'relative' }}
                >
                  {/* ⚠️ `mine` guarda il RUOLO (non è la cliente), il gancio guarda la PERSONA: il
                      messaggio di un collega è «mine» per chi legge, ma non è suo. */}
                  <CancellaMessaggio messaggio={m} gancio={canc} />
                  <AllegatiInBolla allegati={m.allegati} />
                  {m.body}
                  <div style={{ fontSize: 9, opacity: 0.6, marginTop: 3, textAlign: 'right' }}>
                    {hourOnly(m.sentAt)}
                  </div>
                </div>
              );
            })}
            <div ref={bottom} />
          </div>
        )}
      </Async>
      {soloLettura && (
        <div className="sf-sub" style={{ padding: '8px 14px' }}>
          <i className="ti ti-eye" /> La leggi e basta: risponde la nutrizionista. Per scriverle usa la tua chat.
        </div>
      )}
      {!soloLettura && (allegato || errore) && (
        <div style={{ padding: '0 12px' }}>
          {allegato && <AllegatoInAttesa allegato={allegato} onTogli={() => setAllegato(null)} />}
          {errore && <div style={{ color: '#b3261e', fontSize: 12, margin: '4px 0' }}>{errore}</div>}
        </div>
      )}
      {!soloLettura && <div className="sf-chat-bar">
        {puoAllegare && (
          <BottoneAllega
            className="sf-send"
            style={{ background: 'transparent', color: 'inherit' }}
            disabilitato={sending}
            onPronto={(a) => { setErrore(null); setAllegato(a); }}
            onErrore={setErrore}
          />
        )}
        <input
          className="sf-inp"
          placeholder="Scrivi un messaggio…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
        />
        <button className="sf-send" onClick={send} disabled={sending || (!text.trim() && !allegato)}>
          <i className="ti ti-send" />
        </button>
      </div>}
    </StaffShell>
  );
}
