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
): MacroCalcolati {
  let kcal = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  const mancanti: string[] = [];
  const nonContati: string[] = [];
  let contieneVolumi = false;

  for (const i of ingredienti) {
    const grammi = inGrammi(i.qty, i.unit);
    if (grammi === null) {
      nonContati.push(i.name);
      continue;
    }
    if (VOLUMI.has((i.unit ?? '').toLowerCase())) contieneVolumi = true;

    const v = valori.get(i.name) ?? null;
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
  return righe.join(' ');
}
