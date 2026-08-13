/**
 * «CI DICI SE HAI ALLERGIE?» — la domanda che l'app fa a chi non ha mai risposto.
 *
 * Decisione di Simone (13/8): «non fermiamo nessuno; stasera gira un aggiornamento e andiamo a
 * chiedere a tutti quelli che hanno l'app installata». Sostituisce la campagna in chat del §7: meno
 * pezzi, copre tutte, e non dipende da una conversazione che scade dopo un'ora.
 *
 * ## ⚠️ Qui la cliente scrive le allergie, e in tutto il resto del prodotto NON può
 *
 * La regola scritta (§5 dell'handoff allergie) dice che né la coach né la cliente né il backoffice
 * generico scrivono le allergie: le corregge la nutrizionista, col permesso `change_allergies`. Non
 * è una contraddizione, ed è importante capire perché prima di toccare questo file:
 *
 *  - quella regola protegge dalla **cancellazione** e dalla **correzione** di un dato sanitario già
 *    raccolto — «se lo cancelliamo per sbaglio, la cliente se ne accorge e lo rimette?»;
 *  - qui siamo nel caso opposto: **non abbiamo mai chiesto**, e nessuno può rispondere al posto suo.
 *
 * Da cui i due paletti, che non si tolgono:
 *
 * 1. ⚠️ **Si può rispondere una volta sola.** Se `allergieDichiarateIl` è già valorizzato, questa
 *    porta è chiusa: da lì in poi è una correzione, e la fa la nutrizionista.
 * 2. ⚠️ **Si aggiunge, non si sostituisce.** Quello che c'era resta, come in `common/non-perdere.ts`:
 *    una risposta nuova non può far sparire un'allergia che qualcuno aveva già registrato.
 */
import { NON_ALIMENTI } from '../common/allergie';

export interface RispostaAllergie {
  /** I codici scelti dall'elenco dei 14 UE. */
  allergie?: unknown;
  /** Quello che ha scritto a mano, se ha scelto «altro». */
  altro?: unknown;
  /** «Non ho allergie»: è una risposta, e vale quanto un elenco pieno. */
  nessuna?: unknown;
}

export interface EsitoDichiarazione {
  /** L'elenco completo da scrivere: quello che c'era PIÙ quello che ha detto adesso. */
  allergie: string[];
  /** Quali fra quelle sono testo libero. ⚠️ Marcatore, non spostamento: vedi `common/allergie.ts`. */
  allergiesOther: string[];
  /** I termini che nessuno sa tradurre: per ognuno parte una domanda alla nutrizionista. */
  daTradurre: string[];
}

const pulisci = (v: unknown): string[] =>
  (Array.isArray(v) ? v : [])
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter((x) => x.length > 0 && !NON_ALIMENTI.has(x.toLowerCase()));

/**
 * Cosa scrivere sul profilo, date le allergie che c'erano e la risposta di adesso.
 *
 * @param codiciNoti i 14 codici UE: quello che non è lì dentro è testo libero, e va tradotto da una
 *   persona prima di poter togliere qualcosa dal piatto.
 */
export function dichiarazione(
  giaPresenti: readonly string[],
  risposta: RispostaAllergie,
  codiciNoti: readonly string[],
): EsitoDichiarazione {
  const scelte = pulisci(risposta.allergie);
  const libere = pulisci(risposta.altro);
  const esistenti = pulisci(giaPresenti);

  // ⚠️ UNIONE, mai sostituzione: una risposta nuova non può cancellare quello che c'era.
  const allergie: string[] = [...esistenti];
  for (const t of [...scelte, ...libere]) {
    if (!allergie.some((a) => a.toLowerCase() === t.toLowerCase())) allergie.push(t);
  }

  const noti = new Set(codiciNoti.map((c) => c.toLowerCase()));
  const allergiesOther = allergie.filter((a) => !noti.has(a.toLowerCase()));
  return {
    allergie,
    allergiesOther,
    // ⚠️ Si chiede alla nutrizionista SOLO per quello che è arrivato adesso: le voci vecchie hanno
    // già la loro domanda aperta, e riaprirla a ogni risposta riempirebbe la sua coda di doppioni.
    daTradurre: libere.filter((t) => !noti.has(t.toLowerCase())),
  };
}

/** Ha risposto qualcosa? «Non ne ho» è una risposta; il silenzio no. */
export function haRisposto(risposta: RispostaAllergie): boolean {
  return risposta.nessuna === true || pulisci(risposta.allergie).length > 0 || pulisci(risposta.altro).length > 0;
}
