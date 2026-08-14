/**
 * IL PASTO CHE MANCA SI PRENDE DALLE SETTIMANE SUCCESSIVE.
 *
 * Richiesta di Simone del 14/8, testuale: «se per esempio settimana 2 digiuno intermittente giorno
 * 2 mi manca la cena vado a cercare la cena nelle settimane successive con le giuste
 * caratteristiche». Decisione in `progetto/NOTA_Pasto_Mancante_Dalle_Settimane_Successive.md`.
 *
 * ## Perché serve, e cosa NON cambia
 *
 * Dall'11/8 (§15.4) una giornata monca **si scarta**: si servono solo le complete. Quella regola ha
 * chiuso un difetto vero — una giornata con la sola colazione finiva nel piatto — ma paga un
 * prezzo: una giornata a cui manca UN pasto si butta via intera, anche quando quel pasto esiste
 * identico due settimane dopo, nello stesso ciclo, già approvato. Qui si aggiunge un gradino
 * SOPRA quella scala: prima di scartare, si ripara. Se dopo la riparazione la giornata è ancora
 * monca, la scala di prima vale identica (gemella → segnalazione).
 *
 * ## «Le giuste caratteristiche» sono garantite dalla PROVENIENZA
 *
 * Il piatto arriva dalle altre giornate **della stessa dieta e dello stesso livello**, per lo
 * **stesso slot**. Quindi è già del catalogo di quella dieta: regime, stagionalità, esclusioni e
 * allergeni della cliente restano dove sono sempre stati — a valle, in `buildScoringContext` e
 * `evaluateMeals` — e questa regola non li scavalca. ⚠️ Non si pesca in catalogo fuori dalla dieta:
 * quella non sarebbe una riparazione, sarebbe un'altra dieta.
 *
 * ## Modulo puro, come `giornate-complete.ts`
 *
 * Riceve le giornate e le restituisce riparate: nessun Prisma, nessun modulo. Si collauda con
 * giornate vere, e la stessa regola potrà servire domani al gate del catalogo.
 */
import { pastiAttesi, slotPieni, type GiornataConPasti } from '../catalog/giornate-complete';

/** Un pasto di una giornata a catalogo. Gli altri campi (kcal, note) viaggiano intatti. */
interface PastoTemplate {
  slot?: string;
  recipeId?: string;
  [k: string]: unknown;
}

export interface GiornataTemplate extends GiornataConPasti {
  dayIndex?: number;
  level?: number;
}

/** Da dove è arrivato il pasto: si racconta, sempre. Un ripiego nascosto è un errore. */
export interface PastoPreso {
  slot: string;
  recipeId: string;
  /** Il `dayIndex` della giornata che ha prestato il piatto. */
  daGiorno: number;
}

export interface EsitoRiparazione<T extends GiornataTemplate> {
  giornata: T;
  riparata: boolean;
  prese: PastoPreso[];
}

export interface OpzioniRiparazione {
  /** Le kcal delle ricette, quando si conoscono: servono a scegliere fra più candidati. */
  kcalDi?: ReadonlyMap<string, number>;
  /** Il target calorico del giorno (`levelTargetKcal`). Senza, non si finge una scelta calorica. */
  targetKcal?: number | null;
}

const pastiDi = (g: GiornataConPasti): PastoTemplate[] =>
  Array.isArray(g.meals) ? (g.meals as PastoTemplate[]) : [];

/**
 * I candidati per uno slot, **in ordine di preferenza di distanza**: prima le giornate DOPO (dalla
 * più vicina), poi quelle PRIMA (dalla più vicina). È la richiesta di Simone — «le settimane
 * successive» — col ripiego all'indietro, perché meglio un pasto che nessun pasto e il piatto
 * resta comunque del ciclo di quella dieta.
 */
function candidatiPerSlot<T extends GiornataTemplate>(
  giornata: T,
  tutte: readonly T[],
  slot: string,
  giaNellaGiornata: ReadonlySet<string>,
): { pasto: PastoTemplate; daGiorno: number }[] {
  const mio = giornata.dayIndex ?? 0;
  const avanti: { pasto: PastoTemplate; daGiorno: number }[] = [];
  const indietro: { pasto: PastoTemplate; daGiorno: number }[] = [];

  for (const altra of tutte) {
    if (altra === giornata) continue;
    const suo = altra.dayIndex ?? 0;
    if (suo === mio) continue;
    for (const p of pastiDi(altra)) {
      if (p.slot !== slot || !p.recipeId) continue;
      // ⚠️ Mai un doppione nella stessa giornata: lo stesso piatto a pranzo e a cena è peggio del
      // buco che si sta chiudendo.
      if (giaNellaGiornata.has(p.recipeId)) continue;
      (suo > mio ? avanti : indietro).push({ pasto: p, daGiorno: suo });
    }
  }
  avanti.sort((a, b) => a.daGiorno - b.daGiorno);
  indietro.sort((a, b) => b.daGiorno - a.daGiorno);
  return [...avanti, ...indietro];
}

/** Le kcal già nel piatto di quella giornata, per quello che si riesce a leggere. */
function kcalGiaNellaGiornata(giornata: GiornataConPasti, kcalDi?: ReadonlyMap<string, number>): number {
  if (!kcalDi) return 0;
  let somma = 0;
  for (const p of pastiDi(giornata)) {
    if (p.recipeId) somma += kcalDi.get(p.recipeId) ?? 0;
  }
  return somma;
}

/**
 * Ripara UNA giornata. Restituisce la stessa istanza se non c'era niente da fare: chi chiama può
 * confrontare per identità e sapere che non è stato toccato nulla.
 *
 * ⚠️ I candidati si prendono **da `tutte` come sono state passate**: chi chiama deve passare le
 * giornate ORIGINALI del catalogo, non quelle già riparate (vedi `riparaGiornate`). Riparare da una
 * riparata farebbe propagare lo stesso piatto su mezzo ciclo.
 */
export function riparaGiornata<T extends GiornataTemplate>(
  giornata: T,
  tutte: readonly T[],
  dieta: { mealsPerDay?: number | null; fasting?: boolean | null },
  opzioni: OpzioniRiparazione = {},
): EsitoRiparazione<T> {
  const attesi = pastiAttesi(dieta);
  const pieni = slotPieni(giornata);
  const mancanti = attesi.filter((s) => !pieni.has(s));
  if (!mancanti.length) return { giornata, riparata: false, prese: [] };

  const pasti = [...pastiDi(giornata)];
  const giaDentro = new Set(pasti.map((p) => p.recipeId).filter((x): x is string => !!x));
  const prese: PastoPreso[] = [];
  let kcalCorrenti = kcalGiaNellaGiornata(giornata, opzioni.kcalDi);

  for (const slot of mancanti) {
    const candidati = candidatiPerSlot(giornata, tutte, slot, giaDentro);
    if (!candidati.length) continue;

    /**
     * A parità di provenienza comanda il TARGET CALORICO, quando lo si conosce: fra i candidati
     * vince quello che avvicina di più il totale della giornata al target del livello. Senza kcal
     * note si prende il primo in avanti — e non si finge una scelta calorica che non si è fatta.
     */
    let scelto = candidati[0];
    const target = opzioni.targetKcal ?? null;
    if (opzioni.kcalDi && target && target > 0) {
      const restanti = mancanti.length - prese.length;
      // Quanto "dovrebbe" pesare questo pasto: ciò che manca al target, spartito su quelli che
      // restano da mettere. Grezzo di proposito: serve a scegliere fra due piatti veri, non a
      // ricalcolare la dieta.
      const idealePerPasto = Math.max(0, target - kcalCorrenti) / Math.max(1, restanti);
      let migliore = Number.POSITIVE_INFINITY;
      for (const c of candidati) {
        const k = opzioni.kcalDi.get(c.pasto.recipeId as string);
        if (k === undefined) continue;
        const distanza = Math.abs(k - idealePerPasto);
        if (distanza < migliore) { migliore = distanza; scelto = c; }
      }
    }

    const recipeId = scelto.pasto.recipeId as string;
    // Si copia il pasto per intero (kcal, note e quello che il template porta con sé): rifarlo a
    // mano dallo slot e dall'id perderebbe i campi che qualcuno aggiungerà domani.
    pasti.push({ ...scelto.pasto, slot });
    giaDentro.add(recipeId);
    kcalCorrenti += opzioni.kcalDi?.get(recipeId) ?? 0;
    prese.push({ slot, recipeId, daGiorno: scelto.daGiorno });
  }

  if (!prese.length) return { giornata, riparata: false, prese: [] };

  // L'ordine dei pasti resta quello della GIORNATA: il pasto aggiunto va al suo posto, non in
  // fondo. Una merenda dopo la cena non è un errore di dati, ma è un menu che si legge male.
  const rango = new Map(attesi.map((s, i) => [s, i]));
  pasti.sort((a, b) => (rango.get(a.slot ?? '') ?? attesi.length) - (rango.get(b.slot ?? '') ?? attesi.length));

  return { giornata: { ...giornata, meals: pasti }, riparata: true, prese };
}

export interface EsitoRiparazioneGiro<T extends GiornataTemplate> {
  giornate: T[];
  riparate: number;
  /** Cosa è stato preso e da dove: va nei log e nell'evento, mai buttato via. */
  dettaglio: (PastoPreso & { dayIndex: number })[];
}

/**
 * Ripara TUTTE le giornate di un ciclo.
 *
 * ⚠️ Ogni giornata si ripara guardando le giornate **originali**, mai quelle già riparate in questo
 * stesso giro: altrimenti un piatto prestato una volta si propagherebbe a catena su mezzo ciclo, e
 * la varietà — che è la ragione per cui il ciclo ha ventotto giorni — sparirebbe senza un errore.
 */
export function riparaGiornate<T extends GiornataTemplate>(
  giornate: readonly T[],
  dieta: { mealsPerDay?: number | null; fasting?: boolean | null },
  opzioni: OpzioniRiparazione = {},
): EsitoRiparazioneGiro<T> {
  const originali = [...giornate];
  const fuori: T[] = [];
  const dettaglio: (PastoPreso & { dayIndex: number })[] = [];
  let riparate = 0;

  for (const g of originali) {
    const esito = riparaGiornata(g, originali, dieta, opzioni);
    fuori.push(esito.giornata);
    if (esito.riparata) {
      riparate += 1;
      for (const p of esito.prese) dettaglio.push({ ...p, dayIndex: g.dayIndex ?? 0 });
    }
  }
  return { giornate: fuori, riparate, dettaglio };
}
