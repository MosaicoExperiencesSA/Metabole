/**
 * COLLEGARE UNA RICETTA A UNA GIORNATA — la parte che si può ragionare senza database.
 *
 * Richiesta di Simone dell'11/8: dal dettaglio della ricetta, poterla collegare a una dieta e a una
 * settimana, anche a più d'una, anche a una settimana che ancora non c'è.
 *
 * ## Perché una giornata e non «una settimana»
 *
 * Una settimana sono **sette giornate**, e il posto dove un piatto vive è una giornata precisa: la
 * cena di martedì, non «la cena della settimana 3». Chi collega sceglie il giorno — decisione presa
 * l'11/8 — perché l'alternativa («la prima cena libera») nasconde due cose che contano: quale
 * giornata è stata toccata, e cosa c'era prima al suo posto.
 *
 * ## Lo slot lo decide la ricetta, non chi collega
 *
 * Una ricetta ha il suo `mealSlot` (colazione, pranzo, cena…). Collegarla a una giornata vuol dire
 * metterla **in quello slot**, e quindi sostituire il piatto che c'era. Non si chiede in quale slot:
 * una cena non si serve a colazione.
 */

/** Un pasto dentro la giornata del catalogo. La forma è quella scritta in `DietDayTemplate.meals`. */
export interface PastoDiGiornata {
  slot: string;
  recipeId: string;
}

export const GIORNI_PER_SETTIMANA = 7;

/**
 * L'ORDINE DEI PASTI DENTRO LA GIORNATA CONTA, e non è ovvio.
 *
 * L'app disegna i pasti nell'ordine dell'array (`meals.map`), e il motore costruisce lo `slotPool`
 * iterando le giornate del ciclo: l'ordine della **prima giornata completa** diventa l'ordine con
 * cui ogni cliente di quella dieta vede il suo giorno. Rimettere in fondo lo slot appena toccato
 * — cosa che viene naturale scrivendo `filter(...)` seguito da un `push` — sposta la colazione dopo
 * la cena, per tutte, e nessun test se ne accorge perché la giornata è "giusta" a insiemi.
 */
const ORDINE_SLOT = ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner'];

/** Rimette i pasti nell'ordine della giornata. Gli slot sconosciuti restano in fondo, in ordine. */
export const inOrdineDiGiornata = (pasti: PastoDiGiornata[]): PastoDiGiornata[] =>
  [...pasti].sort((a, b) => {
    const ia = ORDINE_SLOT.indexOf(a.slot);
    const ib = ORDINE_SLOT.indexOf(b.slot);
    if (ia === -1 && ib === -1) return a.slot.localeCompare(b.slot);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

/** In che settimana cade una giornata: 1-7 → 1, 8-14 → 2. */
export const settimanaDi = (dayIndex: number): number =>
  Math.max(1, Math.ceil(dayIndex / GIORNI_PER_SETTIMANA));

/** I sette `dayIndex` di una settimana. */
export const giorniDi = (settimana: number): number[] =>
  Array.from({ length: GIORNI_PER_SETTIMANA }, (_, i) => (settimana - 1) * GIORNI_PER_SETTIMANA + i + 1);

/** Il posto del giorno dentro la sua settimana: 1..7. Serve solo a scriverlo a schermo. */
export const giornoNellaSettimana = (dayIndex: number): number =>
  ((dayIndex - 1) % GIORNI_PER_SETTIMANA) + 1;

/** I pasti di una giornata, letti da un JSON di cui non ci si può fidare. */
export function pastiDi(meals: unknown): PastoDiGiornata[] {
  if (!Array.isArray(meals)) return [];
  return (meals as Array<{ slot?: unknown; recipeId?: unknown }>)
    .filter((m) => typeof m?.slot === 'string' && typeof m?.recipeId === 'string' && m.recipeId)
    .map((m) => ({ slot: m.slot as string, recipeId: m.recipeId as string }));
}

/**
 * Mette la ricetta nel suo slot dentro la giornata, e dice **cosa ha sostituito**.
 *
 * Il piatto che c'era non sparisce in silenzio: torna indietro come `sostituito`, perché chi collega
 * deve poterlo leggere. Una sostituzione taciuta su un catalogo condiviso è il modo in cui un piatto
 * scelto con cura scompare senza che nessuno sappia quando.
 */
export function conRicettaNelloSlot(
  meals: unknown,
  slot: string,
  recipeId: string,
): { meals: PastoDiGiornata[]; sostituito: string | null; giaCosi: boolean } {
  const pasti = pastiDi(meals);
  const attuale = pasti.find((m) => m.slot === slot) ?? null;
  if (attuale?.recipeId === recipeId) return { meals: inOrdineDiGiornata(pasti), sostituito: null, giaCosi: true };
  return {
    meals: inOrdineDiGiornata([...pasti.filter((m) => m.slot !== slot), { slot, recipeId }]),
    sostituito: attuale?.recipeId ?? null,
    giaCosi: false,
  };
}

/**
 * Toglie la ricetta dalla giornata. Si cerca **per ricetta**, non per slot: se nel frattempo
 * qualcuno ha messo un altro piatto in quella cena, «togli questa ricetta» non deve togliere la sua.
 */
export function senzaRicetta(meals: unknown, recipeId: string): { meals: PastoDiGiornata[]; tolta: boolean } {
  const pasti = pastiDi(meals);
  const rimaste = pasti.filter((m) => m.recipeId !== recipeId);
  return { meals: inOrdineDiGiornata(rimaste), tolta: rimaste.length !== pasti.length };
}
