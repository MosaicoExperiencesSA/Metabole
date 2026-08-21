import { useState } from 'react';
import { api, ApiError } from '../api/client';
import { Modal } from './ui';

/**
 * ⛔ **CANCELLARE UN PROPRIO MESSAGGIO — la ✕, la conferma e la chiamata, in un posto solo.**
 *
 * Richiesta di Simone dell'11/8: *«chi scrive il messaggio deve poterlo cancellare»*. È stata scritta
 * nella **scheda cliente**, dov'era nata la richiesta. Il 21/8 Simone l'ha richiesta di nuovo, e la
 * ragione è tutta qui: la stessa conversazione si legge da **due schermate** — la scheda cliente e la
 * pagina Chat — e la ✕ ce l'aveva una sola. Chi lavora dalla pagina Chat non poteva cancellare
 * niente, e non aveva modo di sapere che da un'altra parte si poteva.
 *
 * ⚠️ Perciò questa volta non si scrive una seconda copia: si estrae. *Se due punti rispondono alla
 * stessa domanda, uno dei due deve chiamare l'altro* — e qui i punti sono due schermate che mostrano
 * gli stessi messaggi dello stesso thread.
 *
 * ## ⛔ SOLO I PROPRI, e la regola non è qui
 *
 * La ✕ compare solo sui messaggi scritti da chi guarda — non sul capo, non sull'admin: il senso è
 * **rimediare a quello che si è scritto per sbaglio**, non moderare quello che ha scritto un altro.
 * La regola vera sta nel backend (`chat.service.eliminaMessaggio`: `senderUserId !== user.sub` →
 * 403), e questa è la sua faccia. ⚠️ Quindi anche se la ✕ comparisse dove non deve, non succederebbe
 * niente: il peggio è un errore leggibile.
 *
 * ## ⚠️ Si ricarica l'elenco, non si toglie la bolla a mano
 *
 * Quello che si legge dev'essere quello che è stato salvato davvero. Togliere la bolla dallo stato
 * locale farebbe sparire il messaggio anche quando la cancellazione non è riuscita — e la persona
 * riaprirebbe la conversazione trovandocelo, senza capire perché.
 *
 * ⚠️ La cancellazione è **morbida** lato server (`deletedAt`), ma sparisce da tutte le letture: per
 * chi guarda è sparito, per l'audit no. È la ragione per cui la conferma dice che quello che la
 * cliente ha già letto resta letto.
 */

export interface MessaggioCancellabile {
  id: string;
  body: string;
  /** Chi l'ha scritto davvero. ⚠️ Senza questo la ✕ non si può decidere, e non si mostra. */
  senderUserId?: string | null;
}

/**
 * Lo stato e la chiamata. Chi lo usa disegna le bolle a modo suo — le due schermate hanno grafiche
 * diverse e va bene così: quello che deve essere identico è **la regola e le parole**, non i pixel.
 */
export function useCancellaMessaggio(opzioni: {
  threadId: string | null;
  /** Chi sono io: la ✕ compare solo sui miei. */
  ioSono: string | null | undefined;
  /** Ricarica i messaggi dopo la cancellazione. */
  ricarica: () => void | Promise<void>;
  onErrore: (messaggio: string) => void;
}) {
  const [daCancellare, setDaCancellare] = useState<MessaggioCancellabile | null>(null);
  const [inCorso, setInCorso] = useState<string | null>(null);

  /** È mio? ⚠️ `senderUserId` mancante = **no**: nel dubbio non si offre di cancellare. */
  const mio = (m: MessaggioCancellabile): boolean =>
    !!opzioni.ioSono && !!m.senderUserId && m.senderUserId === opzioni.ioSono;

  async function cancella(m: MessaggioCancellabile) {
    if (!opzioni.threadId) return;
    setInCorso(m.id);
    try {
      await api(`/threads/${opzioni.threadId}/messages/${m.id}`, { method: 'DELETE' });
      await opzioni.ricarica();
      setDaCancellare(null);
    } catch (e) {
      opzioni.onErrore(
        e instanceof ApiError && e.status === 403
          ? 'Si può cancellare solo un messaggio scritto da sé.'
          : e instanceof Error ? e.message : 'Messaggio non cancellato.',
      );
    } finally {
      setInCorso(null);
    }
  }

  return { daCancellare, setDaCancellare, inCorso, mio, cancella };
}

/**
 * La ✕ da mettere sulla bolla. ⚠️ Il contenitore dev'essere `position: relative`, o finisce
 * nell'angolo della pagina invece che in quello del messaggio.
 */
export function BottoneCancellaMessaggio({ onClick, disabilitato }: {
  onClick: () => void;
  disabilitato?: boolean;
}) {
  return (
    <button
      type="button"
      title="Cancella questo messaggio"
      aria-label="Cancella questo messaggio"
      disabled={disabilitato}
      onClick={onClick}
      style={{
        position: 'absolute', top: -6, right: -6, width: 18, height: 18,
        borderRadius: '50%', border: '1px solid #E4B4B6', background: '#fff',
        color: '#B4232A', fontSize: 11, lineHeight: '15px', padding: 0,
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <i className="ti ti-x" />
    </button>
  );
}

/**
 * La conferma.
 *
 * ⚠️ **Dice la cosa che non si può disfare**, ed è la riga che conta: cancellare toglie il messaggio
 * dallo schermo, non dalla testa di chi l'ha già letto. Senza quella frase, «cancella» si legge come
 * «non è mai successo» — e su una conversazione clinica è il malinteso peggiore possibile.
 */
export function ConfermaCancellaMessaggio({ messaggio, inCorso, onAnnulla, onConferma }: {
  messaggio: MessaggioCancellabile;
  inCorso: boolean;
  onAnnulla: () => void;
  onConferma: () => void;
}) {
  return (
    <Modal title="Cancellare questo messaggio?" onClose={onAnnulla}>
      <p style={{ marginTop: 0, fontSize: 13 }}>
        Sparisce dalla conversazione, per te e per la cliente. Se l'aveva già letto, però, quello
        che ha letto resta: se serve, scrivile anche una rettifica.
      </p>
      <div style={{
        background: '#F2EFE8', borderRadius: 10, padding: '9px 12px', fontSize: 13,
        whiteSpace: 'pre-wrap', maxHeight: 160, overflowY: 'auto',
      }}>
        {messaggio.body}
      </div>
      <div className="row" style={{ gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
        <button className="btn ghost sm" disabled={inCorso} onClick={onAnnulla}>
          Lascia com'è
        </button>
        <button
          className="btn sm"
          style={{ background: '#B4232A', borderColor: '#B4232A' }}
          disabled={inCorso}
          onClick={onConferma}
        >
          {inCorso ? 'Cancello…' : 'Sì, cancella'}
        </button>
      </div>
    </Modal>
  );
}
