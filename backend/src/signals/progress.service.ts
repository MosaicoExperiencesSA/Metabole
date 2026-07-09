import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  DatedValue,
  movingAverage,
  progressPercent,
  projectTargetDate,
  slopePerDay,
  stallDays,
  weeklyLossRate,
} from './stats';

/**
 * GET /me/progress: % verso l'obiettivo, tendenze su media mobile,
 * proiezione della data, giorni di stallo, flag calo rapido.
 * Ragiona SEMPRE sulla tendenza (media mobile), mai sul singolo dato (spec 7.2).
 */
@Injectable()
export class ProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configParams: ConfigParamsService,
  ) {}

  async getProgress(clientId: string) {
    const [profile, objective, measurements] = await Promise.all([
      this.prisma.clientProfile.findUnique({
        where: { userId: clientId },
        select: { startWeightKg: true, startWaistCm: true, startHipsCm: true },
      }),
      this.prisma.objective.findFirst({
        where: { clientId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.measurement.findMany({
        where: { clientId },
        orderBy: { date: 'asc' },
        take: 120,
      }),
    ]);
    if (!profile) throw new NotFoundException('Profilo non trovato: completa il questionario.');

    const [window, stallThreshold, rapidThreshold] = await Promise.all([
      this.configParams.getNumber('moving_average_window', 3),
      this.configParams.getNumber('stall_days_before_coach_alert', 6),
      this.configParams.getNumber('max_weight_change_alert_kg_week', 1.5),
    ]);

    if (measurements.length === 0) {
      return {
        measurementsCount: 0,
        message: 'Ancora nessuna misura: inserisci la prima per vedere i progressi.',
        objective,
      };
    }

    type M = { date: Date; weightKg: number; waistCm: number | null; hipsCm: number | null };
    const weights = measurements.map((m: M) => m.weightKg);
    const ma = movingAverage(weights, window);
    const maSeries: DatedValue[] = measurements.map((m: M, i: number) => ({
      date: m.date,
      value: Math.round(ma[i] * 100) / 100,
    }));

    const currentMA = maSeries[maSeries.length - 1].value;
    const latest = measurements[measurements.length - 1] as M;
    const today = new Date();

    // Pendenza sul tratto recente della media mobile (ultime ~4 finestre).
    const recentSpan = Math.max(window * 4, 6);
    const recentMA = maSeries.slice(-recentSpan);
    const rate = slopePerDay(recentMA);
    const weeklyRate = weeklyLossRate(rate);

    const target = objective?.targetWeightKg ?? null;
    const start = profile.startWeightKg ?? weights[0];

    const projection =
      target !== null ? projectTargetDate(currentMA, target, rate, today) : null;
    const stall = stallDays(maSeries, today);

    return {
      measurementsCount: measurements.length,
      current: {
        date: latest.date,
        weightKg: latest.weightKg,
        weightKgMovingAvg: currentMA,
        waistCm: latest.waistCm,
        hipsCm: latest.hipsCm,
      },
      start: { weightKg: start, waistCm: profile.startWaistCm, hipsCm: profile.startHipsCm },
      objective,
      progress: {
        weightPercent: target !== null ? progressPercent(start, currentMA, target) : null,
        lostKg: Math.round((start - currentMA) * 10) / 10,
        remainingKg: target !== null ? Math.round((currentMA - target) * 10) / 10 : null,
      },
      trend: {
        weeklyRateKg: weeklyRate, // positivo = calo
        direction:
          weeklyRate === null ? 'unknown' : weeklyRate > 0.05 ? 'down' : weeklyRate < -0.05 ? 'up' : 'flat',
        projectedTargetDate: projection,
        movingAverageWindow: window,
      },
      alerts: {
        stallDays: stall,
        stalled: stall >= stallThreshold,
        rapidLoss: weeklyRate !== null && weeklyRate > rapidThreshold,
      },
      series: maSeries.slice(-30), // per il grafico (media mobile)
    };
  }
}
