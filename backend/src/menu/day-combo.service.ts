import { Injectable } from '@nestjs/common';
import { coppiaDellaGiornata, scartaLeCoppieGiaViste } from './coppia-pranzo-cena';

/** Ricetta candidata per uno slot, con i dati che servono alla composizione. */
export interface RecipeInfo {
  id: string;
  kcal: number;
  proteinShare: number; // quota proteica (0..1) sui macro della ricetta
  score: number; // punteggio efficacia+gradimento (già modulato dallo stato)
  /**
   * ⚠️ Il piatto contiene carne. Serve alla regola flexitariana (due volte a settimana): assente
   * = non lo sappiamo, e **non lo sappiamo non vuol dire no** — una giornata con un piatto ignoto
   * non conta come «senza carne», altrimenti il tetto si aggirerebbe da sé.
   */
  conCarne?: boolean;
}

export interface DayComboInput {
  slots: string[]; // slot richiesti, nell'ordine dei pasti (es. colazione→pranzo→cena)
  poolBySlot: Map<string, RecipeInfo[]>; // candidati per slot (dalla dieta approvata)
  targetKcal: number; // kcal obiettivo della giornata (dal livello della dieta)
  tolerancePct: number; // tolleranza kcal (es. 15 = ±15%)
  dayIndex: number; // indice del giorno nel ciclo → varietà (rotazione tra i migliori)
  proteinBand?: { min: number; max: number }; // banda quota proteica giornaliera (penalità soft)
  maxCombos?: number; // limite enumerazione completa (oltre → greedy)
  /** Se e di quanto allargare la banda kcal quando nessuna giornata ci entra. Assente = non si allarga. */
  allargamento?: Allargamento;
  /**
   * Le coppie pranzo/cena già servite di recente a questa cliente (richiesta del 26/8).
   * ⚠️ Vuoto o assente = la regola non si applica, e la composizione è quella di sempre.
   */
  coppieGiaViste?: ReadonlySet<string>;
  /**
   * Quante volte si può ancora avere carne in questa giornata (regola flexitariana, 1/9).
   * ⚠️ Assente o `Infinity` = nessun limite: è il caso di chi la regola non ce l'ha, cioè quasi tutte.
   */
  carneRestante?: number;
}

/**
 * ⚠️ **SE DEGRADI, DILLO** — decisione di Simone dell'1/9, Fase 3 del piano panieri.
 *
 * Quando nessuna combinazione entra nella banda kcal, la giornata si compone lo stesso: la banda si
 * allarga **a passi**, e si scrive di quanto. Le altre due strade erano comporre fuori banda senza
 * limite (che non degrada: mente) e tenere una giornata di riserva per paniere (38 giornate scritte
 * a mano, che invecchiano).
 *
 * ⛔ **Il tetto non è un dettaglio, è la metà che rende onesta l'altra.** Una banda che si allarga
 * finché qualcosa entra prima o poi compone una giornata che col target non c'entra più niente, e
 * dice di aver rispettato la regola. Oltre il tetto non si compone: si torna `null`, il chiamante
 * ripiega sulla giornata pre-costruita e la cosa si segnala.
 */
export interface Allargamento {
  /** Di quanti punti percentuali si allarga a ogni tentativo. */
  passoPct: number;
  /** Quanti punti percentuali in tutto si può arrivare ad aggiungere. Oltre, si rinuncia. */
  tettoPct: number;
}

/** L'esito della composizione: la giornata, e a che prezzo. */
export interface EsitoComposizione {
  giornata: { slot: string; recipeId: string }[];
  /** La tolleranza con cui è stata trovata, in punti percentuali. */
  tolleranzaUsata: number;
  /** Quanti punti sopra quella chiesta. **Zero vuol dire che non si è degradato niente.** */
  allargataDi: number;
  /**
   * ⚠️ Vero se la coppia pranzo/cena era già stata servita e si è dovuta riproporre lo stesso,
   * perché non ne restava nessun'altra dentro la banda. È un difetto di varietà dichiarato, non un
   * errore: l'alternativa sarebbe stata non comporre.
   */
  coppiaRipetuta: boolean;
  /**
   * ⚠️ Vero se il tetto della carne era esaurito e si è dovuta comporre una giornata con carne lo
   * stesso, perché dentro la banda kcal non ne restava nessuna senza. Una regola alimentare
   * sforata è un difetto da guardare; una cliente senza cena è un guasto.
   */
  carneOltreIlTetto: boolean;
}

interface Combo {
  picks: RecipeInfo[];
  kcal: number;
  score: number;
  proteinShare: number; // media (approssimata) della quota proteica dei piatti
}

/**
 * Composizione automatica di una **giornata bilanciata** (DayCombo, Fase 5 avanzata).
 * Sceglie una ricetta per ogni slot DENTRO il pool della dieta approvata in modo che
 * il totale calorico rientri nella banda del target del livello, massimizzando il
 * punteggio (efficacia appresa + gradimento) e ruotando tra le combinazioni migliori
 * per dare varietà. Algoritmo puro (nessun accesso al DB) → facile da testare.
 *
 * Non allarga mai l'insieme di ricette approvato dal nutrizionista: compone soltanto
 * combinazioni nuove degli stessi piatti. Ritorna `null` se non esiste una giornata
 * nella banda calorica (il chiamante ricade sui template composti a mano).
 *
 * ⚠️ **Dall'1/9 la banda kcal si può allargare a passi, e chi lo fa lo scrive** (`componi`): vedi
 * `Allargamento` qui sotto. Il tetto è la metà che rende onesta l'altra.
 */
@Injectable()
export class DayComboService {
  compose(input: DayComboInput): { slot: string; recipeId: string }[] | null {
    return this.componi(input)?.giornata ?? null;
  }

  /**
   * Come `compose`, ma dice anche **a che prezzo**: con quale tolleranza ha trovato la giornata e
   * di quanto ha dovuto allargare la banda.
   *
   * ⚠️ `compose` resta e chiama questo: è lo stesso conto, non una seconda strada. Chi vuole solo la
   * giornata continua a chiedere quella, chi deve scrivere che si è degradato chiede questo.
   *
   * ⛔ I candidati si calcolano **una volta sola** e si filtrano a bande crescenti. Rifare
   * l'enumerazione a ogni passo vorrebbe dire moltiplicare per quattro il lavoro proprio nel caso
   * in cui il pool è già grande — cioè nel caso in cui questo codice serve.
   */
  componi(input: DayComboInput): EsitoComposizione | null {
    const { slots, poolBySlot, targetKcal, tolerancePct, dayIndex } = input;
    if (!slots.length || targetKcal <= 0) return null;

    const pools = slots.map((s) => (poolBySlot.get(s) ?? []).filter((r) => r.kcal > 0));
    if (pools.some((p) => p.length === 0)) return null; // uno slot senza candidati → non componibile

    const cap = input.maxCombos ?? 20000;
    const total = pools.reduce((acc, p) => acc * p.length, 1);

    const candidates: Combo[] = total <= cap ? this.enumerate(pools) : [this.greedy(pools, targetKcal)];

    /**
     * ⚠️ Le tolleranze da provare, **in ordine**: prima quella chiesta, poi i passi fino al tetto.
     * Il passo a zero o negativo non allarga niente — un parametro sbagliato in `config_param` non
     * deve poter aprire la banda all'infinito, deve solo lasciare le cose come stavano.
     */
    const all = input.allargamento;
    const passo = Math.max(0, all?.passoPct ?? 0);
    const tetto = Math.max(0, all?.tettoPct ?? 0);
    const tolleranze: number[] = [tolerancePct];
    if (passo > 0 && tetto > 0) {
      for (let aggiunta = passo; aggiunta <= tetto + 1e-9; aggiunta += passo) {
        tolleranze.push(tolerancePct + Math.min(aggiunta, tetto));
      }
    }

    let valid: Combo[] = [];
    let usata = tolerancePct;
    for (const t of tolleranze) {
      const lo = targetKcal * (1 - t / 100);
      const hi = targetKcal * (1 + t / 100);
      valid = candidates.filter((c) => c.kcal >= lo && c.kcal <= hi);
      if (valid.length) { usata = t; break; }
    }
    // Nemmeno col tetto: si rinuncia, e chi ha chiamato ripiega sulla giornata pre-costruita.
    if (!valid.length) return null;

    /**
     * ⚠️ **LA COPPIA PRANZO/CENA** (richiesta di Simone, 26/8) — e sta **dopo** la scelta della
     * banda, di proposito: una coppia già vista non è un motivo per allargare le kcal. Prima si
     * decide dentro quale banda si compone, poi lì dentro si preferisce una giornata nuova.
     *
     * ⛔ E non svuota mai: se tutte le coppie in banda sono già state viste si compone lo stesso e
     * lo si dichiara. Una coppia ripetuta è un difetto di varietà; una giornata vuota è una cliente
     * senza cena.
     */
    const coppiaDelCombo = (c: Combo): string | null =>
      coppiaDellaGiornata(slots.map((slot, i) => ({ slot, recipeId: c.picks[i].id })));
    const suCoppie = scartaLeCoppieGiaViste(valid, coppiaDelCombo, input.coppieGiaViste ?? new Set());
    valid = suCoppie.restano;

    /**
     * ⚠️ **LA REGOLA FLEXITARIANA** (decisione di Simone, 1/9: due volte a settimana). Sta qui,
     * accanto alla coppia e **dopo la banda**, per la stessa ragione: la carne finita non è un
     * motivo per allargare le kcal — sarebbe una regola alimentare che compra calorie.
     *
     * ⛔ E **non lo sappiamo non vuol dire no**: un piatto di cui non conosciamo il contenuto conta
     * come carne quando il tetto è esaurito. Il verso opposto — «nel dubbio passa» — renderebbe il
     * tetto aggirabile da qualunque ricetta senza ingredienti scritti bene.
     */
    let carneOltreIlTetto = false;
    const restanti = input.carneRestante;
    if (restanti !== undefined && Number.isFinite(restanti) && restanti <= 0) {
      const senzaCarne = valid.filter((c) => c.picks.every((r) => r.conCarne === false));
      if (senzaCarne.length) valid = senzaCarne;
      else carneOltreIlTetto = true; // la rete: si compone lo stesso, e lo si dichiara
    }

    const band = input.proteinBand;
    const rank = (c: Combo): number => {
      let s = c.score;
      if (band) {
        if (c.proteinShare < band.min) s -= (band.min - c.proteinShare) * 2;
        else if (c.proteinShare > band.max) s -= (c.proteinShare - band.max) * 2;
      }
      // preferenza lieve alla vicinanza al target (a parità di punteggio)
      s -= (Math.abs(c.kcal - targetKcal) / targetKcal) * 0.05;
      return s;
    };
    valid.sort((a, b) => rank(b) - rank(a));

    // Varietà: ruota tra le migliori K combinazioni in base al giorno del ciclo.
    const k = Math.min(valid.length, 3);
    const pick = valid[((dayIndex % k) + k) % k];
    return {
      giornata: slots.map((slot, i) => ({ slot, recipeId: pick.picks[i].id })),
      tolleranzaUsata: usata,
      allargataDi: Math.max(0, usata - tolerancePct),
      coppiaRipetuta: suCoppie.ripiegato,
      carneOltreIlTetto,
    };
  }

  /** Enumerazione completa (pool piccoli): tutte le combinazioni una-ricetta-per-slot. */
  private enumerate(pools: RecipeInfo[][]): Combo[] {
    const out: Combo[] = [];
    const build = (i: number, picks: RecipeInfo[]): void => {
      if (i === pools.length) {
        out.push(this.toCombo(picks));
        return;
      }
      for (const r of pools[i]) {
        picks.push(r);
        build(i + 1, picks);
        picks.pop();
      }
    };
    build(0, []);
    return out;
  }

  /**
   * Greedy per pool grandi: parte dalla ricetta col punteggio migliore per slot, poi
   * riduce lo scarto calorico scambiando lo slot che avvicina di più al target.
   */
  private greedy(pools: RecipeInfo[][], targetKcal: number): Combo {
    const picks = pools.map((p) => [...p].sort((a, b) => b.score - a.score)[0]);
    let kcal = picks.reduce((a, r) => a + r.kcal, 0);
    for (let iter = 0; iter < pools.length * 4; iter++) {
      const diff = kcal - targetKcal;
      if (Math.abs(diff) < 1) break;
      let bestSlot = -1;
      let bestCand: RecipeInfo | null = null;
      let bestAbs = Math.abs(diff);
      for (let s = 0; s < pools.length; s++) {
        for (const cand of pools[s]) {
          if (cand.id === picks[s].id) continue;
          const newKcal = kcal - picks[s].kcal + cand.kcal;
          const abs = Math.abs(newKcal - targetKcal);
          if (abs < bestAbs - 1e-9) {
            bestAbs = abs;
            bestSlot = s;
            bestCand = cand;
          }
        }
      }
      if (bestSlot < 0 || !bestCand) break;
      kcal = kcal - picks[bestSlot].kcal + bestCand.kcal;
      picks[bestSlot] = bestCand;
    }
    return this.toCombo(picks);
  }

  private toCombo(picks: RecipeInfo[]): Combo {
    const kcal = picks.reduce((a, r) => a + r.kcal, 0);
    const score = picks.reduce((a, r) => a + r.score, 0);
    // Approssimazione: media semplice delle quote proteiche dei piatti (segnale soft).
    const proteinShare = picks.length ? picks.reduce((a, r) => a + r.proteinShare, 0) / picks.length : 0;
    return { picks: [...picks], kcal, score, proteinShare };
  }
}
