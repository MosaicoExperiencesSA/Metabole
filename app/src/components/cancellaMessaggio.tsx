import { useState } from 'react';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';

/**
 * ⛔ **CANCELLARE UN PROPRIO MESSAGGIO — anche dall'app.**
 *
 * Simone, 21/8: *«in tutte le chat mettiamo la x, chi scrive può cancellare»*. È la terza volta che
 * questa regola viene chiesta, ed è sempre la stessa: l'**11/8** per la scheda cliente, il **21/8**
 * per la pagina Chat del backoffice, e adesso per l'app. Non perché cambiasse idea: perché la ✕
 * c'era dove era stata chiesta e da nessun'altra parte, e le chat in questo prodotto sono **quattro**
 * — due nel backoffice, due nell'app.
 *
 * ⚠️ Il difetto non è la ✕ mancante: è che una regola sul prodotto viveva in un pezzo di prodotto
 * solo. Perciò anche qui non si copia niente a mano: la regola, la conferma, le parole e la chiamata
 * stanno in un gancio, e ogni schermata lo usa.
 *
 * ## ⛔ SOLO I PROPRI, e la regola sta nel backend
 *
 * *«Chi scrive può cancellare»* — quindi la ✕ compare solo sui messaggi scritti da chi guarda. La
 * cliente può togliere i suoi, la coach i suoi, la nutrizionista i suoi; nessuno tocca quelli di un
 * altro. La regola vera è in `chat.service.eliminaMessaggio` (`senderUserId !== user.sub` → 403), e
 * questa è la sua faccia: se la ✕ comparisse dove non deve, il peggio è un errore leggibile.
 *
 * ⚠️ **Gaia non si cancella**: i suoi messaggi non hanno un `senderUserId`, quindi la ✕ non compare.
 * È giusto — non li ha scritti nessuno, e toglierli dalla conversazione toglierebbe metà del filo.
 *
 * ## ⚠️ Due differenze dal gemello del backoffice, e sono volute
 *
 * 1. **Niente modale**: sul telefono una finestra sopra la conversazione copre proprio quello che si
 *    sta decidendo di cancellare. La conferma è la ✕ stessa che diventa «Cancellare?» dentro la
 *    bolla, dove il messaggio si continua a leggere.
 * 2. **Si ricarica dal server**, come di là: quello che si legge dev'essere quello che è stato
 *    salvato davvero. Togliere la bolla dallo stato locale la farebbe sparire anche quando la
 *    cancellazione non è riuscita, e riaprendo la chat si ritroverebbe lì senza capire perché.
 */

export interface MessaggioCancellabile {
  id: string;
  body: string;
  /** Chi l'ha scritto davvero. ⚠️ Assente = non si offre di cancellare. */
  senderUserId?: string | null;
}

export function useCancellaMessaggio(opzioni: {
  threadId: string | null | undefined;
  /** Ricarica i messaggi dopo la cancellazione. */
  ricarica: () => void | Promise<void>;
  onErrore?: (messaggio: string) => void;
}) {
  const { user } = useAuth();
  const [chiedo, setChiedo] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState<string | null>(null);

  /** È mio? ⚠️ Senza `senderUserId` la risposta è **no**: nel dubbio non si offre di cancellare. */
  const mio = (m: MessaggioCancellabile): boolean =>
    !!user?.id && !!m.senderUserId && m.senderUserId === user.id;

  async function cancella(m: MessaggioCancellabile) {
    if (!opzioni.threadId) return;
    setInCorso(m.id);
    try {
      await api(`/threads/${opzioni.threadId}/messages/${m.id}`, { method: 'DELETE' });
      await opzioni.ricarica();
      setChiedo(null);
    } catch (e) {
      opzioni.onErrore?.(
        e instanceof ApiError && e.status === 403
          ? 'Si può cancellare solo un messaggio scritto da te.'
          : e instanceof Error ? e.message : 'Messaggio non cancellato.',
      );
    } finally {
      setInCorso(null);
    }
  }

  return { chiedo, setChiedo, inCorso, mio, cancella };
}

/**
 * La ✕ sulla bolla, e la conferma che prende il suo posto.
 *
 * ⚠️ Il contenitore dev'essere `position: relative`, o la ✕ finisce nell'angolo della pagina invece
 * che in quello del messaggio.
 *
 * ⚠️ **Il bersaglio è 28 pixel, l'icona 14.** Su un telefono una ✕ da 14 è un bersaglio che si manca
 * — e qui mancarlo vuol dire toccare la bolla accanto. Il tocco è largo, il segno è piccolo.
 */
export function CancellaMessaggio({ messaggio, gancio }: {
  messaggio: MessaggioCancellabile;
  gancio: ReturnType<typeof useCancellaMessaggio>;
}) {
  if (!gancio.mio(messaggio)) return null;
  const chiesto = gancio.chiedo === messaggio.id;
  const inCorso = gancio.inCorso === messaggio.id;

  if (chiesto) {
    return (
      <div
        className="row"
        style={{ gap: 6, marginTop: 6, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}
      >
        {/* ⚠️ Dice la cosa che non si può disfare: cancellare toglie il messaggio dallo schermo, non
            dalla testa di chi l'ha già letto. Senza, «cancella» si legge come «non è mai successo». */}
        <span style={{ fontSize: 11, opacity: 0.85, flex: 1, minWidth: 120 }}>
          Lo cancello? Sparisce a tutti e due. Se l'ha già letto, però, resta letto.
        </span>
        <button
          type="button"
          onClick={() => gancio.setChiedo(null)}
          disabled={inCorso}
          style={{ background: 'none', border: 0, padding: '2px 6px', fontSize: 11, opacity: 0.8, cursor: 'pointer', color: 'inherit' }}
        >
          No
        </button>
        <button
          type="button"
          onClick={() => void gancio.cancella(messaggio)}
          disabled={inCorso}
          style={{
            background: '#B4232A', color: '#fff', border: 0, borderRadius: 8,
            padding: '3px 10px', fontSize: 11, cursor: 'pointer',
          }}
        >
          {inCorso ? 'Cancello…' : 'Sì, cancella'}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      title="Cancella questo messaggio"
      aria-label="Cancella questo messaggio"
      onClick={() => gancio.setChiedo(messaggio.id)}
      style={{
        position: 'absolute', top: -10, right: -10, width: 28, height: 28,
        background: 'none', border: 0, padding: 0, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <span style={{
        width: 18, height: 18, borderRadius: '50%', background: '#fff',
        border: '1px solid #E4B4B6', color: '#B4232A', fontSize: 11,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <i className="ti ti-x" />
      </span>
    </button>
  );
}
