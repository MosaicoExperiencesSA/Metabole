/**
 * QUANTE RICETTE RESTANO — la parte che si può calcolare senza banca dati.
 *
 * È il freno di Vera. Quando la nutrizionista detta «a Simone niente formaggi molli», prima di
 * scrivere qualsiasi cosa l'agente deve poterle dire *quante* ricette quella regola porta via e
 * *quale pasto* rimane scoperto. Senza, la regola sensata su una cliente svuota il pool e il guasto
 * si manifesta di notte, sul menu di qualcuno, senza che nessuno abbia toccato niente quel giorno.
 *
 * ## ⚠️ Perché NON è un menu simulato
 *
 * La specifica diceva di tagliare `deliverIfEligible` prima del salvataggio e restituire i giorni
 * composti. Leggendola sul codice non regge, per due motivi che si vedono solo lì dentro:
 *
 *  - quella funzione ha una quindicina di uscite anticipate che non c'entrano niente con la regola
 *    da provare (nessun abbonamento, pausa, piano fermato, misure mancanti, fine piano…). Una
 *    simulazione che risponde «niente» perché la cliente è in vacanza non è una risposta: è un
 *    rumore che la nutrizionista imparerebbe a ignorare;
 *  - lungo quel percorso ci sono sei scritture collaterali da neutralizzare — richiesta misure,
 *    evento analytics, due escalation, audit, attivazione prova. Renderle opzionali per una
 *    anteprima significa mettere un `if` sul percorso che porta il pasto vero nel piatto di
 *    qualcuno, in cambio di un dato che non serve.
 *
 * La domanda vera di Vera non è «che menu verrebbe fuori» — è **«quanti piatti restano»**. Quella
 * si risponde con una funzione pura sopra il catalogo, che non può scrivere per costruzione. Il
 * modo più sicuro di garantire che una simulazione non salvi niente non è ricordarsi di non
 * salvare: è non avere Prisma sotto mano.
 *
 * ## ⚠️ Le parole chiave arrivano da `menu/exclusions.ts`, non da qui
 *
 * Il confronto sul piatto lo fa `hitsExclusion` sullo stesso `recipeHaystack` che usa il motore. Se
 * questo file si scrivesse il suo filtro, il numero mostrato alla nutrizionista sarebbe una stima
 * di quello che il motore farà — e prima o poi le due cose divergerebbero senza che nessuno se ne
 * accorga, perché una stima sbagliata non produce nessun errore.
 */
import { hitsExclusion, recipeHaystack } from '../menu/exclusions';
import { etichettaSlot, MAIN_SLOTS } from '../common/slot-pasto';

/** Una ricetta del pool, ridotta a quello che serve per decidere se resta o esce. */
export interface RicettaDelPool {
  id: string;
  name: string;
  ingredients: unknown;
}

/** Com'è messo un singolo pasto dopo aver applicato le esclusioni. */
export interface StatoSlot {
  slot: string;
  /** Etichetta italiana, per il messaggio che legge la nutrizionista. */
  etichetta: string;
  /** Quante ricette la dieta prevede per questo pasto, prima di qualsiasi esclusione. */
  totale: number;
  /** Quante ne restano. */
  restano: number;
  /** I piatti tolti, per nome. Troncati: servono a farle riconoscere l'errore, non a fare l'elenco. */
  tolti: string[];
  /** Vero se `restano` è sotto la soglia minima di ricette sicure per pasto. */
  sottoSoglia: boolean;
}

export interface EsitoPool {
  soglia: number;
  slots: StatoSlot[];
  /** Solo i pasti PRINCIPALI sotto soglia: sono quelli su cui il piano si blocca davvero. */
  pastiScoperti: string[];
  totaleRestanti: number;
}

/** Quanti nomi di piatto si mostrano prima di dire «e altri N». */
const MAX_TOLTI_MOSTRATI = 8;

/**
 * Applica le esclusioni al pool e conta cosa resta, pasto per pasto.
 *
 * `chiaviEscluse` sono già espanse (`exclusionKeys`): qui non si interpreta niente, si conta.
 */
export function calcolaPool(
  poolPerSlot: Map<string, RicettaDelPool[]>,
  chiaviEscluse: Iterable<string>,
  soglia: number,
): EsitoPool {
  const chiavi = [...chiaviEscluse].filter(Boolean);
  const slots: StatoSlot[] = [];

  for (const [slot, ricette] of poolPerSlot) {
    const tolti: string[] = [];
    let restano = 0;
    for (const r of ricette) {
      const colpita = hitsExclusion(recipeHaystack(r.name, r.ingredients), chiavi);
      if (colpita) tolti.push(r.name);
      else restano += 1;
    }
    slots.push({
      slot,
      etichetta: etichettaSlot(slot),
      totale: ricette.length,
      restano,
      tolti: tolti.slice(0, MAX_TOLTI_MOSTRATI),
      // ⚠️ La soglia vale sui pasti PRINCIPALI. Uno spuntino con due opzioni non è un piano
      // rotto; una cena con due opzioni sì. Marcare tutto allo stesso modo abituerebbe a
      // ignorare l'avviso, che è il modo più rapido per renderlo inutile.
      sottoSoglia: (MAIN_SLOTS as readonly string[]).includes(slot) && restano < soglia,
    });
  }

  // Ordine stabile: i pasti principali prima, nell'ordine della giornata, poi il resto in ordine
  // alfabetico. Senza, l'elenco cambia posto a ogni chiamata (le Map seguono l'inserimento) e due
  // anteprime della stessa regola sembrerebbero diverse.
  const rango = (s: string) => {
    const i = (MAIN_SLOTS as readonly string[]).indexOf(s);
    return i === -1 ? MAIN_SLOTS.length : i;
  };
  slots.sort((a, b) => rango(a.slot) - rango(b.slot) || a.slot.localeCompare(b.slot));

  return {
    soglia,
    slots,
    pastiScoperti: slots.filter((s) => s.sottoSoglia).map((s) => s.etichetta),
    totaleRestanti: slots.reduce((n, s) => n + s.restano, 0),
  };
}

/**
 * La frase che Vera dice alla nutrizionista prima di scrivere.
 *
 * ⚠️ Non è un avviso, è un BIVIO: se il pool si stringe, il messaggio deve finire con una domanda,
 * non con un punto. Le vie d'uscita le calcola chi chiama (cercandole **nel catalogo**, mai
 * immaginandole): qui si scrive solo la parte che riguarda i numeri.
 */
export function raccontaPool(prima: EsitoPool, dopo: EsitoPool): string {
  const tolte = prima.totaleRestanti - dopo.totaleRestanti;
  if (tolte <= 0) return 'Questa regola non toglie nessuna ricetta dal suo piano.';

  const parti = [
    `Questa regola toglie ${tolte} ricett${tolte === 1 ? 'a' : 'e'} ` +
      `dalle ${prima.totaleRestanti} che aveva: ne restano ${dopo.totaleRestanti}.`,
  ];
  for (const s of dopo.slots) {
    if (!s.sottoSoglia) continue;
    const era = prima.slots.find((p) => p.slot === s.slot)?.restano ?? s.totale;
    parti.push(
      `⚠️ Per la ${s.etichetta} si scende da ${era} a ${s.restano} ` +
        `(sotto la soglia di ${dopo.soglia}).`,
    );
  }
  return parti.join(' ');
}
