import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ConfigParamsService } from '../config-params/config-params.service';
import { I18nService } from '../i18n/i18n.service';
import { MailService } from '../mail/mail.service';
import { MenuService } from '../menu/menu.service';
import { PrismaService } from '../prisma/prisma.service';
import { MessageComposerService } from './message-composer.service';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: any;
  let mail: { sendNotificationEmail: jest.Mock };
  let menu: { pendingRatings: jest.Mock };

  beforeEach(async () => {
    prisma = {
      notification: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'n1' }),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          email: 'g@test.it',
          locale: 'it',
          clientProfile: { notificationPrefs: null },
        }),
      },
      clientProfile: {
        findUnique: jest.fn().mockResolvedValue({
          onboardingCompletedAt: new Date(),
          name: 'Giulia',
          user: { email: 'g@test.it' },
          assignedCoach: { userId: 'coach-user', displayName: 'Marta' },
          notificationPrefs: null,
        }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
      },
      dailyCheckin: {
        findUnique: jest.fn().mockResolvedValue(null), // niente check-in oggi
        findFirst: jest.fn().mockResolvedValue({ date: new Date(Date.now() - 5 * 86_400_000) }),
      },
      measurement: {
        findMany: jest.fn().mockResolvedValue([
          { date: new Date(Date.now() - 3 * 86_400_000), weightKg: 68.5, waistCm: 80 },
        ]),
      },
      event: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
      },
      engineDecision: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'dec-1',
          action: { tone: 'encouraging', timing: 'morning', menu: 'keep' },
          inputs: { signals: { stallDays: 8 } },
        }),
      },
      visit: { findMany: jest.fn().mockResolvedValue([]) },
      staff: { findUnique: jest.fn().mockResolvedValue({ userId: 'nutri-user' }) },
    };
    const config = {
      getNumber: jest.fn((key: string) =>
        Promise.resolve(
          ({ pause_deviation_trigger: 1.5, stall_days_before_coach_alert: 6, no_checkin_days_before_alert: 4 } as Record<string, number>)[key],
        ),
      ),
      getString: jest.fn().mockResolvedValue('false'), // AI composer spento
    };
    mail = { sendNotificationEmail: jest.fn().mockResolvedValue(true) };
    menu = { pendingRatings: jest.fn().mockResolvedValue([]) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationsService,
        MessageComposerService,
        I18nService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigParamsService, useValue: config },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(undefined) } },
        { provide: MailService, useValue: mail },
        { provide: MenuService, useValue: menu },
      ],
    }).compile();
    service = moduleRef.get(NotificationsService);
  });

  it('giornata tipo: messaggio del motore + promemoria + alert coach (stallo e silenzio)', async () => {
    const created = await service.generateDailyForClient('u1');
    expect(created).toContain('engine_daily'); // tono deciso dal motore
    expect(created).toContain('checkin_reminder');
    expect(created).toContain('measurement_reminder');
    expect(created).toContain('no_checkin_coach_alert'); // 5 giorni senza check-in ≥ soglia 4
    expect(created).toContain('stall_coach_alert'); // stallo 8 ≥ soglia 6
    // gli alert coach vanno alla coach, non alla cliente
    const coachCalls = prisma.notification.create.mock.calls.filter(
      (c: any) => c[0].data.userId === 'coach-user',
    );
    expect(coachCalls.length).toBe(2);
    // il messaggio del motore porta tono e tracciabilità del composer
    const engineCall = prisma.notification.create.mock.calls.find((c: any) => c[0].data.type === 'engine_daily');
    expect(engineCall[0].data.payload.tone).toBe('encouraging');
    expect(engineCall[0].data.payload.composer).toBe('template');
  });

  it('MAI due notifiche dello stesso tipo nello stesso giorno', async () => {
    prisma.notification.findFirst.mockResolvedValue({ id: 'già-esistente' });
    const created = await service.generateDailyForClient('u1');
    expect(created).toHaveLength(0);
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('check-in fatto, misure fresche e nessuna decisione: nessuna notifica inutile', async () => {
    prisma.dailyCheckin.findUnique.mockResolvedValue({ id: 'c-oggi' });
    prisma.dailyCheckin.findFirst.mockResolvedValue({ date: new Date() });
    prisma.measurement.findMany.mockResolvedValue([{ date: new Date(), weightKg: 66 }]);
    prisma.engineDecision.findFirst.mockResolvedValue(null);
    const created = await service.generateDailyForClient('u1');
    expect(created).toHaveLength(0);
  });

  it('OPT-OUT rispettato: tipo disattivato → notifica non creata', async () => {
    prisma.user.findUnique.mockResolvedValue({
      email: 'g@test.it',
      locale: 'it',
      clientProfile: { notificationPrefs: { disabledTypes: ['checkin_reminder'] } },
    });
    const sent = await service.notifyOncePerDay({ userId: 'u1', type: 'checkin_reminder', messageKey: 'checkin_reminder' });
    expect(sent).toBe(false);
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('email opzionale: parte solo se attivata e per i tipi previsti', async () => {
    prisma.user.findUnique.mockResolvedValue({
      email: 'g@test.it',
      locale: 'it',
      clientProfile: { notificationPrefs: { emailEnabled: true } },
    });
    await service.notifyOncePerDay({ userId: 'u1', type: 'visit_reminder', messageKey: 'visit_reminder', params: { when: '10/07, 15:00' } });
    expect(mail.sendNotificationEmail).toHaveBeenCalled();
    mail.sendNotificationEmail.mockClear();
    await service.notifyOncePerDay({ userId: 'u1', type: 'checkin_reminder', messageKey: 'checkin_reminder' });
    expect(mail.sendNotificationEmail).not.toHaveBeenCalled(); // tipo non email-abile
  });

  it('i18n: utente con locale en riceve il testo inglese', async () => {
    prisma.user.findUnique.mockResolvedValue({ email: 'g@t.it', locale: 'en', clientProfile: null });
    await service.notifyOncePerDay({ userId: 'u1', type: 'checkin_reminder', messageKey: 'checkin_reminder' });
    const call = prisma.notification.create.mock.calls[0][0];
    expect(call.data.payload.title).toBe('How are you today?');
  });

  it('ricette da valutare → richiamo giornaliero con conteggio', async () => {
    menu.pendingRatings.mockResolvedValue([{ recipeId: 'r1' }, { recipeId: 'r2' }]);
    const created = await service.generateDailyForClient('u1');
    expect(created).toContain('rating_request');
    const call = prisma.notification.create.mock.calls.find((c: any) => c[0].data.type === 'rating_request');
    expect(call[0].data.payload.body).toContain('2');
  });

  it('visita domani → promemoria a cliente e nutrizionista', async () => {
    prisma.visit.findMany.mockResolvedValue([
      { id: 'v1', datetime: new Date(Date.now() + 86_400_000), nutritionistId: 'staff-n' },
    ]);
    const created = await service.generateDailyForClient('u1');
    expect(created).toContain('visit_reminder');
    expect(created).toContain('visit_reminder_staff');
  });

  it('misure migliorate oggi → incoraggiamento', async () => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    prisma.measurement.findMany.mockResolvedValue([
      { date: today, weightKg: 67.2, waistCm: 78 },
      { date: new Date(today.getTime() - 2 * 86_400_000), weightKg: 68.0, waistCm: 80 },
    ]);
    const created = await service.generateDailyForClient('u1');
    expect(created).toContain('progress_cheer');
  });

  it('mini-piano in pausa: scatta oltre pause_deviation_trigger e aggiorna la fase evento', async () => {
    prisma.event.findFirst.mockResolvedValue({
      id: 'ev-pausa',
      startWeightKg: 66.5,
      mode: 'pause_period',
    });
    prisma.measurement.findMany.mockResolvedValue([{ date: new Date(), weightKg: 68.2 }]); // +1.7
    const created = await service.generateDailyForClient('u1');
    expect(created).toContain('mini_plan');
    expect(prisma.event.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { planPhaseState: 'mini_plan_active' } }),
    );
  });

  it('pausa con peso stabile: nessun mini-piano', async () => {
    prisma.event.findFirst.mockResolvedValue({ id: 'ev-pausa', startWeightKg: 66.5 });
    prisma.measurement.findMany.mockResolvedValue([{ date: new Date(), weightKg: 67.0 }]); // +0.5
    const created = await service.generateDailyForClient('u1');
    expect(created).not.toContain('mini_plan');
  });

  it('countdown pre-evento nei 3 giorni prima', async () => {
    const in2days = new Date();
    in2days.setUTCHours(0, 0, 0, 0);
    prisma.event.findMany.mockResolvedValue([
      { label: 'Matrimonio Anna', type: 'wedding', startDate: new Date(in2days.getTime() + 2 * 86_400_000) },
    ]);
    const created = await service.generateDailyForClient('u1');
    expect(created).toContain('pre_event');
    const call = prisma.notification.create.mock.calls.find((c: any) => c[0].data.type === 'pre_event');
    expect(call[0].data.payload.daysToEvent).toBe(2);
  });

  it('onboarding non completato: silenzio totale', async () => {
    prisma.clientProfile.findUnique.mockResolvedValue({ onboardingCompletedAt: null });
    const created = await service.generateDailyForClient('u1');
    expect(created).toHaveLength(0);
  });

  it('preferenze: lettura e aggiornamento (merge, non sovrascrittura cieca)', async () => {
    prisma.clientProfile.findUnique.mockResolvedValue({ notificationPrefs: { disabledTypes: ['pre_event'], emailEnabled: false } });
    const prefs = await service.updatePrefs('u1', { emailEnabled: true });
    expect(prefs).toEqual({ disabledTypes: ['pre_event'], emailEnabled: true });
    expect(prisma.clientProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { notificationPrefs: { disabledTypes: ['pre_event'], emailEnabled: true } } }),
    );
  });
});
