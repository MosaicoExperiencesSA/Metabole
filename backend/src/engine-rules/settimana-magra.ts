/**
 * QUANDO UNA SETTIMANA DI CATALOGO È DAVVERO PIENA — e quando invece va riempita.
 *
 * Simone, 18/8: «le ricette ovviamente vanno sempre a riempimento delle settimane incomplete».
 * È la regola, ed era già quella del cron (`prossima-generazione.ts` mette le settimane **magre**
 * prima di quelle nuove). Ma la stessa domanda — «questa settimana è a posto?» — si rispondeva in
 * due punti diversi con due criteri diversi:
 *
 *  - `statoVarianti`, per il cron: magra = **un pasto con meno di sette piatti diversi**;
 *  - `generateCatalogFromPreset`, per il pulsante: fatta = **esiste una giornata con quel numero**.
 *
 * Il secondo criterio è il conto delle settimane, e il conto delle settimane mente: quattro
 * giornate scritte e tre mancanti fanno «settimana fatta», e chi premeva *genera* su quella
 * settimana si sentiva rispondere «c'è già» mentre in tavola c'erano quattro giorni su sette.
 *
 * Qui la risposta è una sola, e la chiamano tutti e due. ⚠️ Modulo **puro**: nessun database.
 */

/** Sette giornate, quindi sette piatti diversi per pasto: è la varietà che si promette. */
export const PIATTI_PER_PASTO = 7;
export const GIORNI_SETTIMANA = 7;

export interface GiornataInCiclo {
  dayIndex: number;
  /** Il JSON delle giornate: `[{ slot, recipeId }]`. Si accetta `unknown` perché arriva da Prisma. */
  meals: unknown;
}

/** In che settimana cade una giornata. Il giorno 1 è nella settimana 1, il 7 pure, l'8 nella 2. */
export function settimanaDelGiorno(dayIndex: number): number {
  return Math.ceil(Math.max(1, dayIndex) / GIORNI_SETTIMANA);
}

/** L'ultima settimana che ha almeno una giornata scritta. ⚠️ Dice «fin dove si arriva», non «è piena». */
export function settimaneFatteDa(giornate: readonly GiornataInCiclo[]): number {
  let massimo = 0;
  for (const g of giornate) massimo = Math.max(massimo, g.dayIndex ?? 0);
  return Math.ceil(massimo / GIORNI_SETTIMANA);
}

/** I piatti DIVERSI di ogni pasto, settimana per settimana. */
export function piattiPerSettimana(giornate: readonly GiornataInCiclo[]): Map<number, Map<string, Set<string>>> {
  const out = new Map<number, Map<string, Set<string>>>();
  for (const g of giornate) {
    const settimana = settimanaDelGiorno(g.dayIndex);
    if (!out.has(settimana)) out.set(settimana, new Map());
    const perSlot = out.get(settimana)!;
    for (const m of ((Array.isArray(g.meals) ? g.meals : []) as { slot?: string; recipeId?: string }[])) {
      if (!m?.slot || !m?.recipeId) continue;
      if (!perSlot.has(m.slot)) perSlot.set(m.slot, new Set());
      perSlot.get(m.slot)!.add(m.recipeId);
    }
  }
  return out;
}

/**
 * MAGRA = a un pasto atteso mancano piatti diversi.
 *
 * ⚠️ Si contano i piatti DIVERSI, non le giornate. Le varianti nate col metodo vecchio hanno 28
 * giornate e 19 piatti per pasto: a contare le giornate sono a posto, a tavola è la stessa
 * colazione cinque volte al mese. E una settimana che non esiste è magra, non «sconosciuta»:
 * qui la domanda è «c'è da lavorarci?», e su una settimana vuota la risposta è sì.
 */
export function settimanaMagra(
  perSlot: Map<string, Set<string>> | undefined,
  slotAttesi: readonly string[],
  perPasto = PIATTI_PER_PASTO,
): boolean {
  if (!perSlot) return true;
  return slotAttesi.some((s) => (perSlot.get(s)?.size ?? 0) < perPasto);
}

/**
 * La prima settimana ESISTENTE che è ancora magra, o `null` se sono tutte piene.
 *
 * ⚠️ Si guarda solo fino a `settimaneFatte`: la prima settimana mai aperta non è «magra», è la
 * prossima da fare — e quella la decide chi chiama, perché dipende dall'obiettivo.
 */
export function primaSettimanaMagra(
  giornate: readonly GiornataInCiclo[],
  slotAttesi: readonly string[],
  perPasto = PIATTI_PER_PASTO,
): number | null {
  const fatte = settimaneFatteDa(giornate);
  const perSett = piattiPerSettimana(giornate);
  for (let w = 1; w <= fatte; w++) {
    if (settimanaMagra(perSett.get(w), slotAttesi, perPasto)) return w;
  }
  return null;
}

/**
 * Questa settimana precisa è già piena?
 *
 * È la domanda del pulsante *genera*: «c'è già» va detto solo quando è **vero**. Su una settimana
 * a metà la risposta giusta non è «c'è già», è riempirla.
 */
export function settimanaGiaPiena(
  giornate: readonly GiornataInCiclo[],
  settimana: number,
  slotAttesi: readonly string[],
  perPasto = PIATTI_PER_PASTO,
): boolean {
  return !settimanaMagra(piattiPerSettimana(giornate).get(settimana), slotAttesi, perPasto);
}
