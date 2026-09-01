import { AuditService } from '../audit/audit.service';
import { EventsService } from '../calendar/events.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { DietAgentService } from '../diet-agent/diet-agent.service';
import { aGiorno, giornoLocale } from '../common/date-only';
import { PrismaService } from '../prisma/prisma.service';
import { DayComboService } from './day-combo.service';
import { MenuService } from './menu.service';

/**
 * ⛔ **IL DOPPIO DI `menuDay` SEGUE L'ORIGINALE** (25/8).
 *
 * Dal 25/8 l'erogazione non guarda più «l'ultima data» ma **quante giornate di seguito** la cliente
 * ha davanti, e per saperlo chiede anche **le date** in calendario (`select: { date: true }`). Un
 * finto che quel metodo non ce l'ha fa esplodere il motore; uno che risponde sempre `[]` gli
 * racconta un calendario **vuoto** mentre il test ne ha appena dichiarato una giornata — e allora la
 * prova passa (o fallisce) per la ragione sbagliata.
 *
 * ⚠️ Qui le due risposte vengono dallo **stesso** valore: quello che il test dichiara.
 */
const menuDayFinto = (ultimo: { date: Date } | null) => ({
  findFirst: jest.fn().mockResolvedValue(ultimo),
  findMany: jest.fn().mockImplementation(async (arg: { select?: { date?: boolean } } | undefined) =>
    arg?.select?.date && ultimo?.date ? [{ date: ultimo.date }] : []),
});

// Il giorno va calcolato come lo calcola il codice sotto test: `cycleNeedsMeasure` confronta
// col giorno ITALIANO (`common/date-only.ts`). Con `toISOString()` — cioè il giorno UTC — fra le
// 22:00 e le 24:00 UTC il test «2° giorno nel futuro» diventava «oggi» e falliva. Non è mai
// successo solo perché la CI non ha ancora girato a quell'ora.
/**
 * ⛔ **N GIORNI DI CALENDARIO, NON N×24 ORE** — 24/8.
 *
 * Questa riga faceva `Date.now() + n * 86_400_000`. Sembra la stessa cosa e non lo è: la notte del
 * **25 ottobre 2026** le lancette tornano indietro e il giorno dura **25 ore**, quindi alle 00:30
 * di Roma sommare ventiquattro ore **non arriva a domani** — resta lo stesso giorno.
 *
 * ⚠️ Il difetto era **qui, non nel prodotto**: misurato il 24/8 con `ORA_FINTA`, quella notte il
 * motore erogava i giorni giusti e il gate bloccava chi doveva. Erano queste fixture a dire una cosa
 * e a prepararne un'altra. Un test che mente sulla propria premessa manda a correggere codice che
 * funziona, ed è più caro di un test che manca.
 *
 * ⚠️ Il caso caduto qui: «2° giorno del ciclo **nel futuro** → non bloccante». La fixture
 * preparava un ciclo che finiva **oggi**, e il gate bloccava a ragione: il popup delle misure
 * sarebbe comparso giustamente, non per un difetto del prodotto.
 *
 * Adesso si parte da una **mezzanotte UTC** (`aGiorno`, la stessa porta del prodotto) e si somma lì:
 * in UTC non ci sono cambi d'ora, quindi `+ n` giorni è esatto in tutte le stagioni e in tutti i
 * fusi del **processo** — provato su 526.080 istanti. ⚠️ Il giro completo torna al giorno giusto
 * finché il fuso dell'**azienda** (`APP_TIMEZONE`) è a est di Greenwich, come Roma: è una proprietà
 * di `aGiorno`, non di questa riga, ma vale saperlo perché quel fuso si cambia da Render.
 */
const dayIso = (n: number) => giornoLocale(new Date(aGiorno(new Date()).getTime() + n * 86_400_000));
const D = (iso: string) => new Date(iso + 'T00:00:00.000Z');

/** Ultima push inviata dal servizio costruito da `makeService`, per i test dello sblocco. */
let pushInviate: { userId: string; title: string; body: string; data?: Record<string, string> }[] = [];

function makeService(prisma: unknown, parametri: Record<string, number> = {}) {
  const config = {
    getString: jest.fn(async (_k: string, d?: string) => d),
    getNumber: jest.fn((k: string, def?: number) =>
      Promise.resolve(({ menu_days_delivered: 2, menu_visible_days_before_start: 2, ...parametri } as Record<string, number>)[k] ?? def),
    ),
    getBool: jest.fn((_k: string, def?: boolean) => Promise.resolve(def ?? false)),
  };
  const audit = { log: jest.fn() };
  const events = { activePausePeriod: jest.fn().mockResolvedValue(null), pausaAppenaFinita: jest.fn().mockResolvedValue(null) };
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
      subscription: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
      menuDay: menuDayFinto(null),
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
      subscription: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
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
      subscription: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
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
      subscription: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
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
      subscription: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
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
    subscription: { findFirst: jest.fn().mockResolvedValue({ id: 'sub', status: 'active' }), findMany: jest.fn().mockResolvedValue([{ id: 'sub', status: 'active', startDate: null, endDate: null }]) },
    menuDay: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn().mockResolvedValue({}) },
    dailyCheckin: { findUnique: jest.fn() },
    engineDecision: { findFirst: jest.fn().mockResolvedValue(null) },
    diet: { findFirst: jest.fn().mockResolvedValue({ id: 'diet1' }) },
    dietDayTemplate: { findMany: jest.fn().mockResolvedValue([{ dayIndex: 1, level: 1, meals: [{ slot: 'breakfast', recipeId: 'r1' }, { slot: 'morning_snack', recipeId: 's1' }, { slot: 'lunch', recipeId: 'l1' }, { slot: 'afternoon_snack', recipeId: 'm1' }, { slot: 'dinner', recipeId: 'd1' }] }]) },
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
          // Giornate COMPLETE a 5 pasti: dall'11/8 quelle monche non si erogano (§15.4), e un
          // template col solo pranzo farebbe misurare il nulla a test che parlano d'altro.
          { dayIndex: 1, level: 1, meals: [{ slot: 'breakfast', recipeId: 'b1' }, { slot: 'morning_snack', recipeId: 's1' }, { slot: 'lunch', recipeId: 'r1' }, { slot: 'afternoon_snack', recipeId: 'm1' }, { slot: 'dinner', recipeId: 'd1' }] },
          { dayIndex: 2, level: 1, meals: [{ slot: 'breakfast', recipeId: 'b1' }, { slot: 'morning_snack', recipeId: 's1' }, { slot: 'lunch', recipeId: 'r2' }, { slot: 'afternoon_snack', recipeId: 'm1' }, { slot: 'dinner', recipeId: 'd1' }] },
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
    // Il giorno che parte dal template con r1 deve erogare r2 (più gradita, stesse kcal).
    // Si cerca lo SLOT e non `meals[0]`: da quando le giornate di prova sono complete, la prima
    // posizione è la colazione — e un test che si appoggia all'ordine misura l'ordine, non la scelta.
    const firstDayMeals = upsert.mock.calls[0][0].create.meals as { slot: string; recipeId: string }[];
    expect(firstDayMeals.find((m) => m.slot === 'lunch')?.recipeId).toBe('r2');
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
      subscription: { findFirst: jest.fn().mockResolvedValue({ id: 'sub', status: 'active' }), findMany: jest.fn().mockResolvedValue([{ id: 'sub', status: 'active', startDate: null, endDate: null }]) },
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
      subscription: { findFirst: jest.fn().mockResolvedValue({ id: 'sub', status: 'active' }), findMany: jest.fn().mockResolvedValue([{ id: 'sub', status: 'active', startDate: null, endDate: null }]) },
      menuDay: menuDayFinto(null),
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
      subscription: { findFirst: jest.fn().mockResolvedValue({ id: 'sub', status: 'active' }), findMany: jest.fn().mockResolvedValue([{ id: 'sub', status: 'active', startDate: null, endDate: null }]) },
      menuDay: menuDayFinto(null),
      measurement: { findFirst: jest.fn().mockResolvedValue(null) },
      notification: { findFirst: jest.fn().mockResolvedValue({ id: 'giaChiesto' }), create: creaNotifica },
    };
    await makeService(prisma).deliverIfEligible('c1');
    // Un sollecito al giorno su una cosa che richiede una bilancia diventa rumore e si impara a
    // ignorarlo: peggio di non chiedere.
    expect(creaNotifica).not.toHaveBeenCalled();
    expect(pushInviate).toHaveLength(0);
  });

  /**
   * ⛔ **UN BUCO NEL CALENDARIO NON APRE IL CANCELLO DELLE MISURE** — difetto trovato e misurato
   * dalla revisione avversariale del 25/8, il più grave della consegna dei buchi.
   *
   * `cycleNeedsMeasure` esce subito con «oggi è ancora dentro il ciclo» guardando la data più alta
   * del calendario. Finché il buffer guardava la stessa data, i due erano d'accordo: con una riga
   * nel futuro si usciva **prima**, senza erogare. Riempendo i buchi quella porta si è aperta, e il
   * cancello è diventato un no-op **proprio nel caso nuovo**: buco oggi, riga domani, nessuna
   * pesata di ciclo → due giornate erogate senza che nessuno abbia chiesto il peso.
   *
   * ⚠️ È il caso Gioia da un'altra porta: *«o ricevi menu e ti pesi, o non ricevi menu»*. Adesso il
   * ciclo finisce all'ultima giornata **di seguito da oggi**, e con un buco oggi quella corsa non
   * esiste nemmeno.
   */
  it('⛔ buco oggi e una riga domani, senza pesata di ciclo: NON eroga', async () => {
    const domani = D(dayIso(1));
    const prisma = {
      clientProfile: { findUnique: jest.fn().mockResolvedValue(profiloConPiano) },
      subscription: { findFirst: jest.fn().mockResolvedValue({ id: 'sub', status: 'active' }), findMany: jest.fn().mockResolvedValue([{ id: 'sub', status: 'active', startDate: null, endDate: null }]) },
      /** In calendario c'è **solo domani**: oggi è un buco. */
      menuDay: {
        findFirst: jest.fn().mockResolvedValue({ date: domani }),
        findMany: jest.fn().mockImplementation(async (arg: { select?: { date?: boolean } } | undefined) =>
          (arg?.select?.date ? [{ date: domani }] : [])),
        upsert: jest.fn().mockResolvedValue({}),
      },
      /**
       * ⚠️ Il finto distingue le due domande dalla finestra, perché è così che si distinguono nel
       * prodotto: la misura **di partenza** guarda dall'inizio del piano (tre giorni fa) e c'è; la
       * pesata **del ciclo** guarda gli ultimi due giorni e non c'è. Un finto che rispondesse la
       * stessa cosa a tutte e due misurerebbe un'altra cosa.
       */
      measurement: {
        count: jest.fn().mockResolvedValue(1),
        findFirst: jest.fn().mockImplementation(async (arg: { where?: { date?: { gte?: Date } } }) => {
          const da = arg?.where?.date?.gte;
          const dueGiorniFa = new Date(D(dayIso(0)).getTime() - 2 * 86_400_000);
          return da && da.getTime() >= dueGiorniFa.getTime() ? null : { id: 'm-partenza' };
        }),
      },
      notification: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'n1' }) },
    };
    expect(await makeService(prisma).deliverIfEligible('c1')).toEqual([]);
    expect(prisma.menuDay.upsert).not.toHaveBeenCalled();
    /**
     * ⚠️ **E la finestra della pesata è quella giusta**: senza nessuna giornata da oggi in avanti la
     * corsa non esiste, quindi il ciclo è finito **al più tardi ieri** — e la finestra di due giorni
     * parte da ieri, non da oggi. Un giorno di differenza qui vuol dire chiedere una pesata che
     * c'era già, o non chiederne una che manca.
     */
    const finestre = prisma.measurement.findFirst.mock.calls.map((c: any) => c[0]?.where?.date?.gte?.getTime());
    expect(finestre).toContain(D(dayIso(-2)).getTime());
  });

  /**
   * ⛔ **E il buco IN MEZZO fa la stessa cosa.** Variante del caso qui sopra, e serve perché prende
   * un pezzo diverso del conto: qui la corsa da oggi **esiste** (oggi c'è) ma finisce subito, e il
   * ciclo deve finire con lei — non con la riga di dopodomani, che sta oltre il buco.
   */
  it('⛔ oggi c\'è, domani è un buco, dopodomani c\'è: senza pesata di ciclo non eroga', async () => {
    const oggi = D(dayIso(0));
    const dopodomani = D(dayIso(2));
    const prisma = {
      clientProfile: { findUnique: jest.fn().mockResolvedValue(profiloConPiano) },
      subscription: { findFirst: jest.fn().mockResolvedValue({ id: 'sub', status: 'active' }), findMany: jest.fn().mockResolvedValue([{ id: 'sub', status: 'active', startDate: null, endDate: null }]) },
      menuDay: {
        findFirst: jest.fn().mockResolvedValue({ date: dopodomani }),
        findMany: jest.fn().mockImplementation(async (arg: { select?: { date?: boolean } } | undefined) =>
          (arg?.select?.date ? [{ date: oggi }, { date: dopodomani }] : [])),
        upsert: jest.fn().mockResolvedValue({}),
      },
      measurement: {
        count: jest.fn().mockResolvedValue(1),
        findFirst: jest.fn().mockImplementation(async (arg: { where?: { date?: { gte?: Date } } }) => {
          const da = arg?.where?.date?.gte;
          const dueGiorniFa = new Date(oggi.getTime() - 2 * 86_400_000);
          return da && da.getTime() >= dueGiorniFa.getTime() ? null : { id: 'm-partenza' };
        }),
      },
      notification: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'n1' }) },
    };
    expect(await makeService(prisma).deliverIfEligible('c1')).toEqual([]);
    expect(prisma.menuDay.upsert).not.toHaveBeenCalled();
  });

  /**
   * ⚠️ **E LA CLIENTE RIMASTA INDIETRO NON DEVE PAGARE LA CORREZIONE.** L'altra metà del cancello:
   * chi non apre l'app da giorni ha il suo ultimo ciclo **nel passato**, e la finestra della pesata
   * è quella del suo ciclo, non gli ultimi due giorni. Ancorare tutto a «ieri» le stringerebbe la
   * finestra senza che nessuno l'abbia chiesto — un cancello che si chiude di più è un cancello
   * sbagliato quanto uno che si apre.
   */
  it('⚠️ rimasta indietro di cinque giorni: la pesata del SUO ciclo basta ancora', async () => {
    const cinqueGiorniFa = D(dayIso(-5));
    const prisma = {
      clientProfile: { findUnique: jest.fn().mockResolvedValue(profiloConPiano) },
      subscription: { findFirst: jest.fn().mockResolvedValue({ id: 'sub', status: 'active' }), findMany: jest.fn().mockResolvedValue([{ id: 'sub', status: 'active', startDate: null, endDate: null }]) },
      /** Nessuna giornata da oggi in avanti: l'ultima è di cinque giorni fa. */
      menuDay: {
        findFirst: jest.fn().mockResolvedValue({ date: cinqueGiorniFa }),
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockResolvedValue({}),
      },
      /** La pesata c'è, ma è di sei giorni fa: dentro il suo ciclo, fuori dagli ultimi due giorni. */
      measurement: {
        count: jest.fn().mockResolvedValue(1),
        findFirst: jest.fn().mockImplementation(async (arg: { where?: { date?: { gte?: Date } } }) => {
          const da = arg?.where?.date?.gte;
          const setteGiorniFa = new Date(D(dayIso(0)).getTime() - 7 * 86_400_000);
          return da && da.getTime() >= setteGiorniFa.getTime() && da.getTime() <= cinqueGiorniFa.getTime()
            ? { id: 'm-ciclo' }
            : da && da.getTime() > cinqueGiorniFa.getTime()
              ? null
              : { id: 'm-partenza' };
        }),
      },
      diet: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
      notification: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'n1' }) },
    };
    await makeService(prisma).deliverIfEligible('c1');
    /**
     * Il cancello non l'ha fermata: si vede da dove è arrivata — senza dieta si ferma più avanti,
     * ma `diet.findFirst` viene interrogata solo **dopo** il gate.
     */
    expect(prisma.diet.findFirst).toHaveBeenCalled();
  });

  it('con la pesata del piano il gate non trattiene e non chiede niente', async () => {
    pushInviate = [];
    const creaNotifica = jest.fn();
    const prisma = {
      clientProfile: { findUnique: jest.fn().mockResolvedValue(profiloConPiano) },
      subscription: { findFirst: jest.fn().mockResolvedValue({ id: 'sub', status: 'active' }), findMany: jest.fn().mockResolvedValue([{ id: 'sub', status: 'active', startDate: null, endDate: null }]) },
      menuDay: menuDayFinto(null),
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
  const inMonitoraggio = { subscription: { findFirst: jest.fn().mockResolvedValue({ plan: { period: 'monitoring' } }), findMany: jest.fn().mockResolvedValue([{ status: 'active', startDate: null, endDate: null, plan: { period: 'monitoring' } }]) } };

  it('nessun menu mai erogato → NON blocca (il popup misure non compare)', async () => {
    const prisma = {
      ...inMonitoraggio,
      menuDay: menuDayFinto(null),
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

/**
 * LA SCADENZA DELLA VACANZA È UN NUMERO SOLO (13/8).
 *
 * `statoViaggioAttivo` accetta un tetto di giorni per un «in vacanza» senza data di fine. Il gate
 * misure lo chiamava **senza passarlo**, quindi qui valeva il default del helper (30) mentre
 * `DietAgentService` leggeva `travel_max_days` dai Parametri. Due numeri per la stessa scadenza: il
 * giorno in cui qualcuno lo porta a 60, il gate e l'agente non sono più d'accordo su chi è in vacanza —
 * e non lo dice nessun errore.
 */
describe('MenuService — la vacanza NON esenta più dalle misure (11/8)', () => {
  /**
   * Questo blocco verificava il contrario: che in modalità viaggio il gate non bloccasse. Era la
   * regola «Vacanze in Serenità», e su Gioia ha prodotto otto giornate di fila con una sola pesata
   * — erogate puntualmente, senza errori, perché il codice faceva quello per cui era scritto.
   *
   * Decisione di Simone dell'11/8: **o ricevi menu e le misure valgono come per tutte, oppure sei
   * in pausa e non ricevi menu ma entri nel protocollo di monitoraggio.** Niente terza strada in
   * cui i menu arrivano e nessuno chiede il peso: il fabbisogno si calcola sul peso attuale.
   */
  const inVacanzaDa40Giorni = {
    planStartDate: D(dayIso(-60)),
    regime: 'omnivore',
    dietStyle: 'mediterranean',
    mealsPerDay: 5,
    travelState: 'in_vacanza',
    travelStart: D(dayIso(-40)),
    travelEnd: null,
  };
  const prismaSenzaMisure = (profilo: Record<string, unknown> = inVacanzaDa40Giorni) => ({
    clientProfile: { findUnique: jest.fn().mockResolvedValue(profilo) },
    subscription: { findFirst: jest.fn().mockResolvedValue({ id: 'sub', status: 'active' }), findMany: jest.fn().mockResolvedValue([{ id: 'sub', status: 'active', startDate: null, endDate: null }]) },
    menuDay: menuDayFinto(null),
    measurement: { findFirst: jest.fn().mockResolvedValue(null) },
    notification: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
  });

  it('in vacanza da 40 giorni: il gate CHIEDE le misure', async () => {
    const res = await makeService(prismaSenzaMisure(), { travel_max_days: 30 }).measurementGate('c1');
    expect(res.blocking).toBe(true);
  });

  it('e le chiede anche col tetto della vacanza alzato: non dipende più da quel numero', async () => {
    // Prima questo caso tornava `false` — la vacanza «ancora valida» spegneva la regola più severa
    // che abbiamo. Ora `travel_max_days` conta solo per l'agente dieta, che sceglie CHE COSA
    // servire a chi è al mare: una domanda diversa, che non c'entra col peso.
    const res = await makeService(prismaSenzaMisure(), { travel_max_days: 60 }).measurementGate('c1');
    expect(res.blocking).toBe(true);
  });

  it('in vacanza appena partita: nessuna scorciatoia nemmeno il primo giorno', async () => {
    const res = await makeService(
      prismaSenzaMisure({ ...inVacanzaDa40Giorni, travelStart: D(dayIso(-1)) }),
      { travel_max_days: 30 },
    ).measurementGate('c1');
    expect(res.blocking).toBe(true);
  });
});
