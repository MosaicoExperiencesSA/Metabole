import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ConfigParamsService } from '../config-params/config-params.service';
import { I18nService } from '../i18n/i18n.service';
import { MailService } from '../mail/mail.service';
import { MenuService } from '../menu/menu.service';
import { PrismaService } from '../prisma/prisma.service';
import { MessageComposerService } from './message-composer.service';
import { NotificationsService } from './notifications.service';
import { PushService } from './push.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: any;
  let mail: { sendNotificationEmail: jest.Mock };
  let menu: { pendingRatings: jest.Mock; measurementGate: jest.Mock };

  beforeEach(async () => {
    prisma = {
      notification: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'n1' }),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
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
      // Nessun pasto marcato "non seguita" → l'avviso alla coach resta fermo.
      recipeRating: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
      staff: { findUnique: jest.fn().mockResolvedValue({ userId: 'nutri-user' }) },
      // Piano attivo (endDate futura) → il messaggio quotidiano "piano di oggi" può partire.
      subscription: { findFirst: jest.fn().mockResolvedValue({ endDate: new Date(Date.now() + 7 * 86_400_000) }) },
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
    menu = {
      pendingRatings: jest.fn().mockResolvedValue([]),
      // Gate misure: di default "dovuta" (2° giorno del ciclo) → il promemoria scatta.
      measurementGate: jest.fn().mockResolvedValue({ required: true, blocking: true, cycleDate: null }),
    };

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
        // Le push non sono oggetto di questi test (e in test non c'è Firebase): stub silenzioso.
        // Senza questo provider l'intera suite non si avviava — PushService è entrato nel
        // costruttore di NotificationsService senza essere aggiunto qui.
        { provide: PushService, useValue: { sendToUser: jest.fn().mockResolvedValue(undefined) } },
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

  /**
   * Il dedup "una al giorno" confrontava una MEZZANOTTE con un ISTANTE. Da quando la mezzanotte
   * è quella italiana, fra le 22:00 e le 24:00 UTC quella mezzanotte è già di domani — cioè nel
   * futuro — e la finestra non trovava le notifiche appena scritte: una cliente che scriveva alla
   * coach alle 00:10 e poi alle 00:50 le faceva arrivare DUE notifiche.
   * Ora si confrontano due giorni italiani.
   */
  describe('dedup "una al giorno"', () => {
    it('già mandata oggi → non se ne manda un\'altra', async () => {
      prisma.notification.findFirst.mockResolvedValue({ scheduledFor: new Date() });
      const sent = await service.notifyOncePerDay({ userId: 'u1', type: 'checkin_reminder', messageKey: 'checkin_reminder' });
      expect(sent).toBe(false);
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it('l\'ultima è di ieri → se ne manda una nuova', async () => {
      prisma.notification.findFirst.mockResolvedValue({ scheduledFor: new Date(Date.now() - 86_400_000) });
      const sent = await service.notifyOncePerDay({ userId: 'u1', type: 'checkin_reminder', messageKey: 'checkin_reminder' });
      expect(sent).toBe(true);
      expect(prisma.notification.create).toHaveBeenCalled();
    });

    it('cerca l\'ULTIMA notifica di quel tipo, senza finestra sulle date', async () => {
      prisma.notification.findFirst.mockResolvedValue(null);
      await service.notifyOncePerDay({ userId: 'u1', type: 'checkin_reminder', messageKey: 'checkin_reminder' });
      const where = prisma.notification.findFirst.mock.calls[0][0];
      expect(where.orderBy).toEqual({ scheduledFor: 'desc' });
      expect(where.where.scheduledFor).toBeUndefined(); // niente gte/lt: era proprio quello a sbagliare
    });

    it('la finestra mobile resta un confronto fra istanti', async () => {
      prisma.notification.findFirst.mockResolvedValue({ id: 'recente' });
      const sent = await service.notifyOncePerDay({
        userId: 'u1', type: 'coach_message', messageKey: 'checkin_reminder', dedupeWindowMs: 40 * 60_000,
      });
      expect(sent).toBe(false);
      const where = prisma.notification.findFirst.mock.calls[0][0].where;
      expect(where.scheduledFor.gte).toBeInstanceOf(Date);
      expect(where.scheduledFor.lt).toBeUndefined();
    });
  });

  it('check-in fatto, misure fresche e nessuna decisione: nessuna notifica inutile', async () => {
    prisma.dailyCheckin.findUnique.mockResolvedValue({ id: 'c-oggi' });
    prisma.dailyCheckin.findFirst.mockResolvedValue({ date: new Date() });
    prisma.measurement.findMany.mockResolvedValue([{ date: new Date(), weightKg: 66 }]);
    menu.measurementGate.mockResolvedValue({ required: false, blocking: false, cycleDate: null }); // misura del ciclo già presente
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

  // «I miei dati quando non erano modificati mi diceva questo, e mi sembra quasi una presa in
  // giro.» L'`||` faceva scattare i complimenti («le tue misure sono migliorate») anche quando
  // UNA delle due misure era peggiorata in modo netto. I due casi qui sotto sono quelli in cui
  // il messaggio era, letteralmente, falso.

  it('peso aumentato ma vita in calo: nessun complimento', async () => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    prisma.measurement.findMany.mockResolvedValue([
      { date: today, weightKg: 68.6, waistCm: 78 }, // +0,6 kg, −2 cm
      { date: new Date(today.getTime() - 2 * 86_400_000), weightKg: 68.0, waistCm: 80 },
    ]);
    const created = await service.generateDailyForClient('u1');
    expect(created).not.toContain('progress_cheer'); // ← con il solo `||`: complimenti a chi è aumentata
  });

  it('vita aumentata ma peso in calo: nessun complimento', async () => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    prisma.measurement.findMany.mockResolvedValue([
      { date: today, weightKg: 67.2, waistCm: 82 }, // −0,8 kg, +2 cm
      { date: new Date(today.getTime() - 2 * 86_400_000), weightKg: 68.0, waistCm: 80 },
    ]);
    const created = await service.generateDailyForClient('u1');
    expect(created).not.toContain('progress_cheer');
  });

  it('peso in calo e vita invariata: i complimenti restano (la correzione non è troppo severa)', async () => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    prisma.measurement.findMany.mockResolvedValue([
      { date: today, weightKg: 67.2, waistCm: 80 },
      { date: new Date(today.getTime() - 2 * 86_400_000), weightKg: 68.0, waistCm: 80 },
    ]);
    const created = await service.generateDailyForClient('u1');
    expect(created).toContain('progress_cheer');
  });

  // «Se quando si inserisce il peso l'IA dovrebbe mandare un messaggio specifico per chi è
  // aumentato.» Prima chi saliva di peso non riceveva NIENTE. Ora riceve, e il testo è
  // motivazionale ma non è un complimento: complimentarsi per un aumento sarebbe la stessa
  // presa in giro di prima, al contrario.

  /** Misura di oggi + una precedente (68 kg, 80 cm), come le vede il servizio. */
  function measureToday(weightKg: number, waistCm: number) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    prisma.measurement.findMany.mockResolvedValue([
      { date: today, weightKg, waistCm },
      { date: new Date(today.getTime() - 2 * 86_400_000), weightKg: 68.0, waistCm: 80 },
    ]);
  }

  /** Payload della notifica creata per un tipo (undefined se non è stata creata). */
  function payloadOf(type: string): any {
    return prisma.notification.create.mock.calls.find((c: any) => c[0].data.type === type)?.[0].data.payload;
  }

  it('peso aumentato: la cliente riceve un messaggio, non il silenzio', async () => {
    measureToday(68.6, 80); // +0,6 kg, vita invariata
    const created = await service.generateDailyForClient('u1');
    expect(created).toContain('progress_support');
    expect(payloadOf('progress_support').weightGainKg).toBe(0.6);
  });

  it('il messaggio per chi è aumentata non si complimenta e dice il numero vero', async () => {
    measureToday(68.6, 80);
    await service.generateDailyForClient('u1');
    const { title, body } = payloadOf('progress_support');
    expect(body).toContain('0.6 kg');
    // Nessuna congratulazione, in nessuna delle varianti: è il vincolo dato dalla committente.
    expect(`${title} ${body}`).not.toMatch(/brav|complimenti|ottimo|traguardo|festeggi|🎉/i);
  });

  it('peso su ma vita giù: lo dice, invece di ridurlo al solo peso', async () => {
    measureToday(68.6, 78); // +0,6 kg, −2 cm
    const created = await service.generateDailyForClient('u1');
    expect(created).toContain('progress_support');
    expect(created).not.toContain('progress_cheer');
    const payload = payloadOf('progress_support');
    expect(payload.messageKey).toBe('progress_support_waist');
    expect(payload.waistDropCm).toBe(2);
    expect(payload.body).toContain('2 cm');
  });

  it('il servizio chiede il testo verbatim: nessuna riformulazione AI su questo messaggio', async () => {
    const spy = jest.spyOn(MessageComposerService.prototype, 'compose');
    measureToday(68.6, 80);
    await service.generateDailyForClient('u1');
    const call = spy.mock.calls.find((c) => String(c[0].key).startsWith('progress_support'));
    expect(call?.[0].verbatim).toBe(true);
    spy.mockRestore();
  });

  it('oscillazione della bilancia (+0,2 kg): silenzio, né complimenti né messaggio', async () => {
    measureToday(68.2, 80);
    const created = await service.generateDailyForClient('u1');
    expect(created).not.toContain('progress_support');
    expect(created).not.toContain('progress_cheer');
  });

  it('peso in calo: nessun messaggio di sostegno (quello è il caso dei complimenti)', async () => {
    measureToday(67.2, 80);
    const created = await service.generateDailyForClient('u1');
    expect(created).not.toContain('progress_support');
  });

  it('chi ha disattivato il tipo non lo riceve', async () => {
    prisma.user.findUnique.mockResolvedValue({
      email: 'g@test.it',
      locale: 'it',
      clientProfile: { notificationPrefs: { disabledTypes: ['progress_support'] } },
    });
    measureToday(68.6, 80);
    const created = await service.generateDailyForClient('u1');
    expect(created).not.toContain('progress_support');
  });

  // «Nella campanella avere la possibilità di poter cancellare la cronologia, una sfilza di
  // messaggi.» Si ARCHIVIA: sparisce dalla campanella, resta nel database.

  it('la campanella non mostra le notifiche archiviate', async () => {
    await service.listForUser('u1');
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: 'u1', archivedAt: null }) }),
    );
  });

  it('archiviare una notifica la marca anche come letta (non può restare nel badge)', async () => {
    prisma.notification.findFirst.mockResolvedValue({ id: 'n7', userId: 'u1', readAt: null, archivedAt: null });
    await service.archive('u1', 'n7');
    const data = prisma.notification.update.mock.calls[0][0].data;
    expect(data.archivedAt).toBeInstanceOf(Date);
    expect(data.readAt).toBeInstanceOf(Date);
  });

  it('archiviare una notifica di un\'altra utente non è possibile', async () => {
    prisma.notification.findFirst.mockResolvedValue(null); // il filtro è su id + userId
    await expect(service.archive('u1', 'n-di-un-altra')).rejects.toThrow();
    expect(prisma.notification.update).not.toHaveBeenCalled();
  });

  it('"svuota le lette" archivia solo le lette e non tocca le non lette', async () => {
    // Store finto: `updateMany` applica davvero il filtro, così il conteggio è una
    // conseguenza del where e non di un valore inventato dal mock.
    const store = [
      { id: 'a', readAt: new Date(), archivedAt: null },
      { id: 'b', readAt: null, archivedAt: null }, // mai aperta: deve restare
      { id: 'c', readAt: new Date(), archivedAt: new Date() }, // già archiviata
    ];
    prisma.notification.updateMany.mockImplementation((args: any) => {
      const hit = store.filter(
        (n) => (args.where.archivedAt === null ? n.archivedAt === null : true) &&
          (args.where.readAt?.not !== undefined ? n.readAt !== null : true),
      );
      for (const n of hit) n.archivedAt = args.data.archivedAt;
      return Promise.resolve({ count: hit.length });
    });
    const res = await service.archiveRead('u1');
    expect(res.archived).toBe(1); // solo 'a'
    expect(store.find((n) => n.id === 'b')!.archivedAt).toBeNull(); // ← la non letta resta
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
