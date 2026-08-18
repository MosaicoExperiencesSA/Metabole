import { combaciaAlimento } from '../common/nomi-alimento';
import type { IngredienteRicetta, Substitution } from './pasto-giornata';

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
): IngredienteRicetta[] {
  let out = ingredientiRicetta.map((i) => ({ ...i }));
  for (const s of pasto.substitutions ?? []) {
    let sostituito = false;
    out = out.map((i) => {
      if (sostituito || !i?.name || !combaciaAlimento(i.name, s.from)) return i;
      sostituito = true;
      return { name: s.to, qty: s.toQty ?? i.qty, unit: s.unitA ?? s.unit ?? i.unit };
    });
    // Sostituzione che non trova la sua origine (piatto cambiato, catena di cambi): il
    // sostituto va comunque considerato presente, altrimenti resta invisibile.
    if (!sostituito && !out.some((i) => !!i?.name && combaciaAlimento(i.name, s.to))) {
      out.push({ name: s.to, qty: s.toQty, unit: s.unitA ?? s.unit });
    }
  }
  return out;
}
