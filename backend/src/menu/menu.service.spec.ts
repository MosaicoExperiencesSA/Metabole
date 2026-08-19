import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { MenuService } from './menu.service';
import { giornoLocale } from '../common/date-only';

// Il "menu a necessità" non è oggetto di questi test: il fabbisogno non è calcolabile
// (null) e il target kcal resta quello del livello della dieta (comportamento storico).
const kcalNeedStub = () => ({ computeTargetKcal: jest.fn().mockResolvedValue(null) }) as never;
// Le push non sono oggetto di questi test: stub silenzioso. `PushService` è entrato nel
// costruttore di MenuService per la richiesta misure allo sblocco (8/8).
const pushStub = () => ({ sendToUser: jest.fn().mockResolvedValue(undefined) }) as never;

const D = (iso: string) => new Date(iso + 'T00:00:00.000Z');
/**
 * «Oggi» come lo intende il servizio: il giorno del fuso AZIENDALE (`Europe/Rome`), non quello UTC.
 *
 * Prima qui c'era `new Date().toISOString().slice(0, 10)`, cioè il giorno UTC, e questi test
 * fallivano ogni notte fra le 22:00 e le 24:00 UTC — fra mezzanotte e le 2 in Italia — perché il
 * servizio erogava il menu del giorno italiano mentre il test si aspettava quello UTC. Il CI del
 * 9/8 alle 00:09 italiane è caduto esattamente così, su codice sano. È la stessa trappola che
 * `common/date-only.ts` racconta per le misure: usare l'helper del prodotto, non ricalcolare.
 */
const todayIso = giornoLocale(new Date());
const daysFromToday = (n: number) => giornoLocale(new Date(Date.now() + n * 86_400_000));

describe('MenuService (erogazione 2 giorni alla volta)', () => {
  let service: MenuService;
  let prisma: any;

  /**
   * Una giornata **completa** per una dieta a 5 pasti.
   *
   * Prima era `meals: [{ slot: 'lunch' }]`: una giornata con il solo pranzo. Dall'11/8 l'erogazione
   * serve solo le giornate che hanno tutti i pasti previsti (§15.4), quindi un template così non
   * verrebbe erogato — ed è giusto: era la finzione che teneva verdi i test mentre in produzione
   * una giornata con la sola colazione arrivava davvero nel piatto di qualcuno.
   */
  const SLOT_5 = ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner'];
  const template = (dayIndex: number) => ({
    dayIndex,
    level: 1,
    meals: SLOT_5.map((slot, i) => ({ slot, recipeId: `r${i + 1}` })),
  });
  /** Una giornata MONCA, per i test che verificano che venga scartata. */
  const templateMonco = (dayIndex: number) => ({ dayIndex, level: 1, meals: [{ slot: 'lunch', recipeId: 'r1' }] });

  beforeEach(async () => {
    prisma = {
      productRule: { findUnique: jest.fn().mockResolvedValue(null) },
      equivalenceGroup: { findMany: jest.fn().mockResolvedValue([]) },
      clientProfile: {
        findUnique: jest.fn().mockResolvedValue({
          planStartDate: D(todayIso),
          regime: 'omnivore',
          dietStyle: 'mediterranean',
          mealsPerDay: 5,
          intolerances: [], // nessuna esclusione → nessun blocco di sicurezza
          assignedNutritionistId: null,
        }),
      },
      menuDay: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockResolvedValue({}),
        // Serve ai test di rigenerazione: `regenerateFromToday` cancella prima di rierogare, e il
        // punto del test col piano fermo è proprio che questa NON venga chiamata.
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      dailyCheckin: { findUnique: jest.fn().mockResolvedValue(null) },
      // Gate misure: misura del ciclo presente → non blocca l'erogazione.
      measurement: { findFirst: jest.fn().mockResolvedValue({ id: 'm1' }), count: jest.fn().mockResolvedValue(1) },
      notification: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(), updateMany: jest.fn() },
      escalation: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
      diet: {
        findFirst: jest.fn().mockResolvedValue({ id: 'diet1', name: 'Mediterranea', regime: 'omnivore', mealsPerDay: 5 }),
        // Le gemelle della stessa famiglia: servono al ripiego di §15.4 (giornate incomplete).
        findMany: jest.fn().mockResolvedValue([]),
      },
      dietDayTemplate: {
        findMany: jest.fn().mockResolvedValue([template(1), template(2)]),
      },
      recipe: {
        findMany: jest.fn().mockResolvedValue([{ id: 'r1', name: 'Farro', kcal: 520 }]),
        findUnique: jest.fn().mockResolvedValue({ id: 'r1' }),
      },
      recipeRating: {
        upsert: jest.fn().mockResolvedValue({ id: 'rt1' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      menuWeight: { findMany: jest.fn().mockResolvedValue([]) },
      shoppingList: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn(),
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'sl1', ...data })),
        update: jest.fn(),
      },
    };
    prisma.engineDecision = { findFirst: jest.fn().mockResolvedValue(null) };
    prisma.subscription = {
      findFirst: jest.fn().mockResolvedValue({ id: 'sub1', status: 'active' }),
      // `menuStatus` legge TUTTI gli abbonamenti per capire se il percorso è concluso.
      findMany: jest.fn().mockResolvedValue([{ status: 'active', endDate: null }]),
    };
    const config = {
      getNumber: jest.fn((key: string, def?: number) =>
        Promise.resolve(({ menu_days_delivered: 2, menu_visible_days_before_start: 2, menu_penalty_repeat: 0, menu_variety_min_gap_days: 0 } as Record<string, number>)[key] ?? def),
      ),
      getBool: jest.fn((_key: string, def?: boolean) => Promise.resolve(def ?? false)),
    };
    const events = { activePausePeriod: jest.fn().mockResolvedValue(null) };
    (globalThis as any).__eventsMock = events;
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
  });

  it('prima erogazione: 2 giorni dal via del piano', async () => {
    const created = await service.deliverIfEligible('u1');
    expect(created).toEqual([todayIso, daysFromToday(1)]);
    expect(prisma.menuDay.upsert).toHaveBeenCalledTimes(2);
  });

  /**
   * IL PIANO IN CODA E I DUE GIORNI DI ANTEPRIMA — voce 258, 19/8.
   *
   * Fino al 18/8 un piano che comincia più avanti era scritto `active` con la partenza nel futuro,
   * quindi entrava da solo nell'erogazione: è così che i menu si compongono nei giorni di anteprima
   * (`menu_visible_days_before_start`) **prima** che il piano cominci. Da quando nasce `queued`,
   * leggere solo `active` faceva sparire quell'anteprima — e siccome il gate delle misure sta dopo
   * la finestra, la cliente avrebbe perso anche il primo giorno di piano.
   */
  it('⚠️ il piano IN CODA compone i giorni di anteprima, come faceva quando era scritto `active`', async () => {
    const domani = daysFromToday(1);
    prisma.clientProfile.findUnique.mockResolvedValue({
      planStartDate: D(domani),
      regime: 'omnivore',
      dietStyle: 'mediterranean',
      mealsPerDay: 5,
      intolerances: [],
      assignedNutritionistId: null,
    });
    prisma.subscription.findMany.mockResolvedValue([
      { id: 'sub-coda', status: 'queued', startDate: D(domani), endDate: D(daysFromToday(90)), plan: { priceCents: 29700, period: '3m' } },
    ]);
    const created = await service.deliverIfEligible('u1');
    expect(created).toEqual([domani, daysFromToday(2)]);
    // ⚠️ E la coda dev'essere stata CHIESTA al database: il finto Prisma non filtra, quindi senza
    // questa riga il test passerebbe anche leggendo i soli `active` — cioè non verificherebbe niente.
    expect(prisma.subscription.findMany.mock.calls[0][0].where.status).toEqual({
      in: expect.arrayContaining(['active', 'queued']),
    });
  });

  /** ⚠️ Ma non anticipa niente: la finestra di visibilità resta il solo cancello. */
  it('⚠️ un piano in coda che parte fra un mese non compone un bel niente', async () => {
    const fraUnMese = daysFromToday(30);
    prisma.clientProfile.findUnique.mockResolvedValue({
      planStartDate: D(fraUnMese),
      regime: 'omnivore',
      dietStyle: 'mediterranean',
      mealsPerDay: 5,
      intolerances: [],
      assignedNutritionistId: null,
    });
    prisma.subscription.findMany.mockResolvedValue([
      { id: 'sub-coda', status: 'queued', startDate: D(fraUnMese), endDate: D(daysFromToday(120)), plan: { priceCents: 29700, period: '3m' } },
    ]);
    expect(await service.deliverIfEligible('u1')).toEqual([]);
  });

  /**
   * ⚠️ E QUELLO CHE LEGGE LEI. Una cliente che compra oggi con partenza fra dieci giorni ha una
   * riga sola, in coda: leggendo solo `active` l'app le scriveva «il tuo piano è terminato,
   * riattiva un piano dal Negozio» il giorno stesso in cui aveva pagato. Deve leggere la data.
   */
  it('⚠️ con il solo piano in coda l\'app dice QUANDO comincia, non «percorso concluso»', async () => {
    const fraDieciGiorni = daysFromToday(10);
    prisma.clientProfile.findUnique.mockResolvedValue({ planStartDate: D(fraDieciGiorni) });
    prisma.subscription.findMany.mockResolvedValue([
      { status: 'queued', endDate: D(daysFromToday(100)) },
    ]);
    prisma.subscription.findFirst.mockResolvedValue(null);
    const stato = await service.menuStatus('u1', false);
    expect(stato.state).toBe('scheduled');
    expect(stato.availableFrom).toBe(daysFromToday(8)); // due giorni prima dell'inizio
  });

  /**
   * ⚠️ CHI COMPRA IL RINNOVO IN ANTICIPO NON DEVE SMETTERE DI RICEVERE I MENU — trovato il 19/8
   * rileggendo, ed era già in produzione dal 10/8.
   *
   * L'acquisto in coda riallinea `clientProfile.planStartDate` alla partenza del piano NUOVO, così
   * che scheda e scadenza raccontino la stessa data. Ma l'erogazione misurava la sua finestra
   * proprio su `planStartDate`: quindi il giorno in cui una cliente comprava il rinnovo con due mesi
   * d'anticipo, per l'erogazione diventava «troppo presto» e i menu si fermavano — sul piano che
   * stava ancora pagando. La finestra è del piano che eroga, ed è `attivoInCorso` a dire qual è.
   */
  it('⚠️ il piano in corso continua a erogare anche dopo che la cliente ha comprato la coda', async () => {
    const fra60 = daysFromToday(60);
    prisma.clientProfile.findUnique.mockResolvedValue({
      planStartDate: D(fra60), // riallineata dall'acquisto in coda: è la partenza del piano NUOVO
      regime: 'omnivore',
      dietStyle: 'mediterranean',
      mealsPerDay: 5,
      intolerances: [],
      assignedNutritionistId: null,
    });
    prisma.subscription.findMany.mockResolvedValue([
      { id: 'A', status: 'active', startDate: D(daysFromToday(-30)), endDate: D(fra60), plan: { priceCents: 29700, period: '3m' } },
      { id: 'B', status: 'queued', startDate: D(fra60), endDate: D(daysFromToday(150)), plan: { priceCents: 29700, period: '3m' } },
    ]);
    // Il piano A va avanti da un mese: l'ultima giornata erogata è quella di ieri.
    prisma.menuDay.findFirst.mockResolvedValue({ date: D(daysFromToday(-1)) });
    expect(await service.deliverIfEligible('u1')).toEqual([todayIso, daysFromToday(1)]);
  });

  /** ⚠️ E la schermata dice la stessa cosa: non «il menu comparirà fra due mesi». */
  it('⚠️ e l\'app non le annuncia il menu fra due mesi mentre il piano di adesso è suo', async () => {
    const fra60 = daysFromToday(60);
    prisma.clientProfile.findUnique.mockResolvedValue({ planStartDate: D(fra60) });
    prisma.subscription.findMany.mockResolvedValue([
      { status: 'active', startDate: D(daysFromToday(-30)), endDate: D(fra60) },
      { status: 'queued', startDate: D(fra60), endDate: D(daysFromToday(150)) },
    ]);
    prisma.subscription.findFirst.mockResolvedValue(null);
    expect((await service.menuStatus('u1', false)).state).not.toBe('scheduled');
  });

  /**
   * LE ALTRE QUATTRO LETTURE DI QUESTO FILE — voce 258, 19/8.
   *
   * `menuStatus` e l'erogazione non sono gli unici punti che qui dentro chiedono «ha un piano?»: ce
   * ne sono altri quattro, e leggevano tutti `status: 'active'`. Fino al 18/8 non si vedeva, perché
   * la coda era scritta `active`; da quando nasce `queued` ognuno sbaglia in un modo diverso e **in
   * silenzio**, che è il modo in cui questi difetti fanno danno.
   *
   * ⚠️ Il finto Prisma qui **filtra come il database vero**: senza, questi test passerebbero anche
   * leggendo i soli `active`, cioè non verificherebbero niente.
   */
  describe('le letture che devono vedere anche il piano in coda', () => {
    /** Una cliente con un piano solo, in coda, che comincia domani. */
    const soloInCoda = (period: string | null) => {
      const coda = { id: 'sub-coda', status: 'queued', startDate: D(daysFromToday(1)), endDate: D(daysFromToday(90)), plan: { priceCents: 29700, period } };
      // Senza filtro sullo stato la domanda è «tutti i suoi abbonamenti»: la coda c'è. Con un
      // filtro, c'è solo se `queued` è fra gli stati chiesti — è il punto di questi test.
      const filtra = ({ where }: any) => {
        if (!where?.status) return coda;
        const ammessi: string[] = where.status.in ?? [where.status];
        return ammessi.includes('queued') ? coda : null;
      };
      prisma.subscription.findFirst.mockImplementation((args: any) => Promise.resolve(filtra(args)));
      prisma.subscription.findMany.mockImplementation((args: any) => Promise.resolve([filtra(args)].filter(Boolean)));
      prisma.clientProfile.findUnique.mockResolvedValue({
        planStartDate: D(daysFromToday(1)),
        regime: 'omnivore',
        dietStyle: 'mediterranean',
        mealsPerDay: 5,
        intolerances: [],
        assignedNutritionistId: null,
      });
    };

    /**
     * ⚠️ «Il Monitoraggio non prevede menu» va DETTO. Senza questo ramo la cliente resta su «Menu in
     * preparazione», che è una bugia gentile: aspetta qualcosa che non arriverà e prima o poi scrive
     * alla coach per un guasto che non c'è. Un Monitoraggio che comincia domani è esattamente la
     * stessa ragione per cui i menu non arriveranno.
     */
    it('⚠️ il Monitoraggio IN CODA lo dice: «monitoring», non «menu in preparazione»', async () => {
      soloInCoda('monitoring');
      expect((await service.menuStatus('u1', false)).state).toBe('monitoring');
    });

    /**
     * ⚠️ DUE RIGHE, E LA SCELTA NON PUÒ ESSERE «LA PRIMA CHE CAPITA».
     *
     * Una cliente in Monitoraggio che compra il piano alimentare ha due abbonamenti: quello che
     * eroga e quello in coda. Qui c'era un `findFirst` **senza `orderBy`**, quindi il database ne
     * restituiva uno a caso: metà delle volte l'app diceva «Menu in preparazione» a chi è in
     * Monitoraggio — dove i menu non arriveranno mai — e metà «monitoring» a chi aspetta il piano
     * alimentare. Chi decide qual è il piano di adesso è `attivoInCorso`, la stessa funzione
     * dell'erogazione: una domanda, una risposta.
     */
    it('⚠️ Monitoraggio che eroga + piano alimentare in coda: vince chi eroga, non la prima riga', async () => {
      prisma.clientProfile.findUnique.mockResolvedValue({ planStartDate: D(daysFromToday(1)) });
      prisma.subscription.findMany.mockResolvedValue([
        // La coda per prima, di proposito: se qualcuno tornasse a prendere «la prima», si vedrebbe.
        { id: 'coda', status: 'queued', startDate: D(daysFromToday(1)), endDate: D(daysFromToday(90)), plan: { period: '3m' } },
        { id: 'mon', status: 'active', startDate: D(daysFromToday(-30)), endDate: D(daysFromToday(30)), plan: { period: 'monitoring' } },
      ]);
      expect((await service.menuStatus('u1', false)).state).toBe('monitoring');
    });

    /**
     * ⚠️ E il gate delle misure: in Monitoraggio il peso **si chiede, non si impone** (decisione di
     * Simone, 9/8). Senza riconoscere il Monitoraggio in coda, chi paga €19 al mese si ritrovava il
     * popup bloccante che chiede le misure per un menu che non arriverà — e dalla sua parte non c'è
     * nessun modo di uscirne.
     */
    it('⚠️ in Monitoraggio, anche se comincia domani, il popup misure non blocca l\'app', async () => {
      soloInCoda('monitoring');
      prisma.measurement.findFirst.mockResolvedValue(null);
      prisma.measurement.count.mockResolvedValue(0);
      expect(await service.measurementGate('u1')).toMatchObject({ required: false, blocking: false });
    });

    /**
     * ⚠️ E sul piano alimentare la misura di partenza SI CHIEDE, dentro la finestra di anteprima —
     * cioè prima che il piano cominci. È il motivo per cui il primo giorno di menu parte puntuale:
     * chiedendola solo a piano partito, il popup arriverebbe la mattina stessa e il primo giorno si
     * perderebbe. Con la coda invisibile qui usciva «non manca niente», e non gliela chiedeva
     * nessuno.
     */
    it('⚠️ sul piano alimentare in coda la pesata di partenza si chiede lo stesso', async () => {
      soloInCoda('3m');
      prisma.measurement.findFirst.mockResolvedValue(null);
      prisma.measurement.count.mockResolvedValue(0);
      prisma.menuDay.findFirst.mockResolvedValue(null);
      expect(await service.measurementGate('u1')).toMatchObject({ required: true, blocking: true });
    });
  });

  it('SENZA abbonamento attivo il menu non si genera (gating bonifico)', async () => {
    prisma.subscription.findFirst.mockResolvedValue(null);
    // ⚠️ Anche `findMany`: dal 17/8 l'erogazione legge TUTTI gli attivi e sceglie quello in corso
    // (`attivoInCorso`), perché due righe `active` sono legittime e `findFirst` senza `orderBy` ne
    // prendeva una a caso. «Nessun abbonamento attivo» si dice qui, ed è questa riga a dirlo.
    prisma.subscription.findMany.mockResolvedValue([]);
    expect(await service.deliverIfEligible('u1')).toEqual([]);
    expect(prisma.menuDay.upsert).not.toHaveBeenCalled();
  });

  it('periodo di pausa attivo: erogazione sospesa', async () => {
    ((globalThis as any).__eventsMock.activePausePeriod as jest.Mock).mockResolvedValue({ id: 'ev-pausa' });
    expect(await service.deliverIfEligible('u1')).toEqual([]);
  });

  it('la decisione del motore guida livello e source_rule_id', async () => {
    prisma.engineDecision.findFirst.mockResolvedValue({
      ruleId: 'p3',
      action: { levelDelta: 1 },
      date: new Date(),
    });
    prisma.dietDayTemplate.findMany
      .mockResolvedValueOnce([template(1)]) // livello 2 esiste
      .mockResolvedValue([template(1), template(2)]);
    await service.deliverIfEligible('u1');
    const call = prisma.menuDay.upsert.mock.calls[0][0];
    expect(call.create.level).toBe(2);
    expect(call.create.sourceRuleId).toBe('p3');
  });

  it('livello richiesto inesistente: si ripiega sul livello 1', async () => {
    prisma.engineDecision.findFirst.mockResolvedValue({
      ruleId: 'p3',
      action: { levelDelta: 1 },
      date: new Date(),
    });
    prisma.dietDayTemplate.findMany
      .mockResolvedValueOnce([]) // livello 2 non esiste
      .mockResolvedValue([template(1), template(2)]); // fallback livello 1
    await service.deliverIfEligible('u1');
    const call = prisma.menuDay.upsert.mock.calls[0][0];
    expect(call.create.level).toBe(1);
  });

  /**
   * IL BLOCCO CHE FERMA DAVVERO (§15.2 punto 4).
   *
   * Il difetto che questa funzione corregge era proprio un blocco che non bloccava: `dietBlock`
   * era letto da `getMenu` e da `menuStatus` — cioè decideva cosa la cliente *legge* — e mai
   * dall'erogazione. Un test che non guarda `menuDay.upsert` ripeterebbe lo stesso errore.
   */
  it('piano fermato dal nutrizionista: NESSUN giorno nuovo viene scritto', async () => {
    prisma.clientProfile.findUnique.mockResolvedValue({
      planStartDate: D(daysFromToday(-1)),
      regime: 'omnivore',
      mealsPerDay: 5,
      planHeldAt: new Date(),
    });
    expect(await service.deliverIfEligible('u1')).toEqual([]);
    expect(prisma.menuDay.upsert).not.toHaveBeenCalled();
  });

  it('piano fermato: «Rigenera menu» non cancella niente', async () => {
    // Cancellerebbe i giorni futuri e non potrebbe rierogarli (l'erogazione è ferma): la cliente
    // resterebbe senza i giorni che il blocco le lascia di proposito.
    prisma.clientProfile.findUnique.mockResolvedValue({
      planStartDate: D(daysFromToday(-1)),
      regime: 'omnivore',
      mealsPerDay: 5,
      planHeldAt: new Date(),
    });
    const res = await service.regenerateFromToday('u1');
    expect(res).toEqual({ removed: 0, delivered: [] });
    expect(prisma.menuDay.deleteMany).not.toHaveBeenCalled();
  });

  it('una decisione con una CAUSA non viene applicata, anche se non è flaggata', async () => {
    // Dal 13/8 le decisioni di una causa già in coda nascono senza flag — servono al tono del
    // messaggio quotidiano, non a essere eseguite. Se il menu le pescasse, un guardrail che dice
    // «fermati, deve guardarci il nutrizionista» finirebbe per cambiare il piano da solo: il
    // contrario esatto di quello per cui esiste. Qui si verifica il `where`, perché è lì che vive
    // la protezione (il mock risponderebbe di sì a qualunque domanda).
    prisma.engineDecision.findFirst.mockResolvedValue(null);
    await service.deliverIfEligible('u1');
    expect(prisma.engineDecision.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ flaggedForReview: false, reasonKey: null }),
      }),
    );
  });

  it('niente menu senza plan_start_date', async () => {
    prisma.clientProfile.findUnique.mockResolvedValue({ planStartDate: null });
    expect(await service.deliverIfEligible('u1')).toEqual([]);
  });

  it('troppo presto: piano che inizia tra 5 giorni → nessuna erogazione', async () => {
    prisma.clientProfile.findUnique.mockResolvedValue({
      planStartDate: D(daysFromToday(5)),
      regime: 'omnivore',
      mealsPerDay: 5,
    });
    expect(await service.deliverIfEligible('u1')).toEqual([]);
  });

  it('finestra di anticipo: piano tra 2 giorni → eroga (visible_from = start - 2)', async () => {
    prisma.clientProfile.findUnique.mockResolvedValue({
      planStartDate: D(daysFromToday(2)),
      regime: 'omnivore',
      dietStyle: 'mediterranean',
      mealsPerDay: 5,
    });
    const created = await service.deliverIfEligible('u1');
    expect(created).toEqual([daysFromToday(2), daysFromToday(3)]);
  });

  it('buffer: ha già un menu per un giorno FUTURO → non eroga altro', async () => {
    prisma.menuDay.findFirst.mockResolvedValue({ date: D(daysFromToday(1)) });
    expect(await service.deliverIfEligible('u1')).toEqual([]);
  });

  it('ultimo giorno del ciclo (menu di oggi presente) + misura inviata → eroga SUBITO i 2 successivi', async () => {
    // Scelta prodotto (Simone): l'invio delle misure fa arrivare subito i prossimi giorni,
    // senza aspettare che finisca il ciclo corrente né il check-in del giorno dopo.
    prisma.menuDay.findFirst.mockResolvedValue({ date: D(todayIso) });
    prisma.dailyCheckin.findUnique.mockResolvedValue(null); // il check-in NON è richiesto
    const created = await service.deliverIfEligible('u1');
    expect(created).toEqual([daysFromToday(1), daysFromToday(2)]);
  });

  it('ultimo giorno del ciclo SENZA la misura → resta bloccato (gate misure)', async () => {
    prisma.menuDay.findFirst.mockResolvedValue({ date: D(todayIso) });
    prisma.measurement.findFirst.mockResolvedValue(null); // manca la misura del ciclo
    expect(await service.deliverIfEligible('u1')).toEqual([]);
  });

  it('giorni scaduti SENZA la misura del ciclo → resta bloccato (gate misure)', async () => {
    prisma.menuDay.findFirst.mockResolvedValue({ date: D(daysFromToday(-1)) });
    prisma.measurement.findFirst.mockResolvedValue(null);
    expect(await service.deliverIfEligible('u1')).toEqual([]);
  });

  it('giorni scaduti CON la misura → eroga i 2 successivi (il check-in non è richiesto)', async () => {
    prisma.menuDay.findFirst.mockResolvedValue({ date: D(daysFromToday(-1)) });
    prisma.dailyCheckin.findUnique.mockResolvedValue(null); // nessun check-in
    const created = await service.deliverIfEligible('u1');
    expect(created).toEqual([todayIso, daysFromToday(1)]);
  });

  it('mai sovrascrivere un giorno già erogato (upsert con update vuoto)', async () => {
    await service.deliverIfEligible('u1');
    const call = prisma.menuDay.upsert.mock.calls[0][0];
    expect(call.update).toEqual({});
  });

  it('valutazione: upsert per cliente+ricetta+giorno, mai nel futuro', async () => {
    await service.rateRecipe('u1', { recipeId: 'r1', stars: 4, tags: ['buono'] });
    expect(prisma.recipeRating.upsert).toHaveBeenCalled();
    await expect(
      service.rateRecipe('u1', { recipeId: 'r1', stars: 4, date: daysFromToday(2) }),
    ).rejects.toThrow();
  });

  it('pending: pasti dei giorni erogati senza valutazione', async () => {
    prisma.menuDay.findMany.mockResolvedValue([
      { date: D(todayIso), meals: [{ slot: 'lunch', recipeId: 'r1', name: 'Farro', kcal: 520 }] },
    ]);
    prisma.recipeRating.findMany.mockResolvedValue([]);
    const pending = await service.pendingRatings('u1');
    expect(pending).toHaveLength(1);
    expect(pending[0].recipeId).toBe('r1');
  });

  /**
   * ⚠️ LE STELLE MAI DATE NON ORIENTANO PIÙ IL MOTORE (decisione della notte del 18/8). Il 3 che
   * l'app scrive quando la cliente tocca solo «Seguita / Non seguita» è un valore di scorta: qui
   * pesava sul punteggio del pool, cioè su cosa le viene riproposto.
   */
  it('⚠️ il punteggio del pool legge solo le stelle DATE', async () => {
    prisma.recipeRating.findMany.mockClear();
    await service.deliverIfEligible('u1').catch(() => undefined);
    const letture = prisma.recipeRating.findMany.mock.calls.map((c: any) => c[0]?.where ?? {});
    expect(letture.some((w: any) => w?.NOT?.tags?.has === 'stelle_non_date')).toBe(true);
  });

  it('lista spesa: aggrega gli ingredienti per nome e unità', async () => {
    prisma.menuDay.findMany.mockResolvedValue([
      { date: D(todayIso), meals: [{ slot: 'lunch', recipeId: 'r1' }, { slot: 'dinner', recipeId: 'r2' }] },
    ]);
    prisma.recipe.findMany.mockResolvedValue([
      { id: 'r1', ingredients: [{ name: 'Zucchine', qty: 100, unit: 'g' }] },
      { id: 'r2', ingredients: [{ name: 'zucchine', qty: 150, unit: 'g' }, { name: 'Uova', qty: 2, unit: 'pz' }] },
    ]);
    const list: any = await service.shoppingList('u1');
    const zucchine = list.items.find((i: any) => i.name.toLowerCase() === 'zucchine');
    expect(zucchine.qty).toBe(250);
    expect(list.items).toHaveLength(2);
  });

  /**
   * ⚠️ LA LISTA VECCHIA NON SI RESTITUIVA PIÙ AGGIORNATA DA NESSUNO. Se la riga esisteva, si
   * tornava quella: porzioni scalate, piatti cambiati in chat e grammature corrette dalla
   * nutrizionista non arrivavano mai nel carrello, e la lista *sembrava* la lista di quei giorni.
   */
  it('⚠️ la lista già in tabella si RIFÀ: la porzione scalata arriva anche a chi ce l\'aveva già', async () => {
    prisma.menuDay.findMany.mockResolvedValue([
      { date: D(todayIso), meals: [{ slot: 'lunch', recipeId: 'r1', porzione: 1.8 }] },
    ]);
    prisma.recipe.findMany.mockResolvedValue([{ id: 'r1', ingredients: [{ name: 'Farro', qty: 80, unit: 'g' }] }]);
    prisma.shoppingList.findUnique.mockResolvedValue({
      id: 'sl1',
      items: [{ name: 'Farro', qty: 80, unit: 'g', checked: false }],
    });
    prisma.shoppingList.update.mockImplementation(({ data }: any) => Promise.resolve({ id: 'sl1', ...data }));
    const list: any = await service.shoppingList('u1');
    expect(list.items).toEqual([{ name: 'Farro', qty: 144, unit: 'g', checked: false }]);
  });

  it('⚠️ e le spunte restano: è l\'unica cosa che il server non sa rifare da solo', async () => {
    prisma.menuDay.findMany.mockResolvedValue([
      { date: D(todayIso), meals: [{ slot: 'lunch', recipeId: 'r1', porzione: 1.8 }] },
    ]);
    prisma.recipe.findMany.mockResolvedValue([{ id: 'r1', ingredients: [{ name: 'Farro', qty: 80, unit: 'g' }] }]);
    prisma.shoppingList.findUnique.mockResolvedValue({
      id: 'sl1',
      items: [{ name: 'Farro', qty: 80, unit: 'g', checked: true }],
    });
    prisma.shoppingList.update.mockImplementation(({ data }: any) => Promise.resolve({ id: 'sl1', ...data }));
    const list: any = await service.shoppingList('u1');
    expect(list.items[0]).toEqual({ name: 'Farro', qty: 144, unit: 'g', checked: true });
  });

  /**
   * ⚠️ Una scrittura per ogni lettura muoverebbe `updatedAt` senza che sia successo niente — e la
   * lista si rilegge molte volte al giorno, con l'app in mano davanti a uno scaffale.
   */
  it('⚠️ se non è cambiato niente NON scrive: torna la riga com\'era', async () => {
    prisma.menuDay.findMany.mockResolvedValue([
      { date: D(todayIso), meals: [{ slot: 'lunch', recipeId: 'r1' }] },
    ]);
    prisma.recipe.findMany.mockResolvedValue([{ id: 'r1', ingredients: [{ name: 'Farro', qty: 80, unit: 'g' }] }]);
    const riga = { id: 'sl1', items: [{ name: 'Farro', qty: 80, unit: 'g', checked: true }] };
    prisma.shoppingList.findUnique.mockResolvedValue(riga);
    const list: any = await service.shoppingList('u1');
    expect(list).toBe(riga);
    expect(prisma.shoppingList.update).not.toHaveBeenCalled();
    expect(prisma.shoppingList.create).not.toHaveBeenCalled();
  });

  // --- Finestra di getMenu ---
  // Emula il comportamento di Prisma (orderBy + take) su uno storico più lungo della
  // finestra: è l'unico modo per far vedere al test la differenza tra "i primi 30" e
  // "gli ultimi 30". 45 giorni consecutivi che finiscono DOPODOMANI (storico + oggi +
  // i due giorni già erogati in avanti), come una cliente al secondo mese di piano.
  const storicoLungo = () => {
    const rows = Array.from({ length: 45 }, (_, i) => ({
      id: `md${i}`,
      date: D(daysFromToday(i - 42)),
      meals: [{ slot: 'lunch', recipeId: 'r1', name: 'Farro', kcal: 520 }],
    }));
    prisma.menuDay.findMany.mockImplementation((args: any) => {
      if (args?.orderBy?.date !== 'asc' && args?.orderBy?.date !== 'desc') return Promise.resolve([]);
      const ordered = args.orderBy.date === 'desc' ? [...rows].reverse() : [...rows];
      return Promise.resolve(args.take ? ordered.slice(0, args.take) : ordered);
    });
    return rows;
  };

  it('getMenu: oltre i 30 giorni erogati la finestra contiene comunque OGGI', async () => {
    storicoLungo();
    const res: any = await service.getMenu('u1');
    const giorni = res.days.map((d: any) => d.date.toISOString().slice(0, 10));
    expect(giorni).toContain(todayIso);
    expect(giorni).toContain(daysFromToday(2)); // e i giorni già erogati in avanti
  });

  it('getMenu: i giorni tornano in ordine crescente (la pagina Menu ci conta)', async () => {
    storicoLungo();
    const res: any = await service.getMenu('u1');
    const giorni = res.days.map((d: any) => d.date.toISOString().slice(0, 10));
    expect(giorni).toEqual([...giorni].sort());
    expect(giorni).toHaveLength(30);
  });

  it('getMenu: con giorni futuri visibili lo stato è "available", non "preparing"', async () => {
    storicoLungo();
    const res: any = await service.getMenu('u1');
    expect(res.status.state).toBe('available');
  });

  it('getMenu: con from E to insieme restano ENTRAMBI i limiti', async () => {
    prisma.menuDay.findMany.mockResolvedValue([]);
    await service.getMenu('u1', daysFromToday(-3), daysFromToday(3));
    const where = prisma.menuDay.findMany.mock.calls.at(-1)[0].where;
    expect(where.date.gte).toEqual(D(daysFromToday(-3)));
    expect(where.date.lte).toEqual(D(daysFromToday(3)));
  });
});

describe('MenuService — DayCombo (giornate bilanciate, opt-in)', () => {
  const today = new Date().toISOString().slice(0, 10);
  const DD = (iso: string) => new Date(iso + 'T00:00:00.000Z');
  // Pool: 2 candidati per slot; target livello 1400 kcal (±15% = [1190,1610]).
  const recipes = [
    { id: 'b1', name: 'Colazione A', kcal: 300, macros: { protein_g: 15, carbs_g: 40, fat_g: 8 } },
    { id: 'b2', name: 'Colazione B', kcal: 350, macros: { protein_g: 18, carbs_g: 45, fat_g: 9 } },
    { id: 'l1', name: 'Pranzo A', kcal: 500, macros: { protein_g: 30, carbs_g: 55, fat_g: 15 } },
    { id: 'l2', name: 'Pranzo B', kcal: 600, macros: { protein_g: 35, carbs_g: 60, fat_g: 18 } },
    { id: 'd1', name: 'Cena A', kcal: 500, macros: { protein_g: 32, carbs_g: 40, fat_g: 16 } },
    { id: 'd2', name: 'Cena B', kcal: 700, macros: { protein_g: 40, carbs_g: 60, fat_g: 22 } },
  ];
  const tmpl = (dayIndex: number, b: string, l: string, d: string) => ({
    dayIndex,
    level: 1,
    // Slot VERI del sistema. Erano scritti in italiano ('colazione', 'pranzo', 'cena'): nomi che
    // non corrispondono a nessuno slot reale, e che dall'11/8 renderebbero la giornata incompleta
    // agli occhi del controllo di §15.4 — cioè non erogabile. Non aveva conseguenze finché nessuno
    // guardava i pasti; ora le ha.
    meals: [{ slot: 'breakfast', recipeId: b }, { slot: 'lunch', recipeId: l }, { slot: 'dinner', recipeId: d }],
  });

  function build(daycombo: boolean) {
    const prisma: any = {
      productRule: { findUnique: jest.fn().mockResolvedValue(null) },
      equivalenceGroup: { findMany: jest.fn().mockResolvedValue([]) },
      clientProfile: {
        findUnique: jest.fn().mockResolvedValue({
          planStartDate: DD(today), regime: 'omnivore', dietStyle: 'mediterranean', mealsPerDay: 3,
          intolerances: [], dislikedFoods: [], assignedNutritionistId: null,
        }),
      },
      subscription: { findFirst: jest.fn().mockResolvedValue({ id: 'sub', status: 'active' }), findMany: jest.fn().mockResolvedValue([{ id: 'sub', status: 'active', startDate: null, endDate: null }]) },
      menuDay: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn().mockResolvedValue({}) },
      dailyCheckin: { findUnique: jest.fn().mockResolvedValue(null) },
      measurement: { findFirst: jest.fn().mockResolvedValue({ id: 'm1' }), count: jest.fn().mockResolvedValue(1) },
      engineDecision: { findFirst: jest.fn().mockResolvedValue(null) },
      diet: { findFirst: jest.fn().mockResolvedValue({ id: 'diet1', levels: [{ level: 1, kcal: 1400 }] }) },
      dietDayTemplate: { findMany: jest.fn().mockResolvedValue([tmpl(1, 'b1', 'l1', 'd1'), tmpl(2, 'b2', 'l2', 'd2')]) },
      recipe: { findMany: jest.fn().mockResolvedValue(recipes), findUnique: jest.fn() },
      menuWeight: { findMany: jest.fn().mockResolvedValue([]) },
      recipeRating: { findMany: jest.fn().mockResolvedValue([]) },
      escalation: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
      notification: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(), updateMany: jest.fn() },
    };
    const config = {
      getNumber: jest.fn((k: string, def?: number) =>
        Promise.resolve(({ menu_days_delivered: 2, menu_visible_days_before_start: 2, menu_penalty_repeat: 0, menu_variety_min_gap_days: 0 } as Record<string, number>)[k] ?? def)),
      getBool: jest.fn((k: string, def?: boolean) => Promise.resolve(k === 'menu_daycombo_enabled' ? daycombo : (def ?? false))),
    };
    const events = { activePausePeriod: jest.fn().mockResolvedValue(null) };
    const dietAgent = { stateFor: jest.fn().mockResolvedValue('normale') };
    const { DayComboService } = require('./day-combo.service');
    const service = new MenuService(
      prisma as PrismaService,
      config as unknown as ConfigParamsService,
      { log: jest.fn() } as unknown as AuditService,
      events as any,
      dietAgent as any,
      new DayComboService(),
      kcalNeedStub(), pushStub(),
    );
    return { service, prisma };
  }

  it('compone le giornate dentro la banda kcal del livello usando solo ricette del pool', async () => {
    const { service, prisma } = build(true);
    const created = await service.deliverIfEligible('u1');
    expect(created).toHaveLength(2);
    const poolIds = recipes.map((r) => r.id);
    for (const call of prisma.menuDay.upsert.mock.calls) {
      const meals = call[0].create.meals as { slot: string; recipeId: string; kcal: number }[];
      expect(meals.map((m) => m.slot)).toEqual(['breakfast', 'lunch', 'dinner']);
      meals.forEach((m) => expect(poolIds).toContain(m.recipeId));
      const kcal = meals.reduce((a, m) => a + m.kcal, 0);
      expect(kcal).toBeGreaterThanOrEqual(1400 * 0.85);
      expect(kcal).toBeLessThanOrEqual(1400 * 1.15);
    }
  });

  it('con DayCombo spento eroga comunque i giorni (fallback ai template)', async () => {
    const { service, prisma } = build(false);
    const created = await service.deliverIfEligible('u1');
    expect(created).toHaveLength(2);
    expect(prisma.menuDay.upsert).toHaveBeenCalledTimes(2);
  });
});

describe('MenuService — R11 penalità di ripetizione (varietà)', () => {
  const today = new Date().toISOString().slice(0, 10);
  const DD = (iso: string) => new Date(iso + 'T00:00:00.000Z');
  const recipes = [
    { id: 'l1', name: 'Pranzo A', kcal: 500, macros: { protein_g: 30, carbs_g: 55, fat_g: 15 } },
    { id: 'l2', name: 'Pranzo B', kcal: 500, macros: { protein_g: 30, carbs_g: 55, fat_g: 15 } },
  ];
  /**
   * Giornata completa per una dieta a 5 pasti, con il PRANZO variabile: è quello su cui questi
   * test asseriscono. Gli altri quattro pasti ci sono perché dall'11/8 l'erogazione serve solo le
   * giornate complete (§15.4): un template col solo pranzo non verrebbe erogato affatto, e il test
   * misurerebbe il nulla.
   */
  const tmpl = (dayIndex: number, l: string) => ({
    dayIndex,
    level: 1,
    meals: [
      { slot: 'breakfast', recipeId: 'b1' },
      { slot: 'morning_snack', recipeId: 's1' },
      { slot: 'lunch', recipeId: l },
      { slot: 'afternoon_snack', recipeId: 'm1' },
      { slot: 'dinner', recipeId: 'd1' },
    ],
  });

  function build(penalty: number, recentLunch: string[]) {
    const prisma: any = {
      productRule: { findUnique: jest.fn().mockResolvedValue(null) },
      equivalenceGroup: { findMany: jest.fn().mockResolvedValue([]) },
      clientProfile: { findUnique: jest.fn().mockResolvedValue({ planStartDate: DD(today), regime: 'omnivore', dietStyle: 'mediterranean', mealsPerDay: 5, intolerances: [], dislikedFoods: [], assignedNutritionistId: null }) },
      subscription: { findFirst: jest.fn().mockResolvedValue({ id: 'sub', status: 'active' }), findMany: jest.fn().mockResolvedValue([{ id: 'sub', status: 'active', startDate: null, endDate: null }]) },
      // findMany qui è consumata SOLO dalla penalità (le giornate recenti); ne conto le ripetizioni di l1.
      menuDay: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue(recentLunch.map((r) => ({ meals: [{ slot: 'lunch', recipeId: r }] }))),
        upsert: jest.fn().mockResolvedValue({}),
      },
      dailyCheckin: { findUnique: jest.fn().mockResolvedValue(null) },
      measurement: { findFirst: jest.fn().mockResolvedValue({ id: 'm1' }), count: jest.fn().mockResolvedValue(1) },
      engineDecision: { findFirst: jest.fn().mockResolvedValue(null) },
      diet: { findFirst: jest.fn().mockResolvedValue({ id: 'diet1' }) },
      dietDayTemplate: { findMany: jest.fn().mockResolvedValue([tmpl(1, 'l1'), tmpl(2, 'l2')]) },
      recipe: { findMany: jest.fn().mockResolvedValue(recipes), findUnique: jest.fn() },
      menuWeight: { findMany: jest.fn().mockResolvedValue([]) },
      recipeRating: { findMany: jest.fn().mockResolvedValue([]) },
      escalation: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
      notification: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(), updateMany: jest.fn() },
    };
    const config = {
      getNumber: jest.fn((k: string, def?: number) => Promise.resolve(({ menu_days_delivered: 2, menu_visible_days_before_start: 2, menu_penalty_repeat: penalty, menu_repeat_window_days: 14, menu_variety_min_gap_days: 0 } as Record<string, number>)[k] ?? def)),
      getBool: jest.fn((_k: string, def?: boolean) => Promise.resolve(def ?? false)),
    };
    const events = { activePausePeriod: jest.fn().mockResolvedValue(null) };
    const dietAgent = { stateFor: jest.fn().mockResolvedValue('normale') };
    const { DayComboService } = require('./day-combo.service');
    const service = new MenuService(prisma as PrismaService, config as unknown as ConfigParamsService, { log: jest.fn() } as unknown as AuditService, events as any, dietAgent as any, new DayComboService(), kcalNeedStub(), pushStub());
    return { service, prisma };
  }

  const lunchesOf = (prisma: any) =>
    prisma.menuDay.upsert.mock.calls.map((c: any) => (c[0].create.meals as { slot: string; recipeId: string }[]).find((m) => m.slot === 'lunch')?.recipeId);

  it('penalità attiva: la ricetta servita di recente viene evitata a favore dell\'alternativa', async () => {
    const { service, prisma } = build(1, ['l1', 'l1', 'l1']); // l1 ripetuta di recente
    await service.deliverIfEligible('u1');
    expect(lunchesOf(prisma)).toEqual(['l2', 'l2']); // entrambe le giornate scelgono l2
  });

  it('penalità disattivata (0): resta la ricetta del template (comportamento invariato)', async () => {
    const { service, prisma } = build(0, ['l1', 'l1', 'l1']);
    await service.deliverIfEligible('u1');
    expect(lunchesOf(prisma)).toEqual(['l1', 'l2']); // template: giorno1 l1, giorno2 l2
  });
});

describe('MenuService — R12 modulazione da objective (mantenimento = efficacia neutra)', () => {
  const today = new Date().toISOString().slice(0, 10);
  const DD = (iso: string) => new Date(iso + 'T00:00:00.000Z');
  const recipes = [
    { id: 'l1', name: 'Pranzo A', kcal: 500, macros: { protein_g: 30, carbs_g: 55, fat_g: 15 } },
    { id: 'l2', name: 'Pranzo B', kcal: 500, macros: { protein_g: 30, carbs_g: 55, fat_g: 15 } },
  ];
  /**
   * Giornata completa per una dieta a 5 pasti, con il PRANZO variabile: è quello su cui questi
   * test asseriscono. Gli altri quattro pasti ci sono perché dall'11/8 l'erogazione serve solo le
   * giornate complete (§15.4): un template col solo pranzo non verrebbe erogato affatto, e il test
   * misurerebbe il nulla.
   */
  const tmpl = (dayIndex: number, l: string) => ({
    dayIndex,
    level: 1,
    meals: [
      { slot: 'breakfast', recipeId: 'b1' },
      { slot: 'morning_snack', recipeId: 's1' },
      { slot: 'lunch', recipeId: l },
      { slot: 'afternoon_snack', recipeId: 'm1' },
      { slot: 'dinner', recipeId: 'd1' },
    ],
  });

  function build(objective: string) {
    const prisma: any = {
      productRule: { findUnique: jest.fn().mockResolvedValue(null) },
      equivalenceGroup: { findMany: jest.fn().mockResolvedValue([]) },
      clientProfile: { findUnique: jest.fn().mockResolvedValue({ planStartDate: DD(today), regime: 'omnivore', dietStyle: 'mediterranean', mealsPerDay: 5, intolerances: [], dislikedFoods: [], assignedNutritionistId: null }) },
      subscription: { findFirst: jest.fn().mockResolvedValue({ id: 'sub', status: 'active' }), findMany: jest.fn().mockResolvedValue([{ id: 'sub', status: 'active', startDate: null, endDate: null }]) },
      menuDay: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn().mockResolvedValue({}) },
      dailyCheckin: { findUnique: jest.fn().mockResolvedValue(null) },
      measurement: { findFirst: jest.fn().mockResolvedValue({ id: 'm1' }), count: jest.fn().mockResolvedValue(1) },
      engineDecision: { findFirst: jest.fn().mockResolvedValue(null) },
      diet: { findFirst: jest.fn().mockResolvedValue({ id: 'diet1', objective }) },
      dietDayTemplate: { findMany: jest.fn().mockResolvedValue([tmpl(1, 'l1'), tmpl(2, 'l2')]) },
      recipe: { findMany: jest.fn().mockResolvedValue(recipes), findUnique: jest.fn() },
      // l2 = ricetta "che fa perdere di più" (efficacia appresa alta); l1 = più gradita.
      menuWeight: { findMany: jest.fn().mockResolvedValue([{ recipeId: 'l2', score: 5, samples: 5 }]) },
      /**
       * ⚠️ 4★ contro 2★, non 5★ contro 1★ (cambiato il 12/8 con la nuova scala delle stelle).
       *
       * Con `(stelle − 1) / 4` una stella vale **zero** e cinque vale **uno**: su questa fixture
       * `l2` faceva 1,0 (efficacia piena + gradimento zero) e `l1` faceva 1,0 (efficacia zero +
       * gradimento pieno) — un **pareggio esatto**, e il test smetteva di misurare la regola che
       * dichiara per misurare come si rompono i pareggi. Con 4★/2★ le due voci restano quelle di
       * prima — `l2` efficace, `l1` più gradita — e ogni test torna a dipendere solo dal peso che
       * sta verificando.
       */
      recipeRating: { findMany: jest.fn().mockResolvedValue([{ recipeId: 'l1', stars: 4 }, { recipeId: 'l2', stars: 2 }]) },
      escalation: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
      notification: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(), updateMany: jest.fn() },
    };
    const config = {
      // R12: mantenimento = efficacia RIDOTTA ma non zero (0,1 quando il dimagrimento vale 1).
      getNumber: jest.fn((k: string, def?: number) => Promise.resolve(({ menu_days_delivered: 2, menu_visible_days_before_start: 2, menu_maintenance_w_eff: 0.1, menu_penalty_repeat: 0, menu_variety_min_gap_days: 0 } as Record<string, number>)[k] ?? def)),
      getBool: jest.fn((_k: string, def?: boolean) => Promise.resolve(def ?? false)),
    };
    const events = { activePausePeriod: jest.fn().mockResolvedValue(null) };
    const dietAgent = { stateFor: jest.fn().mockResolvedValue('normale') };
    const { DayComboService } = require('./day-combo.service');
    const service = new MenuService(prisma as PrismaService, config as unknown as ConfigParamsService, { log: jest.fn() } as unknown as AuditService, events as any, dietAgent as any, new DayComboService(), kcalNeedStub(), pushStub());
    return { service, prisma };
  }

  const lunchesOf = (prisma: any) =>
    prisma.menuDay.upsert.mock.calls.map((c: any) => (c[0].create.meals as { slot: string; recipeId: string }[]).find((m) => m.slot === 'lunch')?.recipeId);

  it('DIMAGRIMENTO (w_eff=1): l\'efficacia appresa alta batte il gusto → vince l2', async () => {
    const { service, prisma } = build('dimagrimento');
    await service.deliverIfEligible('u1');
    expect(lunchesOf(prisma)).toEqual(['l2', 'l2']); // efficacia 1.0 supera il gradimento di l1
  });

  it('MANTENIMENTO (w_eff=0,1): efficacia ridotta ma non zero → a gradimento più alto vince il gusto (l1)', async () => {
    const { service, prisma } = build('mantenimento');
    await service.deliverIfEligible('u1');
    expect(lunchesOf(prisma)).toEqual(['l1', 'l1']); // l1 (5★) batte l2 (1★) perché l'efficacia pesa solo 0,1
  });
});

describe('MenuService — regola ripetizione bigiornaliera (menu_repeat_two_days)', () => {
  const today = new Date().toISOString().slice(0, 10);
  const DD = (iso: string) => new Date(iso + 'T00:00:00.000Z');
  // r1 e r2: stesso slot, stesse kcal, alimenti principali diversi (orata/branzino).
  // menuWeight su r1 → r1 vince lo scoring per ENTRAMBI i giorni (base = r1, r1).
  const recipes = [
    { id: 'r1', name: 'Orata al forno', kcal: 500, macros: { protein_g: 30, carbs_g: 55, fat_g: 15 }, ingredients: [{ name: 'Orata', qty: 150, unit: 'g' }] },
    { id: 'r2', name: 'Branzino in crosta', kcal: 500, macros: { protein_g: 30, carbs_g: 55, fat_g: 15 }, ingredients: [{ name: 'Branzino', qty: 150, unit: 'g' }] },
  ];
  /**
   * Giornata completa per una dieta a 5 pasti, con il PRANZO variabile: è quello su cui questi
   * test asseriscono. Gli altri quattro pasti ci sono perché dall'11/8 l'erogazione serve solo le
   * giornate complete (§15.4): un template col solo pranzo non verrebbe erogato affatto, e il test
   * misurerebbe il nulla.
   */
  const tmpl = (dayIndex: number, l: string) => ({
    dayIndex,
    level: 1,
    meals: [
      { slot: 'breakfast', recipeId: 'b1' },
      { slot: 'morning_snack', recipeId: 's1' },
      { slot: 'lunch', recipeId: l },
      { slot: 'afternoon_snack', recipeId: 'm1' },
      { slot: 'dinner', recipeId: 'd1' },
    ],
  });

  // ruleEnabled: valore di ProductRule.enabled (null = regola non impostata → default off).
  function build(ruleEnabled: boolean | null, groups: { id: string; members: { items: string[] } }[]) {
    const prisma: any = {
      productRule: { findUnique: jest.fn().mockResolvedValue(ruleEnabled === null ? null : { enabled: ruleEnabled }) },
      equivalenceGroup: { findMany: jest.fn().mockResolvedValue(groups) },
      clientProfile: { findUnique: jest.fn().mockResolvedValue({ planStartDate: DD(today), regime: 'omnivore', dietStyle: 'mediterranean', mealsPerDay: 5, intolerances: [], dislikedFoods: [], assignedNutritionistId: null }) },
      subscription: { findFirst: jest.fn().mockResolvedValue({ id: 'sub', status: 'active' }), findMany: jest.fn().mockResolvedValue([{ id: 'sub', status: 'active', startDate: null, endDate: null }]) },
      menuDay: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn().mockResolvedValue({}) },
      dailyCheckin: { findUnique: jest.fn().mockResolvedValue(null) },
      measurement: { findFirst: jest.fn().mockResolvedValue({ id: 'm1' }), count: jest.fn().mockResolvedValue(1) },
      engineDecision: { findFirst: jest.fn().mockResolvedValue(null) },
      diet: { findFirst: jest.fn().mockResolvedValue({ id: 'diet1', objective: 'dimagrimento' }) },
      dietDayTemplate: { findMany: jest.fn().mockResolvedValue([tmpl(1, 'r1'), tmpl(2, 'r2')]) },
      recipe: { findMany: jest.fn().mockResolvedValue(recipes), findUnique: jest.fn() },
      // r1 con efficacia appresa alta → vince lo scoring in entrambi i giorni (base r1,r1).
      menuWeight: { findMany: jest.fn().mockResolvedValue([{ recipeId: 'r1', score: 5, samples: 5 }]) },
      recipeRating: { findMany: jest.fn().mockResolvedValue([]) },
      escalation: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
      notification: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(), updateMany: jest.fn() },
    };
    const config = {
      getNumber: jest.fn((k: string, def?: number) => Promise.resolve(({ menu_days_delivered: 2, menu_visible_days_before_start: 2, repeat_twin_kcal_tolerance_pct: 15, menu_penalty_repeat: 0, menu_variety_min_gap_days: 0 } as Record<string, number>)[k] ?? def)),
      getBool: jest.fn((_k: string, def?: boolean) => Promise.resolve(def ?? false)),
    };
    const events = { activePausePeriod: jest.fn().mockResolvedValue(null) };
    const dietAgent = { stateFor: jest.fn().mockResolvedValue('normale') };
    const { DayComboService } = require('./day-combo.service');
    const service = new MenuService(prisma as PrismaService, config as unknown as ConfigParamsService, { log: jest.fn() } as unknown as AuditService, events as any, dietAgent as any, new DayComboService(), kcalNeedStub(), pushStub());
    return { service, prisma };
  }

  const lunchesOf = (prisma: any) =>
    prisma.menuDay.upsert.mock.calls.map((c: any) => (c[0].create.meals as { slot: string; recipeId: string }[]).find((m) => m.slot === 'lunch')?.recipeId);

  const grp = [{ id: 'g1', members: { items: ['orata', 'branzino'] } }];

  it('regola OFF (default): il 2° giorno resta la ricetta composta dal motore (r1)', async () => {
    const { service, prisma } = build(null, grp);
    await service.deliverIfEligible('u1');
    expect(lunchesOf(prisma)).toEqual(['r1', 'r1']); // nessun override gemella
  });

  it('regola ON: il 2° giorno ripropone lo STESSO alimento con ricetta DIVERSA (gemella r2)', async () => {
    const { service, prisma } = build(true, grp);
    await service.deliverIfEligible('u1');
    expect(lunchesOf(prisma)).toEqual(['r1', 'r2']); // giorno1 orata → giorno2 branzino (stesso gruppo)
  });

  it('regola ON ma senza gruppo di equivalenza approvato: inerte, resta il pasto composto (r1)', async () => {
    const { service, prisma } = build(true, []); // il nutrizionista non ha ancora approvato gruppi
    await service.deliverIfEligible('u1');
    expect(lunchesOf(prisma)).toEqual(['r1', 'r1']);
  });
});

describe('MenuService — override PER DIETA (ProductRule) letto dal motore', () => {
  const today = new Date().toISOString().slice(0, 10);
  const DD = (iso: string) => new Date(iso + 'T00:00:00.000Z');
  const recipes = [
    { id: 'l1', name: 'Pranzo A', kcal: 500, macros: { protein_g: 30, carbs_g: 55, fat_g: 15 } },
    { id: 'l2', name: 'Pranzo B', kcal: 500, macros: { protein_g: 30, carbs_g: 55, fat_g: 15 } },
  ];
  /**
   * Giornata completa per una dieta a 5 pasti, con il PRANZO variabile: è quello su cui questi
   * test asseriscono. Gli altri quattro pasti ci sono perché dall'11/8 l'erogazione serve solo le
   * giornate complete (§15.4): un template col solo pranzo non verrebbe erogato affatto, e il test
   * misurerebbe il nulla.
   */
  const tmpl = (dayIndex: number, l: string) => ({
    dayIndex,
    level: 1,
    meals: [
      { slot: 'breakfast', recipeId: 'b1' },
      { slot: 'morning_snack', recipeId: 's1' },
      { slot: 'lunch', recipeId: l },
      { slot: 'afternoon_snack', recipeId: 'm1' },
      { slot: 'dinner', recipeId: 'd1' },
    ],
  });

  // Global penalità = 0 (spenta). L'override per dieta la porta a `penaltyOverride`.
  function build(penaltyOverride: number | null, recentLunch: string[]) {
    const prisma: any = {
      productRule: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue(
          penaltyOverride == null ? [] : [{ ruleCode: 'menu_penalty_repeat', enabled: true, params: { value: penaltyOverride } }],
        ),
      },
      equivalenceGroup: { findMany: jest.fn().mockResolvedValue([]) },
      clientProfile: { findUnique: jest.fn().mockResolvedValue({ planStartDate: DD(today), regime: 'omnivore', dietStyle: 'mediterranean', mealsPerDay: 5, intolerances: [], dislikedFoods: [], assignedNutritionistId: null }) },
      subscription: { findFirst: jest.fn().mockResolvedValue({ id: 'sub', status: 'active' }), findMany: jest.fn().mockResolvedValue([{ id: 'sub', status: 'active', startDate: null, endDate: null }]) },
      menuDay: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue(recentLunch.map((r) => ({ meals: [{ slot: 'lunch', recipeId: r }] }))),
        upsert: jest.fn().mockResolvedValue({}),
      },
      dailyCheckin: { findUnique: jest.fn().mockResolvedValue(null) },
      measurement: { findFirst: jest.fn().mockResolvedValue({ id: 'm1' }), count: jest.fn().mockResolvedValue(1) },
      engineDecision: { findFirst: jest.fn().mockResolvedValue(null) },
      diet: { findFirst: jest.fn().mockResolvedValue({ id: 'diet1' }) },
      dietDayTemplate: { findMany: jest.fn().mockResolvedValue([tmpl(1, 'l1'), tmpl(2, 'l2')]) },
      recipe: { findMany: jest.fn().mockResolvedValue(recipes), findUnique: jest.fn() },
      menuWeight: { findMany: jest.fn().mockResolvedValue([]) },
      recipeRating: { findMany: jest.fn().mockResolvedValue([]) },
      escalation: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
      notification: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(), updateMany: jest.fn() },
    };
    // Global: penalità 0 (spenta) e finestra 14. L'override deve avere la precedenza.
    const config = {
      getNumber: jest.fn((k: string, def?: number) => Promise.resolve(({ menu_days_delivered: 2, menu_visible_days_before_start: 2, menu_penalty_repeat: 0, menu_repeat_window_days: 14, menu_variety_min_gap_days: 0 } as Record<string, number>)[k] ?? def)),
      getBool: jest.fn((_k: string, def?: boolean) => Promise.resolve(def ?? false)),
    };
    const events = { activePausePeriod: jest.fn().mockResolvedValue(null) };
    const dietAgent = { stateFor: jest.fn().mockResolvedValue('normale') };
    const { DayComboService } = require('./day-combo.service');
    const service = new MenuService(prisma as PrismaService, config as unknown as ConfigParamsService, { log: jest.fn() } as unknown as AuditService, events as any, dietAgent as any, new DayComboService(), kcalNeedStub(), pushStub());
    return { service, prisma };
  }
  const lunchesOf = (prisma: any) =>
    prisma.menuDay.upsert.mock.calls.map((c: any) => (c[0].create.meals as { slot: string; recipeId: string }[]).find((m) => m.slot === 'lunch')?.recipeId);

  it('senza override: penalità globale 0 → template invariato (l1, l2)', async () => {
    const { service, prisma } = build(null, ['l1', 'l1', 'l1']);
    await service.deliverIfEligible('u1');
    expect(lunchesOf(prisma)).toEqual(['l1', 'l2']);
  });

  it('override per dieta menu_penalty_repeat=1 → la ripetuta di recente (l1) viene evitata (l2, l2)', async () => {
    const { service, prisma } = build(1, ['l1', 'l1', 'l1']);
    await service.deliverIfEligible('u1');
    expect(lunchesOf(prisma)).toEqual(['l2', 'l2']);
  });
});

describe('MenuService — garanzia di varietà (menu_variety_min_gap_days)', () => {
  const today = new Date().toISOString().slice(0, 10);
  const DD = (iso: string) => new Date(iso + 'T00:00:00.000Z');
  // Due colazioni equivalenti come kcal: il pool offre sempre un'alternativa.
  const recipes = [
    { id: 'c1', name: 'Frittata spinaci e feta', kcal: 400, macros: { protein_g: 25, carbs_g: 35, fat_g: 14 } },
    { id: 'c2', name: 'Salmone affumicato e cream cheese', kcal: 400, macros: { protein_g: 25, carbs_g: 35, fat_g: 14 } },
  ];
  // Il pool della dieta contiene entrambe le colazioni, ma c1 ha efficacia appresa alta e
  // vince lo scoring TUTTI i giorni: senza guard la colazione resta identica (il reclamo).
  /** Giornata completa a 3 pasti, con la COLAZIONE variabile: è quella su cui questi test asseriscono. */
  const tmpl = (dayIndex: number, c: string) => ({
    dayIndex,
    level: 1,
    meals: [{ slot: 'breakfast', recipeId: c }, { slot: 'lunch', recipeId: 'l-fisso' }, { slot: 'dinner', recipeId: 'd-fisso' }],
  });

  function build(gapDays: number, recentBreakfast: string[]) {
    const prisma: any = {
      productRule: { findUnique: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
      equivalenceGroup: { findMany: jest.fn().mockResolvedValue([]) },
      clientProfile: { findUnique: jest.fn().mockResolvedValue({ planStartDate: DD(today), regime: 'pescetarian', dietStyle: 'mediterranean', mealsPerDay: 5, intolerances: [], dislikedFoods: [], assignedNutritionistId: null }) },
      subscription: { findFirst: jest.fn().mockResolvedValue({ id: 'sub', status: 'active' }), findMany: jest.fn().mockResolvedValue([{ id: 'sub', status: 'active', startDate: null, endDate: null }]) },
      menuDay: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue(recentBreakfast.map((r) => ({ meals: [{ slot: 'breakfast', recipeId: r }] }))),
        upsert: jest.fn().mockResolvedValue({}),
      },
      dailyCheckin: { findUnique: jest.fn().mockResolvedValue(null) },
      measurement: { findFirst: jest.fn().mockResolvedValue({ id: 'm1' }), count: jest.fn().mockResolvedValue(1) },
      engineDecision: { findFirst: jest.fn().mockResolvedValue(null) },
      diet: { findFirst: jest.fn().mockResolvedValue({ id: 'diet1', objective: 'dimagrimento' }) },
      dietDayTemplate: { findMany: jest.fn().mockResolvedValue([tmpl(1, 'c1'), tmpl(2, 'c2')]) },
      recipe: { findMany: jest.fn().mockResolvedValue(recipes), findUnique: jest.fn() },
      menuWeight: { findMany: jest.fn().mockResolvedValue([{ recipeId: 'c1', score: 5, samples: 5 }]) },
      recipeRating: { findMany: jest.fn().mockResolvedValue([]) },
      escalation: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
      notification: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(), updateMany: jest.fn() },
    };
    const config = {
      // Penalità spenta di proposito: qui si misura SOLO la garanzia dura di varietà.
      getNumber: jest.fn((k: string, def?: number) => Promise.resolve(({ menu_days_delivered: 2, menu_visible_days_before_start: 2, menu_penalty_repeat: 0, menu_variety_min_gap_days: gapDays } as Record<string, number>)[k] ?? def)),
      getBool: jest.fn((_k: string, def?: boolean) => Promise.resolve(def ?? false)),
    };
    const events = { activePausePeriod: jest.fn().mockResolvedValue(null) };
    const dietAgent = { stateFor: jest.fn().mockResolvedValue('normale') };
    const { DayComboService } = require('./day-combo.service');
    const service = new MenuService(prisma as PrismaService, config as unknown as ConfigParamsService, { log: jest.fn() } as unknown as AuditService, events as any, dietAgent as any, new DayComboService(), kcalNeedStub(), pushStub());
    return { service, prisma };
  }

  const breakfastsOf = (prisma: any) =>
    prisma.menuDay.upsert.mock.calls.map((c: any) => (c[0].create.meals as { slot: string; recipeId: string }[]).find((m) => m.slot === 'breakfast')?.recipeId);

  it('nessun piatto due giorni di fila nello stesso pasto quando il pool offre un\'alternativa', async () => {
    const { service, prisma } = build(2, []);
    await service.deliverIfEligible('u1');
    const b = breakfastsOf(prisma);
    expect(b).toHaveLength(2);
    expect(b[0]).not.toBe(b[1]); // ← il reclamo della cliente: colazione identica ogni giorno
  });

  it('tiene conto dei giorni GIÀ erogati: se ieri c\'era c1, oggi non torna c1', async () => {
    const { service, prisma } = build(2, ['c1', 'c1']);
    await service.deliverIfEligible('u1');
    expect(breakfastsOf(prisma)[0]).toBe('c2');
  });

  it('guard disattivato (0): comportamento storico, resta la ricetta del template', async () => {
    const { service, prisma } = build(0, ['c1', 'c1']);
    await service.deliverIfEligible('u1');
    expect(breakfastsOf(prisma)).toEqual(['c1', 'c1']); // il piatto migliore vince sempre
  });
});

// La preferenza "ricette semplici" RISCRIVE i pasti dopo il guard di varietà, pescando da un
// pool proprio (tutte le ricette difficulty="semplice" del regime). Quel pool è piccolo: se in
// banda kcal resta UNA sola ricetta, `dayIndex % 1` la ripropone ogni giorno e la garanzia di
// varietà applicata a monte viene annullata.
describe('MenuService — ricette semplici senza annullare la varietà', () => {
  const today = new Date().toISOString().slice(0, 10);
  const DD = (iso: string) => new Date(iso + 'T00:00:00.000Z');
  const macros = { protein_g: 25, carbs_g: 35, fat_g: 14 };
  // Pool della dieta: due colazioni equivalenti (il guard può alternarle).
  const dietRecipes = [
    { id: 'c1', name: 'Frittata leggera spinaci e formaggio', kcal: 400, macros },
    { id: 'c2', name: 'Avocado toast integrale con uovo poché', kcal: 400, macros },
  ];
  const simple = (id: string, name: string) => ({ id, name, kcal: 400, macros, mealSlot: 'breakfast', ingredients: [], difficulty: 'semplice' });
  /** Giornata completa a 3 pasti, con la COLAZIONE variabile: è quella su cui si asserisce. */
  const tmpl = (dayIndex: number, c: string) => ({
    dayIndex,
    level: 1,
    meals: [{ slot: 'breakfast', recipeId: c }, { slot: 'lunch', recipeId: 'l-fisso' }, { slot: 'dinner', recipeId: 'd-fisso' }],
  });

  function build(simplePool: ReturnType<typeof simple>[]) {
    const all = [...dietRecipes, ...simplePool];
    const prisma: any = {
      productRule: { findUnique: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
      equivalenceGroup: { findMany: jest.fn().mockResolvedValue([]) },
      clientProfile: {
        findUnique: jest.fn().mockResolvedValue({
          planStartDate: DD(today), regime: 'pescetarian', dietStyle: 'mediterranean', mealsPerDay: 5,
          allergies: [], intolerances: [], dislikedFoods: [], assignedNutritionistId: null,
          prefersSimpleRecipes: true, // ← la cliente ha attivato "preferisco ricette semplici"
        }),
      },
      subscription: { findFirst: jest.fn().mockResolvedValue({ id: 'sub', status: 'active' }), findMany: jest.fn().mockResolvedValue([{ id: 'sub', status: 'active', startDate: null, endDate: null }]) },
      menuDay: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn().mockResolvedValue({}) },
      dailyCheckin: { findUnique: jest.fn().mockResolvedValue(null) },
      measurement: { findFirst: jest.fn().mockResolvedValue({ id: 'm1' }), count: jest.fn().mockResolvedValue(1) },
      engineDecision: { findFirst: jest.fn().mockResolvedValue(null) },
      diet: { findFirst: jest.fn().mockResolvedValue({ id: 'diet1', objective: 'dimagrimento' }) },
      dietDayTemplate: { findMany: jest.fn().mockResolvedValue([tmpl(1, 'c1'), tmpl(2, 'c2')]) },
      // Il pool "semplice" è una query a parte (difficulty='semplice'): va distinta.
      recipe: {
        findMany: jest.fn((args: any) => Promise.resolve(args?.where?.difficulty === 'semplice' ? simplePool : all)),
        findUnique: jest.fn(),
      },
      menuWeight: { findMany: jest.fn().mockResolvedValue([{ recipeId: 'c1', score: 5, samples: 5 }]) },
      recipeRating: { findMany: jest.fn().mockResolvedValue([]) },
      escalation: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
      notification: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(), updateMany: jest.fn() },
    };
    const config = {
      getNumber: jest.fn((k: string, def?: number) =>
        Promise.resolve(({ menu_days_delivered: 2, menu_visible_days_before_start: 2, menu_penalty_repeat: 0, menu_variety_min_gap_days: 2 } as Record<string, number>)[k] ?? def),
      ),
      getBool: jest.fn((_k: string, def?: boolean) => Promise.resolve(def ?? false)),
    };
    const { DayComboService } = require('./day-combo.service');
    const service = new MenuService(
      prisma as PrismaService, config as unknown as ConfigParamsService, { log: jest.fn() } as unknown as AuditService,
      { activePausePeriod: jest.fn().mockResolvedValue(null) } as any,
      { stateFor: jest.fn().mockResolvedValue('normale') } as any,
      new DayComboService(), kcalNeedStub(), pushStub(),
    );
    return { service, prisma };
  }

  const breakfastsOf = (prisma: any) =>
    prisma.menuDay.upsert.mock.calls.map((c: any) => (c[0].create.meals as { slot: string; recipeId: string }[]).find((m) => m.slot === 'breakfast')?.recipeId);

  it('una sola ricetta semplice in banda: non la ripete due giorni, tiene il piatto del piano', async () => {
    const { service, prisma } = build([simple('s1', 'Salmone affumicato e cream cheese')]);
    await service.deliverIfEligible('u1');
    const b = breakfastsOf(prisma);
    expect(b).toHaveLength(2);
    expect(b[0]).toBe('s1'); // la preferenza della cliente viene comunque soddisfatta
    expect(b[1]).not.toBe('s1'); // ← senza questo: 's1','s1' (la colazione bloccata del reclamo)
  });

  it('due ricette semplici in banda: le alterna, restando sempre sulle semplici', async () => {
    const { service, prisma } = build([simple('s1', 'Pane, ricotta e marmellata'), simple('s2', 'Yogurt greco con mela a fette')]);
    await service.deliverIfEligible('u1');
    const b = breakfastsOf(prisma);
    expect(new Set(b).size).toBe(2);
    expect(b.every((id: string) => id === 's1' || id === 's2')).toBe(true);
  });
});

// La sostituzione dei cibi NON GRADITI è l'ULTIMO passaggio prima del salvataggio: riscrive i
// pasti già composti, quindi due suoi difetti annullavano tutto il lavoro fatto a monte.
// (1) Pescava dall'intero catalogo filtrato per il `regime` REGISTRATO sulla cliente, non dal
//     pool della dieta: è così che a un piano di pesce, registrato per errore `omnivore`,
//     finiva in tavola la carne.
// (2) Sceglieva in modo deterministico il candidato più vicino in kcal, senza storico: lo
//     stesso identico sostituto ogni giorno, cioè la ripetitività del reclamo.
// Il caso qui sotto riproduce la cliente reale: colazioni del piano che contengono un cibo
// non gradito ("avena"), un pool di dieta con due alternative buone e un catalogo che offre
// un'alternativa PIÙ VICINA in kcal — che però non deve mai essere scelta.
describe('MenuService — sostituzione dei non graditi dentro il pool della dieta', () => {
  const today = new Date().toISOString().slice(0, 10);
  const DD = (iso: string) => new Date(iso + 'T00:00:00.000Z');
  const macros = { protein_g: 25, carbs_g: 35, fat_g: 14 };
  const R = (id: string, name: string, kcal: number) => ({ id, name, kcal, macros, mealSlot: 'breakfast', ingredients: [], active: true, difficulty: 'media' });
  // Pool della dieta: i due piatti del piano contengono "avena" (non gradita) e vanno cambiati;
  // a2/a3 sono le uniche alternative del pool, identiche in kcal fra loro e LONTANE dai piatti
  // del piano — così restano fuori dalla banda del compositore e a toccarle è solo lo swap.
  const dietRecipes = [
    R('d1', 'Porridge di avena e frutti di bosco', 400),
    R('d2', 'Barretta di avena, miele e mandorle', 400),
    R('a2', 'Ricotta, pere e pane integrale', 300),
    R('a3', 'Yogurt greco con mirtilli', 300),
  ];
  // Catalogo per regime: carne, e con kcal IDENTICHE al piatto da sostituire. Se lo swap
  // interrogasse il catalogo (o lo interrogasse per primo) vincerebbe questa.
  const catalogRecipes = [R('x1', 'Bresaola, grana e rucola', 400)];
  /** Giornata completa a 3 pasti, con la COLAZIONE variabile: è quella su cui si asserisce. */
  const tmpl = (dayIndex: number, c: string) => ({
    dayIndex,
    level: 1,
    meals: [{ slot: 'breakfast', recipeId: c }, { slot: 'lunch', recipeId: 'l-fisso' }, { slot: 'dinner', recipeId: 'd-fisso' }],
  });

  function build(gapDays: number) {
    const byId = new Map(dietRecipes.concat(catalogRecipes).map((r) => [r.id, r]));
    const prisma: any = {
      productRule: { findUnique: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
      equivalenceGroup: { findMany: jest.fn().mockResolvedValue([]) },
      clientProfile: {
        findUnique: jest.fn().mockResolvedValue({
          planStartDate: DD(today), regime: 'omnivore', dietStyle: 'mediterranean', mealsPerDay: 5,
          allergies: [], intolerances: [], dislikedFoods: ['Avena'], assignedNutritionistId: null,
          prefersSimpleRecipes: false,
        }),
      },
      subscription: { findFirst: jest.fn().mockResolvedValue({ id: 'sub', status: 'active' }), findMany: jest.fn().mockResolvedValue([{ id: 'sub', status: 'active', startDate: null, endDate: null }]) },
      menuDay: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn().mockResolvedValue({}) },
      dailyCheckin: { findUnique: jest.fn().mockResolvedValue(null) },
      measurement: { findFirst: jest.fn().mockResolvedValue({ id: 'm1' }), count: jest.fn().mockResolvedValue(1) },
      engineDecision: { findFirst: jest.fn().mockResolvedValue(null) },
      diet: { findFirst: jest.fn().mockResolvedValue({ id: 'diet1', objective: 'dimagrimento' }) },
      dietDayTemplate: { findMany: jest.fn().mockResolvedValue([tmpl(1, 'd1'), tmpl(2, 'd2'), tmpl(3, 'a2'), tmpl(4, 'a3')]) },
      // Due query distinte: per `id in [...]` (pool della dieta) e per `mealSlot` + regime
      // (catalogo). Tenerle separate è ciò che rende il test capace di distinguerle.
      recipe: {
        findMany: jest.fn((args: any) => {
          const ids = args?.where?.id?.in as string[] | undefined;
          if (ids) return Promise.resolve(ids.map((i) => byId.get(i)).filter(Boolean));
          if (args?.where?.mealSlot) return Promise.resolve(catalogRecipes);
          return Promise.resolve(dietRecipes);
        }),
        findUnique: jest.fn(),
      },
      menuWeight: { findMany: jest.fn().mockResolvedValue([]) },
      recipeRating: { findMany: jest.fn().mockResolvedValue([]) },
      escalation: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
      notification: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(), updateMany: jest.fn() },
    };
    const config = {
      getNumber: jest.fn((k: string, def?: number) =>
        Promise.resolve(({ menu_days_delivered: 2, menu_visible_days_before_start: 2, menu_penalty_repeat: 0, menu_variety_min_gap_days: gapDays } as Record<string, number>)[k] ?? def),
      ),
      getBool: jest.fn((_k: string, def?: boolean) => Promise.resolve(def ?? false)),
    };
    const { DayComboService } = require('./day-combo.service');
    const service = new MenuService(
      prisma as PrismaService, config as unknown as ConfigParamsService, { log: jest.fn() } as unknown as AuditService,
      { activePausePeriod: jest.fn().mockResolvedValue(null) } as any,
      { stateFor: jest.fn().mockResolvedValue('normale') } as any,
      new DayComboService(), kcalNeedStub(), pushStub(),
    );
    return { service, prisma };
  }

  const breakfastsOf = (prisma: any) =>
    prisma.menuDay.upsert.mock.calls.map((c: any) => (c[0].create.meals as { slot: string; recipeId: string }[]).find((m) => m.slot === 'breakfast')?.recipeId);

  it('il sostituto viene dal pool della dieta, non dal catalogo per regime', async () => {
    const { service, prisma } = build(2);
    const b = (await service.deliverIfEligible('u1'), breakfastsOf(prisma));
    expect(b).toHaveLength(2);
    // ← senza il pool-first: 'x1','x1' — carne, in un piano che di carne non ne ha.
    expect(b).not.toContain('x1');
    expect(b.every((id: string) => id === 'a2' || id === 'a3')).toBe(true);
  });

  it('non ripropone lo stesso sostituto due giorni di fila', async () => {
    const { service, prisma } = build(2);
    await service.deliverIfEligible('u1');
    const b = breakfastsOf(prisma);
    // ← senza lo storico: 'a2','a2' — a parità di kcal vince sempre lo stesso id.
    expect(b[0]).not.toBe(b[1]);
  });

  it('il catalogo resta la rete di sicurezza quando la dieta non offre alternative', async () => {
    const { service, prisma } = build(2);
    // Pool ridotto ai soli piatti con avena: dentro la dieta non c'è niente di accettabile.
    prisma.dietDayTemplate.findMany.mockResolvedValue([tmpl(1, 'd1'), tmpl(2, 'd2')]);
    await service.deliverIfEligible('u1');
    expect(breakfastsOf(prisma)).toEqual(['x1', 'x1']); // meglio la carne che un piatto non gradito
  });
});

// «Sostituzioni: aggiungerei la casella SOLO PER OGGI. Se mi piace l'alimento ma per tot motivo
// non ce l'ho nella giornata odierna, non significa che devo toglierlo per più gg.»
// Prima esisteva una sola portata — tre giorni — e un popup che DOPO l'applicazione chiedeva se
// escludere per sempre. "Oggi non ce l'ho in casa" e "questo cibo non mi piace" finivano nello
// stesso posto, e la seconda restringe il pool di TUTTI i menu futuri: è la causa documentata
// della ripetitività in REGISTRO_Varieta_Menu.md. Qui verifico che le tre portate siano
// davvero distinte, e soprattutto che solo `forever` tocchi il profilo.
describe('MenuService — portata della sostituzione (solo oggi / questi giorni / per sempre)', () => {
  const macros = { protein_g: 20, carbs_g: 30, fat_g: 12 };
  const ing = (...names: string[]) => names.map((name) => ({ name, qty_g: 50 }));
  // Il piatto del piano ha l'avena NEL NOME: è il caso che fa scattare il cambio di piatto.
  const planDish = { id: 'p1', name: 'Porridge di avena e frutti di bosco', kcal: 400, macros, mealSlot: 'breakfast', ingredients: ing('avena', 'mirtilli'), active: true, difficulty: 'media' };
  const altDish = { id: 'alt1', name: 'Yogurt greco con mirtilli', kcal: 400, macros, mealSlot: 'breakfast', ingredients: ing('yogurt greco', 'mirtilli'), active: true, difficulty: 'facile' };
  const meal = () => [{ slot: 'breakfast', recipeId: 'p1', name: planDish.name, kcal: 400, ...macros }];

  function build() {
    const byId = new Map([planDish, altDish].map((r) => [r.id, r]));
    // Tre giorni erogati da oggi in poi. Il mock rispetta `take`, così il numero di giorni
    // toccati è una conseguenza del codice e non del mock.
    const allDays = [0, 1, 2].map((n) => ({
      id: `md${n}`,
      date: new Date(Date.now() + n * 86_400_000),
      meals: meal(),
    }));
    const prisma: any = {
      clientProfile: {
        findUnique: jest.fn().mockResolvedValue({ regime: 'omnivore', intolerances: [], dislikedFoods: [] }),
        update: jest.fn().mockResolvedValue({}),
      },
      menuDay: {
        findMany: jest.fn((args: any) => Promise.resolve(allDays.slice(0, args?.take ?? allDays.length))),
        update: jest.fn().mockResolvedValue({}),
      },
      recipe: {
        findMany: jest.fn((args: any) => {
          const ids = args?.where?.id?.in as string[] | undefined;
          if (ids) return Promise.resolve(ids.map((i) => byId.get(i)).filter(Boolean));
          return Promise.resolve([altDish]); // catalogo per slot
        }),
      },
      productRule: { findUnique: jest.fn().mockResolvedValue(null) },
      equivalenceGroup: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const config = { getNumber: jest.fn((_k: string, def?: number) => Promise.resolve(def)), getBool: jest.fn((_k: string, def?: boolean) => Promise.resolve(def ?? false)) };
    const { DayComboService } = require('./day-combo.service');
    const service = new MenuService(
      prisma as PrismaService, config as unknown as ConfigParamsService, { log: jest.fn() } as unknown as AuditService,
      { activePausePeriod: jest.fn().mockResolvedValue(null) } as any,
      { stateFor: jest.fn().mockResolvedValue('normale') } as any,
      new DayComboService(), kcalNeedStub(), pushStub(),
    );
    return { service, prisma };
  }

  it('"solo per oggi": tocca un giorno soltanto', async () => {
    const { service, prisma } = build();
    const res = await service.substituteDisliked('u1', 'avena', 'today');
    expect(prisma.menuDay.update).toHaveBeenCalledTimes(1); // ← col vecchio take:3 fisso: 3
    expect(new Set(res.applied.map((a) => a.day)).size).toBe(1);
    expect(res.scope).toBe('today');
  });

  it('"questi giorni" resta il comportamento storico: tre giorni', async () => {
    const { service, prisma } = build();
    const res = await service.substituteDisliked('u1', 'avena', 'days');
    expect(prisma.menuDay.update).toHaveBeenCalledTimes(3);
    expect(new Set(res.applied.map((a) => a.day)).size).toBe(3);
  });

  it('senza portata indicata il default è "questi giorni" (le app già installate non cambiano)', async () => {
    const { service, prisma } = build();
    const res = await service.substituteDisliked('u1', 'avena');
    expect(prisma.menuDay.update).toHaveBeenCalledTimes(3);
    expect(res.scope).toBe('days');
  });

  it('solo "per sempre" scrive nei cibi non graditi del profilo', async () => {
    const { service, prisma } = build();
    await service.substituteDisliked('u1', 'avena', 'today');
    await service.substituteDisliked('u1', 'avena', 'days');
    // ← il punto del reclamo: un "oggi non ce l'ho" NON deve restringere i menu futuri.
    expect(prisma.clientProfile.update).not.toHaveBeenCalled();

    await service.substituteDisliked('u1', 'avena', 'forever');
    expect(prisma.clientProfile.update).toHaveBeenCalledTimes(1);
    expect(prisma.clientProfile.update.mock.calls[0][0].data.dislikedFoods).toContain('avena');
  });

  /**
   * Le spezie: la regola è della nutrizionista e nasce da un caso vero — una cliente con curry e
   * cumino fra i cibi esclusi riceveva lo stesso pranzo per quattro giorni, perché escludere una
   * spezia cancella dal ricettario TUTTI i piatti che la contengono.
   */
  it('una spezia non entra fra i cibi esclusi e non tocca i menu', async () => {
    const { service, prisma } = build();
    const res = await service.substituteDisliked('u1', 'curry', 'forever');
    expect(res.applicato).toBe(false);
    expect(res.avvisoSpezia?.tipo).toBe('specifica');
    expect(res.message).toContain('Sostituiscila con le spezie che più ti piacciono');
    expect(prisma.clientProfile.update).not.toHaveBeenCalled();
    expect(prisma.menuDay.update).not.toHaveBeenCalled();
  });

  it('il cancello vale anche per "solo oggi": pure lì scarterebbe i piatti speziati', async () => {
    const { service, prisma } = build();
    const res = await service.substituteDisliked('u1', 'cannella', 'today');
    expect(res.applicato).toBe(false);
    expect(prisma.menuDay.update).not.toHaveBeenCalled();
  });

  it('"spezie" in generale manda dalla coach, non registra niente', async () => {
    const { service, prisma } = build();
    const res = await service.substituteDisliked('u1', 'spezie', 'forever');
    expect(res.avvisoSpezia?.tipo).toBe('generica');
    expect(res.message).toContain('Contatta la tua coach');
    expect(prisma.clientProfile.update).not.toHaveBeenCalled();
  });

  it('il cibo vero continua a passare: il cancello è solo per le spezie', async () => {
    const { service, prisma } = build();
    const res = await service.substituteDisliked('u1', 'avena', 'forever');
    expect(res.applicato).toBe(true);
    expect(prisma.clientProfile.update).toHaveBeenCalled();
  });

  it('il messaggio dice per quanto vale davvero', async () => {
    const { service } = build();
    const oggi = await service.substituteDisliked('u1', 'avena', 'today');
    expect(oggi.message).toContain('nel menu di oggi');
    expect(oggi.message).toContain('Da domani torna disponibile');
    // ← senza il messaggio parametrico: "nei prossimi menu" anche a chi ha chiesto solo oggi.
    expect(oggi.message).not.toContain('prossimi due giorni');

    const giorni = await service.substituteDisliked('u1', 'avena', 'days');
    expect(giorni.message).toContain('prossimi due giorni');

    const sempre = await service.substituteDisliked('u1', 'avena', 'forever');
    expect(sempre.message).toContain('non comparirà più');
  });
});

/**
 * §15.4 — LE GIORNATE INCOMPLETE. Le tre decisioni di Simone, una per test.
 *
 * Il difetto che chiudono: l'erogazione si fermava solo alle giornate ZERO, quindi una giornata
 * con la sola colazione veniva servita e salvata così com'è, senza log né avviso.
 */
describe('MenuService — giornate incomplete (§15.4)', () => {
  const D2 = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
  const oggi = new Date().toISOString().slice(0, 10);
  const completa = (dayIndex: number, pranzo = 'r1') => ({
    dayIndex, level: 1,
    meals: [
      { slot: 'breakfast', recipeId: 'b1' }, { slot: 'morning_snack', recipeId: 's1' },
      { slot: 'lunch', recipeId: pranzo }, { slot: 'afternoon_snack', recipeId: 'm1' },
      { slot: 'dinner', recipeId: 'd1' },
    ],
  });
  const monca = (dayIndex: number) => ({ dayIndex, level: 1, meals: [{ slot: 'breakfast', recipeId: 'b1' }] });

  const monta = async (over: Record<string, unknown>) => {
    const prisma: any = {
      productRule: { findUnique: jest.fn().mockResolvedValue(null) },
      equivalenceGroup: { findMany: jest.fn().mockResolvedValue([]) },
      clientProfile: {
        findUnique: jest.fn().mockResolvedValue({
          planStartDate: D2(oggi), regime: 'omnivore', dietStyle: 'mediterranean', mealsPerDay: 5,
          intolerances: [], dislikedFoods: [], assignedNutritionistId: null,
        }),
      },
      subscription: { findFirst: jest.fn().mockResolvedValue({ id: 'sub1', status: 'active' }), findMany: jest.fn().mockResolvedValue([{ status: 'active', endDate: null }]) },
      menuDay: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn().mockResolvedValue({}), deleteMany: jest.fn() },
      measurement: { findFirst: jest.fn().mockResolvedValue({ id: 'm1' }), count: jest.fn().mockResolvedValue(1) },
      engineDecision: { findFirst: jest.fn().mockResolvedValue(null) },
      recipe: { findMany: jest.fn().mockResolvedValue([]) },
      recipeRating: { findMany: jest.fn().mockResolvedValue([]) },
      menuWeight: { findMany: jest.fn().mockResolvedValue([]) },
      dailyCheckin: { findUnique: jest.fn().mockResolvedValue(null) },
      notification: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(), updateMany: jest.fn() },
      escalation: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'e1' }) },
      staff: { findUnique: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
      analyticsEvent: { create: jest.fn().mockResolvedValue({}) },
      ...over,
    };
    const config = {
      getNumber: jest.fn((key: string, def?: number) => Promise.resolve(({ menu_days_delivered: 2, menu_visible_days_before_start: 2 } as Record<string, number>)[key] ?? def)),
      getBool: jest.fn((_k: string, d?: boolean) => Promise.resolve(d ?? false)),
    };
    const events = { activePausePeriod: jest.fn().mockResolvedValue(null) };
    const dietAgent = { stateFor: jest.fn().mockResolvedValue('normale') };
    const { DayComboService } = require('./day-combo.service');
    // Costruzione diretta, come gli altri blocchi di questo file: monta solo quello che serve.
    const service = new MenuService(
      prisma as PrismaService,
      config as unknown as ConfigParamsService,
      { log: jest.fn() } as unknown as AuditService,
      events as any,
      dietAgent as any,
      new DayComboService(),
      kcalNeedStub(),
      pushStub(),
    );
    return { service, prisma };
  };

  it('qualche giornata completa c’è: si servono quelle e le monche si saltano', async () => {
    const { service, prisma } = await monta({
      diet: { findFirst: jest.fn().mockResolvedValue({ id: 'd1', name: 'Mediterranea', regime: 'omnivore', mealsPerDay: 5 }), findMany: jest.fn().mockResolvedValue([]) },
      dietDayTemplate: { findMany: jest.fn().mockResolvedValue([completa(1), monca(2), completa(3)]) },
    });
    const creati = await service.deliverIfEligible('u1');
    expect(creati.length).toBeGreaterThan(0);
    // Nessuna giornata scritta con la sola colazione: è il difetto che si chiude.
    for (const call of (prisma.menuDay.upsert as jest.Mock).mock.calls) {
      const slots = (call[0].create.meals as { slot: string }[]).map((m) => m.slot);
      expect(slots).toContain('lunch');
      expect(slots).toContain('dinner');
    }
  });

  /**
   * LA REGOLA DEL 14/8 (Simone): «se settimana 2 giorno 2 mi manca la cena vado a cercare la cena
   * nelle settimane successive». Prima quella giornata si buttava via intera; ora si ripara col
   * piatto del ciclo — e il ripiego resta scritto.
   */
  it('la giornata a cui manca UN pasto si ripara col piatto del ciclo, e lo traccia', async () => {
    const senzaCena = (dayIndex: number) => ({
      dayIndex, level: 1,
      meals: [
        { slot: 'breakfast', recipeId: 'b1' }, { slot: 'morning_snack', recipeId: 's1' },
        { slot: 'lunch', recipeId: 'r1' }, { slot: 'afternoon_snack', recipeId: 'm1' },
      ],
    });
    const { service, prisma } = await monta({
      diet: { findFirst: jest.fn().mockResolvedValue({ id: 'd1', name: 'Mediterranea', regime: 'omnivore', mealsPerDay: 5 }), findMany: jest.fn().mockResolvedValue([]) },
      dietDayTemplate: { findMany: jest.fn().mockResolvedValue([senzaCena(1), completa(2), completa(3)]) },
    });
    const creati = await service.deliverIfEligible('u1');
    expect(creati.length).toBeGreaterThan(0);
    // Nessuna giornata servita senza cena: era il buco da chiudere.
    for (const call of (prisma.menuDay.upsert as jest.Mock).mock.calls) {
      expect((call[0].create.meals as { slot: string }[]).map((m) => m.slot)).toContain('dinner');
    }
    // ⚠️ E il ripiego NON è silenzioso: resta l'evento, come per la gemella.
    const eventi = (prisma.analyticsEvent.create as jest.Mock).mock.calls.map((c) => c[0].data.name);
    expect(eventi).toContain('diet_day_repaired');
  });

  it('nessuna completa: scende sulla GEMELLA e lo traccia (non in silenzio)', async () => {
    const gemella = { id: 'd2', name: 'Mediterranea', regime: 'omnivore', mealsPerDay: 3, fasting: false, style: 'mediterranean' };
    const templateDi = jest.fn(({ where }: any) =>
      Promise.resolve(where.dietId === 'd2'
        ? [{ dayIndex: 1, level: 1, meals: [{ slot: 'breakfast', recipeId: 'b1' }, { slot: 'lunch', recipeId: 'l1' }, { slot: 'dinner', recipeId: 'dd1' }] }]
        : [monca(1), monca(2)]),
    );
    const { service, prisma } = await monta({
      diet: {
        findFirst: jest.fn().mockResolvedValue({ id: 'd1', name: 'Mediterranea', regime: 'omnivore', mealsPerDay: 5 }),
        findMany: jest.fn().mockResolvedValue([gemella]),
      },
      dietDayTemplate: { findMany: templateDi },
    });
    const creati = await service.deliverIfEligible('u1');
    expect(creati.length).toBeGreaterThan(0);
    // Il ripiego è voluto, il silenzio no: resta un evento, come per lo scostamento di stile.
    expect(prisma.analyticsEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: 'diet_meals_fallback' }) }),
    );
    // La gemella deve arrivare con i LIVELLI CALORICI: il target del giorno esce da
    // `levelTargetKcal(diet.levels, level)`, quindi una gemella senza `levels` servirebbe le
    // giornate giuste con le calorie a ZERO. Si controlla la forma della SELECT e non l'effetto
    // perché è lì che il campo si perde, e si perde in silenzio.
    const selectGemelle = (prisma.diet.findMany as jest.Mock).mock.calls[0][0].select;
    expect(selectGemelle).toMatchObject({ levels: true, objective: true, mealsPerDay: true });
  });

  it('nemmeno le gemelle: NON eroga e apre una segnalazione', async () => {
    const { service, prisma } = await monta({
      diet: {
        findFirst: jest.fn().mockResolvedValue({ id: 'd1', name: 'Vacanze in Serenità', regime: 'omnivore', mealsPerDay: 3 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      dietDayTemplate: { findMany: jest.fn().mockResolvedValue([monca(1), monca(2)]) },
    });
    // Meglio «menu in preparazione» che una giornata con la sola colazione.
    expect(await service.deliverIfEligible('u1')).toEqual([]);
    expect(prisma.menuDay.upsert).not.toHaveBeenCalled();
    expect(prisma.escalation.create).toHaveBeenCalled();
  });
});

/**
 * IL SEGNALE DELLA GIORNATA SOTTO IL FABBISOGNO (17/8) — il collegamento, non il calcolo.
 *
 * Il giudizio sta in `giornata-sotto-target.ts` e ha i suoi test per tabella. Qui si difende la sola
 * cosa che quei test non possono vedere: che `deliverIfEligible` lo CHIAMI, che l'evento esca una
 * volta per erogazione, e ⚠️ che il menu venga erogato comunque — una giornata scarsa è meglio di
 * nessun menu, e bloccare qui sarebbe un difetto peggiore di quello che si sta segnalando.
 */
describe('MenuService · la giornata sotto il target si segnala (e si eroga comunque)', () => {
  const recipes = [
    { id: 'b1', name: 'Colazione A', kcal: 300, macros: { protein_g: 15, carbs_g: 40, fat_g: 8 } },
    { id: 'l1', name: 'Pranzo A', kcal: 500, macros: { protein_g: 30, carbs_g: 55, fat_g: 15 } },
    { id: 'd1', name: 'Cena A', kcal: 500, macros: { protein_g: 32, carbs_g: 40, fat_g: 16 } },
  ];
  const tmpl = (dayIndex: number) => ({
    dayIndex,
    level: 1,
    meals: [
      { slot: 'breakfast', recipeId: 'b1' },
      { slot: 'lunch', recipeId: 'l1' },
      { slot: 'dinner', recipeId: 'd1' },
    ],
  });

  /** `levelKcal` è il target: 1300 di pool su 1400 sta in banda, su 2400 no. */
  function build(levelKcal: number) {
    const prisma: any = {
      productRule: { findUnique: jest.fn().mockResolvedValue(null) },
      equivalenceGroup: { findMany: jest.fn().mockResolvedValue([]) },
      clientProfile: {
        findUnique: jest.fn().mockResolvedValue({
          planStartDate: D(todayIso), regime: 'omnivore', dietStyle: 'mediterranean', mealsPerDay: 3,
          intolerances: [], dislikedFoods: [], assignedNutritionistId: null,
        }),
      },
      subscription: {
        findFirst: jest.fn().mockResolvedValue({ id: 'sub', status: 'active' }),
        findMany: jest.fn().mockResolvedValue([{ id: 'sub', status: 'active', startDate: null, endDate: null }]),
      },
      menuDay: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn().mockResolvedValue({}) },
      dailyCheckin: { findUnique: jest.fn().mockResolvedValue(null) },
      measurement: { findFirst: jest.fn().mockResolvedValue({ id: 'm1' }), count: jest.fn().mockResolvedValue(1) },
      engineDecision: { findFirst: jest.fn().mockResolvedValue(null) },
      diet: { findFirst: jest.fn().mockResolvedValue({ id: 'diet1', levels: [{ level: 1, kcal: levelKcal }] }) },
      dietDayTemplate: { findMany: jest.fn().mockResolvedValue([tmpl(1), tmpl(2)]) },
      recipe: { findMany: jest.fn().mockResolvedValue(recipes), findUnique: jest.fn() },
      menuWeight: { findMany: jest.fn().mockResolvedValue([]) },
      recipeRating: { findMany: jest.fn().mockResolvedValue([]) },
      escalation: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
      notification: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(), updateMany: jest.fn() },
      analyticsEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const config = {
      getNumber: jest.fn((k: string, def?: number) =>
        Promise.resolve(({ menu_days_delivered: 2, menu_visible_days_before_start: 2, menu_penalty_repeat: 0, menu_variety_min_gap_days: 0 } as Record<string, number>)[k] ?? def)),
      getBool: jest.fn((_k: string, def?: boolean) => Promise.resolve(def ?? false)),
    };
    const { DayComboService } = require('./day-combo.service');
    const service = new MenuService(
      prisma as PrismaService,
      config as unknown as ConfigParamsService,
      { log: jest.fn() } as unknown as AuditService,
      { activePausePeriod: jest.fn().mockResolvedValue(null) } as any,
      { stateFor: jest.fn().mockResolvedValue('normale') } as any,
      new DayComboService(),
      kcalNeedStub(), pushStub(),
    );
    return { service, prisma };
  }

  const eventiKcal = (prisma: any) =>
    (prisma.analyticsEvent.create as jest.Mock).mock.calls.filter((c) => c[0]?.data?.name === 'daily_kcal_below_target');

  /** I pasti scritti nel primo giorno erogato: è quello che la cliente riceve davvero. */
  const pastiErogati = (prisma: any) =>
    (prisma.menuDay.upsert as jest.Mock).mock.calls[0][0].create.meals as {
      slot: string; kcal: number; porzione?: number; kcalBase?: number;
    }[];

  /**
   * ⚠️ IL SIGNIFICATO DI QUESTO ALLARME È CAMBIATO IL 18/8 (voce 255, strada C).
   *
   * Prima misurava la giornata **di catalogo**: 1300 kcal su un fabbisogno di 2400 erano il 54%, e
   * l'evento scattava. Ora, prima di misurare, le porzioni si scalano — quindi «sotto il
   * fabbisogno» vuol dire «resta corta ANCHE col moltiplicatore al tetto», che è una cosa più rara
   * e più grave. Questi due test tengono ferme tutt'e due le metà.
   */
  it('⚠️ target 2400 su una giornata da 1300: le porzioni si scalano, e l\'allarme NON scatta più', async () => {
    const { service, prisma } = build(2400);
    await expect(service.deliverIfEligible('u1')).resolves.toHaveLength(2);

    const pasti = pastiErogati(prisma);
    // Tutti e tre al loro tetto: 300×1,6 · 500×1,8 · 500×1,8 = 2280, cioè il 95% di 2400.
    expect(pasti.map((m) => m.kcal)).toEqual([480, 900, 900]);
    // ⚠️ `kcalBase` conserva l'origine: senza, il fabbisogno che cambia non avrebbe da dove ripartire.
    expect(pasti.map((m) => m.kcalBase)).toEqual([300, 500, 500]);
    expect(pasti.map((m) => m.porzione)).toEqual([1.6, 1.8, 1.8]);
    // 2280 su 2400 è dentro la banda: non c'è più niente da segnalare.
    expect(eventiKcal(prisma)).toHaveLength(0);
  });

  it('⚠️ ma se nemmeno al tetto ci si arriva, l\'evento esce — UNO per erogazione', async () => {
    const { service, prisma } = build(3000);
    const created = await service.deliverIfEligible('u1');
    // ⚠️ Si eroga comunque: il segnale non blocca.
    expect(created).toHaveLength(2);
    expect(prisma.menuDay.upsert).toHaveBeenCalledTimes(2);

    const eventi = eventiKcal(prisma);
    expect(eventi).toHaveLength(1); // non uno per giorno: `deliverIfEligible` gira a ogni apertura
    const dati = eventi[0][0].data.data;
    expect(dati.targetKcal).toBe(3000);
    expect(dati.targetSource).toBe('level');
    expect(dati.giorni).toHaveLength(2);
    /**
     * ⚠️ Le kcal nell'evento sono quelle SCALATE (2280), non quelle di catalogo (1300): è la
     * giornata che la cliente riceve. Se qui comparisse 1300, `diag:kcal` racconterebbe un
     * problema più grave di quello vero e manderebbe la nutrizionista a cercare una causa
     * sbagliata.
     */
    expect(dati.giorni[0].kcal).toBe(2280);
    expect(dati.giorni[0].quotaDelTarget).toBeCloseTo(0.76, 2);
    expect(dati.giorni[0].scostamentoPct).toBeLessThan(-15);
  });

  it('⚠️ e la giornata che resta corta anche al tetto finisce nel log, con quali slot erano al tetto', async () => {
    const { service } = build(3000);
    const avvisi = jest.spyOn((service as unknown as { logger: { warn: (m: string) => void } }).logger, 'warn');
    await service.deliverIfEligible('u1');
    const riga = avvisi.mock.calls.map((c) => String(c[0])).find((m) => m.includes('ANCHE col moltiplicatore'));
    expect(riga).toBeDefined();
    expect(riga).toContain('breakfast');
    avvisi.mockRestore();
  });

  it('⚠️ se la scrittura dell\'evento fallisce, il menu si eroga lo stesso (e l\'errore non sparisce)', async () => {
    // Degradare sì, tacere no: `diag:kcal` legge solo questi eventi, e una scrittura persa in
    // silenzio è indistinguibile da «nessuna giornata sotto il fabbisogno».
    const { service, prisma } = build(3000);
    (prisma.analyticsEvent.create as jest.Mock).mockRejectedValue(new Error('colonna sparita'));
    const avvisi = jest.spyOn((service as unknown as { logger: { warn: (m: string) => void } }).logger, 'warn');

    await expect(service.deliverIfEligible('u1')).resolves.toHaveLength(2);
    expect(prisma.menuDay.upsert).toHaveBeenCalledTimes(2);
    expect(avvisi.mock.calls.some((c) => String(c[0]).includes('daily_kcal_below_target NON scritto'))).toBe(true);
    avvisi.mockRestore();
  });

  it('target 1400 e le stesse giornate: nessun evento — 1300 sta nella banda del 15%', async () => {
    const { service, prisma } = build(1400);
    expect(await service.deliverIfEligible('u1')).toHaveLength(2);
    expect(eventiKcal(prisma)).toHaveLength(0);
  });
});
