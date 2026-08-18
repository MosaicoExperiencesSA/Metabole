/**
 * LA LISTA DELLA SPESA SI RIFÀ A OGNI APERTURA — quello che si conserva è cosa hai già preso.
 *
 * ## Il difetto che chiude (voce 255, ultima coda + un pezzo più vecchio)
 *
 * `shoppingList` teneva una riga per `(cliente, dal, al)` e, se la trovava, la **restituiva così
 * com'era**. Nessuno la invalidava mai. Quindi tutto quello che cambia la giornata *dopo* che la
 * lista è nata non arrivava mai nel carrello:
 *
 * - le **porzioni scalate** del 18/8 (una lista fatta prima del rilascio somma le grammature di
 *   catalogo: la cliente compra il cibo della porzione piccola e a metà settimana finisce);
 * - il **piatto cambiato in chat** con Gaia, le «ricette semplici», il piatto non gradito
 *   sostituito in erogazione: la lista continua a chiedere gli ingredienti di un piatto che quel
 *   giorno non c'è più;
 * - la **ricetta corretta in backoffice** (una grammatura sbagliata sistemata dalla nutrizionista).
 *
 * ⚠️ E non lo diceva nessuno: la lista *sembrava* la lista di quei giorni. È il difetto di famiglia
 * di questo progetto — un dato che agisce e non si vede — dentro l'unica schermata che si guarda
 * mentre si spinge un carrello.
 *
 * ## La scelta: si ricalcola sempre, non si prova a indovinare quando è vecchia
 *
 * La strada breve sarebbe stata confrontare le date: «se un giorno è stato toccato dopo che la
 * lista è nata, rifalla». ⚠️ **Non si può**, e per due motivi diversi, ognuno dei quali basta:
 * `ShoppingList.updatedAt` lo muove **anche la spunta** (è la lezione della voce 275: un
 * `updatedAt` che serve a due domande non risponde bene a nessuna delle due), e `MenuDay.updatedAt`
 * lo muove `deliverIfEligible`, che gira **a ogni apertura dell'app**. Il confronto sarebbe stato
 * o sempre falso o sempre vero, e in tutti e due i casi sbagliato in silenzio.
 *
 * Il calcolo costa una query sulle ricette dei sette giorni, cioè quello che costava comunque la
 * prima volta. La riga in tabella resta, ma smette di essere una **copia** della lista: diventa il
 * posto dove vive l'unica cosa che il server non sa ricostruire, cioè **cosa hai già messo nel
 * carrello**.
 */
import { ingredientiEffettivi } from './ingredienti-effettivi';
import type { IngredienteRicetta, MealSnapshot } from './pasto-giornata';
import { quantitaScalata } from './porzione-scalata';

export interface VoceSpesa {
  name: string;
  qty: number | null;
  unit: string | null;
  checked: boolean;
}

/** La chiave con cui due righe sono «la stessa cosa»: nome e unità. */
const chiave = (name: string, unit?: string | null): string => `${name.trim().toLowerCase()}|${unit ?? ''}`;

/**
 * Somma gli ingredienti dei giorni, con il moltiplicatore di porzione di ogni pasto.
 *
 * ⚠️ Il fattore è quello del **pasto**, non della giornata: dentro lo stesso giorno la colazione può
 * essere al tetto e il pranzo no. ⚠️ Un ingrediente senza quantità («q.b.») resta senza quantità e
 * non diventa uno zero, e ⚠️ se **una** delle righe che si sommano non ha quantità la somma resta
 * quella delle altre: dire «120 g» quando un pezzo non si sa quanto pesa è meglio che dire `null`,
 * che nella lista si legge come «non serve pesarlo».
 *
 * ⚠️ **E vale in tutti e due gli ordini.** Fino alla revisione del 18/8 sera la regola qui sopra era
 * scritta nel commento e realizzata a metà: se la riga senza quantità arrivava **per prima**, la
 * somma nasceva `null` e da lì non si muoveva più — quindi «q.b. di farro il lunedì» cancellava i
 * 100 g del martedì. L'ordine dei giorni non deve decidere cosa compare nella lista della spesa.
 */
export function aggregaSpesa(
  giorni: { meals: unknown }[],
  ingredientiPerRicetta: Map<string, IngredienteRicetta[]>,
): VoceSpesa[] {
  const somma = new Map<string, VoceSpesa>();
  for (const giorno of giorni) {
    if (!Array.isArray(giorno?.meals)) continue;
    for (const pasto of giorno.meals as MealSnapshot[]) {
      /**
       * ⚠️ GLI INGREDIENTI SONO QUELLI DEL PIATTO, NON QUELLI DEL CATALOGO. Fino alla revisione del
       * 18/8 sera qui si leggevano gli ingredienti per `recipeId` e basta: una sostituzione
       * concordata con Gaia («carote → biete») non arrivava **mai** nel carrello. La cliente
       * comprava le carote — per giunta scalate — e zero biete, e in cucina se ne accorgeva da sola.
       */
      const ingredienti = ingredientiEffettivi(ingredientiPerRicetta.get(pasto?.recipeId) ?? [], pasto ?? {});
      const fattore = pasto?.porzione ?? 1;
      for (const ing of ingredienti) {
        if (!ing?.name) continue;
        const k = chiave(ing.name, ing.unit);
        const qta = quantitaScalata(ing.qty, fattore, ing.unit);
        const gia = somma.get(k);
        if (gia) {
          // Le quantità note si sommano; quelle che non ci sono si saltano — da qualunque parte
          // arrivino. `null + 100` non è `null`, è `100`.
          if (qta !== null) gia.qty = gia.qty === null ? qta : Math.round((gia.qty + qta) * 10) / 10;
        } else {
          somma.set(k, { name: ing.name, qty: qta, unit: ing.unit ?? null, checked: false });
        }
      }
    }
  }
  return [...somma.values()];
}

/**
 * Riporta le spunte della lista vecchia su quella appena calcolata.
 *
 * ⚠️ **È l'unica cosa che il server non sa rifare da solo**, e per questo la riga in tabella
 * continua a esistere. Una voce che non c'è più (piatto cambiato) sparisce con la sua spunta, ed è
 * giusto: quella roba non serve più. Una voce nuova nasce da spuntare.
 *
 * ⚠️ La quantità **non** si conserva: se il piatto è cresciuto, i 120 g diventano 216 anche se la
 * riga era già spuntata. Chi ha già comprato lo vede e decide; tenere il numero vecchio perché
 * «tanto l'ha già presa» vorrebbe dire nasconderle che ora gliene serve di più.
 */
export function conservaSpuntati(calcolate: VoceSpesa[], vecchie: unknown): VoceSpesa[] {
  if (!Array.isArray(vecchie)) return calcolate;
  const spuntate = new Set(
    (vecchie as { name?: string; unit?: string | null; checked?: boolean }[])
      .filter((v) => v?.checked && v?.name)
      .map((v) => chiave(v.name as string, v.unit)),
  );
  return calcolate.map((v) => (spuntate.has(chiave(v.name, v.unit)) ? { ...v, checked: true } : v));
}

/**
 * Le due liste dicono la stessa cosa? Serve a **non scrivere** quando non è cambiato niente: la
 * lista si rilegge molte volte al giorno, e una scrittura per ogni lettura sarebbe rumore in tabella
 * e un `updatedAt` che si muove senza che sia successo niente.
 *
 * ⚠️ Confronto per **contenuto e non per ordine**: l'ordine delle voci dipende da quello dei pasti,
 * e un giorno rigenerato con gli stessi piatti in ordine diverso non è una lista diversa.
 *
 * (C'era anche un `perChiave.size !== a.length`: era codice morto — le chiavi di `a` sono distinte
 * per costruzione, quindi se una manca l'`every` qui sotto torna già `false`. Tolto nella revisione
 * del 18/8 sera: una riga che non può cambiare l'esito fa credere che ci sia un caso in più.)
 */
export function stessaLista(a: VoceSpesa[], b: unknown): boolean {
  if (!Array.isArray(b) || a.length !== b.length) return false;
  const perChiave = new Map(
    (b as { name?: string; unit?: string | null; qty?: number | null; checked?: boolean }[])
      .filter((v) => v?.name)
      .map((v) => [chiave(v.name as string, v.unit), v]),
  );
  return a.every((v) => {
    const altra = perChiave.get(chiave(v.name, v.unit));
    return !!altra && (altra.qty ?? null) === v.qty && !!altra.checked === v.checked;
  });
}
