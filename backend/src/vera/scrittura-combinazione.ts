/**
 * LA PORTA PER APPROVARE UNA COMBINAZIONE — un token, come `SCRITTURA_RICETTA`.
 *
 * Stessa ragione, pratica e non stilistica: importare `EquivalenceService` qui trascinerebbe nel
 * grafo di compilazione dei test di Vera un modulo che con Vera non c'entra. Il servizio vero resta
 * quello, legato con `useExisting` in `VeraModule`.
 *
 * ⚠️ Un metodo solo, e si vede leggendo cosa Vera può fare qui: **approvare**. Non modificare i
 * membri, non cancellare, non riportare in bozza. Un gruppo di equivalenza dice al motore quali
 * alimenti può scambiare fra loro nel piatto di una cliente: da una chat si dice sì a quello che è
 * scritto, e il resto si fa in Equivalenze, guardando il campo.
 */
export interface ScritturaCombinazione {
  approve(userId: string, id: string): Promise<unknown>;
  /**
   * ⚠️ **Creare** un gruppo, dal 19/8: «aggiungi equivalenza» dettata a Vera. Nasce `draft` e
   * avvisa i capi nutrizionisti — quella regola sta in `EquivalenceService.create` e qui non si
   * duplica: da questa porta si passa, non si decide.
   */
  create(userId: string, dto: { name: string; items: string[]; note?: string; productId?: string }): Promise<unknown>;
}

export const SCRITTURA_COMBINAZIONE = 'VERA_SCRITTURA_COMBINAZIONE';
