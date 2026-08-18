/** Mappa gli slot pasto del backend (MealSlot) su etichetta, icona e colori dell'app. */
export interface SlotInfo { label: string; icon: string; bg: string; color: string }

const SLOT: Record<string, SlotInfo> = {
  breakfast: { label: 'Colazione', icon: 'ti-coffee', bg: '#F3E8DC', color: '#B8863B' },
  morning_snack: { label: 'Spuntino', icon: 'ti-apple', bg: '#F3F9E8', color: '#4D7C0F' },
  lunch: { label: 'Pranzo', icon: 'ti-salad', bg: '#DCEBE3', color: '#12A386' },
  afternoon_snack: { label: 'Merenda', icon: 'ti-cup', bg: '#EFEAF9', color: '#6C5AB7' },
  dinner: { label: 'Cena', icon: 'ti-fish', bg: '#DCEBE3', color: '#0E7C66' },
};

export function slotInfo(slot: string): SlotInfo {
  return SLOT[slot] ?? { label: slot, icon: 'ti-tools-kitchen-2', bg: '#F2EFE8', color: '#5F6E6B' };
}

/**
 * Etichette dei metodi di cottura (`Recipe.cookingMethods[].type`).
 *
 * ⚠️ L'elenco che DECIDE sta nel backend (`common/metodi-cottura.ts`): l'app non sceglie, mostra.
 * Qui c'erano tre voci mentre il motore ne usava cinque, quindi «in padella» e «al vapore» — che
 * nei menu ci sono davvero — arrivavano alla cliente come `padella` e `vapore`, in minuscolo e con
 * l'aria di un errore.
 */
export const METHOD_LABEL: Record<string, string> = {
  veloce: 'Veloce',
  forno: 'Al forno',
  padella: 'In padella',
  vapore: 'Al vapore',
  meal_prep: 'Meal prep',
  piatto_freddo: 'Piatto freddo',
};

/**
 * L'etichetta da mostrare, con un ripiego LEGGIBILE per i codici che questa versione dell'app non
 * conosce: `piatto_freddo` → «Piatto freddo». Serve perché l'app si aggiorna dopo il backend — e
 * fra i due deploy la cliente non deve leggere un identificatore.
 */
export function etichettaMetodo(type: string | null | undefined): string {
  if (!type) return '';
  const nota = METHOD_LABEL[type];
  if (nota) return nota;
  const parole = type.replace(/_/g, ' ').trim();
  return parole.charAt(0).toUpperCase() + parole.slice(1);
}

/**
 * Una sostituzione annotata su un pasto. I primi tre campi ci sono da sempre; i grammi e
 * l'origine li valorizza solo il cambio concordato in chat con Gaia, quindi sono opzionali:
 * le giornate scritte prima si leggono ancora (vedi `backend/src/menu/pasto-giornata.ts`).
 */
export interface ApiSubstitution {
  from: string;
  to: string;
  reason: string;
  fromQty?: number;
  toQty?: number;
  unit?: string;
  /**
   * Unità del SOSTITUTO, quando è diversa da quella di partenza. Senza questo campo il menu
   * avrebbe letto «70 ml panna fresca → 70 ml burro»: il burro in millilitri non esiste, e la
   * cliente che sta cucinando è l'unica a cui quel numero serve. Assente = la stessa di `unit`,
   * che è il caso normale (vedi `unitaPerSostituto` nel backend).
   */
  unitA?: string;
  origine?: 'chat';
}

/**
 * Come si legge una sostituzione nel menu. Coi grammi quando ci sono: «100 g carote → 100 g
 * biete» dice alla cliente cosa mettere davvero nel piatto, che mentre cucina è l'unica cosa
 * che le serve sapere. Senza grammi resta la forma di sempre.
 */
export function testoSostituzione(sub: ApiSubstitution): string {
  const q = (qta?: number, unita?: string) => (qta !== undefined && qta > 0 ? `${qta}${unita ? ` ${unita}` : ''} ` : '');
  // A destra l'unità del sostituto: sono due alimenti diversi e possono misurarsi in modi diversi.
  return `${q(sub.fromQty, sub.unit)}${sub.from} → ${q(sub.toQty, sub.unitA ?? sub.unit)}${sub.to}`;
}

/**
 * ⚠️ `kcal` sono quelle che si mangiano davvero: se `porzione` c'è, sono GIÀ moltiplicate (voce
 * 255, 18/8). L'app somma i totali della giornata da queste righe — Home, Percorso in due punti —
 * e un totale calcolato sulla porzione di catalogo sarebbe sbagliato in silenzio in tre schermate.
 * `kcalBase` è la porzione di catalogo, e serve solo a spiegare da dove viene il numero.
 */
export interface ApiMeal {
  slot: string;
  recipeId: string;
  name: string;
  kcal: number;
  /** Assente = porzione di catalogo. Presente = il piatto è stato ingrandito sul fabbisogno. */
  porzione?: number;
  kcalBase?: number;
  substitutions?: ApiSubstitution[];
}

/**
 * La riga «porzione più abbondante» sotto il nome del piatto, o `null` se non c'è niente da dire.
 *
 * ⚠️ Va detta, e questa è la ragione precisa: la scheda della ricetta (`GET /recipes/:id`) mostra
 * le grammature **di catalogo**, perché non sa di quale giorno si stia parlando. Senza questa riga
 * la cliente legge «Pranzo 891 kcal», apre la ricetta e trova gli ingredienti per 500: una
 * contraddizione visibile, e nessun modo di capire quale dei due numeri sia quello giusto.
 */
export function testoPorzione(m: Pick<ApiMeal, 'porzione' | 'kcalBase'>): string | null {
  const f = m.porzione;
  if (!f || !Number.isFinite(f) || f <= 1.05) return null;
  const quante = (Math.round(f * 10) / 10).toString().replace('.', ',');
  const base = m.kcalBase ? ` (in ricetta ne trovi ${m.kcalBase})` : '';
  return `Porzione più abbondante, ×${quante} — pesa gli ingredienti per ${quante} volte${base}`;
}
export interface ApiMenuDay { id: string; date: string; meals: ApiMeal[] }
export interface ApiRecipe {
  id: string;
  name: string;
  kcal: number;
  tags?: string[];
  ingredients?: { name: string; qty?: number; unit?: string }[];
  cookingMethods?: { type: string; steps: string[] }[];
}
