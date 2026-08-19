/**
 * I MACRO DI UNA RICETTA — sommati dalla tabella nutrienti, mai inventati.
 *
 * Decisione di Simone (13/8), scelta a) fra tre: «calcolati dalla tabella nutrienti, mai
 * inventati». Il motivo è che questi quattro numeri non restano fermi: `menu.service` ci calcola
 * sopra la quota proteica di ogni giornata, e `day-combo` ci sceglie le combinazioni. Un numero
 * stimato a occhio non sbaglia il piatto — sbaglia il piano.
 *
 * ## ⚠️ Se un ingrediente non è in tabella, NON si stima: si dice
 *
 * E la ricetta non si scrive, perché `Recipe.kcal` è obbligatorio: senza i valori veri l'unico modo
 * di riempirlo sarebbe indovinarlo. Il termine mancante finisce in `NutrientLookupMiss` — la
 * tabella che dice **quali alimenti aggiungere per primi**, ordinati per quante volte sono stati
 * chiesti — e da lì diventa una riga di lavoro vera invece di un buco.
 *
 * ## ⚠️ Le due approssimazioni, dette e non nascoste
 *
 * 1. **i millilitri contati come grammi**: vale per l'acqua, non per l'olio (0,91 g/ml, cioè un 9%
 *    in meno). Si accetta perché è la convenzione delle tabelle nutrizionali, ma quando c'è un
 *    ingrediente in ml la frase lo dice — un'approssimazione dichiarata è un dato, una nascosta è
 *    un errore;
 * 2. **quello che non ha un peso** («sale q.b.», «2 foglie di basilico») **non si conta**, e si
 *    elenca. Bloccare una ricetta intera per il sale sarebbe il modo di far smettere di usare lo
 *    strumento; contarlo come zero **senza dirlo** sarebbe peggio.
 */

import { fraseSoloCotto } from '../nutrient-facts/stato-alimento';

/** I valori della tabella, **per 100 g**. È l'unità di `NutrientFact`, e non va convertita altrove. */
export interface ValorePer100 {
  name: string;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

export interface IngredienteDaContare {
  name: string;
  qty: number | null;
  unit: string | null;
}

export interface MacroCalcolati {
  kcal: number;
  macros: { protein_g: number; carbs_g: number; fat_g: number };
  /** Alimenti che non sono nella tabella nutrienti: senza questi non si scrive niente. */
  mancanti: string[];
  /**
   * ⚠️ Alimenti che nella tabella ci sono **più di una volta, con stati diversi** (crudo e cotto), e
   * la ricetta non dice quale (voce 228). Non si contano — un numero preso dallo stato sbagliato
   * sbaglia fino a tre volte (farro: 353 kcal crudo, 127 bollito) — e si chiede.
   */
  ambigui: string[];
  /**
   * ⚠️ Alimenti di cui la tabella ha **solo il valore da cotto**, mentre nelle ricette le grammature
   * sono a **crudo** (convenzione decisa da Simone il 19/8, come nei libri di cucina). Contarli
   * darebbe un totale molto più basso del vero — sul riso e sui legumi anche tre volte — quindi non
   * si contano e si dice. Vedi `nutrient-facts/stato-alimento.ts`.
   */
  soloCotto: string[];
  /**
   * Alimenti contati con una riga che **non dichiara lo stato**: si contano, ma l'approssimazione si
   * dichiara. «Senza stato» non è «cotto», è «non lo so» — e rifiutarli bloccherebbe quasi ogni
   * ricetta.
   */
  statoIgnoto: string[];
  /** Righe senza un peso utilizzabile: la ricetta si scrive, ma questi non sono nel conto. */
  nonContati: string[];
  /** C'è almeno un ingrediente misurato in volume: l'approssimazione va detta. */
  contieneVolumi: boolean;
}

/** Da quanto è scritto sulla riga a grammi. `null` = non si sa, e allora non si conta. */
export function inGrammi(qty: number | null, unit: string | null): number | null {
  if (qty === null || !Number.isFinite(qty) || qty <= 0) return null;
  const u = (unit ?? '').toLowerCase().replace(/\./g, '');
  if (['g', 'gr', 'grammi'].includes(u) || u === '') return qty;
  if (u === 'kg') return qty * 1000;
  // ⚠️ Volume → peso con densità 1. Vero per l'acqua, generoso dell'8-9% per l'olio: si accetta e
  // si dichiara (vedi il riquadro in testa), non si corregge per alimento — una tabella di densità
  // scritta a mano qui sarebbe un secondo posto dove i numeri divergono da `NutrientFact`.
  if (u === 'ml') return qty;
  if (u === 'cl') return qty * 10;
  if (u === 'l' || u === 'litri') return qty * 1000;
  return null;
}

const VOLUMI = new Set(['ml', 'cl', 'l', 'litri']);

const arrotonda = (n: number) => Math.round(n * 10) / 10;

/**
 * Somma i macro. `valori` è già la risposta della tabella per ogni ingrediente: la ricerca per nome
 * e sinonimi la fa `ValoriNutrizionaliService`, e non si riscrive qui — è la funzione che decide
 * anche cosa risponde Gaia sui valori, e due idee di «quale alimento è questo» sono due risposte
 * diverse alla stessa domanda.
 */
export function calcolaMacro(
  ingredienti: IngredienteDaContare[],
  valori: Map<string, ValorePer100 | null>,
  /** I nomi che la tabella ha in più stati e la ricetta non distingue: vedi `ambigui`. */
  ambiguiNoti: readonly string[] = [],
  /** ⚠️ I nomi di cui la tabella ha **solo** il valore da cotto: vedi `soloCotto`. */
  soloCottoNoti: readonly string[] = [],
  /** I nomi contati con una riga senza stato dichiarato: vedi `statoIgnoto`. */
  statoIgnotoNoti: readonly string[] = [],
): MacroCalcolati {
  let kcal = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  const mancanti: string[] = [];
  const ambigui: string[] = [];
  const soloCotto: string[] = [];
  const statoIgnoto: string[] = [];
  const nonContati: string[] = [];
  let contieneVolumi = false;

  for (const i of ingredienti) {
    const grammi = inGrammi(i.qty, i.unit);
    if (grammi === null) {
      nonContati.push(i.name);
      continue;
    }
    if (VOLUMI.has((i.unit ?? '').toLowerCase())) contieneVolumi = true;

    // ⚠️ L'ambiguità viene PRIMA del «manca»: sono due cose diverse e portano a due azioni diverse
    // — una si risolve aggiungendo una riga alla tabella, l'altra dicendo se lo pesa crudo o cotto.
    if (ambiguiNoti.includes(i.name)) {
      ambigui.push(i.name);
      continue;
    }
    /**
     * ⚠️ SOLO DA COTTO: non si conta, e viene **prima** del «manca». Sono due cose diverse e portano
     * a due azioni diverse — qui la riga in tabella c'è, e va aggiunta quella a crudo; là l'alimento
     * non c'è affatto. Confonderle manderebbe la nutrizionista a cercare la cosa sbagliata.
     */
    if (soloCottoNoti.includes(i.name)) {
      soloCotto.push(i.name);
      continue;
    }
    /**
     * ⚠️ **Solo se la riga si può davvero contare.** Trovato dalla revisione del 19/8 sera: un nome
     * in `statoIgnotoNoti` ma **senza kcal** finiva in tutte e due le liste, e il racconto diceva
     * «l'ho contato lo stesso» e subito dopo «non è in tabella» — due frasi che si smentiscono nella
     * stessa riga, e la seconda manda a creare una riga che esiste già.
     */
    const valore = valori.get(i.name) ?? null;
    if (statoIgnotoNoti.includes(i.name) && valore && valore.kcal !== null && valore.kcal !== undefined) {
      statoIgnoto.push(i.name);
    }
    const v = valore;
    // ⚠️ Anche un alimento in tabella ma **senza kcal** conta come mancante: una riga a metà darebbe
    // un totale più basso del vero, e un totale più basso del vero è esattamente il tipo di errore
    // che nessuno nota guardando il numero.
    if (!v || v.kcal === null || v.kcal === undefined) {
      mancanti.push(i.name);
      continue;
    }
    const fattore = grammi / 100;
    kcal += v.kcal * fattore;
    protein += (v.protein ?? 0) * fattore;
    carbs += (v.carbs ?? 0) * fattore;
    fat += (v.fat ?? 0) * fattore;
  }

  return {
    kcal: Math.round(kcal),
    macros: { protein_g: arrotonda(protein), carbs_g: arrotonda(carbs), fat_g: arrotonda(fat) },
    mancanti: [...new Set(mancanti)],
    ambigui: [...new Set(ambigui)],
    soloCotto: [...new Set(soloCotto)],
    statoIgnoto: [...new Set(statoIgnoto)],
    nonContati: [...new Set(nonContati)],
    contieneVolumi,
  };
}

/** Come si raccontano, in una riga sola. */
export function raccontaMacro(m: MacroCalcolati): string {
  const righe = [
    `**${m.kcal} kcal** — proteine ${m.macros.protein_g} g, carboidrati ${m.macros.carbs_g} g, grassi ${m.macros.fat_g} g.`,
  ];
  if (m.contieneVolumi) righe.push('(i millilitri li ho contati come grammi)');
  if (m.nonContati.length) {
    righe.push(
      `Non ho contato ${m.nonContati.join(', ')}: ${m.nonContati.length === 1 ? 'non ha' : 'non hanno'} un peso. ` +
        'Se pesa, dimmi quanti grammi e rifaccio il conto.',
    );
  }
  /**
   * ⚠️ GLI ALIMENTI CHE NON HO IN TABELLA — 18/8. Erano contati (`mancanti`) e **non detti**: la
   * riga sopra il calcolo spiegava già perché un totale più basso del vero è «il tipo di errore che
   * nessuno nota guardando il numero», e poi il racconto se ne dimenticava. Chi dettava una ricetta
   * con dentro un alimento fuori tabella leggeva un totale kcal più basso del vero, senza niente
   * che glielo dicesse.
   */
  /**
   * ⚠️ SOLO DA COTTO — 19/8, dalla convenzione «nelle ricette si pesa a crudo». Va detto PRIMA dei
   * mancanti, perché è l'errore più grosso dei due: qui il numero c'è, sembra buono, e sbaglia di
   * volte. Un totale più basso del vero è il tipo di errore che nessuno nota guardando il numero.
   */
  if (m.soloCotto.length) righe.push(fraseSoloCotto(m.soloCotto));
  if (m.statoIgnoto.length) {
    righe.push(
      `Di ${m.statoIgnoto.join(', ')} la tabella non dice se il valore è a crudo o a cotto: ` +
        `${m.statoIgnoto.length === 1 ? 'l\'ho contato' : 'li ho contati'} lo stesso, ma il numero potrebbe non tornare.`,
    );
  }
  if (m.mancanti.length) {
    righe.push(
      `⚠️ Non ho i valori di ${m.mancanti.join(', ')}: ${m.mancanti.length === 1 ? 'non è' : 'non sono'} in tabella, ` +
        'quindi il totale qui sopra è più basso del vero.',
    );
  }
  if (m.ambigui.length) {
    righe.push(
      `⚠️ Di ${m.ambigui.join(', ')} ho i valori in più stati (crudo e cotto) e non so quale intendi: ` +
        'da crudo a bollito le kcal per 100 g possono ridursi di quasi tre volte, quindi non li ho contati. ' +
        'Dimmi come li pesa e rifaccio il conto.',
    );
  }
  return righe.join(' ');
}
