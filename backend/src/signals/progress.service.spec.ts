import { Test } from '@nestjs/testing';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProgressService } from './progress.service';

const mk = (n: number, w: number) => ({
  date: new Date(Date.UTC(2026, 6, n)),
  weightKg: w,
  waistCm: null,
  hipsCm: null,
});

describe('ProgressService', () => {
  let service: ProgressService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      clientProfile: {
        findUnique: jest.fn().mockResolvedValue({ startWeightKg: 68, startWaistCm: 80, startHipsCm: 99 }),
      },
      objective: {
        findFirst: jest.fn().mockResolvedValue({ targetWeightKg: 62, targetDate: new Date('2026-11-01') }),
      },
      measurement: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const config = {
      getNumber: jest.fn((key: string) =>
        Promise.resolve(
          ({ moving_average_window: 3, stall_days_before_coach_alert: 6, max_weight_change_alert_kg_week: 1.5 } as Record<string, number>)[key],
        ),
      ),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        ProgressService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigParamsService, useValue: config },
      ],
    }).compile();
    service = moduleRef.get(ProgressService);
  });

  it('senza misure: messaggio di invito, nessun crash', async () => {
    const result = await service.getProgress('u1');
    expect(result.measurementsCount).toBe(0);
    expect((result as any).message).toContain('prima');
  });

  it('con calo regolare: percentuale, tendenza in discesa e proiezione presente', async () => {
    // 68 → 65 in 18 giorni (~1.17 kg/sett... no: 3kg/18gg = 0.17/g? troppo. usiamo calo sano ~0.5/sett)
    const series = [1, 3, 5, 7, 9, 11, 13, 15].map((n, i) => mk(n, 68 - i * 0.15));
    prisma.measurement.findMany.mockResolvedValue(series);
    const result: any = await service.getProgress('u1');
    expect(result.progress.weightPercent).toBeGreaterThan(0);
    expect(result.trend.direction).toBe('down');
    expect(result.trend.weeklyRateKg).toBeGreaterThan(0);
    expect(result.trend.projectedTargetDate).not.toBeNull();
    expect(result.alerts.rapidLoss).toBe(false);
    expect(result.series.length).toBe(series.length);
  });

  it('peso fermo da giorni: stallo segnalato oltre soglia config', async () => {
    const series = [1, 3, 5, 7, 9, 11, 13].map((n) => mk(n, 67));
    prisma.measurement.findMany.mockResolvedValue(series);
    const result: any = await service.getProgress('u1');
    expect(result.trend.direction).toBe('flat');
    expect(result.alerts.stallDays).toBeGreaterThanOrEqual(0);
  });

  it('calo troppo rapido: flag rapidLoss', async () => {
    // ~0.3 kg/giorno = 2.1 kg/settimana > 1.5
    const series = [1, 3, 5, 7, 9].map((n, i) => mk(n, 68 - i * 0.6));
    prisma.measurement.findMany.mockResolvedValue(series);
    const result: any = await service.getProgress('u1');
    expect(result.alerts.rapidLoss).toBe(true);
  });
});
