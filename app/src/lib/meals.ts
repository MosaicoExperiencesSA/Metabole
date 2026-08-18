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
 * ⚠️ SOTTO QUESTO FATTORE NON SI DICE NIENTE. Un ×1,03 su 80 g di farro sono due grammi: nessuno li
 * pesa, e un avviso che compare per due grammi si impara a saltare.
 *
 * ⚠️ **Lo stesso numero sta nel backend** (`backend/src/menu/porzione-scalata.ts`,
 * `PORZIONE_DA_DIRE`), che lo usa per decidere se la scheda della ricetta mostra le grammature
 * scalate. I due devono restare uguali, o gli ingredienti cambierebbero senza che questa riga dica
 * perché. Un test per parte tiene fermo il numero.
 */
export const PORZIONE_DA_DIRE = 1.05;

/** Il fattore come si scrive: «1,8». Due decimali sono già troppi da leggere. */
const quanteVolte = (f: number): string => (Math.round(f * 10) / 10).toString().replace('.', ',');

/**
 * La riga «porzione più abbondante» sotto il nome del piatto, o `null` se non c'è niente da dire.
 *
 * ⚠️ Va detta, e questa è la ragione precisa: la cliente legge «Pranzo 891 kcal» e la ricetta di
 * catalogo è da 495. Senza una riga che lo spieghi sono due numeri che si contraddicono, e nessun
 * modo di capire quale sia quello giusto.
 *
 * ⚠️ **Non dice più «pesa gli ingredienti per 1,8 volte».** Da quando il server scala le grammature
 * della scheda (`?giorno=&slot=`), quel conto a mano è già fatto: ripeterlo qui vorrebbe dire farlo
 * fare due volte, cioè ×3,24 nel piatto. Il conto a mano resta scritto **nella scheda**, e solo nel
 * caso in cui la scheda non sia riuscita a scalare — vedi `testoIngredientiScheda`.
 */
export function testoPorzione(m: Pick<ApiMeal, 'porzione' | 'kcalBase'>): string | null {
  const f = m.porzione;
  if (!f || !Number.isFinite(f) || f <= PORZIONE_DA_DIRE) return null;
  const base = m.kcalBase ? ` (di catalogo è da ${m.kcalBase})` : '';
  return `Porzione più abbondante, ×${quanteVolte(f)} — nella ricetta trovi già le tue quantità${base}`;
}

/**
 * La riga sopra gli ingredienti, nella scheda della ricetta.
 *
 * ⚠️ **Chi comanda è la risposta del server, non quello che sa l'app.** `porzioneScheda` c'è solo se
 * il server ha davvero scalato le grammature; `porzioneMenu` è il fattore che l'app ha letto nel
 * menu. Sono due cose diverse e vanno tenute separate, perché il caso in cui divergono è proprio
 * quello che fa male: il server non ha trovato la giornata (o il piatto compare due volte con
 * fattori diversi e non sappiamo in quale pasto siamo) e la scheda è rimasta di catalogo. Lì la
 * cliente il conto a mano lo deve fare, e qualcuno glielo deve dire.
 *
 * Tre stati:
 * - scalata → «Quantità già per la tua porzione, ×1,8» (e non deve moltiplicare niente);
 * - non scalata ma il menu dice ×1,8 → «Quantità di catalogo: pesa per 1,8 volte»;
 * - porzione di catalogo → `null`, che è la stragrande maggioranza dei piatti.
 */
export function testoIngredientiScheda(p: {
  porzioneScheda?: number;
  porzioneMenu?: number;
}): { testo: string; scalata: boolean } | null {
  const scalata = p.porzioneScheda;
  if (scalata && Number.isFinite(scalata) && scalata > PORZIONE_DA_DIRE) {
    return { testo: `Quantità già per la tua porzione, ×${quanteVolte(scalata)}: pesa questi numeri`, scalata: true };
  }
  const menu = p.porzioneMenu;
  if (menu && Number.isFinite(menu) && menu > PORZIONE_DA_DIRE) {
    return {
      testo: `Quantità di catalogo: la tua porzione è ×${quanteVolte(menu)}, pesa gli ingredienti per ${quanteVolte(menu)} volte`,
      scalata: false,
    };
  }
  return null;
}
export interface ApiMenuDay { id: string; date: string; meals: ApiMeal[] }
export interface ApiRecipe {
  id: string;
  name: string;
  /** ⚠️ Con `?giorno=` sono le kcal che ha ricevuto quel giorno, non quelle di catalogo. */
  kcal: number;
  /**
   * Presenti solo quando la scheda è stata chiesta per un giorno e il server ha trovato la porzione:
   * `porzione` è la bandierina «queste grammature sono già le tue». Assente = catalogo.
   */
  porzione?: number;
  kcalBase?: number;
  tags?: string[];
  ingredients?: { name: string; qty?: number; unit?: string }[];
  cookingMethods?: { type: string; steps: string[] }[];
}
