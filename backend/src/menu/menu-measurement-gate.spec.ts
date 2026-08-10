import { AuditService } from '../audit/audit.service';
import { EventsService } from '../calendar/events.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { DietAgentService } from '../diet-agent/diet-agent.service';
import { giornoLocale } from '../common/date-only';
import { PrismaService } from '../prisma/prisma.service';
import { DayComboService } from './day-combo.service';
import { MenuService } from './menu.service';

// Il giorno va calcolato come lo calcola il codice sotto test: `cycleNeedsMeasure` confronta
// col giorno ITALIANO (`common/date-only.ts`). Con `toISOString()` — cioè il giorno UTC — fra le
// 22:00 e le 24:00 UTC il test «2° giorno nel futuro» diventava «oggi» e falliva. Non è mai
// successo solo perché la CI non ha ancora girato a quell'ora.
const dayIso = (n: number) => giornoLocale(new Date(Date.now() + n * 86_400_000));
const D = (iso: string) => new Date(iso + 'T00:00:00.000Z');

/** Ultima push inviata dal servizio costruito da `makeService`, per i test dello sblocco. */
let pushInviate: { userId: string; title: string; body: string; data?: Record<string, string> }[] = [];

function makeService(prisma: unknown) {
  const config = {
    getNumber: jest.fn((k: string, def?: number) =>
      Promise.resolve(({ menu_days_delivered: 2, menu_visible_days_before_start: 2 } as Record<string, number>)[k] ?? def),
    ),
    getBool: jest.fn((_k: string, def?: boolean) => Promise.resolve(def ?? false)),
  };
  const audit = { log: jest.fn() };
  const events = { activePausePeriod: jest.fn().mockResolvedValue(null) };
  const dietAgent = { stateFor: jest.fn().mockResolvedValue('normale') };
  return new MenuService(
    prisma as PrismaService,
    config as unknown as ConfigParamsService,
    audit as unknown as AuditService,
    events as unknown as EventsService,
    dietAgent as unknown as DietAgentService,
    new DayComboService(),
    // Il "menu a necessità" non è oggetto di questi test: fabbisogno non calcolabile → target dal livello.
    { computeTargetKcal: jest.fn().mockResolvedValue(null) } as never,
    {
      sendToUser: jest.fn((userId: string, title: string, body: string, data?: Record<string, string>) => {
        pushInviate.push({ userId, title, body, data });
        return Promise.resolve();
      }),
    } as never,
  );
}

describe('MenuService — gate misure', () => {
  it('nessun menu erogato → gate non richiesto', async () => {
    const prisma = {
      // Il gate ora chiede anche QUALE piano è attivo: nel Monitoraggio (€19) il peso si
      // chiede e basta, quindi non blocca mai. Qui nessun abbonamento → comportamento di sempre.
      subscription: { findFirst: jest.fn().mockResolvedValue(null) },
      menuDay: { findFirst: jest.fn().mockResolvedValue(null) },
      clientProfile: { findUnique: jest.fn().mockResolvedValue(null) }, // nessun piano → nessun popup
    };
    const res = await makeService(prisma).measurementGate('c1');
    // Il gate severo (voce #6 del 5/8) ha aggiunto `level`, `since` e `lockedMessage`.
    // Il confronto resta ESAUSTIVO di proposito: se domani il gate cresce ancora, questo
    // test lo dice invece di lasciar passare campi nuovi mai guardati da nessuno.
    expect(res).toEqual({ required: false, blocking: false, cycleDate: null, level: 'none', since: null, lockedMessage: null });
  });

  it('2° giorno del ciclo passato e nessuna misura → bloccante', async () => {
    const prisma = {
      // Il gate ora chiede anche QUALE piano è attivo: nel Monitoraggio (€19) il peso si
      // chiede e basta, quindi non blocca mai. Qui nessun abbonamento → comportamento di sempre.
      subscription: { findFirst: jest.fn().mockResolvedValue(null) },
      menuDay: { findFirst: jest.fn().mockResolvedValue({ date: D(dayIso(-1)) }) },
      clientProfile: { findUnique: jest.fn().mockResolvedValue({ travelState: null, travelStart: null, travelEnd: null }) },
      measurement: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const res = await makeService(prisma).measurementGate('c1');
    expect(res.blocking).toBe(true);
    expect(res.cycleDate).toBe(dayIso(-1));
  });

  it('2° giorno del ciclo oggi e nessuna misura → bloccante', async () => {
    const prisma = {
      // Il gate ora chiede anche QUALE piano è attivo: nel Monitoraggio (€19) il peso si
      // chiede e basta, quindi non blocca mai. Qui nessun abbonamento → comportamento di sempre.
      subscription: { findFirst: jest.fn().mockResolvedValue(null) },
      menuDay: { findFirst: jest.fn().mockResolvedValue({ date: D(dayIso(0)) }) },
      clientProfile: { findUnique: jest.fn().mockResolvedValue({ travelState: null, travelStart: null, travelEnd: null }) },
      measurement: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const res = await makeService(prisma).measurementGate('c1');
    expect(res.blocking).toBe(true);
  });

  it('2° giorno del ciclo nel futuro → non bloccante', async () => {
    const prisma = {
      // Il gate ora chiede anche QUALE piano è attivo: nel Monitoraggio (€19) il peso si
      // chiede e basta, quindi non blocca mai. Qui nessun abbonamento → comportamento di sempre.
      subscription: { findFirst: jest.fn().mockResolvedValue(null) },
      menuDay: { findFirst: jest.fn().mockResolvedValue({ date: D(dayIso(1)) }) },
      clientProfile: { findUnique: jest.fn().mockResolvedValue({ travelState: null, travelStart: null, travelEnd: null }) },
      measurement: { findFirst: jest.fn() },
    };
    const res = await makeService(prisma).measurementGate('c1');
    expect(res.blocking).toBe(false);
    expect(prisma.measurement.findFirst).not.toHaveBeenCalled();
  });

  it('misura del ciclo presente → non bloccante', async () => {
    const prisma = {
      // Il gate ora chiede anche QUALE piano è attivo: nel Monitoraggio (€19) il peso si
      // chiede e basta, quindi non blocca mai. Qui nessun abbonamento → comportamento di sempre.
      subscription: { findFirst: jest.fn().mockResolvedValue(null) },
      menuDay: { findFirst: jest.fn().mockResolvedValue({ date: D(dayIso(-1)) }) },
      clientProfile: { findUnique: jest.fn().mockResolvedValue({ travelState: null, travelStart: null, travelEnd: null }) },
      measurement: { findFirst: jest.fn().mockResolvedValue({ id: 'm1' }) },
    };
    const res = await makeService(prisma).measurementGate('c1');
    expect(res.blocking).toBe(false);
  });

  const deliveryPrisma = (over: Record<string, unknown>) => ({
    productRule: { findUnique: jest.fn().mockResolvedValue(null) },
    equivalenceGroup: { findMany: jest.fn().mockResolvedValue([]) },
    subscription: { findFirst: jest.fn().mockResolvedValue({ id: 'sub', status: 'active' }) },
    menuDay: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn().mockResolvedValue({}) },
    dailyCheckin: { findUnique: jest.fn() },
    engineDecision: { findFirst: jest.fn().mockResolvedValue(null) },
    diet: { findFirst: jest.fn().mockResolvedValue({ id: 'diet1' }) },
    dietDayTemplate: { findMany: jest.fn().mockResolvedValue([{ dayIndex: 1, level: 1, meals: [{ slot: 'breakfast', recipeId: 'r1' }] }]) },
    escalation: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
    menuWeight: { findMany: jest.fn().mockResolvedValue([]) },
    recipeRating: { findMany: jest.fn().mockResolvedValue([]) },
    // Misure presenti: il gate non blocca, così questi test misurano solo sicurezza/selezione.
    measurement: { count: jest.fn().mockResolvedValue(1), findFirst: jest.fn().mockResolvedValue({ id: 'm1' }) },
    ...over,
  });

  it('sicurezza: intolleranza NON sostituibile → blocca ed apre escalation al nutrizionista', async () => {
    const prisma = deliveryPrisma({
      clientProfile: {
        findUnique: jest.fn().mockResolvedValue({
          planStartDate: D(dayIso(-3)), regime: 'omnivore', dietStyle: 'mediterranean', mealsPerDay: 5,
          intolerances: ['frutta secca'], dislikedFoods: [], assignedNutritionistId: 'nut-1',
        }),
      },
      recipe: { findMany: jest.fn().mockResolvedValue([{ id: 'r1', name: 'Insalata con noci', kcal: 300, ingredients: [{ name: 'noci sgusciate' }] }]) },
    });
    const created = await makeService(prisma).deliverIfEligible('c1');
    expect(created).toEqual([]);
    expect((prisma.escalation.create as jest.Mock)).toHaveBeenCalled();
    expect((prisma.escalation.create as jest.Mock).mock.calls[0][0].data.reason).toContain('Piano bloccato');
    expect((prisma.menuDay.upsert as jest.Mock)).not.toHaveBeenCalled();
  });

  it('selezione: a parità di kcal sceglie la ricetta più gradita', async () => {
    const upsert = jest.fn().mockResolvedValue({});
    const prisma = deliveryPrisma({
      clientProfile: {
        findUnique: jest.fn().mockResolvedValue({
          planStartDate: D(dayIso(-3)), regime: 'omnivore', dietStyle: 'mediterranean', mealsPerDay: 5,
          intolerances: [], dislikedFoods: [], assignedNutritionistId: null,
        }),
      },
      dietDayTemplate: {
        findMany: jest.fn().mockResolvedValue([
          { dayIndex: 1, level: 1, meals: [{ slot: 'lunch', recipeId: 'r1' }] },
          { dayIndex: 2, level: 1, meals: [{ slot: 'lunch', recipeId: 'r2' }] },
        ]),
      },
      recipe: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'r1', name: 'Pasta A', kcal: 500, ingredients: [] },
          { id: 'r2', name: 'Pasta B', kcal: 500, ingredients: [] },
        ]),
      },
      recipeRating: { findMany: jest.fn().mockResolvedValue([{ recipeId: 'r1', stars: 2 }, { recipeId: 'r2', stars: 5 }]) },
      menuDay: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]), upsert },
    });
    await makeService(prisma).deliverIfEligible('c1');
    // il giorno che parte dal template con r1 deve erogare r2 (più gradita, stesse kcal)
    const firstDayMeals = upsert.mock.calls[0][0].create.meals;
    expect(firstDayMeals[0].recipeId).toBe('r2');
  });

  it('sostituzione: intolleranza sostituibile → eroga con nota di sostituzione', async () => {
    const prisma = deliveryPrisma({
      clientProfile: {
        findUnique: jest.fn().mockResolvedValue({
          planStartDate: D(dayIso(-3)), regime: 'omnivore', dietStyle: 'mediterranean', mealsPerDay: 5,
          intolerances: ['lattosio'], dislikedFoods: [], assignedNutritionistId: 'nut-1',
        }),
      },
      recipe: { findMany: jest.fn().mockResolvedValue([{ id: 'r1', name: 'Yogurt e avena', kcal: 300, ingredients: [{ name: 'yogurt greco' }] }]) },
    });
    const created = await makeService(prisma).deliverIfEligible('c1');
    expect(created.length).toBeGreaterThan(0); // erogato, non bloccato
    expect((prisma.escalation.create as jest.Mock)).not.toHaveBeenCalled();
    const meals = (prisma.menuDay.upsert as jest.Mock).mock.calls[0][0].create.meals;
    expect(meals[0].substitutions[0]).toEqual({ from: 'yogurt greco', to: 'yogurt senza lattosio', reason: 'lattosio' });
  });

  it('erogazione: senza misura del ciclo NON eroga (ciclo successivo "held")', async () => {
    const prisma = {
      clientProfile: {
        findUnique: jest.fn().mockResolvedValue({
          planStartDate: D(dayIso(-3)),
          regime: 'omnivore',
          dietStyle: 'mediterranean',
          mealsPerDay: 5,
        }),
      },
      subscription: { findFirst: jest.fn().mockResolvedValue({ id: 'sub', status: 'active' }) },
      menuDay: { findFirst: jest.fn().mockResolvedValue({ date: D(dayIso(-2)) }) },
      dailyCheckin: { findUnique: jest.fn().mockResolvedValue({ id: 'ck' }) },
      measurement: { findFirst: jest.fn().mockResolvedValue(null), count: jest.fn().mockResolvedValue(1) },
    };
    const created = await makeService(prisma).deliverIfEligible('c1');
    expect(created).toEqual([]); // held: l'avviso coach lo genera l'Alert engine
  });
});

/**
 * IL PUNTO A DEVE ESSERE UNA MISURA DI QUESTO PIANO, E VA CHIESTA (11/8).
 *
 * Il caso vero: una cliente con pesate dal 20 luglio ha iniziato il piano il 6 agosto e i menu sono
 * partiti — il gate contava le misure di sempre (`count({ clientId })`) — e nessuno le ha chiesto
 * niente, perché la richiesta esisteva solo dopo lo sblocco della coach.
 */
describe('MenuService — misura di partenza del piano', () => {
  const profiloConPiano = {
    planStartDate: D(dayIso(-3)),
    regime: 'omnivore',
    dietStyle: 'mediterranean',
    mealsPerDay: 5,
  };

  it('nessuna pesata nella finestra del piano → niente menu, E la richiesta parte (push + in-app)', async () => {
    pushInviate = [];
    const creaNotifica = jest.fn().mockResolvedValue({ id: 'n1' });
    const prisma = {
      clientProfile: { findUnique: jest.fn().mockResolvedValue(profiloConPiano) },
      subscription: { findFirst: jest.fn().mockResolvedValue({ id: 'sub', status: 'active' }) },
      menuDay: { findFirst: jest.fn().mockResolvedValue(null) },
      // Il finto risponde `null`: nessuna misura dal giorno di visibilità in poi. Le pesate di
      // luglio esistono ma cadono fuori dalla finestra, ed è tutto il punto.
      measurement: { findFirst: jest.fn().mockResolvedValue(null) },
      notification: { findFirst: jest.fn().mockResolvedValue(null), create: creaNotifica },
    };
    const created = await makeService(prisma).deliverIfEligible('c1');
    expect(created).toEqual([]);
    expect(creaNotifica).toHaveBeenCalled();
    expect(pushInviate).toHaveLength(1);
    expect(pushInviate[0].data).toEqual({ type: 'measures_required' });
    // Il testo CHIEDE, non annuncia: è la differenza fra una richiesta e una punizione.
    expect(pushInviate[0].body).toContain('inserisci');
  });

  it('la richiesta non si ripete ogni giro: se è già partita di recente resta zitta', async () => {
    pushInviate = [];
    const creaNotifica = jest.fn();
    const prisma = {
      clientProfile: { findUnique: jest.fn().mockResolvedValue(profiloConPiano) },
      subscription: { findFirst: jest.fn().mockResolvedValue({ id: 'sub', status: 'active' }) },
      menuDay: { findFirst: jest.fn().mockResolvedValue(null) },
      measurement: { findFirst: jest.fn().mockResolvedValue(null) },
      notification: { findFirst: jest.fn().mockResolvedValue({ id: 'giaChiesto' }), create: creaNotifica },
    };
    await makeService(prisma).deliverIfEligible('c1');
    // Un sollecito al giorno su una cosa che richiede una bilancia diventa rumore e si impara a
    // ignorarlo: peggio di non chiedere.
    expect(creaNotifica).not.toHaveBeenCalled();
    expect(pushInviate).toHaveLength(0);
  });

  it('con la pesata del piano il gate non trattiene e non chiede niente', async () => {
    pushInviate = [];
    const creaNotifica = jest.fn();
    const prisma = {
      clientProfile: { findUnique: jest.fn().mockResolvedValue(profiloConPiano) },
      subscription: { findFirst: jest.fn().mockResolvedValue({ id: 'sub', status: 'active' }) },
      menuDay: { findFirst: jest.fn().mockResolvedValue(null) },
      measurement: { findFirst: jest.fn().mockResolvedValue({ id: 'm-oggi' }) },
      notification: { findFirst: jest.fn(), create: creaNotifica },
      // Oltre il gate il resto della catena non è oggetto di questo test: senza dieta si ferma lì.
      diet: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
    };
    await makeService(prisma).deliverIfEligible('c1');
    expect(creaNotifica).not.toHaveBeenCalled();
    expect(pushInviate).toHaveLength(0);
  });
});

/**
 * MONITORAGGIO (€19/mese): il peso **si chiede, non si impone** (decisione Simone 9/8).
 *
 * Senza questo controllo il monitoraggio era la trappola perfetta. È un piano che i menu non li
 * prevede, quindi `menuDay` resta vuoto per sempre: il gate leggeva «mancano le misure iniziali»
 * e mostrava il popup bloccante — a una persona che paga ogni mese, per sbloccare un menu che
 * non sarebbe mai arrivato. E dopo la settimana di menu di rientro sarebbe scattato pure il
 * blocco di ciclo, con tanto di «contatta la tua coach per sbloccare la app».
 */
describe('MenuService — gate misure nel Monitoraggio', () => {
  const inMonitoraggio = { subscription: { findFirst: jest.fn().mockResolvedValue({ plan: { period: 'monitoring' } }) } };

  it('nessun menu mai erogato → NON blocca (il popup misure non compare)', async () => {
    const prisma = {
      ...inMonitoraggio,
      menuDay: { findFirst: jest.fn().mockResolvedValue(null) },
      clientProfile: { findUnique: jest.fn().mockResolvedValue({ planStartDate: D(dayIso(-10)), travelState: null }) },
      measurement: { findFirst: jest.fn().mockResolvedValue(null), count: jest.fn().mockResolvedValue(0) },
      subscription2: null,
    };
    const res = await makeService(prisma).measurementGate('c1');
    expect(res).toEqual({ required: false, blocking: false, cycleDate: null, level: 'none', since: null, lockedMessage: null });
  });

  it('dopo i menu di rientro, ciclo scaduto senza misure → NON blocca lo stesso', async () => {
    const prisma = {
      ...inMonitoraggio,
      menuDay: { findFirst: jest.fn().mockResolvedValue({ date: D(dayIso(-5)) }) },
      clientProfile: { findUnique: jest.fn().mockResolvedValue({ travelState: null, travelStart: null, travelEnd: null }) },
      measurement: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const res = await makeService(prisma).measurementGate('c1');
    expect(res.blocking).toBe(false);
    expect(res.level).toBe('none');
  });
});

/**
 * Sblocco della coach: la cliente deve ricevere la richiesta delle misure SUL TELEFONO.
 * Richiesta di Simone dell'8/8 («quando sblocca dobbiamo subito chiedere alla cliente le misure»).
 * La sola notifica in-app non basta: la vede chi apre l'app, cioè non chi si era fermata perché
 * l'app era bloccata — le arriverebbe dopo aver già fatto da sé la cosa che le stiamo chiedendo.
 */
describe('MenuService — sblocco misure: la richiesta arriva sul telefono', () => {
  beforeEach(() => { pushInviate = []; });

  const prismaSblocco = () => ({
    clientProfile: { update: jest.fn().mockResolvedValue({}) },
    notification: { create: jest.fn().mockResolvedValue({}) },
  });

  it('manda la push alla cliente, e CHIEDE le misure invece di annunciare lo sblocco', async () => {
    const prisma = prismaSblocco();
    await makeService(prisma).unlockMeasures('cliente-1', 'coach-1');
    expect(pushInviate).toHaveLength(1);
    const p = pushInviate[0];
    expect(p.userId).toBe('cliente-1');
    expect(p.data).toEqual({ type: 'measures_unlocked' });
    // Il corpo deve chiedere le misure: se un giorno qualcuno lo riscrive come «app sbloccata» e
    // basta, la cliente resta a girare in un'app che ancora non le dà il menu.
    expect(p.body.toLowerCase()).toContain('misure');
  });

  it('la notifica nel campanello resta (chi apre l\'app la ritrova)', async () => {
    const prisma = prismaSblocco();
    await makeService(prisma).unlockMeasures('cliente-1', 'coach-1');
    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    const payload = prisma.notification.create.mock.calls[0][0].data;
    expect(payload.type).toBe('measures_unlocked');
    expect(payload.channel).toBe('inapp');
  });

  it('se le push sono spente o in errore lo sblocco riesce comunque', async () => {
    // La finestra di grazia è già stata concessa e la coach ha avuto la conferma: un guasto FCM
    // non deve trasformarsi in «sblocco non riuscito» sulla sua schermata.
    const prisma = prismaSblocco();
    const service = makeService(prisma);
    (service as unknown as { push: { sendToUser: jest.Mock } }).push.sendToUser =
      jest.fn().mockRejectedValue(new Error('FCM non configurato'));
    await expect(service.unlockMeasures('cliente-1', 'coach-1')).resolves.toHaveProperty('until');
    expect(prisma.clientProfile.update).toHaveBeenCalled();
  });
});
