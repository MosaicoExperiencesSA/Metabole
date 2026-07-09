import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProgressService } from '../signals/progress.service';
import { toDateOnly } from '../signals/signals.service';
import { EngineSignals } from './rules-evaluator';

const MOOD_SCORE: Record<string, number> = {
  great: 5,
  good: 4,
  ok: 3,
  hard: 2,
  stressed: 1,
};

/**
 * Raccoglie e sintetizza i 5 segnali (Corpo, Testa, Vita, Agenda, Gusto)
 * per il valutatore. Lo snapshot finisce in EngineDecision.inputs: ogni
 * decisione resta spiegabile a posteriori (spec 7.4).
 */
@Injectable()
export class SignalsCollectorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly progress: ProgressService,
    private readonly configParams: ConfigParamsService,
  ) {}

  async collect(clientId: string): Promise<{ signals: EngineSignals; screeningFlag: boolean }> {
    const profile = await this.prisma.clientProfile.findUnique({ where: { userId: clientId } });
    if (!profile) throw new NotFoundException('Profilo cliente non trovato');

    const today = toDateOnly();
    const sevenDaysAgo = new Date(today.getTime() - 7 * 86_400_000);

    const [progressData, checkins, ratings, lowEnergyThreshold] = await Promise.all([
      this.progress.getProgress(clientId).catch(() => null),
      this.prisma.dailyCheckin.findMany({
        where: { clientId, date: { gte: sevenDaysAgo } },
        orderBy: { date: 'desc' },
      }),
      this.prisma.recipeRating.findMany({
        where: { clientId, date: { gte: new Date(today.getTime() - 14 * 86_400_000) } },
        select: { stars: true },
      }),
      this.configParams.getNumber('low_energy_chronic_threshold', 2.5),
    ]);

    type Checkin = { mood: string; energy: number | null; stress: number | null };
    const moods = (checkins as Checkin[]).map((c) => MOOD_SCORE[c.mood] ?? 3);
    const energies = (checkins as Checkin[]).map((c) => c.energy).filter((e): e is number => e !== null);
    const stresses = (checkins as Checkin[]).map((c) => c.stress).filter((s): s is number => s !== null);
    const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : null);

    const energyAvg = avg(energies);
    // Energia bassa cronica: media sotto soglia su almeno 3 check-in con dato energia.
    const lowEnergyChronic = energies.length >= 3 && energyAvg !== null && energyAvg < lowEnergyThreshold;

    const stars = (ratings as { stars: number }[]).map((r) => r.stars);

    const prog = progressData as {
      alerts?: { stallDays: number; rapidLoss: boolean };
      trend?: { weeklyRateKg: number | null; direction: string };
      progress?: { weightPercent: number | null };
      measurementsCount?: number;
    } | null;

    const lifestyle = (profile.lifestyle ?? {}) as { work?: string; cookingTime?: string; weekdayLunch?: string };

    const signals: EngineSignals = {
      stallDays: prog?.alerts?.stallDays ?? 0,
      weeklyRateKg: prog?.trend?.weeklyRateKg ?? null,
      direction: (prog?.trend?.direction as EngineSignals['direction']) ?? 'unknown',
      rapidLoss: prog?.alerts?.rapidLoss ?? false,
      progressPercent: prog?.progress?.weightPercent ?? null,
      measurementsCount: prog?.measurementsCount ?? 0,
      moodAvg: avg(moods),
      energyAvg,
      stressAvg: avg(stresses),
      lowEnergyChronic,
      checkinsLast7: checkins.length,
      cookingTime: lifestyle.cookingTime ?? null,
      busyLifestyle:
        lifestyle.work === 'shifts' ||
        lifestyle.work === 'travel' ||
        lifestyle.weekdayLunch === 'out' ||
        lifestyle.weekdayLunch === 'on_the_go',
      upcomingEvent: false, // arriverà col calendario (M6)
      pausePeriodActive: false, // idem
      avgRating: avg(stars),
      adherenceLast7: Math.round((checkins.length / 7) * 100) / 100,
    };
    return { signals, screeningFlag: profile.screeningFlag };
  }
}
