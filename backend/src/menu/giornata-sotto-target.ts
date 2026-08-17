/**
 * LA GIORNATA CHE ESCE SOTTO IL FABBISOGNO, E CHE OGGI NON LO DICE A NESSUNO.
 *
 * Il difetto, trovato scrivendo `progetto/DECISIONE_Porzioni_Scalate_Strada_C.md` (voce 255):
 * `menu_kcal_balance_tolerance_pct` esiste, ma è usata come **filtro** e non come **controllo**.
 * `DayCombo` scarta le combinazioni fuori banda e, se non ne resta nessuna, torna `null`; da lì
 * `deliverIfEligible` compone col selettore per-slot e **eroga comunque**. Una giornata al 65% del
 * fabbisogno — Sonia, finestra «salto la cena» — esce identica a una giusta: nessun log, nessun
 * evento, nessuna riga in una diagnostica.
 *
 * ⚠️ Nello stesso file, per i **pasti** mancanti, il segnale è stato costruito il 17/8
 * (`fasting_meals_missing`, warn + `analyticsEvent` + `npm run diag:digiuni` cliente per cliente).
 * Per le **calorie** non esisteva l'equivalente: è la stessa domanda, sullo stesso codice, lasciata
 * senza risposta. Questo modulo è quella risposta, e viene PRIMA della cura (il moltiplicatore di
 * porzione, strada C) di proposito: prima si sa quante sono e chi sono, poi si cambia il piatto a
 * qualcuno.
 *
 * ⚠️ **Non blocca niente.** Una giornata scarsa è meglio di nessun menu, e il rimedio — un catalogo
 * con le porzioni giuste — non è nelle mani di chi apre l'app. Si lascia una traccia cercabile.
 *
 * Modulo **puro**: nessuna lettura, nessuna scrittura, nessun `Date.now()`. La stessa scelta di
 * `catalog/struttura-per-digiuno.ts` e di `commerce/abbonamento-in-corso.ts` — così si prova per
 * tabella, e il giudizio sta in un posto solo.
 *
 * ⚠️ La soglia NON è una costante di questo file: arriva da `menu_kcal_balance_tolerance_pct`
 * (`config_param`), che è la stessa che il motore usa per comporre. Due soglie diverse sulla stessa
 * domanda divergerebbero in un pomeriggio — è già successo il 17/8 fra il motore e `diag:digiuni`.
 */

/** Un pasto, per quello che serve qui: solo le sue calorie. */
export interface PastoConKcal {
  slot: string;
  kcal: number;
}

export interface GiornataDaControllare {
  /** La data del giorno erogato. */
  date: Date;
  meals: readonly PastoConKcal[];
}

export interface GiornataFuoriTarget {
  /** `YYYY-MM-DD`, come la scrive il resto del progetto nei log e negli eventi. */
  data: string;
  kcal: number;
  /** Negativo = sotto il target. Una cifra decimale, come `contaGiornata` di Vera. */
  scostamentoPct: number;
  /** Quanto della giornata è arrivato nel piatto: 0,65 = il 65% del fabbisogno. */
  quotaDelTarget: number;
}

/** Il totale delle kcal di una giornata. I valori non finiti contano zero, non `NaN`. */
export function kcalGiornata(meals: readonly PastoConKcal[]): number {
  return (meals ?? []).reduce((n, m) => n + (Number.isFinite(m?.kcal) ? m.kcal : 0), 0);
}

/**
 * Lo scostamento dal target, in punti percentuali con una cifra decimale.
 * ⚠️ Stessa formula e stesso arrotondamento di `vera/giornata-dettata.ts` (`contaGiornata`): due
 * numeri diversi per la stessa distanza sarebbero due verità.
 */
export function scostamentoPct(kcal: number, targetKcal: number): number {
  return Math.round(((kcal - targetKcal) / targetKcal) * 1000) / 10;
}

/**
 * Le giornate che escono **sotto** la banda del target.
 *
 * ⚠️ Solo sotto, di proposito: sopra la banda è un'altra domanda (una giornata troppo ricca) e non
 * è quella che sta togliendo calorie a qualcuno oggi. Mescolarle in un evento solo vorrebbe dire
 * non poter più contare né l'una né l'altra.
 *
 * ⚠️ Senza target (`0`, `null`, non finito) torna una lista **vuota**: «non lo so» non è «va bene»,
 * ma non è nemmeno un allarme — chi chiama sa che il target non c'era e non deve poter leggere un
 * silenzio come una conferma.
 *
 * ⚠️ Una giornata **senza pasti** non finisce qui: è già coperta dalla rete di `dayComboPools`
 * (mai una giornata vuota) e dal blocco delle intolleranze, che sono difetti diversi con un'altra
 * risposta. Qui si guarda la giornata **monca**, che è quella che passa.
 */
export function giornateSottoTarget(
  giorni: readonly GiornataDaControllare[],
  targetKcal: number | null | undefined,
  tolleranzaPct: number,
): GiornataFuoriTarget[] {
  if (!targetKcal || !Number.isFinite(targetKcal) || targetKcal <= 0) return [];
  const tolleranza = Number.isFinite(tolleranzaPct) ? Math.abs(tolleranzaPct) : 0;
  const fuori: GiornataFuoriTarget[] = [];
  for (const g of giorni ?? []) {
    if (!g?.meals?.length) continue;
    const kcal = kcalGiornata(g.meals);
    const scostamento = scostamentoPct(kcal, targetKcal);
    if (scostamento < -tolleranza) {
      fuori.push({
        data: g.date.toISOString().slice(0, 10),
        kcal,
        scostamentoPct: scostamento,
        quotaDelTarget: Math.round((kcal / targetKcal) * 100) / 100,
      });
    }
  }
  return fuori;
}

/** La peggiore delle giornate fuori target: quella che va scritta nel log, se se ne scrive una. */
export function laPeggiore(fuori: readonly GiornataFuoriTarget[]): GiornataFuoriTarget | null {
  if (!fuori?.length) return null;
  return fuori.reduce((peggio, g) => (g.scostamentoPct < peggio.scostamentoPct ? g : peggio));
}
