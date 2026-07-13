import { Injectable, Logger } from '@nestjs/common';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';

// Helper locale (evita import da signals.service → dipendenza circolare).
const toDateOnly = (iso: string): Date => new Date(iso.slice(0, 10) + 'T00:00:00.000Z');

type Esito = 'perso' | 'stabile' | 'preso' | 'n.d.';

interface MeasureRow {
  date: Date;
  weightKg: number;
  waistCm: number | null;
  hipsCm: number | null;
}
interface MenuDayRow {
  date: Date;
  meals: unknown;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Attribuzione causale (v1, euristica osservazionale). Invece di dare a tutte le
 * ricette del ciclo lo stesso merito/demerito, pesa il credito in base a quanto
 * ogni ricetta è "distintiva" per la cliente: una ricetta rara (pochi `samples`)
 * è la variabile che è CAMBIATA in questo ciclo, quindi la più probabile causa di
 * un esito diverso dal solito → prende (quasi) tutto il credito; le ricette-base
 * presenti sempre lo prendono scontato. Se tutte hanno la stessa frequenza il
 * credito torna uniforme (nessuna è più distintiva). Peso: w = 1/(1+alpha·samples),
 * normalizzato al massimo del ciclo. NON è una prova causale: è un modo trasparente
 * per far emergere più in fretta il pasto che sposta l'ago, restando prudente.
 */
export function distinctiveCredits(
  recipeIds: string[],
  samplesByRecipe: Map<string, number>,
  nudge: number,
  alpha: number,
): Map<string, number> {
  const a = Math.max(0, alpha);
  const weights = new Map<string, number>();
  let maxW = 0;
  for (const r of recipeIds) {
    const s = Math.max(0, samplesByRecipe.get(r) ?? 0);
    const w = 1 / (1 + a * s);
    weights.set(r, w);
    if (w > maxW) maxW = w;
  }
  const out = new Map<string, number>();
  for (const r of recipeIds) {
    const scaled = maxW > 0 ? weights.get(r)! / maxW : 1;
    out.set(r, Math.round(nudge * scaled * 1000) / 1000);
  }
  return out;
}

/**
 * Learning del motore (Metabole_Motore_Personalizzazione §4/§6).
 * Alla chiusura di un ciclo (arrivo della misura al 2° giorno) calcola l'esito
 * peso/cm dell'intera giornata/ciclo e — se il ciclo è stato seguito — aggiorna
 * i "pesi" (MenuWeight) delle ricette del ciclo. Il credito può essere uniforme
 * (v1 naive, default) oppure pesato per **distintività** (attribuzione causale v1,
 * opt-in `learning_distinctive_weighting`): la ricetta rara — quella che è CAMBIATA
 * nel ciclo — prende più credito di quelle sempre presenti (vedi `distinctiveCredits`).
 * Non lancia mai: il salvataggio della misura non deve dipendere da qui.
 */
@Injectable()
export class DietLearningService {
  private readonly logger = new Logger(DietLearningService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configParams: ConfigParamsService,
  ) {}

  /** Da chiamare dopo il salvataggio di una misura. */
  async onCycleClose(
    clientId: string,
    measurement: { date: Date; weightKg: number; waistCm: number | null; hipsCm: number | null },
  ): Promise<{ esitoPeso: Esito; esitoCm: Esito; followed: boolean } | null> {
    const [daysPerDelivery, wThr, cmThr, alpha] = await Promise.all([
      this.configParams.getNumber('menu_days_delivered', 2),
      this.configParams.getNumber('cycle_weight_delta_kg', 0.2),
      this.configParams.getNumber('cycle_cm_delta', 0.5),
      this.configParams.getNumber('learning_distinctiveness_alpha', 0.5),
    ]);
    // Attribuzione causale (distintività): opt-in, default off → credito uniforme (v1 naive).
    const distinctive = await this.configParams.getBool('learning_distinctive_weighting', false);

    const end = toDateOnly(measurement.date.toISOString());
    // Giorni del ciclo corrente = ultimi N menu day fino alla data della misura.
    const cycleDays = (await this.prisma.menuDay.findMany({
      where: { clientId, date: { lte: end } },
      orderBy: { date: 'desc' },
      take: daysPerDelivery,
      select: { date: true, meals: true },
    })) as MenuDayRow[];
    if (!cycleDays.length) return null;
    const cycleStart = toDateOnly(cycleDays[cycleDays.length - 1].date.toISOString());
    const cycleEnd = toDateOnly(cycleDays[0].date.toISOString());

    // Misura precedente (chiusura del ciclo prima): serve per il delta.
    const prev = (await this.prisma.measurement.findFirst({
      where: { clientId, date: { lt: cycleStart } },
      orderBy: { date: 'desc' },
      select: { date: true, weightKg: true, waistCm: true, hipsCm: true },
    })) as MeasureRow | null;

    let deltaWeightKg: number | null = null;
    let deltaCm: number | null = null;
    let esitoPeso: Esito = 'n.d.';
    let esitoCm: Esito = 'n.d.';
    if (prev) {
      deltaWeightKg = round1(prev.weightKg - measurement.weightKg); // perdita = positivo
      esitoPeso = deltaWeightKg > wThr ? 'perso' : deltaWeightKg < -wThr ? 'preso' : 'stabile';
      if (prev.waistCm != null && measurement.waistCm != null) {
        const prevSum = prev.waistCm + (prev.hipsCm ?? 0);
        const curSum = measurement.waistCm + (measurement.hipsCm ?? 0);
        deltaCm = round1(prevSum - curSum);
        esitoCm = deltaCm > cmThr ? 'perso' : deltaCm < -cmThr ? 'preso' : 'stabile';
      }
    }

    // "Seguito" (proxy v1): almeno un check-in nel ciclo.
    const checkin = await this.prisma.dailyCheckin.findFirst({
      where: { clientId, date: { gte: cycleStart, lte: cycleEnd } },
      select: { id: true },
    });
    const followed = !!checkin;

    await this.prisma.cycleFeedback.upsert({
      where: { clientId_cycleEnd: { clientId, cycleEnd } },
      create: { clientId, cycleStart, cycleEnd, deltaWeightKg, deltaCm, esitoPeso, esitoCm, followed },
      update: { cycleStart, deltaWeightKg, deltaCm, esitoPeso, esitoCm, followed },
    });

    // Learning: aggiorna i pesi delle ricette del ciclo SOLO se seguito e con esito noto.
    if (followed && esitoPeso !== 'n.d.') {
      const nudge = esitoPeso === 'perso' ? 1 : esitoPeso === 'preso' ? -1 : 0;
      const recipeSet = new Set<string>();
      for (const d of cycleDays) {
        for (const m of (d.meals as { recipeId?: string }[]) ?? []) if (m?.recipeId) recipeSet.add(m.recipeId);
      }
      const recipeIds = [...recipeSet];

      // Credito per ricetta: uniforme (default) oppure pesato per distintività (opt-in).
      let credits: Map<string, number>;
      if (distinctive && recipeIds.length) {
        const existing = (await this.prisma.menuWeight.findMany({
          where: { clientId, recipeId: { in: recipeIds } },
          select: { recipeId: true, samples: true },
        })) as { recipeId: string; samples: number }[];
        const samplesByRecipe = new Map(existing.map((w) => [w.recipeId, w.samples]));
        credits = distinctiveCredits(recipeIds, samplesByRecipe, nudge, alpha);
      } else {
        credits = new Map(recipeIds.map((r) => [r, nudge]));
      }

      for (const recipeId of recipeIds) {
        const inc = credits.get(recipeId) ?? nudge;
        await this.prisma.menuWeight.upsert({
          where: { clientId_recipeId: { clientId, recipeId } },
          create: { clientId, recipeId, score: inc, samples: 1 },
          update: { score: { increment: inc }, samples: { increment: 1 } },
        });
      }
    }

    return { esitoPeso, esitoCm, followed };
  }
}
