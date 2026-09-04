/**
 * ⛔ **LA SPUNTA «RICETTA VERIFICATA»** — richiesta di Simone del 4/9: *«quando vado in modifica
 * devo avere un flag: ricetta verificata. Quando il nutrizionista clicca, resta tutto registrato.»*
 *
 * ⚠️ **CHI e QUANDO, non un booleano.** Una spunta da sola dice «qualcuno, una volta»: fra tre mesi,
 * davanti a una ricetta verificata e sbagliata, nessuno saprebbe a chi chiedere. È la stessa forma
 * di `clinical_clearance`, dove resta scritto chi ha guardato.
 *
 * ⛔ **E NON è `allergensReviewed`.** Quella dice «i tag degli allergeni sono confermati» e la legge
 * il filtro di sicurezza: una ricetta senza quella non entra nei menu di chi ha allergie. Questa
 * dice «una nutrizionista ha guardato la ricetta intera». Farle coincidere vorrebbe dire che
 * spuntare la seconda accende la prima — cioè che un piatto entra nei menu delle allergiche perché
 * qualcuno ha detto «l'ho guardata», senza aver guardato i tag.
 *
 * ## ⛔ La firma cade quando cambia quello su cui è stata messa
 *
 * È la stessa regola degli allergeni (`conferma-allergeni-decade.ts`, 18/8), e per la stessa
 * ragione: *una conferma è una firma su un contenuto; cambiato il contenuto, la firma non vale più*.
 * Qui il contenuto è più largo, perché la verifica è più larga:
 * · i **nomi degli ingredienti** — la stessa lettura degli allergeni, quindi si **chiama** quella
 *   funzione invece di riscriverla: se un giorno si corregge lì, si corregge anche qui;
 * · il **regime** — una ricetta verificata come vegana che diventa onnivora è un'altra ricetta.
 *
 * ⚠️ **E NON cade su nome, kcal, grammature, stagioni o difficoltà**: correggere un peso o un
 * refuso nel titolo non cambia quello che la nutrizionista ha guardato, e azzerare la verifica
 * ogni volta vorrebbe dire che dopo due settimane non è verificato più niente — cioè spegnere la
 * spunta a forza di rispettarla.
 */
import { laConfermaDecade } from './conferma-allergeni-decade';

export interface StatoVerifica {
  /** Chi l'ha verificata, o `null`. */
  verifiedById: string | null;
  /** Quando, o `null`. */
  verifiedAt: Date | null;
}

export interface CambioRichiesto {
  /** `true` spunta, `false` toglie la spunta, `undefined` non la tocca. */
  verified?: boolean;
  /** I nuovi ingredienti, se il salvataggio li cambia. */
  ingredienti?: unknown;
  /** Il nuovo regime, se il salvataggio lo cambia. */
  regime?: string;
}

export interface Prima {
  verificata: boolean;
  ingredienti: unknown;
  regime: unknown;
}

export type EsitoVerifica =
  | { tipo: 'invariata' }
  | { tipo: 'verificata'; da: string; il: Date }
  | { tipo: 'tolta' }
  /** ⚠️ `perche` si scrive nel registro: chi si chiede «perché non è più verificata» lo trova lì. */
  | { tipo: 'decaduta'; perche: 'ingredienti_cambiati' | 'regime_cambiato' };

/**
 * Cosa succede alla verifica in questo salvataggio.
 *
 * ⛔ **L'ordine è una scelta: la decadenza vince sulla spunta.** Se qualcuno cambia gli ingredienti
 * **e** nello stesso salvataggio mette la spunta, la spunta vale — sta verificando il piatto nuovo,
 * l'ha davanti. È il caso normale: si corregge e si conferma. Ma se cambia gli ingredienti e la
 * spunta **non** la tocca, la verifica di prima cade: era una firma su un altro contenuto.
 */
export function cosaSuccedeAllaVerifica(
  prima: Prima,
  cambio: CambioRichiesto,
  chi: string,
  adesso: Date = new Date(),
): EsitoVerifica {
  if (cambio.verified === true) return { tipo: 'verificata', da: chi, il: adesso };
  if (cambio.verified === false) return { tipo: 'tolta' };
  if (!prima.verificata) return { tipo: 'invariata' };
  /** ⚠️ La stessa funzione degli allergeni: una regola sola, corretta in un posto solo. */
  if (laConfermaDecade(true, prima.ingredienti, cambio.ingredienti)) {
    return { tipo: 'decaduta', perche: 'ingredienti_cambiati' };
  }
  if (cambio.regime !== undefined && cambio.regime !== prima.regime) {
    return { tipo: 'decaduta', perche: 'regime_cambiato' };
  }
  return { tipo: 'invariata' };
}

/** I campi da scrivere, o `null` se non c'è niente da scrivere. */
export function campiDaScrivere(esito: EsitoVerifica): StatoVerifica | null {
  if (esito.tipo === 'invariata') return null;
  if (esito.tipo === 'verificata') return { verifiedById: esito.da, verifiedAt: esito.il };
  return { verifiedById: null, verifiedAt: null };
}
