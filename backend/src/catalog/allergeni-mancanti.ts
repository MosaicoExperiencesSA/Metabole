import { suggestAllergens } from './allergens';
import type { RicettaDaRiparare } from './allergeni-porta-unica';

/**
 * ⛔ **I TAG CHE MANCANO: la deduzione di oggi li trova, la ricetta non li porta.**
 *
 * È il gemello di `allergeniFalsiDaTogliere`, nel verso opposto — e il verso cambia la regola.
 * Togliere un tag è irreversibile e toglie protezione: si toglie solo sapendo perché c'era.
 * **Aggiungere** un tag aggiunge protezione: si aggiunge ogni volta che la deduzione lo trova.
 *
 * Misurato il 5/9 con `diag:vocabolario-allergeni`: **616** tag da scrivere per il solo verso
 * esclusioni→tag (sardine 140, dentice 132, spigola 66, ricciola 34…), più **224** per le parole
 * nuove (scamorza 35, provola 30, seppie 25, burrata 21…). Una cliente allergica al pesce riceveva
 * la spigola: la porta delle esclusioni la toglieva, la base personale dei tag no.
 *
 * ## ⛔ Chi è stato toccato a mano NON si tocca, nemmeno per aggiungere
 *
 * Sembra il contrario di prudente — aggiungere un tag non fa male — ma su una lista che una
 * persona ha scelto (`catalog.recipe.allergens.set` nel registro) un tag in più che lei aveva
 * **tolto apposta** (un falso positivo che conosceva) è la macchina che rifà una scelta sua. Quelle
 * ricette escono in un elenco a parte e le guarda lei.
 *
 * ⚠️ `allergensReviewed` non si tocca: azzerarla toglierebbe il piatto dalle basi personali di
 * tutte, ed è la stessa decisione scritta in `ripara-allergeni-chiave.ts`.
 */
export interface AllergeneMancante {
  allergen: string;
  /** Il nome di ingrediente che lo porta: è quello che una persona legge per giudicare. */
  ingrediente: string;
}

export function allergeniMancantiDaAggiungere(r: RicettaDaRiparare): AllergeneMancante[] {
  if (r.toccataAMano) return [];
  const scritti = new Set((r.allergens ?? []).map((x) => String(x)));
  return suggestAllergens(r.ingredients)
    .filter((a) => !scritti.has(a.allergen))
    .map((a) => ({ allergen: a.allergen, ingrediente: a.matched[0] }));
}

export interface ContoMancanti {
  esaminate: number;
  /** Ricette che guadagnano almeno un tag. */
  daRiparare: number;
  /** Di quelle, quante portano la spunta di conferma (guadagnano un tag su una lista «confermata»). */
  confermate: number;
  /** Per allergene: quante ricette lo guadagnano, con esempi. */
  perAllergene: { allergen: string; ricette: number; esempi: string[] }[];
}

const MAX_ESEMPI = 3;

/** ⛔ Il conto sta qui e non nello script: da questo numero dipende una scrittura sul catalogo. */
export function contaMancanti(ricette: readonly RicettaDaRiparare[]): ContoMancanti {
  const per = new Map<string, { allergen: string; ricette: number; esempi: string[] }>();
  let daRiparare = 0;
  let confermate = 0;
  for (const r of ricette) {
    const m = allergeniMancantiDaAggiungere(r);
    if (!m.length) continue;
    daRiparare += 1;
    if (r.allergensReviewed) confermate += 1;
    for (const x of m) {
      const riga = per.get(x.allergen) ?? { allergen: x.allergen, ricette: 0, esempi: [] };
      riga.ricette += 1;
      if (riga.esempi.length < MAX_ESEMPI) riga.esempi.push(`${r.name} (${x.ingrediente})`);
      per.set(x.allergen, riga);
    }
  }
  return { esaminate: ricette.length, daRiparare, confermate, perAllergene: [...per.values()].sort((a, b) => b.ricette - a.ricette) };
}
