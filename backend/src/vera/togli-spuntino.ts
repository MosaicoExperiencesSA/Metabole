/**
 * «TOGLI LO SPUNTINO» — l'azione 3 di Vera sui pasti (Decisioni 13/8 §14).
 *
 * Solo SPUNTINI (`morning_snack`, `afternoon_snack`): i pasti principali passano da
 * `fastingWindow`, che è una scelta di percorso con il suo permesso — due porte diverse apposta.
 *
 * ## ⚠️ Le kcal non si perdono
 *
 * Gli slot esclusi escono PRIMA della composizione della giornata (stessa strada del digiuno,
 * `menu.service.dayComboPools`): il target kcal del giorno si ridistribuisce sui pasti rimasti.
 * Non c'è una seconda formula da tenere allineata — è la stessa.
 *
 * ## ⚠️ «Lo spuntino» secco non si indovina
 *
 * `slots: null` vuol dire «chiedi quale»: mattina, merenda del pomeriggio, o tutti e due. È la
 * regola di tutto l'assistente — attribuire la scelta sbagliata non dà nessun errore, dà solo una
 * giornata diversa da quella che voleva.
 */

import { siPuoRifare } from './menu-da-rifare';

export type Spuntino = 'morning_snack' | 'afternoon_snack';
export const SPUNTINI: readonly Spuntino[] = ['morning_snack', 'afternoon_snack'];

export interface LetturaPasti {
  azione: 'togli' | 'rimetti';
  /** `null` = non l'ha detto: si chiede, non si indovina. */
  slots: Spuntino[] | null;
}

/**
 * ⚠️ Fra il verbo e la parola dello spuntino possono esserci SOLO articoli e rafforzativi:
 * «togli lo yogurt dallo spuntino» parla del contenuto dello spuntino, non dello slot, e deve
 * restare un divieto alimentare per il ramo dei DIVIETI — non un pasto tolto.
 */
const FRASE_PASTI =
  /\b(rimett\w*|ridai|ridacci|riaggiung\w*|togli\w*|leva\w*|elimin\w*|via|niente|senza|basta)\s+(?:(?:lo|la|il|gli|le|l'|un[oa]?|tutti(?:\s+e\s+due)?|tutte|entramb[ei]|anche|pure|più)\s+)*(spuntini|spuntino|merende|merenda)\b/iu;

const RIMETTI = /^(rimett|ridai|ridacci|riaggiung)/i;

/** Il qualificatore dopo la parola: «del pomeriggio», «di metà mattina». */
const dopoLaParola = (frase: string, daIndice: number): Spuntino[] | null => {
  const coda = frase.slice(daIndice, daIndice + 40).toLowerCase();
  const m = /^\s*(?:di|del|della|delle)?\s*(?:metà\s+)?(mattin\w*|pomeriggio|pomeridian\w*)/iu.exec(coda);
  if (!m) return null;
  return m[1].startsWith('mattin') ? ['morning_snack'] : ['afternoon_snack'];
};

/** La frase parla di togliere/rimettere uno SPUNTINO? (`null` = non è questo l'argomento.) */
export function leggiPasti(frase: string): LetturaPasti | null {
  const testo = (frase ?? '').trim();
  if (!testo) return null;
  const m = FRASE_PASTI.exec(testo);
  if (!m) return null;

  const azione: LetturaPasti['azione'] = RIMETTI.test(m[1]) ? 'rimetti' : 'togli';
  const parola = m[2].toLowerCase();

  // «merenda» È lo spuntino del pomeriggio: il nome lo dice da solo.
  if (parola.startsWith('merend')) return { azione, slots: ['afternoon_snack'] };
  // Il plurale vale per tutti e due.
  if (parola === 'spuntini') return { azione, slots: [...SPUNTINI] };

  // Il qualificatore sta subito dopo la parola trovata: «del pomeriggio», «di metà mattina».
  const slots = dopoLaParola(testo, (m.index ?? 0) + m[0].length);
  return { azione, slots };
}

/** La risposta alla domanda «quale spuntino?». `null` = non si è capito, si richiede. */
export function leggiQualeSpuntino(frase: string): Spuntino[] | null {
  const f = (frase ?? '').toLowerCase();
  if (!f.trim()) return null;
  if (/\b(tutt|entramb|due)\w*/.test(f)) return [...SPUNTINI];
  const slots: Spuntino[] = [];
  if (/mattin/.test(f)) slots.push('morning_snack');
  if (/pomerigg|merend/.test(f)) slots.push('afternoon_snack');
  return slots.length ? slots : null;
}

/** I pasti esclusi dopo la decisione. Idempotente: ridirlo non raddoppia niente. */
export function pastiDopo(attuali: readonly string[], lettura: { azione: 'togli' | 'rimetti'; slots: Spuntino[] }): string[] {
  if (lettura.azione === 'rimetti') return attuali.filter((a) => !lettura.slots.includes(a as Spuntino));
  const dopo = [...attuali];
  for (const s of lettura.slots) if (!dopo.includes(s)) dopo.push(s);
  return dopo;
}

export function etichettaSpuntino(slot: Spuntino): string {
  return slot === 'morning_snack' ? 'lo spuntino del mattino' : 'la merenda del pomeriggio';
}

export interface GiornoConPasti {
  id: string;
  clientId: string;
  date: Date;
  viewedAt: Date | null;
  meals: unknown;
}

const slotDelGiorno = (meals: unknown): string[] =>
  Array.isArray(meals)
    ? meals.map((p) => (p && typeof p === 'object' ? String((p as { slot?: unknown }).slot ?? '') : '')).filter(Boolean)
    : [];

/**
 * I giorni da rifare: futuri, MAI aperti (`viewedAt` nullo — la regola dell'annulla del §6.2), e
 * toccati davvero dalla decisione. Per il «togli» sono quelli che CONTENGONO lo spuntino; per il
 * «rimetti» il criterio si ribalta — quelli a cui MANCA, perché vanno ricomposti per riaverlo.
 */
export function giorniDaRifarePerPasti(
  giorni: readonly GiornoConPasti[],
  slots: readonly Spuntino[],
  oggi: Date,
  azione: 'togli' | 'rimetti',
): GiornoConPasti[] {
  return giorni.filter((g) => {
    /**
     * ⚠️ **La giornata di oggi si rifà** (19/8, decisione di Simone), e la risposta a «si può ancora
     * rifare?» adesso è **una sola** (`siPuoRifare`). Qui il confine era «da domani» mentre negli
     * altri due punti era «da oggi»: su una cliente che non aveva ancora aperto il menu di oggi,
     * toglierle lo spuntino non lo toglieva oggi ma vietarle un alimento sì — due comportamenti
     * diversi, nessuno dei due scritto come scelta.
     */
    if (!siPuoRifare(g, oggi)) return false;
    const presenti = slotDelGiorno(g.meals);
    return azione === 'togli'
      ? slots.some((s) => presenti.includes(s))
      : slots.some((s) => !presenti.includes(s));
  });
}
