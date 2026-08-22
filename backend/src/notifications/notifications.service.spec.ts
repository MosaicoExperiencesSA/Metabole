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
import { TIMER_VERI } from '../../test/orologio-fermo';
import { giornoLocale, inizioDelGiorno, toDateOnly } from '../common/date-only';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: any;
  let mail: { sendNotificationEmail: jest.Mock };
  let menu: { pendingRatings: jest.Mock; measurementGate: jest.Mock };

  /**
   * ⛔ **UN TEST SU CHI SUONA IL CAMPANELLO DEVE DIRE CHE ORA È** (23/8).
   *
   * Questo servizio ha una regola che dipende dall'**ora**: fra le 22:00 e le 08:00 italiane non si
   * notifica nessuno. Ce n'è già un gruppo che lo verifica apposta, e quello l'orologio lo ferma.
   * Tutti gli altri no — e allora l'esito dipendeva da che ora capitava di lanciare la suite: verdi
   * di giorno, rossi di notte. Due li ha trovati `npm run test:notte`: «il sollecito misure raggiunge
   * anche chi ha il piano in coda» e «mai due notifiche dello stesso tipo nello stesso giorno», che
   * alle 00:30 non fallivano per il motivo che verificano ma perché il silenzio notturno,
   * **giustamente**, non faceva partire niente.
   *
   * ⚠️ È il caso peggiore fra i due possibili: un test che passa 22 ore su 24 sembra un test che
   * funziona, e quando diventa rosso la prima ipotesi di chiunque è che sia rotto lui — cioè si va a
   * cercare nel posto sbagliato, o peggio lo si «aggiusta» finché torna verde.
   *
   * ⛔ **L'ora si sposta, il GIORNO no.** La prima stesura fermava l'orologio a una data assoluta, e
   * così facendo rendeva questo file — l'unico in cui il passo notturno avesse trovato qualcosa —
   * **esente dal passo notturno**: `test:notte` lo avrebbe riportato in pieno giorno del 21 agosto
   * qualunque cosa stesse misurando. Adesso si prende il giorno di *adesso* — vero o finto che sia —
   * e ci si mette dentro le 10:00 di Roma: l'unica variabile che questo file deve togliere di mezzo è
   * l'ora, non il calendario.
   */
  beforeEach(() => {
    // 10:00 di Roma del giorno in corso: dentro la fascia in cui si notifica, in ogni stagione.
    const dieciDelMattino = new Date(inizioDelGiorno(giornoLocale(new Date())).getTime() + 10 * 3_600_000);
    jest.useFakeTimers({ doNotFake: TIMER_VERI as never, now: dieciDelMattino });
  });
  afterEach(() => { jest.useRealTimers(); });

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
      subscription: {
        findFirst: jest.fn().mockResolvedValue({ endDate: new Date(Date.now() + 7 * 86_400_000) }),
        // ⚠️ `findMany` e non `findFirst`: il messaggio quotidiano legge TUTTI i piani della cliente e
        // sceglie quello che eroga (`attivoInCorso`), perché due righe sono legittime e una `findFirst`
        // senza `orderBy` ne prendeva una a caso. Lo usa anche il giro dei solleciti misure.
        findMany: jest.fn().mockResolvedValue([
          { status: 'active', startDate: new Date(Date.now() - 7 * 86_400_000), endDate: new Date(Date.now() + 7 * 86_400_000) },
        ]),
      },
    };
    const config = {
      /**
       * ⛔ **IL FINTO RISPETTA IL VALORE DI SCORTA, come quello vero** (corretto il 21/8).
       *
       * Prima tornava `undefined` per ogni chiave non elencata, **ignorando il secondo argomento**.
       * `ConfigParamsService.getNumber(chiave, scorta)` invece la scorta la usa — e la differenza non
       * era teorica: la finestra di silenzio dei solleciti (`measures_nudge_end_hour`, scorta 22)
       * arrivava qui come `undefined`, e `ora >= undefined` è falso. **In ogni test di questo file la
       * guardia notturna era spenta**, e nessuno poteva accorgersene.
       */
      getNumber: jest.fn((key: string, scorta?: number) =>
        Promise.resolve(
          ({ pause_deviation_trigger: 1.5, stall_days_before_coach_alert: 6, no_checkin_days_before_alert: 4 } as Record<string, number>)[key]
            ?? scorta,
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

  /**
   * ⚠️ IL MESSAGGIO QUOTIDIANO VALE ANCHE PER CHI COMINCIA DOMANI (19/8, voce 258).
   *
   * «Il tuo piano di oggi» non si manda a chi ha il piano scaduto — il link la porterebbe a un
   * percorso finito. Ma una cliente che ha appena pagato ha **una riga sola**, in coda: leggendo i
   * soli `active` il messaggio taceva proprio nei giorni di anteprima, quelli in cui i menu si
   * compongono già e lei li può guardare. Una schermata che mostra il menu e un messaggio che dice
   * che non c'è sono la stessa app che si contraddice.
   *
   * ⚠️ Il finto Prisma qui **filtra come il database vero**: senza, il test passerebbe anche
   * leggendo i soli `active`.
   */
  /**
   * ⚠️ IL SOLLECITO DELLE MISURE VALE ANCHE PER CHI COMINCIA LUNEDÌ — 19/8, quarta revisione.
   *
   * `measurementGate` chiede la misura di partenza già nella **finestra di anteprima**, cioè prima
   * che il piano cominci. Se il giro dei solleciti guardasse i soli `active`, la cliente in coda si
   * troverebbe l'app ferma sulla schermata «servono le tue misure» senza ricevere nessuna push e
   * senza che nasca il compito per la coach: il blocco senza la richiesta, cioè la punizione senza
   * la domanda.
   *
   * ⚠️ Il finto Prisma qui **filtra come il database vero**: senza, il test passerebbe anche
   * leggendo i soli `active`.
   */
  it('⚠️ il sollecito misure raggiunge anche chi ha il piano IN CODA', async () => {
    prisma.subscription.findMany.mockImplementation(({ where }: any) => {
      const ammessi: string[] = where?.status?.in ?? [where?.status];
      return Promise.resolve(ammessi.includes('queued') ? [{ clientId: 'u1' }] : []);
    });
    menu.measurementGate.mockResolvedValue({ blocking: true, level: 'soft' });
    const esito = await service.measuresNudgeTick();
    expect(esito.controllate).toBe(1);
  });

  /**
   * ⛔ **«FRA LE 22 E LE 8 NON SI SUONA IL CAMPANELLO A NESSUNO» — e adesso è vero.**
   *
   * Era `new Date().getHours()`, cioè l'ora **del server**: su Render `TZ` non è impostata, quindi
   * UTC. D'estate il silenzio cadeva fra la **mezzanotte e le dieci** italiane — si suonava alle
   * 22:30 e si taceva alle 09:00. ⚠️ Difetto **preesistente**, non introdotto dal digiuno: trovato
   * di rimbalzo mentre scrivevo `oraLocaleInMinuti`.
   *
   * ⚠️ E il test ferma l'orologio: senza, passava o falliva a seconda dell'ora in cui girava la
   * suite — che è il modo in cui un difetto di fuso non si riproduce mai.
   */
  describe('⛔ il silenzio notturno è quello italiano', () => {
    beforeEach(() => { jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] }); });
    afterEach(() => { jest.useRealTimers(); });

    it('⛔ alle 22:30 di Roma NON si sollecita nessuno', async () => {
      jest.setSystemTime(new Date('2026-08-21T22:30:00+02:00'));
      expect(await service.measuresNudgeTick()).toEqual({ controllate: 0, sollecitate: 0, coachAvvisate: 0 });
    });

    it('⚠️ mentre alle 09:00 di Roma si sollecita, e prima non succedeva', async () => {
      jest.setSystemTime(new Date('2026-08-21T09:00:00+02:00'));
      prisma.subscription.findMany.mockResolvedValue([{ clientId: 'u1' }]);
      menu.measurementGate.mockResolvedValue({ blocking: true, level: 'soft' });
      expect((await service.measuresNudgeTick()).controllate).toBe(1);
    });
  });

  it('⚠️ col solo piano IN CODA il messaggio quotidiano parte lo stesso', async () => {
    prisma.subscription.findMany.mockImplementation(({ where }: any) => {
      const ammessi: string[] = where?.status?.in ?? [where?.status];
      const coda = { status: 'queued', startDate: new Date(Date.now() + 86_400_000), endDate: new Date(Date.now() + 90 * 86_400_000) };
      return Promise.resolve(ammessi.includes('queued') ? [coda] : []);
    });
    expect(await service.generateDailyForClient('u1')).toContain('engine_daily');
  });

  /**
   * ⚠️ E CON DUE RIGHE NON SI SCEGLIE A CASO. Una cliente con il piano che eroga **e** una coda
   * rimasta indietro con la fine già passata: un `findFirst` senza `orderBy` poteva prendere la
   * seconda, e allora il messaggio quotidiano spariva a chi il piano ce l'ha. La coda per prima,
   * di proposito: se qualcuno tornasse a prendere «la prima», si vedrebbe.
   */
  it('⚠️ fra la coda vecchia e il piano che eroga, il messaggio segue chi eroga', async () => {
    prisma.subscription.findMany.mockResolvedValue([
      { status: 'queued', startDate: new Date(Date.now() - 60 * 86_400_000), endDate: new Date(Date.now() - 30 * 86_400_000) },
      { status: 'active', startDate: new Date(Date.now() - 7 * 86_400_000), endDate: new Date(Date.now() + 7 * 86_400_000) },
    ]);
    expect(await service.generateDailyForClient('u1')).toContain('engine_daily');
  });

  /**
   * ⛔ **E LA NOTIFICA GIÀ MANDATA DEVE AVERE UNA DATA** (23/8).
   *
   * La finta riga era `{ id: 'già-esistente' }` — **senza `scheduledFor`**, che è proprio il campo
   * che il dedup legge. Il test passava lo stesso, e per una ragione che non c'entra niente con
   * quello che verifica: `Intl.DateTimeFormat.format(undefined)` non è un errore, **formatta
   * adesso**. Cioè `giornoLocale(undefined) === giornoLocale(adesso)` era vero per costruzione, e
   * questo test avrebbe continuato a essere verde anche se il confronto dei giorni fosse sparito.
   *
   * ⚠️ Si è visto solo fermando l'orologio: `Intl` legge il clock del sistema, che i finti timer di
   * jest non toccano, quindi «adesso» secondo `Intl` e «adesso» secondo `Date` diventavano due
   * giorni diversi e il buco è venuto a galla. Un test che passa per la ragione sbagliata è verde
   * esattamente come uno che funziona: è il motivo per cui vale la pena girare la suite in
   * condizioni scomode.
   *
   * ⚠️ **Cosa tiene ferma questa riga, e cosa no.** Qui la data c'è perché il campo che il dedup
   * legge deve esserci: è la fixture che diventa onesta. Che il confronto sia poi fatto **per
   * giorni** lo tengono fermo i due test del gruppo «dedup "una al giorno"», che passano una
   * notifica di oggi e una di ieri — non questo.
   */
  it('MAI due notifiche dello stesso tipo nello stesso giorno', async () => {
    prisma.notification.findFirst.mockResolvedValue({ id: 'già-esistente', scheduledFor: new Date() });
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
    const today = toDateOnly(); // mezzanotte del giorno ITALIANO: vedi la nota in testa al file
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
    const in2days = toDateOnly(); // idem: il giorno da cui contare è quello italiano
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
    const today = toDateOnly(); // mezzanotte del giorno ITALIANO: vedi la nota in testa al file
    prisma.measurement.findMany.mockResolvedValue([
      { date: today, weightKg: 68.6, waistCm: 78 }, // +0,6 kg, −2 cm
      { date: new Date(today.getTime() - 2 * 86_400_000), weightKg: 68.0, waistCm: 80 },
    ]);
    const created = await service.generateDailyForClient('u1');
    expect(created).not.toContain('progress_cheer'); // ← con il solo `||`: complimenti a chi è aumentata
  });

  it('vita aumentata ma peso in calo: nessun complimento', async () => {
    const today = toDateOnly(); // mezzanotte del giorno ITALIANO: vedi la nota in testa al file
    prisma.measurement.findMany.mockResolvedValue([
      { date: today, weightKg: 67.2, waistCm: 82 }, // −0,8 kg, +2 cm
      { date: new Date(today.getTime() - 2 * 86_400_000), weightKg: 68.0, waistCm: 80 },
    ]);
    const created = await service.generateDailyForClient('u1');
    expect(created).not.toContain('progress_cheer');
  });

  it('peso in calo e vita invariata: i complimenti restano (la correzione non è troppo severa)', async () => {
    const today = toDateOnly(); // mezzanotte del giorno ITALIANO: vedi la nota in testa al file
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
    const today = toDateOnly(); // mezzanotte del giorno ITALIANO: vedi la nota in testa al file
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
