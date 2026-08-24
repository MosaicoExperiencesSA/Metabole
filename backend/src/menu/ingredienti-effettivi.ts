import { combaciaAlimento } from '../common/nomi-alimento';
import { SOSTITUTO_ASSENTE, type IngredienteRicetta, type Substitution } from './pasto-giornata';

/**
 * GLI INGREDIENTI COME STANNO NEL PIATTO OGGI — ricetta di catalogo più le sostituzioni concordate.
 *
 * ⚠️ **Stava dentro `sostituzione-chat.service.ts`**, cioè dentro un servizio che si porta dietro
 * audit, config, segnalazioni e Vera: chi aveva bisogno solo di questa regola — la lista della spesa
 * e la scheda ricetta — non poteva chiamarla senza tirarsi dietro tutto il resto, e infatti **non la
 * chiamava**. Il risultato lo ha trovato la revisione del 18/8 sera: la cliente concordava «carote →
 * biete» e nel carrello si ritrovava le carote. Una funzione difficile da chiamare è una funzione
 * che qualcuno riscriverà — o, peggio, che qualcuno dimenticherà.
 *
 * Adesso vive da sola, senza dipendenze, e la importano tutti e tre i posti che rispondono alla
 * stessa domanda: il dialogo con Gaia, la scheda della ricetta e la lista della spesa.
 *
 * ⚠️ Senza questo, Gaia negava l'esistenza di un alimento che aveva scritto lei: concordato ieri
 * «carote → biete», oggi la cliente apre il menu, legge «biete 100 g», preme Sostituisci e
 * scrive «le biete» — e si sentiva rispondere che le biete non ci sono, perché nessuna ricetta
 * di catalogo le contiene. Due tentativi così e il dialogo passava alla coach.
 */
export function ingredientiEffettivi(
  ingredientiRicetta: IngredienteRicetta[],
  pasto: { substitutions?: Substitution[] },
  opzioni?: { seNonTrovato?: 'aggiungi' | 'salta' },
): IngredienteRicetta[] {
  let out = ingredientiRicetta.map((i) => ({ ...i }));
  for (const s of pasto.substitutions ?? []) {
    let sostituito = false;
    /**
     * ⛔ **«Si toglie» non è un sostituto: è un'assenza.** L'ingrediente esce dall'elenco invece di
     * cambiare nome — altrimenti la spesa avrebbe una riga da comprare che si chiama «si toglie
     * (niente al suo posto)», la scheda ricetta la stessa frase con una grammatura accanto, e Gaia
     * la offrirebbe fra gli alimenti da cambiare. Trovato in revisione il 24/8, sui solfiti.
     */
    if (s.to === SOSTITUTO_ASSENTE) {
      const prima = out.length;
      out = out.filter((i) => !i?.name || !combaciaAlimento(i.name, s.from));
      // Se l'origine non c'era, non c'è niente da togliere e niente da aggiungere: si passa oltre.
      if (out.length !== prima) continue;
      continue;
    }
    out = out.map((i) => {
      if (sostituito || !i?.name || !combaciaAlimento(i.name, s.from)) return i;
      sostituito = true;
      return { name: s.to, qty: s.toQty ?? i.qty, unit: s.unitA ?? s.unit ?? i.unit };
    });
    /**
     * Sostituzione che non trova la sua origine: il sostituto va comunque considerato presente,
     * altrimenti resta invisibile.
     *
     * ⚠️ **MA SOLO PER CHI CHIEDE «cosa c'è nel piatto», non per chi chiede «cosa devo comprare».**
     * Il cambio di PIATTO — `swapDislikedDishes`, il piatto non gradito sostituito in erogazione —
     * scrive una sostituzione in cui `from` e `to` sono **nomi di ricetta**, non di ingrediente. Per
     * la chat va bene: serve solo a non far negare a Gaia l'esistenza di quel nome. Ma nella lista
     * della spesa e nella scheda ricetta quel ripiego diventa **una riga da comprare che si chiama
     * «Riso e lenticchie»**, in mezzo a farro e zucchine — trovato dalla revisione della notte del
     * 18/8, poche ore dopo che questa funzione era stata data a quei due punti.
     *
     * Quindi chi chiama sceglie: la chat `aggiungi` (com'è sempre stato), la spesa e la scheda
     * `salta`. ⚠️ Il prezzo di `salta`, detto: una sostituzione **di ingrediente** la cui origine è
     * sparita (una ricetta cambiata sotto) non compare — e va bene così, perché l'alternativa è
     * inventare una riga di spesa con un nome che nessuno ha mai comprato.
     */
    const seNonTrovato = opzioni?.seNonTrovato ?? 'aggiungi';
    if (seNonTrovato === 'aggiungi' && !sostituito && !out.some((i) => !!i?.name && combaciaAlimento(i.name, s.to))) {
      out.push({ name: s.to, qty: s.toQty, unit: s.unitA ?? s.unit });
    }
  }
  return out;
}
