import { BadRequestException } from '@nestjs/common';

/**
 * LE REGOLE DELL'ELENCO DEI LAVORI, senza database.
 *
 * Stanno fuori dal servizio per la ragione di sempre in questo progetto: quello che si può provare
 * con un elenco di casi si prova con un elenco di casi. Il servizio resta la parte che scrive.
 */

/** Il minimo perché una voce voglia dire qualcosa a chi la rilegge fra un mese. */
export const TITOLO_MIN = 3;
export const TITOLO_MAX = 200;
export const CATEGORIA_DEFAULT = 'Da fare';

export interface DatiLavoro {
  titolo?: unknown;
  dettaglio?: unknown;
  categoria?: unknown;
  ordine?: unknown;
  blocca?: unknown;
}

/**
 * Ripulisce quello che arriva dalla pagina, e torna **solo i campi presenti**.
 *
 * ⚠️ `undefined` e stringa vuota sono cose diverse — «non te l'ho mandato» contro «l'ho svuotato» —
 * ed è la stessa distinzione di `common/non-perdere.ts`: confonderle è il modo in cui una modifica
 * di un campo ne cancella un altro senza che nessuno se ne accorga.
 */
export function normalizzaLavoro(d: DatiLavoro, obbligaTitolo: boolean): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (d.titolo !== undefined) {
    const t = typeof d.titolo === 'string' ? d.titolo.trim() : '';
    if (t.length < TITOLO_MIN) throw new BadRequestException(MSG_TITOLO);
    out.titolo = t.slice(0, TITOLO_MAX);
  } else if (obbligaTitolo) {
    throw new BadRequestException(MSG_TITOLO);
  }
  if (d.dettaglio !== undefined) {
    const v = typeof d.dettaglio === 'string' ? d.dettaglio.trim() : '';
    // Il dettaglio è facoltativo: svuotarlo è un gesto legittimo, e qui `''` diventa `null`.
    out.dettaglio = v ? v.slice(0, 4000) : null;
  }
  if (d.categoria !== undefined) {
    const v = typeof d.categoria === 'string' ? d.categoria.trim() : '';
    out.categoria = v ? v.slice(0, 80) : CATEGORIA_DEFAULT;
  }
  if (d.blocca !== undefined) {
    // ⚠️ Il rosso: «finché questa non si chiude, dietro c'è una fila ferma». Non «urgente».
    out.blocca = d.blocca === true || d.blocca === 'true' || d.blocca === 1;
  }
  if (d.ordine !== undefined) {
    const n = Number(d.ordine);
    out.ordine = Number.isFinite(n) ? Math.trunc(n) : 0;
  }
  return out;
}

export const MSG_TITOLO = 'Scrivi cosa c\'è da fare: bastano poche parole, ma devono dirlo.';

/**
 * Cosa scrive la spunta.
 *
 * ⚠️ **Togliendola si azzerano anche chi e quando.** Una voce riaperta che continua a dire «fatta da
 * Simone il 13 agosto» è la riga che fa perdere fiducia in tutta la lista — e una lista di cui non
 * ci si fida non si guarda più, che è l'unico modo in cui questa pagina può fallire.
 *
 * ⚠️ Chi spunta senza scheda staff (un admin creato a mano) lascia `null` nel nome: la voce resta
 * fatta, con la sua data. Meglio una spunta senza nome che una spunta rifiutata.
 */
export function datiSpunta(fatto: boolean, staffId: string | null | undefined, adesso: Date) {
  return {
    fatto,
    fattoIl: fatto ? adesso : null,
    fattoDaId: fatto ? (staffId ?? null) : null,
  };
}

/**
 * L'ordine della pagina: **da fare in cima, fatte in fondo**, e fra le fatte le ultime chiuse per
 * prime.
 *
 * Le fatte non spariscono — è la parte «così è tutto registrato» della richiesta — ma non devono
 * nemmeno stare in mezzo, o l'elenco smette di rispondere a «cosa resta» a colpo d'occhio.
 */
export function ordinaLavori<T extends { fatto: boolean; fattoIl?: Date | null }>(righe: T[]): T[] {
  const daFare = righe.filter((r) => !r.fatto);
  const fatte = righe.filter((r) => r.fatto).sort((a, b) => (b.fattoIl?.getTime() ?? 0) - (a.fattoIl?.getTime() ?? 0));
  return [...daFare, ...fatte];
}
