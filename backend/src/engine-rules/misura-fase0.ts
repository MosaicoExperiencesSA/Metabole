import { SLOT_ORDINE, type CoperturaVariante, type Slot, slotAttesi, statoCopertura } from './copertura-catalogo';

/**
 * IL VERDETTO DELLA FASE 0 DEL PIANO PANIERI — la parte che decide, tenuta fuori dallo script.
 *
 * `PIANO_Panieri_Ricette.md` §9: prima di aprire la Fase 1 serve sapere se «attivi ≥ 60 per pasto su
 * tutte le celle». ⚠️ Da quella riga dipende se la Fase 6 è zero consegne o no, cioè la stima di
 * tutto il piano — quindi il conto sta qui, con le sue prove, e non dentro un file di `prisma/` che
 * nessun test guarda.
 *
 * ⛔ **Il minimo si fa sui pasti ATTESI da quella struttura, non su tutti e cinque.** Una dieta a
 * tre pasti non ha lo spuntino: contarlo come «zero attivi» la farebbe risultare sotto soglia per
 * un pasto che non esiste, e il tabulato direbbe che il catalogo è messo peggio di com'è.
 *
 * ⚠️ E si guardano gli **attivi**, non i piatti: `diag:settimane` conta i `recipeId` nominati dalle
 * giornate, che è il massimo e non l'utile (§2.4).
 *
 * ⛔ **IL CAVEAT DEL 4, che va portato qui e non lasciato nel file accanto.** `slotAttesi` sul 4
 * risponde tre pasti, mentre `slotsForMeals` del wizard conosce una giornata da quattro **con la
 * merenda** — sta scritto nel suo commento. Su una variante a quattro pasti la merenda sparirebbe
 * dal minimo e dai totali, cioè il tabulato direbbe che quella cella è più piena di com'è.
 * ⚠️ Oggi non capita: in catalogo non ci sono diete a quattro pasti e il 4 è stato tolto dal DTO.
 * Ma la misura di Fase 0 esiste per decidere, e una cosa che oggi non capita non è una cosa che non
 * può capitare — se un giorno il 4 torna, questo conto va rifatto prima di rileggerlo.
 */

export interface DietaPerMisura {
  id: string;
  mealsPerDay: number;
  fasting?: boolean | null;
}

export interface MisuraVariante {
  dietId: string;
  /** I pasti che questa struttura prevede. Vuoto = la variante non chiede nessun pasto. */
  attesi: Slot[];
  /** Il pasto messo peggio e quanti piatti attivi ha. `null` se la struttura non prevede pasti. */
  minimoAttivi: number | null;
  pastoPeggiore: Slot | null;
  piatti: number;
  attivi: number;
  rotti: number;
  clienti: number;
  stato: string;
  sottoSoglia: boolean;
}

export function misuraVariante(
  d: DietaPerMisura,
  copertura: CoperturaVariante | undefined,
  clienti: number,
  soglia: number,
  settimana?: number | null,
): MisuraVariante {
  const attesi = slotAttesi(d.mealsPerDay, !!d.fasting);
  const { stato } = statoCopertura(copertura, attesi, settimana);
  let minimoAttivi: number | null = null;
  let pastoPeggiore: Slot | null = null;
  let piatti = 0;
  let attivi = 0;
  let rotti = 0;
  for (const sl of attesi) {
    const p = copertura?.perSlot[sl] ?? { piatti: 0, attivi: 0, rotti: 0 };
    piatti += p.piatti;
    attivi += p.attivi;
    rotti += p.rotti;
    if (minimoAttivi === null || p.attivi < minimoAttivi) { minimoAttivi = p.attivi; pastoPeggiore = sl; }
  }
  return {
    dietId: d.id,
    attesi,
    minimoAttivi,
    pastoPeggiore,
    piatti,
    attivi,
    rotti,
    clienti,
    stato,
    /** ⚠️ Una struttura senza pasti attesi non è «sotto soglia»: è una domanda che non si può fare. */
    sottoSoglia: minimoAttivi !== null && minimoAttivi < soglia,
  };
}

export interface VerdettoFase0 {
  varianti: number;
  conClienti: number;
  sotto: MisuraVariante[];
  sottoConClienti: number;
  piattiTot: number;
  attiviTot: number;
  /** Nominati dalle giornate ma non attivi: è il §2.4, cioè quanto vale la differenza fra le due porte. */
  nominatiNonAttivi: number;
  rottiTot: number;
  perStato: Map<string, number>;
  /**
   * ⛔ L'uscita del piano: `true` = «si procede senza cambiare niente».
   *
   * ⚠️ **Due criteri, non uno.** La prima stesura guardava solo la soglia sugli attivi, e una
   * variante con trenta riferimenti rotti ma i pasti pieni usciva ✅ — mentre §9.1 chiede tre numeri
   * («piatti / attivi / **rotti**») e la Fase 1 pretende che i rotti vadano a zero. `rottiTot`
   * veniva calcolato, stampato, e non entrava mai nel verdetto: era ornamento.
   */
  siProcede: boolean;
  /**
   * Lo stesso verdetto contato **solo sulle varianti che hanno clienti sopra**.
   *
   * ⚠️ Serve perché il denominatore vero non è 306: il piano (§2.3) dice che le varianti magre
   * senza nessuna cliente **spariscono da sole** chiudendo le famiglie doppione. Contarle nel
   * verdetto secco lo fa uscire «no» per una ragione che il piano ha già messo in conto.
   * ⛔ Non sostituisce `siProcede`: è l'altra metà della stessa domanda, e si stampano insieme.
   */
  siProcedeSulleVive: boolean;
}

export function verdettoFase0(
  diete: readonly DietaPerMisura[],
  copertura: ReadonlyMap<string, CoperturaVariante>,
  clientiPer: ReadonlyMap<string, number>,
  soglia: number,
  settimana?: number | null,
): { misure: MisuraVariante[]; verdetto: VerdettoFase0 } {
  const misure = (diete ?? []).map((d) => misuraVariante(d, copertura.get(d.id), clientiPer.get(d.id) ?? 0, soglia, settimana));
  const perStato = new Map<string, number>();
  for (const m of misure) perStato.set(m.stato, (perStato.get(m.stato) ?? 0) + 1);
  const sotto = misure.filter((m) => m.sottoSoglia);
  const somma = (f: (m: MisuraVariante) => number) => misure.reduce((s, m) => s + f(m), 0);
  const piattiTot = somma((m) => m.piatti);
  const attiviTot = somma((m) => m.attivi);
  return {
    misure,
    verdetto: {
      varianti: misure.length,
      conClienti: misure.filter((m) => m.clienti > 0).length,
      sotto,
      sottoConClienti: sotto.filter((m) => m.clienti > 0).length,
      piattiTot,
      attiviTot,
      nominatiNonAttivi: piattiTot - attiviTot,
      rottiTot: somma((m) => m.rotti),
      perStato,
      siProcede: sotto.length === 0 && somma((m) => m.rotti) === 0,
      siProcedeSulleVive: sotto.every((m) => m.clienti === 0) && misure.every((m) => m.clienti === 0 || m.rotti === 0),
    },
  };
}

/** L'ordine in cui si guardano: prima chi ha clienti sopra, poi chi sta peggio. */
export function primaQuelleConClienti(a: MisuraVariante, b: MisuraVariante): number {
  return b.clienti - a.clienti || (a.minimoAttivi ?? 0) - (b.minimoAttivi ?? 0);
}

export { SLOT_ORDINE };
