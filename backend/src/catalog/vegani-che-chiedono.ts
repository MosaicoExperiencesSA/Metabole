import { controllaRicettaDaScrivere } from './ricetta-che-si-puo-scrivere';

/**
 * ⛔ **QUANTE RICETTE VEGANE DEL CATALOGO CHIEDEREBBERO CONFERMA OGGI, E PER QUALE PAROLA.**
 *
 * Il cancello del 4/9 sera chiede conferma su latte e uova in un piatto vegano. Vale per chi
 * scrive da oggi; ma il catalogo ha già migliaia di piatti vegani, e la stessa domanda fatta a
 * loro dice due cose insieme: **quanti sono sbagliati davvero** (una frittata dichiarata vegana)
 * e **quali parole fanno scattare la conferma a torto** — che è l'elenco con cui si allungano le
 * piante di `derivatoVegetale`, una parola alla volta, coi nomi davanti.
 *
 * ⚠️ Il conto sta qui e non nello script, per la solita ragione: da questo numero si decide se
 * il cancello resta com'è, e un giudizio che decide non sta in un file che nessun test guarda.
 */

export interface RicettaVegana {
  id: string;
  name: string;
  ingredients: unknown;
}

export interface ParolaCheChiede {
  /** L'ingrediente (nome intero) che fa scattare la conferma. */
  ingrediente: string;
  ricette: number;
  esempi: string[];
}

export interface ContoVegani {
  esaminate: number;
  chiedono: number;
  /** Per ingrediente, dalla più frequente: è l'elenco da leggere una riga per volta. */
  parole: ParolaCheChiede[];
}

const MAX_ESEMPI = 3;

/** L'ingrediente nominato dentro «Fra gli ingredienti c'è «…»». */
function ingredienteNominato(problema: string): string {
  const m = /«([^»]+)»/.exec(problema);
  return m?.[1] ?? '(?)';
}

export function contaVeganiCheChiedono(ricette: readonly RicettaVegana[]): ContoVegani {
  const per = new Map<string, ParolaCheChiede>();
  let chiedono = 0;
  for (const r of ricette) {
    const v = controllaRicettaDaScrivere({ nome: r.name, regime: 'vegan', ingredienti: r.ingredients });
    if (v.esito !== 'conferma') continue;
    chiedono += 1;
    const ingrediente = ingredienteNominato(v.problema);
    const riga = per.get(ingrediente) ?? { ingrediente, ricette: 0, esempi: [] };
    riga.ricette += 1;
    if (riga.esempi.length < MAX_ESEMPI) riga.esempi.push(r.name);
    per.set(ingrediente, riga);
  }
  return { esaminate: ricette.length, chiedono, parole: [...per.values()].sort((a, b) => b.ricette - a.ricette) };
}
