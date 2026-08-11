/**
 * UNA GIORNATA È COMPLETA SE HA TUTTI I PASTI PREVISTI — e chi lo chiede sono in due.
 *
 * Questa regola viveva dentro `assertActivatable`, cioè dentro il controllo che si fa **una volta
 * sola**, quando qualcuno mette una dieta `clientVisible: true`. Il buco (§15.4, 11/8) è che
 * l'erogazione non se lo è mai chiesto: `pick-diet.ts` filtra su `{status: 'approved', regime,
 * mealsPerDay}` e non guarda nemmeno `clientVisible`, e `menu.service` si fermava solo alle
 * giornate **zero**. Quindi una giornata con la sola colazione veniva servita e salvata così com'è,
 * senza log e senza avviso.
 *
 * Non è un caso teorico: il generatore scrive le giornate direttamente e rompe solo se *tutti* gli
 * slot sono vuoti, e due script pubblicano diete scavalcando il gate. Una dieta può quindi
 * diventare incompleta **dopo** essere stata dichiarata a posto — e il controllo che si fa una
 * volta sola, per costruzione, non se ne accorge.
 *
 * Modulo **puro**: la regola vive in un posto, la usano il gate e l'erogazione.
 */

/** Gli slot che una giornata deve avere, secondo la struttura della dieta. */
export function pastiAttesi(diet: { mealsPerDay?: number | null; fasting?: boolean | null }): string[] {
  if (diet.fasting) return ['lunch', 'afternoon_snack', 'dinner'];
  return diet.mealsPerDay === 5
    ? ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner']
    : ['breakfast', 'lunch', 'dinner'];
}

/** Una giornata del catalogo, ridotta a quello che serve qui. */
export interface GiornataConPasti {
  meals?: unknown;
}

/** Gli slot davvero pieni di quella giornata: serve sia `slot` sia una ricetta agganciata. */
export function slotPieni(giornata: GiornataConPasti): Set<string> {
  const meals = Array.isArray(giornata.meals)
    ? (giornata.meals as Array<{ slot?: string; recipeId?: string }>)
    : [];
  return new Set(meals.filter((m) => m.slot && m.recipeId).map((m) => m.slot as string));
}

/** Vero se la giornata ha **tutti** i pasti previsti. */
export function giornataCompleta(giornata: GiornataConPasti, attesi: string[]): boolean {
  const suoi = slotPieni(giornata);
  return attesi.every((s) => suoi.has(s));
}

/**
 * Le giornate complete di una dieta, e quante ne mancano.
 *
 * Si restituisce anche il **conteggio delle monche** perché è il numero che va detto: «12 su 28
 * non hanno tutti i pasti» dice cosa fare, «la dieta è incompleta» no.
 */
export function giornateComplete<T extends GiornataConPasti>(
  giornate: T[],
  diet: { mealsPerDay?: number | null; fasting?: boolean | null },
): { complete: T[]; monche: number; attesi: string[] } {
  const attesi = pastiAttesi(diet);
  const complete = giornate.filter((g) => giornataCompleta(g, attesi));
  return { complete, monche: giornate.length - complete.length, attesi };
}

/** Come si scrive in una frase: «pranzo, cena» invece di «lunch, dinner». */
export const NOME_PASTO: Record<string, string> = {
  breakfast: 'colazione',
  morning_snack: 'spuntino',
  lunch: 'pranzo',
  afternoon_snack: 'merenda',
  dinner: 'cena',
};

/** I pasti che mancano a una giornata, in italiano e nell'ordine della giornata. */
export function pastiMancanti(giornata: GiornataConPasti, attesi: string[]): string[] {
  const suoi = slotPieni(giornata);
  return attesi.filter((s) => !suoi.has(s)).map((s) => NOME_PASTO[s] ?? s);
}
