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
import { aGiorno, giornoLocale, inizioDelGiorno } from '../common/date-only';

/**
 * ⛔ **NIENTE PIANO, NIENTE NOTIFICHE** (Simone, 12/9: «se un cliente non ha piani attivi va
 * staccato tutto», e vale anche per gli avvisi alla coach).
 *
 * Il difetto, misurato nel codice l'11/9: `generateDailyForClient` calcolava `hasActivePlan` e poi
 * lo guardava in **due** punti su dieci — il suggerimento 20-4 e il messaggio quotidiano del
 * motore. Tutto il resto partiva lo stesso e **non smetteva mai**: alla cliente il promemoria
 * check-in e quello delle misure ogni giorno; alla coach `no_checkin_coach_alert` ogni giorno, col
 * numero dei giorni che cresceva all'infinito.
 *
 * ⚠️ **Le fixture di questo file hanno tutto quello che serviva a far partire le notifiche** —
 * nessun check-in oggi, l'ultimo cinque giorni fa, il gate misure che chiede, una decisione del
 * motore con lo stallo oltre soglia — così l'unica cosa che cambia la risposta è il piano. Se il
 * cancello sparisce dal prodotto, questi casi diventano rossi.
 */
describe('Notifiche — il cancello del piano', () => {
  const IERI = () => new Date(Date.now() - 86_400_000);
  const FRA_UNA_SETTIMANA = () => new Date(Date.now() + 7 * 86_400_000);

  beforeEach(() => {
    // 10:00 di Roma del giorno in corso: dentro la fascia in cui si notifica, in ogni stagione.
    // ⚠️ Senza, `test:notte` renderebbe questo file verde o rosso a seconda dell'ora.
    const dieciDelMattino = new Date(inizioDelGiorno(giornoLocale(new Date())).getTime() + 10 * 3_600_000);
    jest.useFakeTimers({ doNotFake: TIMER_VERI as never, now: dieciDelMattino });
  });
  afterEach(() => { jest.useRealTimers(); });

  /**
   * Il finto Prisma. `piani` è quello che il database restituisce alla lettura degli abbonamenti;
   * tutto il resto è messo apposta perché, con un piano, le notifiche partano davvero.
   */
  function fintoPrisma(opzioni: {
    piani: unknown[];
    /** Se `true`, la lettura degli abbonamenti torna vuota quando la query filtra sul `plan`. */
    scartaSeFiltraSulPiano?: boolean;
    visite?: unknown[];
  }) {
    return {
      notification: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'n1' }),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          email: 'g@test.it', locale: 'it', clientProfile: { notificationPrefs: null },
        }),
      },
      clientProfile: {
        findUnique: jest.fn().mockResolvedValue({
          onboardingCompletedAt: new Date(Date.now() - 90 * 86_400_000),
          name: 'Giulia',
          user: { email: 'g@test.it' },
          assignedCoach: { userId: 'coach-user', displayName: 'Marta' },
          notificationPrefs: null,
        }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
      },
      dailyCheckin: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue({ date: new Date(Date.now() - 5 * 86_400_000) }),
      },
      measurement: { findMany: jest.fn().mockResolvedValue([]) },
      event: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
      engineDecision: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'dec-1',
          action: { tone: 'encouraging', timing: 'morning', menu: 'keep' },
          inputs: { signals: { stallDays: 8 } },
        }),
      },
      visit: { findMany: jest.fn().mockResolvedValue(opzioni.visite ?? []) },
      recipeRating: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
      monitoringPeriod: { findFirst: jest.fn().mockResolvedValue(null) },
      staff: { findUnique: jest.fn().mockResolvedValue({ userId: 'nutri-user' }) },
      subscription: {
        findFirst: jest.fn().mockResolvedValue(null),
        /**
         * ⚠️ **Il finto filtra come il database vero.** Senza questo ramo, il caso del
         * Monitoraggio sarebbe verde anche se il cancello passasse a `filtroClienteConPianoAttivo`
         * — che il monitoraggio lo esclude apposta — perché un finto che ignora il `where`
         * risponde uguale a due domande diverse.
         */
        findMany: jest.fn().mockImplementation(({ where }: { where?: Record<string, unknown> }) => {
          if (opzioni.scartaSeFiltraSulPiano && where && 'plan' in where) return Promise.resolve([]);
          return Promise.resolve(opzioni.piani);
        }),
      },
    };
  }

  async function servizio(prisma: unknown, gateChiede = true) {
    const config = {
      getNumber: jest.fn((key: string, scorta?: number) =>
        Promise.resolve(
          ({ stall_days_before_coach_alert: 6, no_checkin_days_before_alert: 4 } as Record<string, number>)[key] ?? scorta,
        ),
      ),
      getString: jest.fn().mockResolvedValue('false'),
    };
    const menu = {
      pendingRatings: jest.fn().mockResolvedValue([]),
      measurementGate: jest.fn().mockResolvedValue({ required: gateChiede, blocking: gateChiede, cycleDate: null }),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationsService,
        MessageComposerService,
        I18nService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigParamsService, useValue: config },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(undefined) } },
        { provide: MailService, useValue: { sendNotificationEmail: jest.fn().mockResolvedValue(true) } },
        { provide: MenuService, useValue: menu },
        { provide: PushService, useValue: { sendToUser: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();
    return moduleRef.get(NotificationsService);
  }

  it('⛔ piano finito ieri: alla cliente non parte niente', async () => {
    const prisma = fintoPrisma({
      piani: [{ status: 'active', startDate: new Date(Date.now() - 40 * 86_400_000), endDate: IERI() }],
    });
    const created = await (await servizio(prisma)).generateDailyForClient('u1');
    expect(created).toEqual([]);
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('⛔ piano finito ieri: e alla coach nemmeno', async () => {
    const prisma = fintoPrisma({
      piani: [{ status: 'active', startDate: new Date(Date.now() - 40 * 86_400_000), endDate: IERI() }],
    });
    await (await servizio(prisma)).generateDailyForClient('u1');
    const allaCoach = prisma.notification.create.mock.calls.filter((c) => c[0].data.userId === 'coach-user');
    expect(allaCoach).toEqual([]);
  });

  it('mai comprato niente: stesso silenzio', async () => {
    const prisma = fintoPrisma({ piani: [] });
    const created = await (await servizio(prisma)).generateDailyForClient('u1');
    expect(created).toEqual([]);
  });

  /**
   * ⚠️ **Non è un interruttore generale**: la controprova serve, o un cancello sempre chiuso
   * passerebbe i tre casi qui sopra senza che nessuno se ne accorga.
   */
  it('con il piano attivo tutto parte come prima, coach compresa', async () => {
    const prisma = fintoPrisma({
      piani: [{ status: 'active', startDate: new Date(Date.now() - 7 * 86_400_000), endDate: FRA_UNA_SETTIMANA() }],
    });
    const created = await (await servizio(prisma)).generateDailyForClient('u1');
    expect(created).toContain('checkin_reminder');
    expect(created).toContain('measurement_reminder');
    expect(created).toContain('no_checkin_coach_alert');
  });

  /**
   * ⚠️ **Monitoraggio e Mantenimento contano come piano** (Simone, 12/9): sono abbonamenti attivi e
   * pagati. Per questo il cancello è `STATI_CON_UN_PIANO` letto da `attivoInCorso`, e **non**
   * `filtroClienteConPianoAttivo`, che esclude il monitoraggio perché risponde a un'altra domanda.
   */
  it('⚠️ chi è in Monitoraggio continua a ricevere', async () => {
    const prisma = fintoPrisma({
      scartaSeFiltraSulPiano: true,
      piani: [{ status: 'active', startDate: new Date(Date.now() - 7 * 86_400_000), endDate: FRA_UNA_SETTIMANA(), plan: { period: 'monitoring' } }],
    });
    const created = await (await servizio(prisma)).generateDailyForClient('u1');
    expect(created).toContain('checkin_reminder');
  });

  /**
   * ⛔ **L'ECCEZIONE, ed è una sola.** Una visita si compra a parte — senza credito
   * `prenotazioni.service` non la fa prenotare — quindi è un appuntamento già pagato e già in
   * agenda. Zittirlo farebbe saltare l'appuntamento a due persone, e la nutrizionista non c'entra
   * niente col fatto che quella cliente abbia o no un piano.
   */
  it('⚠️ la visita di domani passa il cancello, per la cliente E per la nutrizionista', async () => {
    const prisma = fintoPrisma({
      piani: [{ status: 'active', startDate: new Date(Date.now() - 40 * 86_400_000), endDate: IERI() }],
      visite: [{ id: 'v1', datetime: new Date(Date.now() + 30 * 3_600_000), nutritionistId: 'nutri-1' }],
    });
    const created = await (await servizio(prisma)).generateDailyForClient('u1');
    expect(created).toEqual(['visit_reminder', 'visit_reminder_staff']);
    const destinatari = prisma.notification.create.mock.calls.map((c) => c[0].data.userId);
    expect(destinatari).toEqual(['u1', 'nutri-user']);
  });

  /**
   * ⚠️ **Il cancello sta PRIMA delle sei letture in parallelo**, e questa è la prova che lo tiene
   * lì. Il database di produzione sta all'80% di CPU: un giro che ogni notte interroga check-in,
   * misure, eventi, decisioni e visite di gente che non riceverà niente è lavoro che si paga
   * tutte le notti. Spostando il cancello sotto il `Promise.all`, il prodotto resterebbe corretto
   * e questa riga diventerebbe rossa — che è il punto.
   */
  it('⚠️ e non si legge nemmeno il resto della sua giornata', async () => {
    const prisma = fintoPrisma({ piani: [] });
    await (await servizio(prisma)).generateDailyForClient('u1');
    // ⚠️ **Tutte e sei**, non tre: guardandone metà, la guardia si aggirava aggiungendo una lettura
    // proprio fra quelle non guardate. Trovato dal mutation testing.
    expect(prisma.dailyCheckin.findUnique).not.toHaveBeenCalled();
    expect(prisma.measurement.findMany).not.toHaveBeenCalled();
    expect(prisma.engineDecision.findFirst).not.toHaveBeenCalled();
    expect(prisma.event.findFirst).not.toHaveBeenCalled();
    expect(prisma.event.findMany).not.toHaveBeenCalled();
    // La settima è la visita, che il ramo senza piano legge da sé: **una volta sola**.
    expect(prisma.visit.findMany).toHaveBeenCalledTimes(1);
  });

  /**
   * ⛔ **L'ULTIMO GIORNO DEL PERCORSO È ANCORA UN GIORNO DI PERCORSO.** È l'unico giorno su cui
   * `>=` e `>` danno risposte diverse dentro `loStiamoSeguendo`, ed è il giorno in cui la cliente
   * sta ancora usando l'app. Il caso pieno sta in `common/lo-stiamo-seguendo.spec.ts`; qui c'è
   * perché la catena arrivi fino alla notifica.
   */
  it('⛔ il piano finisce OGGI: le notifiche partono ancora', async () => {
    // ⚠️ `aGiorno` e non `inizioDelGiorno`: `endDate` è una colonna DATE, cioè la mezzanotte del
    // giorno **come la scrive il database**. Con la mezzanotte di Roma espressa in UTC la fixture
    // dichiarerebbe «finito ieri» e la prova fallirebbe per la premessa, non per il prodotto.
    const oggi = aGiorno(new Date());
    const prisma = fintoPrisma({
      piani: [{ status: 'active', startDate: new Date(Date.now() - 30 * 86_400_000), endDate: oggi }],
    });
    const created = await (await servizio(prisma)).generateDailyForClient('u1');
    expect(created).toContain('checkin_reminder');
  });

  /**
   * ⛔ **Il monitoraggio OMAGGIO non è un abbonamento** — `monitoring.service.start()` lo concede
   * solo a chi non ha nessuna riga in ballo — ma i menu di rientro li riceve. Guardando i soli
   * abbonamenti si sarebbe ricreato lo stato chiuso l'11/8: i menu arrivano e nessuno chiede il
   * peso.
   */
  it('⛔ nel monitoraggio omaggio continua a ricevere', async () => {
    const prisma = fintoPrisma({ piani: [] });
    prisma.monitoringPeriod.findFirst.mockResolvedValue({ id: 'mon-1' });
    const created = await (await servizio(prisma)).generateDailyForClient('u1');
    expect(created).toContain('checkin_reminder');
  });
});
