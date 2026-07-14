import { Injectable } from '@nestjs/common';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';

// Stati contestuali del ciclo (R11). Qui vive lo stato (D4); E5 lo modula sui segnali.
export const CYCLE_STATES = ['normale', 'conforto', 'rientro', 'pre_evento', 'post_evento', 'plateau'] as const;
export type CycleState = (typeof CYCLE_STATES)[number];

// Metodi di cottura (R5/R6): a parità di kcal, due preparazioni diverse nel ciclo.
const COOKING_LABEL: Record<string, string> = {
  veloce: 'Veloce',
  forno: 'Al forno',
  meal_prep: 'Meal prep',
  padella: 'In padella',
  vapore: 'Al vapore',
};

export interface MealSnapshot {
  slot: string;
  recipeId: string;
  name?: string;
  kcal?: number;
}

/**
 * R10 — Ciclo bigiornaliero attivo. Il socio già EROGA il menu 2 giorni alla volta
 * (`MenuService` → `MenuDay`) e CHIUDE il ciclo al 2° giorno (`DietLearningService` →
 * `CycleFeedback` + learning). Qui manca il pezzo "cosa sta mangiando ORA": questo
 * servizio materializza il **ciclo attivo** (`ClientCycle`) dalle giornate erogate —
 * finestra di 2 giorni, le **2 cotture** (stessa kcal, preparazioni diverse) e lo
 * **stato contestuale** (ancora per R11) — e calcola il **gradimento del ciclo**
 * (regola R10: il menu vale il MASSIMO delle stelle delle sue ricette, default 5★).
 * Additivo: legge i `MenuDay` esistenti, non tocca l'erogazione né la chiusura.
 */
@Injectable()
export class CycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configParams: ConfigParamsService,
  ) {}

  /** Ciclo attivo del cliente (le ultime N giornate erogate = finestra corrente). */
  async getActiveCycle(clientId: string) {
    const daysPerCycle = await this.configParams.getNumber('menu_days_delivered', 2);
    const days = (await this.prisma.menuDay.findMany({
      where: { clientId },
      orderBy: { date: 'desc' },
      take: daysPerCycle,
      select: { date: true, dietId: true, level: true, meals: true },
    })) as unknown as { date: Date; dietId: string; level: number; meals: unknown }[];

    if (!days.length) {
      return { active: false as const, message: 'Nessun ciclo attivo: il menu non è ancora stato erogato.' };
    }

    const cycleEnd = days[0].date;
    const cycleStart = days[days.length - 1].date;
    const dietId = days[0].dietId;

    // Ricette del ciclo (dedup) per cotture e gradimento.
    const recipeIds = new Set<string>();
    for (const d of days) for (const m of (d.meals as MealSnapshot[]) ?? []) if (m?.recipeId) recipeIds.add(m.recipeId);
    const ids = [...recipeIds];

    const [cooking, gradimento, existing, lastOutcome] = await Promise.all([
      this.pickTwoCookings(ids),
      this.menuGradimento(clientId, ids),
      this.prisma.clientCycle.findFirst({ where: { clientId, cycleEnd } as never }) as Promise<{ id: string; state: string } | null>,
      this.prisma.cycleFeedback.findFirst({
        where: { clientId },
        orderBy: { cycleEnd: 'desc' },
        select: { esitoPeso: true, esitoCm: true, followed: true, cycleEnd: true },
      }) as Promise<{ esitoPeso: string; esitoCm: string; followed: boolean; cycleEnd: Date } | null>,
    ]);

    // Lo stato si conserva tra le riletture dello stesso ciclo (default 'normale').
    const state = (existing?.state as CycleState) ?? 'normale';
    const data = {
      clientId, dietId, cycleStart, cycleEnd,
      cookingG1: cooking.g1, cookingG2: cooking.g2, state, status: 'active',
    };
    if (existing) {
      await this.prisma.clientCycle.update({ where: { id: existing.id }, data: { ...data } as never });
    } else {
      await this.prisma.clientCycle.create({ data: data as never });
    }

    return {
      active: true as const,
      cycleStart,
      cycleEnd,
      state,
      cooking: {
        g1: cooking.g1, g2: cooking.g2,
        g1Label: COOKING_LABEL[cooking.g1] ?? cooking.g1,
        g2Label: COOKING_LABEL[cooking.g2] ?? cooking.g2,
      },
      gradimento, // max stelle del ciclo (default 5)
      lastOutcome: lastOutcome ? { esitoPeso: lastOutcome.esitoPeso, esitoCm: lastOutcome.esitoCm, followed: lastOutcome.followed } : null,
      days: days.map((d) => ({ date: d.date, meals: (d.meals as MealSnapshot[]) ?? [] })),
    };
  }

  /**
   * Regola gradimento R10: il gradimento di un menu è il MASSIMO delle stelle date
   * alle sue ricette (non la media); se una ricetta non è ancora stata valutata vale
   * il default (5★, ottimista). Il gradimento del ciclo è il minimo tra i menu — cioè
   * il "pasto peggiore" traina, per non ripetere ciò che non piace.
   */
  async menuGradimento(clientId: string, recipeIds: string[]): Promise<number> {
    const def = await this.configParams.getNumber('cycle_default_rating', 5);
    if (!recipeIds.length) return def;
    const ratings = (await this.prisma.recipeRating.findMany({
      where: { clientId, recipeId: { in: recipeIds } },
      select: { recipeId: true, stars: true },
    })) as { recipeId: string; stars: number }[];
    const maxByRecipe = new Map<string, number>();
    for (const r of ratings) maxByRecipe.set(r.recipeId, Math.max(maxByRecipe.get(r.recipeId) ?? 0, r.stars));
    // Ogni ricetta = max delle sue stelle (default se mai valutata); il ciclo = il minimo tra queste.
    let cycleMin = def;
    for (const id of recipeIds) {
      const v = maxByRecipe.get(id) ?? def;
      if (v < cycleMin) cycleMin = v;
    }
    return cycleMin;
  }

  /** Due cotture diverse (a parità di kcal) tra quelle disponibili sulle ricette del ciclo. */
  private async pickTwoCookings(recipeIds: string[]): Promise<{ g1: string; g2: string }> {
    if (!recipeIds.length) return { g1: 'veloce', g2: 'forno' };
    const recipes = (await this.prisma.recipe.findMany({
      where: { id: { in: recipeIds } },
      select: { cookingMethods: true },
    })) as unknown as { cookingMethods: unknown }[];
    const types: string[] = [];
    for (const r of recipes) {
      for (const cm of (r.cookingMethods as { type?: string }[]) ?? []) {
        if (cm?.type && !types.includes(cm.type)) types.push(cm.type);
      }
    }
    const g1 = types[0] ?? 'veloce';
    const g2 = types[1] ?? (g1 === 'veloce' ? 'forno' : 'veloce');
    return { g1, g2 };
  }
}
