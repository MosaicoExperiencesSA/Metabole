/**
 * Scelta della dieta per una cliente — **una sola volta, per tutti**.
 *
 * Questa logica viveva copiata in `menu.service.ts` e in `personal-base.service.ts`, identica
 * riga per riga. Due copie della stessa scala di ripieghi significano che prima o poi una delle
 * due cambia e l'altra no: il menu del giorno e la base personalizzata sicura si costruirebbero
 * su due diete diverse, senza che niente segnali il disallineamento.
 *
 * ## L'ordine dei ripieghi, dal più preciso al più largo
 *
 * 1. **famiglia + obiettivo** — il prodotto scelto in registrazione, nella fase giusta;
 * 2. **famiglia** — quel prodotto, qualsiasi obiettivo (variante non ancora creata);
 * 3. **stile + obiettivo**;
 * 4. **stile**;
 * 5. **obiettivo**;
 * 6. qualsiasi dieta con quel regime e quel piano pasti;
 * 7. (ultimo) stesso regime, ignorando il piano pasti — meglio una dieta vicina che nessun menu.
 *
 * I primi due passi sono la ragione per cui questo file esiste. Lo `style` da solo NON
 * identifica un prodotto: Vegana, Vegetariana, Flexitariana e Flessibile sono tutte `flexible`,
 * quindi la cliente ne sceglieva una e il motore poteva servirle l'altra (segnalato da Simone
 * il 6/8). La famiglia — `Diet.name`, salvata su `ClientProfile.dietFamily` — disambigua.
 *
 * Il filtro famiglia è sempre combinato con lo stile: se lo staff cambia lo stile dal
 * backoffice, la vecchia famiglia non trova più niente e si scende da sola al passo 3. È il
 * motivo per cui non serve azzerare `dietFamily` a mano quando un nutrizionista corregge la
 * scheda.
 */

import { strutturaPerFinestra } from './struttura-per-digiuno';

/** I campi del profilo che contano per l'abbinamento. Tutto il resto è irrilevante qui. */
export interface DietMatchProfile {
  regime: string | null;
  dietStyle: string | null;
  /** `Diet.name` del prodotto scelto. Null sulle clienti registrate prima del 7/8. */
  dietFamily?: string | null;
  mealsPerDay: number | null;
  objective?: string | null;
  pathType?: string | null;
  /**
   * La finestra del digiuno (`skip_dinner`, `skip_lunch`, …). Serve a scegliere un catalogo che
   * abbia i pasti che la finestra promette: vedi `struttura-per-digiuno.ts`.
   *
   * ⚠️ Chi chiama `pickDietFor` per una cliente in digiuno **deve** leggerla dal profilo. Se la
   * lascia fuori, questa funzione ricade sul catalogo digiuno — cioè sul comportamento di prima —
   * e due chiamanti dello stesso profilo sceglierebbero due diete diverse: il menu del giorno su
   * una, la base personalizzata sull'altra. È il difetto che questo file esiste per evitare.
   */
  fastingWindow?: string | null;
}

/** Come si interroga il catalogo. Il chiamante passa Prisma e si tiene i suoi tipi. */
export type TrovaDieta<T> = (where: Record<string, unknown>) => Promise<T | null>;

/**
 * ⛔ **QUALE STRUTTURA DI CATALOGO CHIEDE QUESTO PROFILO — la regola, in un posto solo.**
 *
 * Piano pasti: digiuno intermittente (`pathType`) → il catalogo che ha i pasti che la **finestra**
 * promette (`struttura-per-digiuno.ts`); altrimenti match sul numero di pasti (3/5), escludendo le
 * varianti digiuno.
 *
 * ⚠️ **Il criterio non è QUANTI pasti, è QUALI** — e scriverlo male qui è già costato un difetto. Il
 * catalogo `fasting` ha pranzo, merenda e cena: basta a chi salta la colazione (16:8), a chi mangia
 * due volte (18:6, 20:4) e a chi ne fa uno solo (23:1), anche se i numeri non coincidono. Serve il
 * catalogo a 5 pasti solo a chi ha **la colazione** fra i pasti promessi: la 14:10 e chi salta la
 * cena o il pranzo. Un commento che dice «il 5 pasti per chi ne promette quattro» fa ricavare la
 * regola sbagliata, ed è esattamente la regola sbagliata su cui è nato il falso allarme dello
 * scostamento (vedi `clients/scostamento-dieta.ts`).
 *
 * ⛔ **Sta qui, e non dentro `pickDietFor`, perché la stessa domanda la fa anche un altro punto**
 * (trovato in revisione, 21/8): `catalog/dieta-mostrata.ts` cerca «la variante esatta» per dire alla
 * scheda e all'app **quale dieta stanno seguendo**, e la cercava con `mealsPerDay` — cioè con il
 * numero scritto in profilo, che per **ogni** cliente in digiuno è `3`.
 *
 * ⚠️ Effetto: la variante digiuno della sua famiglia si trovava **sempre**, quindi «la variante
 * esatta esiste» era sempre vero, quindi `scostamentoDieta` restituiva sempre `null` e la scheda
 * continuava a scrivere «Digiuno intermittente (16:8)» **mentre il motore stava servendo la dieta di
 * un'altra famiglia**. Due punti che rispondono alla stessa domanda con due regole diverse: quello
 * che sceglie e quello che racconta. E quello che racconta mentiva.
 *
 * ⚠️ Adesso ne esiste una sola. Se un giorno nasce una terza struttura, nasce qui.
 */
export function strutturaChiesta(profile: DietMatchProfile): Record<string, unknown> {
  return profile.pathType === 'intermittent_fasting'
    ? strutturaPerFinestra(profile.fastingWindow)
    : { mealsPerDay: profile.mealsPerDay, fasting: false };
}

export async function pickDietFor<T>(trova: TrovaDieta<T>, profile: DietMatchProfile): Promise<T | null> {
  if (!profile.regime || !profile.mealsPerDay) return null;

  const base: Record<string, unknown> = { status: 'approved', regime: profile.regime, ...strutturaChiesta(profile) };

  const styleWhere = profile.dietStyle ? { style: profile.dietStyle } : {};
  // La famiglia va SEMPRE insieme allo stile: da sola potrebbe agganciare l'omonima di un altro
  // stile, e dopo un cambio di stile deve smettere di valere (vedi il commento in testa).
  const familyWhere = profile.dietFamily ? { name: profile.dietFamily, ...styleWhere } : null;
  const objWhere = { objective: profile.objective || 'dimagrimento' };

  const tentativi: Record<string, unknown>[] = [
    ...(familyWhere ? [{ ...base, ...familyWhere, ...objWhere }, { ...base, ...familyWhere }] : []),
    { ...base, ...styleWhere, ...objWhere },
    { ...base, ...styleWhere },
    { ...base, ...objWhere },
    base,
  ];
  for (const where of tentativi) {
    const trovata = await trova(where);
    if (trovata) return trovata;
  }

  // Ultimo fallback: la variante col piano pasti richiesto non esiste ancora. Meglio una dieta
  // dello stesso regime (famiglia/stile/obiettivo preferiti) che lasciare la cliente senza menu.
  const loose: Record<string, unknown> = { status: 'approved', regime: profile.regime };
  const larghi: Record<string, unknown>[] = [
    ...(familyWhere ? [{ ...loose, ...familyWhere, ...objWhere }, { ...loose, ...familyWhere }] : []),
    { ...loose, ...styleWhere, ...objWhere },
    { ...loose, ...styleWhere },
    loose,
  ];
  for (const where of larghi) {
    const trovata = await trova(where);
    if (trovata) return trovata;
  }
  return null;
}

/**
 * LO STILE DI UNA FAMIGLIA — perché la cliente sceglie la dieta, non lo stile.
 *
 * §16.10 (Simone, 11/8): «lo STILE sparisce dall'interfaccia». Nel questionario la cliente sceglie
 * un **prodotto** («Mediterranea senza glutine»), e lo stile è una proprietà di quel prodotto: non
 * una seconda domanda, e nemmeno un campo che l'app debba sapere.
 *
 * ⚠️ Serve perché lo stile **non si può semplicemente togliere**: `pickDietFor` lo usa come
 * co-filtro della famiglia («la famiglia va SEMPRE insieme allo stile», vedi sopra), e una famiglia
 * senza stile può agganciare l'omonima di un altro stile. Quindi non si smette di scriverlo: lo si
 * smette di **chiedere**, e lo si legge dal catalogo.
 *
 * ⚠️ Si guarda solo fra le diete **approvate**: una bozza non è un prodotto acquistabile, e
 * prenderne lo stile vorrebbe dire assegnare una cliente a qualcosa che nel Negozio non esiste.
 */
export async function stileDellaFamiglia<T extends { style: string }>(
  trova: TrovaDieta<T>,
  family: string | null | undefined,
): Promise<string | null> {
  if (!family) return null;
  const dieta = await trova({ status: 'approved', name: family });
  return dieta?.style ?? null;
}
