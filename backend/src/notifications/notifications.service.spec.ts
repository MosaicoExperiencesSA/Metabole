import { Test } from '@nestjs/testing';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      notification: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'n1' }),
        update: jest.fn(),
      },
      clientProfile: {
        findUnique: jest.fn().mockResolvedValue({
          onboardingCompletedAt: new Date(),
          name: 'Giulia',
          user: { email: 'g@test.it' },
          assignedCoach: { userId: 'coach-user', displayName: 'Marta' },
        }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      dailyCheckin: {
        findUnique: jest.fn().mockResolvedValue(null), // niente check-in oggi
        findFirst: jest.fn().mockResolvedValue({ date: new Date(Date.now() - 5 * 86_400_000) }),
      },
      measurement: {
        findFirst: jest.fn().mockResolvedValue({ date: new Date(Date.now() - 3 * 86_400_000), weightKg: 68.5 }),
      },
      event: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
      },
      engineDecision: {
        findFirst: jest.fn().mockResolvedValue({ inputs: { signals: { stallDays: 8 } } }),
      },
    };
    const config = {
      getNumber: jest.fn((key: string) =>
        Promise.resolve(
          ({ pause_deviation_trigger: 1.5, stall_days_before_coach_alert: 6, no_checkin_days_before_alert: 4 } as Record<string, number>)[key],
        ),
      ),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigParamsService, useValue: config },
      ],
    }).compile();
    service = moduleRef.get(NotificationsService);
  });

  it('giornata tipo: promemoria check-in e misure + alert coach (stallo e silenzio)', async () => {
    const created = await service.generateDailyForClient('u1');
    expect(created).toContain('checkin_reminder');
    expect(created).toContain('measurement_reminder');
    expect(created).toContain('no_checkin_coach_alert'); // 5 giorni senza check-in ≥ soglia 4
    expect(created).toContain('stall_coach_alert'); // stallo 8 ≥ soglia 6
    // gli alert coach vanno alla coach, non alla cliente
    const coachCalls = prisma.notification.create.mock.calls.filter(
      (c: any) => c[0].data.userId === 'coach-user',
    );
    expect(coachCalls.length).toBe(2);
  });

  it('MAI due notifiche dello stesso tipo nello stesso giorno', async () => {
    prisma.notification.findFirst.mockResolvedValue({ id: 'già-esistente' });
    const created = await service.generateDailyForClient('u1');
    expect(created).toHaveLength(0);
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('check-in fatto e misure fresche: nessun promemoria inutile', async () => {
    prisma.dailyCheckin.findUnique.mockResolvedValue({ id: 'c-oggi' });
    prisma.dailyCheckin.findFirst.mockResolvedValue({ date: new Date() });
    prisma.measurement.findFirst.mockResolvedValue({ date: new Date(), weightKg: 66 });
    prisma.engineDecision.findFirst.mockResolvedValue({ inputs: { signals: { stallDays: 0 } } });
    const created = await service.generateDailyForClient('u1');
    expect(created).toHaveLength(0);
  });

  it('mini-piano in pausa: scatta oltre pause_deviation_trigger e aggiorna la fase evento', async () => {
    prisma.event.findFirst.mockResolvedValue({
      id: 'ev-pausa',
      startWeightKg: 66.5,
      mode: 'pause_period',
    });
    prisma.measurement.findFirst.mockResolvedValue({ date: new Date(), weightKg: 68.2 }); // +1.7
    const created = await service.generateDailyForClient('u1');
    expect(created).toContain('mini_plan');
    expect(prisma.event.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { planPhaseState: 'mini_plan_active' } }),
    );
  });

  it('pausa con peso stabile: nessun mini-piano', async () => {
    prisma.event.findFirst.mockResolvedValue({ id: 'ev-pausa', startWeightKg: 66.5 });
    prisma.measurement.findFirst.mockResolvedValue({ date: new Date(), weightKg: 67.0 }); // +0.5
    const created = await service.generateDailyForClient('u1');
    expect(created).not.toContain('mini_plan');
  });

  it('countdown pre-evento nei 3 giorni prima', async () => {
    prisma.event.findMany.mockResolvedValue([
      { label: 'Matrimonio Anna', type: 'wedding', startDate: new Date(Date.now() + 2 * 86_400_000) },
    ]);
    const created = await service.generateDailyForClient('u1');
    expect(created).toContain('pre_event');
  });

  it('onboarding non completato: silenzio totale', async () => {
    prisma.clientProfile.findUnique.mockResolvedValue({ onboardingCompletedAt: null });
    const created = await service.generateDailyForClient('u1');
    expect(created).toHaveLength(0);
  });
});
