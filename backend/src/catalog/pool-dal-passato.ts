import { PESI_RITORNO_IN_EQUILIBRIO, type GiornataCandidata } from '../monitoring/giornate-che-hanno-funzionato';
import { componiIlMese, quantoEPovero } from './mese-dallo-storico';
import { poolPerSlot } from './pool-del-paniere';

/**
 * IL POOL CHE VIENE DAL PASSATO DI UNA CLIENTE — «Ritorno in Equilibrio», §6.1.
 *
 * Richiesta di Simone del 27/8: *«per chi ha già fatto un percorso con noi, un mese coi menu scelti
 * tra quelli che hanno dato migliori risultati e al cliente più graditi»*.
 *
 * ⚠️ **LA FORMA È UNA SCELTA, e va dichiarata perché non è l'unica possibile.** Si poteva **copiare
 * le giornate intere** del passato, come fa il kit di rientro. Qui invece dal passato viene il
 * **pool** — l'insieme dei piatti fra cui scegliere — e la giornata la compone il motore di sempre.
 *
 * ⛔ Il motivo: tutte le regole scritte in questi giorni vivono nella composizione — la banda kcal
 * che si allarga dicendolo, la coppia pranzo/cena che non si ripete, la carne due volte a settimana,
 * gli allergeni, le esclusioni. **Copiando giornate intere si salterebbero tutte in un colpo**, e
 * una cliente riceverebbe una giornata di tre mesi fa con le esclusioni di allora. Il kit di rientro
 * può permetterselo perché dura quattro giorni ed è un'emergenza; un mese no.
 *
 * ⚠️ Quello che si prende dal passato è **quali piatti**, non **come stanno insieme**.
 */

export interface EsitoPoolDalPassato {
  /** slot → ricette, nella forma che il motore già usa. */
  pool: Map<string, Set<string>>;
  /** Quante giornate diverse del suo passato sono entrate. */
  giornateUsate: number;
  /** ⚠️ La frase da dire a una persona se il mese non mantiene la promessa. `null` = tutto bene. */
  avviso: string | null;
}

/** Una giornata del passato, coi suoi piatti e i segnali che le stanno attorno. */
export interface GiornataDelPassato extends GiornataCandidata {
  /** I pasti di quella giornata: `{slot, recipeId}`. */
  pasti: readonly { slot: string; recipeId: string }[];
}

/**
 * Costruisce il pool dalle giornate migliori del passato.
 *
 * ⛔ **Sotto la soglia non si compone niente e si torna `null`**, invece di fare del proprio meglio.
 * «Un mese dei tuoi piatti migliori» costruito su quattro giornate sono quattro giornate girate
 * sette volte: la promessa non regge, e chi la riceve se ne accorge mangiando. Meglio che quella
 * cliente resti sul paniere normale — che è pieno — finché il suo passato non basta.
 *
 * ⚠️ E la soglia la decide chi chiama, non questo file: è un numero di prodotto (28, deciso da
 * Simone l'1/9), non una costante tecnica.
 */
export function poolDalPassato(
  giornate: readonly GiornataDelPassato[],
  quanteNeServono: number,
  soglia: number,
): EsitoPoolDalPassato | null {
  const distinte = new Set(giornate.map((g) => g.chiave)).size;
  if (distinte < soglia) return null;

  const mese = componiIlMese(giornate, quanteNeServono, PESI_RITORNO_IN_EQUILIBRIO);
  const scelte = new Set(mese.giornate.map((g) => g.chiave));

  /**
   * ⛔ **IL POOL SI COSTRUISCE DALLA PORTA, NON A MANO** (2/9).
   *
   * Qui c'erano sei righe che appiattivano le giornate del passato in una mappa: erano la **quarta**
   * copia della stessa domanda — «quali ricette può ricevere questa cliente, per ogni pasto» — e la
   * porta `poolPerSlot` esiste proprio perché non ce ne siano due.
   *
   * ⚠️ E la copia era già indietro di una regola: `poolPerSlot` fa l'allargamento spuntino↔merenda
   * (Fase 2, 1/9), questa no. ⛔ **Nessuna cliente ci ha rimesso**, e va detto invece di lasciar
   * credere il contrario: `ritorno_in_equilibrio_acceso` è `false` di default e non è nemmeno
   * dichiarato in `ENGINE_RULES`, quindi da quel ramo non è mai passato nessuno. Era
   * un'incoerenza fra i due modi di costruire lo stesso pool, trovata il 2/9 mentre si verificava
   * *perché* il pool delle «ricette semplici» potesse fidarsi dell'allargamento — quella funzione
   * è stata poi tolta, questa correzione no: vale per chiunque legga `slotPool`.
   *
   * ⛔ `allargaAiGemelli` **non inventa un pasto che le sue giornate non avevano**: allarga fra
   * chiavi che ci sono già.
   *
   * ⚠️ **E il controllo qui sotto sui pasti vuoti non c'entra**, né prima né dopo: un `Set` in
   * questa mappa nasce solo un attimo prima di riceverci dentro un id, quindi vuoto non è mai — di
   * quella riga vive solo `pool.size === 0`. La prima stesura del 2/9 lo citava come rassicurazione,
   * ed era una tautologia spacciata per verifica.
   */
  const pool = poolPerSlot(
    giornate
      .filter((g) => scelte.has(g.chiave))
      .flatMap((g) => (g.pasti ?? []).map((m) => ({ slot: m?.slot, recipeId: m?.recipeId }))) as never,
  );

  /**
   * ⛔ **Un pool con un pasto vuoto non è un pool**: se anche un solo slot resta senza piatti la
   * composizione non riesce e la cliente resta senza giornata. Meglio dichiarare che il passato non
   * basta e lasciarla sul paniere — la stessa scelta di «sotto la soglia si torna `null`».
   */
  if (![...pool.values()].every((s) => s.size > 0) || pool.size === 0) return null;

  return { pool, giornateUsate: mese.distinte, avviso: quantoEPovero(mese, quanteNeServono) };
}
