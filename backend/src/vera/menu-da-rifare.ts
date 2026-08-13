/**
 * QUALI MENU SI RIFANNO QUANDO UN DIVIETO ENTRA IN VIGORE — e quali no.
 *
 * Decisione di Simone (13/8): «si rifanno solo i giorni futuri non ancora visti». È la stessa regola
 * dell'annulla, e `MenuDay.viewedAt` esiste dalla Consegna 1 esattamente per questo.
 *
 * ⚠️ **Un menu già letto resta suo.** Rifare un giorno che una cliente ha già aperto — magari dopo
 * aver fatto la spesa — è la cosa che fa scrivere «l'app è impazzita». Il confine non è «da domani»:
 * è «da quello che non ha ancora aperto».
 *
 * ⚠️ **Si toccano solo i giorni che contengono davvero il piatto vietato.** Buttare via tutti i
 * giorni futuri della dieta sarebbe più semplice da scrivere e molto peggio da subire: si
 * rimescolerebbero menu che non c'entrano niente, per una regola su un solo alimento.
 */

export interface GiornoDaValutare {
  id: string;
  clientId: string;
  date: Date;
  viewedAt?: Date | null;
  /** Lo snapshot dei pasti: `[{slot, recipeId, name, kcal}]`. */
  meals: unknown;
}

/** Gli id delle ricette dentro lo snapshot di un giorno, comunque sia fatto. */
export function ricetteDelGiorno(meals: unknown): string[] {
  if (!Array.isArray(meals)) return [];
  return (meals as unknown[])
    .map((m) => ((m ?? {}) as { recipeId?: unknown }).recipeId)
    .filter((r): r is string => typeof r === 'string' && r.length > 0);
}

/**
 * I giorni da rifare: futuri, **non ancora aperti**, e che contengono almeno una ricetta vietata.
 *
 * @param oggi la data di riferimento (iniettabile: un test non deve dipendere da che giorno è).
 */
export function giorniDaRifare(
  giorni: readonly GiornoDaValutare[],
  vietate: ReadonlySet<string>,
  oggi: Date,
): GiornoDaValutare[] {
  if (!vietate.size) return [];
  const limite = new Date(Date.UTC(oggi.getUTCFullYear(), oggi.getUTCMonth(), oggi.getUTCDate()));
  return giorni.filter((g) => {
    if (g.viewedAt) return false; // già letto: resta suo
    if (new Date(g.date).getTime() < limite.getTime()) return false; // passato
    return ricetteDelGiorno(g.meals).some((id) => vietate.has(id));
  });
}

/** Quante persone diverse tocca. È il numero da confrontare col tetto, non quello dei giorni. */
export function clientiColpiti(giorni: readonly GiornoDaValutare[]): string[] {
  return [...new Set(giorni.map((g) => g.clientId))];
}
