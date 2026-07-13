import { Injectable } from '@nestjs/common';

/** Ricetta candidata per uno slot, con i dati che servono alla composizione. */
export interface RecipeInfo {
  id: string;
  kcal: number;
  proteinShare: number; // quota proteica (0..1) sui macro della ricetta
  score: number; // punteggio efficacia+gradimento (già modulato dallo stato)
}

export interface DayComboInput {
  slots: string[]; // slot richiesti, nell'ordine dei pasti (es. colazione→pranzo→cena)
  poolBySlot: Map<string, RecipeInfo[]>; // candidati per slot (dalla dieta approvata)
  targetKcal: number; // kcal obiettivo della giornata (dal livello della dieta)
  tolerancePct: number; // tolleranza kcal (es. 15 = ±15%)
  dayIndex: number; // indice del giorno nel ciclo → varietà (rotazione tra i migliori)
  proteinBand?: { min: number; max: number }; // banda quota proteica giornaliera (penalità soft)
  maxCombos?: number; // limite enumerazione completa (oltre → greedy)
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
 */
@Injectable()
export class DayComboService {
  compose(input: DayComboInput): { slot: string; recipeId: string }[] | null {
    const { slots, poolBySlot, targetKcal, tolerancePct, dayIndex } = input;
    if (!slots.length || targetKcal <= 0) return null;

    const pools = slots.map((s) => (poolBySlot.get(s) ?? []).filter((r) => r.kcal > 0));
    if (pools.some((p) => p.length === 0)) return null; // uno slot senza candidati → non componibile

    const lo = targetKcal * (1 - tolerancePct / 100);
    const hi = targetKcal * (1 + tolerancePct / 100);
    const cap = input.maxCombos ?? 20000;
    const total = pools.reduce((acc, p) => acc * p.length, 1);

    const candidates: Combo[] = total <= cap ? this.enumerate(pools) : [this.greedy(pools, targetKcal)];

    const valid = candidates.filter((c) => c.kcal >= lo && c.kcal <= hi);
    if (!valid.length) return null; // nessuna giornata nella banda → fallback ai template

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
    return slots.map((slot, i) => ({ slot, recipeId: pick.picks[i].id }));
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
