import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { MenuService } from './menu.service';
import { giornoLocale } from '../common/date-only';

/**
 * IL CASO GIUSY (13/8): sbloccata ieri, menu mai arrivato, e l'app che diceva «arriverà a breve».
 *
 * La sequenza vera, ricostruita dal codice:
 *  1. la pesata del ciclo non arriva → `cycleNeedsMeasure` trattiene i giorni nuovi (giusto: è la
 *     regola dell'11/8, «ci serve sempre una misura per erogare il menu»);
 *  2. Simone la «sblocca» dal backoffice → `measurementGate` restituiva `required: false`, quindi
 *     **spariva il popup**, cioè l'unica cosa che le chiedeva di pesarsi;
 *  3. `menuStatus` non aveva uno stato per il cancello del ciclo — controllava solo la misura di
 *     PARTENZA — e cadeva su `preparing`: «Menu in preparazione, arriverà a breve».
 *
 * Tre pezzi che, presi uno per uno, erano difendibili. Insieme: una cliente senza menu, senza
 * istruzioni, e con una frase che le diceva di aspettare.
 *
 * Questi test tengono le tre cose separate, perché il difetto stava nel loro incrocio:
 *  - lo sblocco NON deve far arrivare il menu (la regola resta);
 *  - lo sblocco NON deve zittire la richiesta (`required` resta vero, `blocking` diventa falso);
 *  - lo stato deve dire la verità (`awaiting_cycle_measure`, non `preparing`).
 */

const D = (iso: string) => new Date(iso + 'T00:00:00.000Z');
const oggiIso = giornoLocale(new Date());
const giorniDaOggi = (n: number) => giornoLocale(new Date(Date.now() + n * 86_400_000));

const kcalNeedStub = () => ({ computeTargetKcal: jest.fn().mockResolvedValue(null) }) as never;
const pushStub = () => ({ sendToUser: jest.fn().mockResolvedValue(undefined) }) as never;

describe('Pesata del ciclo: lo sblocco riapre l\'app, non eroga il menu', () => {
  let service: MenuService;
  let prisma: any;

  /**
   * Lo scenario: piano attivo partito dieci giorni fa, ultima giornata di menu erogata **ieri**
   * (quindi il ciclo è scaduto) e nessuna pesata dentro il ciclo.
   *
   * `measurement.findFirst` è la parte delicata: nel servizio la stessa funzione risponde a due
   * domande diverse — «c'è la misura di PARTENZA di questo piano?» e «c'è la misura di QUESTO
   * ciclo?» — e un finto che risponde uguale a tutte e due farebbe passare i test qualunque cosa
   * faccia il codice. Si distinguono dal `gte` nella `where`: la partenza guarda la finestra
   * dell'inizio piano, il ciclo guarda gli ultimi giorni.
   */
  const montaScenario = async (opzioni: { sbloccataFinoA?: Date | null } = {}) => {
    const inizioPiano = D(giorniDaOggi(-10));
    const ultimaGiornata = D(giorniDaOggi(-1));
    // La pesata di partenza esiste (fatta a inizio piano), quella del ciclo no.
    const pesataDiPartenza = { id: 'm-partenza', date: inizioPiano };

    prisma = {
      clientProfile: {
        findUnique: jest.fn().mockResolvedValue({
          planStartDate: inizioPiano,
          screeningFlag: false,
          regime: 'omnivore',
          dietStyle: 'mediterranean',
          mealsPerDay: 5,
          intolerances: [],
          assignedNutritionistId: null,
          isStoreReviewer: false,
          measuresUnlockedUntil: opzioni.sbloccataFinoA ?? null,
          travelState: null,
          travelStart: null,
          travelEnd: null,
        }),
      },
      menuDay: {
        // L'ultima giornata erogata è di ieri: il ciclo è scaduto.
        findFirst: jest.fn().mockResolvedValue({ id: 'md1', date: ultimaGiornata, level: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockResolvedValue({}),
      },
      measurement: {
        findFirst: jest.fn().mockImplementation(({ where }: any) => {
          const da: Date | undefined = where?.date?.gte;
          if (!da) return Promise.resolve(pesataDiPartenza);
          // Finestra del punto A (intorno all'inizio piano) → la pesata di partenza c'è.
          if (da.getTime() <= inizioPiano.getTime()) return Promise.resolve(pesataDiPartenza);
          // Finestra del ciclo corrente (ultimi giorni) → nessuna pesata.
          return Promise.resolve(null);
        }),
        count: jest.fn().mockResolvedValue(1),
      },
      subscription: {
        findFirst: jest.fn().mockResolvedValue({ id: 'sub1', status: 'active', endDate: null, plan: { period: 'month', priceCents: 4900 } }),
        findMany: jest.fn().mockResolvedValue([{ status: 'active', endDate: null }]),
      },
      escalation: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
      notification: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(), updateMany: jest.fn() },
      engineDecision: { findFirst: jest.fn().mockResolvedValue(null) },
      diet: { findFirst: jest.fn().mockResolvedValue({ id: 'diet1', style: 'mediterranean' }) },
      dietDayTemplate: { findMany: jest.fn().mockResolvedValue([{ dayIndex: 1, level: 1, meals: [{ slot: 'lunch', recipeId: 'r1' }] }]) },
      productRule: { findUnique: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
      equivalenceGroup: { findMany: jest.fn().mockResolvedValue([]) },
      recipe: { findMany: jest.fn().mockResolvedValue([{ id: 'r1', name: 'Farro', kcal: 520 }]), findUnique: jest.fn().mockResolvedValue({ id: 'r1' }) },
      recipeRating: { findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn() },
      menuWeight: { findMany: jest.fn().mockResolvedValue([]) },
      dailyCheckin: { findUnique: jest.fn().mockResolvedValue(null) },
      analyticsEvent: { create: jest.fn() },
      shoppingList: { findUnique: jest.fn().mockResolvedValue(null), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    };
    const config = {
      getNumber: jest.fn((key: string, def?: number) =>
        Promise.resolve(({
          menu_days_delivered: 2,
          menu_visible_days_before_start: 2,
          measures_lock_after_hours: 24,
          travel_max_days: 30,
        } as Record<string, number>)[key] ?? def),
      ),
      getBool: jest.fn((_k: string, def?: boolean) => Promise.resolve(def ?? false)),
    };
    const events = { activePausePeriod: jest.fn().mockResolvedValue(null), pausaAppenaFinita: jest.fn().mockResolvedValue(null) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        MenuService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigParamsService, useValue: config },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: require('../calendar/events.service').EventsService, useValue: events },
        { provide: require('../diet-agent/diet-agent.service').DietAgentService, useValue: { stateFor: jest.fn().mockResolvedValue('normale') } },
        { provide: require('./day-combo.service').DayComboService, useValue: new (require('./day-combo.service').DayComboService)() },
        { provide: require('./kcal-need.service').KcalNeedService, useValue: kcalNeedStub() },
        { provide: require('../notifications/push.service').PushService, useValue: pushStub() },
      ],
    }).compile();
    service = moduleRef.get(MenuService);
  };

  it('senza pesata del ciclo non eroga: la regola vale anche dopo lo sblocco', async () => {
    await montaScenario({ sbloccataFinoA: new Date(Date.now() + 24 * 3_600_000) });
    const erogati = await service.deliverIfEligible('c1');
    expect(erogati).toEqual([]);
    expect(prisma.menuDay.upsert).not.toHaveBeenCalled();
  });

  it('IL DIFETTO: lo stato non deve essere «in preparazione», che è una promessa falsa', async () => {
    await montaScenario();
    const stato = await service.menuStatus('c1', false);
    expect(stato.state).toBe('awaiting_cycle_measure');
  });

  it('lo stato dice la verità anche a app riaperta: il menu resta in attesa della pesata', async () => {
    await montaScenario({ sbloccataFinoA: new Date(Date.now() + 24 * 3_600_000) });
    const stato = await service.menuStatus('c1', false);
    expect(stato.state).toBe('awaiting_cycle_measure');
  });

  it('senza sblocco il popup blocca, come prima', async () => {
    await montaScenario();
    const gate = await service.measurementGate('c1');
    expect(gate.required).toBe(true);
    expect(gate.blocking).toBe(true);
    expect(['popup', 'locked']).toContain(gate.level);
  });

  it('LO SBLOCCO NON ZITTISCE LA RICHIESTA: cade il muro, resta la domanda', async () => {
    // È il cuore della correzione. Prima qui usciva `required: false, level: 'none'`: la cliente non
    // vedeva più niente — né popup né menu — e non aveva modo di sapere cosa le mancava.
    await montaScenario({ sbloccataFinoA: new Date(Date.now() + 24 * 3_600_000) });
    const gate = await service.measurementGate('c1');
    expect(gate.required).toBe(true);
    expect(gate.blocking).toBe(false);
    expect(gate.level).toBe('promemoria');
  });

  it('sblocco SCADUTO: torna il blocco, altrimenti sarebbe un interruttore per sempre', async () => {
    await montaScenario({ sbloccataFinoA: new Date(Date.now() - 3_600_000) });
    const gate = await service.measurementGate('c1');
    expect(gate.blocking).toBe(true);
  });

  it('con la pesata del ciclo presente lo stato NON è quello di attesa: il test che smaschera un finto troppo permissivo', async () => {
    await montaScenario();
    // Ora ogni finestra trova una pesata: se il codice non guardasse davvero il ciclo, il test
    // precedente e questo darebbero lo stesso risultato.
    prisma.measurement.findFirst.mockResolvedValue({ id: 'm-ciclo', date: new Date() });
    const stato = await service.menuStatus('c1', false);
    expect(stato.state).not.toBe('awaiting_cycle_measure');
  });
});

describe('Pesata del ciclo: chi non deve essere toccato', () => {
  it('il giorno di oggi va lasciato in pace — nessun assunto sul fuso', () => {
    // Guardia contro la trappola raccontata in `menu.service.spec.ts`: «oggi» è il giorno del fuso
    // aziendale, non quello UTC, e i test che lo ricalcolano a mano cadono di notte.
    expect(oggiIso).toBe(giornoLocale(new Date()));
  });
});
