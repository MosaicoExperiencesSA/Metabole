/**
 * ANNULLARE UN ABBONAMENTO DALLA SCHEDA — richiesta di Simone, 17/8 (caso Lorena).
 *
 * Lorena ha due «Conosciamoci» attivi insieme, e fino a oggi l'unico modo di toglierne uno era
 * scrivere a mano nel database. Un rimedio che non passa dal prodotto non lascia traccia, non
 * chiede conferma e non avvisa nessuno: la volta che va storto non c'è niente da leggere.
 *
 * ⚠️ Modulo **puro**: qui c'è solo la decisione — si può? va chiesta conferma? cosa succede dopo? —
 * e si prova per tabella. La scrittura sta nel servizio, dietro permesso e con l'audit.
 *
 * ## ⚠️ Annullare NON è stornare
 *
 * Un annullamento tocca il **piano**: da domani non si erogano più menu nuovi. Un rimborso tocca i
 * **soldi**, ha la sua strada (`refundPurchase`), scrive nel ledger e storna le provvigioni.
 * Confonderli vuol dire o togliere il piano lasciando l'incasso a libro, o cancellare un incasso
 * vero perché si voleva solo sistemare una riga doppia. Sono due porte, e restano due.
 *
 * ## ⚠️ Annullare NON cancella la riga
 *
 * Si scrive `cancelled` e la riga resta. Un pagamento la referenzia, e la storia di una cliente —
 * cosa ha comprato, quando, chi gliel'ha attivato — è la cosa che si va a leggere proprio quando
 * qualcosa non torna. Cancellarla per davvero è togliere le prove.
 */

import { eInCodaPerStato, STATI_CON_UN_PIANO } from './stati-abbonamento';

/** Gli stati che questo modulo conosce; gli altri li tratta come «non annullabile». */
export type StatoAbbonamento = 'pending' | 'active' | 'queued' | 'cancelled' | 'expired' | string;

export interface AbbonamentoLetto {
  id: string;
  status: StatoAbbonamento;
  startDate: Date | null;
  endDate: Date | null;
  /** Solo per il messaggio: «Conosciamoci», «Mantenimento»… */
  piano: string;
}

export type EsitoAnnullamento =
  | { tipo: 'nulla_da_fare'; testo: string }
  | { tipo: 'serve_conferma'; testo: string }
  | { tipo: 'procedi'; restaSenzaPiano: boolean };

/**
 * Sta erogando **adesso**: un piano comprato, cominciato e non finito.
 *
 * ⚠️ `STATI_CON_UN_PIANO` e non il solo `'active'` (19/8, voce 258): un `queued` con la data d'inizio
 * **già arrivata** sta consegnando menu davvero — la promozione notturna è solo in ritardo, e
 * `deliverIfEligible` sceglie comunque la coda quando non eroga nessun altro. Con il confronto
 * vecchio, annullarlo non chiedeva nessuna conferma: si toglievano i menu di oggi a una cliente
 * senza che nessuno lo dicesse a chi stava cliccando.
 */
const inCorso = (s: AbbonamentoLetto, oggi: Date): boolean => {
  if (!(STATI_CON_UN_PIANO as readonly string[]).includes(s.status)) return false;
  const dopoLInizio = !s.startDate || s.startDate.getTime() <= oggi.getTime();
  const primaDellaFine = !s.endDate || s.endDate.getTime() >= oggi.getTime();
  return dopoLInizio && primaDellaFine;
};

/** Un piano comprato che c'è ancora: eroga adesso, oppure comincia più avanti. */
const haUnPiano = (s: AbbonamentoLetto, oggi: Date): boolean =>
  inCorso(s, oggi) || eInCodaPerStato(s, oggi);

const gg = (d: Date | null): string =>
  d ? d.toISOString().slice(0, 10).split('-').reverse().join('/') : '—';

/**
 * Si può annullare questo abbonamento? E cosa va detto prima di farlo?
 *
 * ⚠️ La conferma si chiede in **un caso solo**: quando dopo l'annullamento la cliente resta senza
 * nessun piano in corso, cioè quando smette di ricevere menu. Chiederla sempre insegna a cliccare
 * «sì» senza leggere, e allora la volta che conta non la legge nessuno.
 */
export function esitoAnnullamento(
  bersaglio: AbbonamentoLetto,
  tuttiGliAbbonamenti: AbbonamentoLetto[],
  oggi: Date,
): EsitoAnnullamento {
  if (bersaglio.status === 'cancelled') {
    return { tipo: 'nulla_da_fare', testo: `«${bersaglio.piano}» è già annullato.` };
  }
  if (bersaglio.status === 'expired') {
    return {
      tipo: 'nulla_da_fare',
      testo: `«${bersaglio.piano}» è già scaduto il ${gg(bersaglio.endDate)}: non c'è niente da annullare.`,
    };
  }

  const altriInCorso = (tuttiGliAbbonamenti ?? []).filter((s) => s.id !== bersaglio.id && inCorso(s, oggi));
  const restaSenzaPiano = altriInCorso.length === 0;

  /**
   * Se il bersaglio non stava erogando niente (è in coda che comincia più avanti, o è ancora
   * `pending`), toglierlo non cambia cosa mangia domani: si procede senza domande.
   *
   * ⚠️ Ma `restaSenzaPiano` va detto lo stesso (19/8): qui tornava sempre `false`, e su una cliente
   * il cui **unico** piano è quello in coda l'audit e la risposta dicevano «Resta attivo l'altro
   * piano, e i menu continuano» — a una persona che ha appena pagato e adesso non ha più niente. Una
   * frase falsa in un registro è peggio di nessuna frase: la si legge proprio quando qualcosa non
   * torna.
   */
  if (!inCorso(bersaglio, oggi)) {
    const altriConUnPiano = (tuttiGliAbbonamenti ?? []).filter((s) => s.id !== bersaglio.id && haUnPiano(s, oggi));
    // ⚠️ Solo se il bersaglio era davvero un piano: annullare un `pending` è togliere un carrello
    // non pagato, e dire «non ha più nessun piano» a chi non ne ha mai avuto uno è una frase che
    // fa cercare un problema che non c'è.
    const eraUnPiano = (STATI_CON_UN_PIANO as readonly string[]).includes(bersaglio.status);
    return { tipo: 'procedi', restaSenzaPiano: eraUnPiano && altriConUnPiano.length === 0 };
  }

  if (restaSenzaPiano) {
    return {
      tipo: 'serve_conferma',
      // ⚠️ Niente markdown: questo testo finisce in un `confirm()` del browser (`ClientDetail.tsx`),
      // che disegna testo semplice e basta.
      testo:
        `Annullando «${bersaglio.piano}» questa cliente resta senza nessun piano in corso: da domani ` +
        'non riceve menu nuovi e in scheda comparirà «Nessun piano attivo». I giorni già consegnati ' +
        'restano. Se è quello che vuoi, conferma.',
    };
  }

  return { tipo: 'procedi', restaSenzaPiano: false };
}

/** La frase che finisce nell'audit e nella risposta: dice cosa è cambiato, non «fatto». */
export function raccontaAnnullamento(bersaglio: AbbonamentoLetto, restaSenzaPiano: boolean): string {
  const base = `«${bersaglio.piano}» (${gg(bersaglio.startDate)} → ${gg(bersaglio.endDate)}) annullato`;
  return restaSenzaPiano
    ? `${base}. ⚠️ La cliente non ha più nessun piano: non riceverà menu nuovi.`
    : `${base}. Le resta un altro piano.`;
}
