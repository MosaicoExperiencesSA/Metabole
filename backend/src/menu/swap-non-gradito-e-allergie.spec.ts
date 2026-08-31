import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MenuService } from './menu.service';
import { giornoLocale } from '../common/date-only';

/**
 * ⛔ **IL PIATTO NON GRADITO ENTRAVA DALLA QUARTA PORTA** (31/8/2026).
 *
 * ⚠️ **E la porta è il CATALOGO DI RIPIEGO**, non il pool: quando dentro la dieta non c'è nessuna
 * alternativa accettabile, lo swap si allarga a `recipe.findMany({mealSlot, active, regime})` —
 * dove il filtro di sicurezza del 21/8 non arriva. Il pool, quello, il piatto vietato lo toglie
 * già. È la differenza che questi test tengono separata.
 *
 * `swapDislikedDishes` è l'ULTIMO passaggio prima del salvataggio e riscrive quanto composto a
 * monte. Leggeva `regime`, `intolerances` e `dislikedFoods` — **non `allergies`** — e valutava il
 * candidato con un confronto di parole su nome e ingredienti, senza i tag allergene. Quindi
 * scavalcava sia la guardia di `evaluateMeals` (allergie dal 20/8) sia il filtro del pool (21/8).
 *
 * Non è teoria: `npm run diag:allergeni-piatto` del 31/8, su una cliente con sei allergie.
 *   · 25/8 pranzo «Gamberoni al cartoccio», snapshot creato il 23/8 — DOPO le due correzioni —
 *     con `substitutions: [{reason: "non gradito"}]`: struzzo → vitello → gamberoni, e il tag
 *     `crostacei` era confermato sulla ricetta.
 *   · 30/8 merenda «Ricotta con albicocche secche», entrata per la stessa strada e **senza** la
 *     sostituzione dei solfiti — mentre quella del 28/8, entrata per la via normale, ce l'aveva.
 *     Stessa cliente, stessa allergia, due esiti: la differenza era la porta.
 *
 * I tre casi qui sotto sono quelle due giornate, più la regola che le tiene insieme.
 */
describe('MenuService — lo swap di un non gradito non può servire un allergene', () => {
  const today = giornoLocale(new Date());
  const DD = (iso: string) => new Date(iso + 'T00:00:00.000Z');
  const macros = { protein_g: 20, carbs_g: 30, fat_g: 12 };
  const R = (
    id: string,
    name: string,
    kcal: number,
    extra: { ingredients?: { name: string }[]; allergens?: string[] } = {},
  ) => ({
    id, name, kcal, macros, mealSlot: 'breakfast', active: true, difficulty: 'media',
    ingredients: extra.ingredients ?? [], allergens: extra.allergens ?? [],
  });

  // Il piatto del piano contiene un cibo NON GRADITO: va cambiato, ed è ciò che apre la porta.
  const CON_AVENA = R('d1', 'Porridge di avena e frutti di bosco', 400, {
    // ⚠️ L'uvetta serve al caso «le sostituzioni del piatto vecchio non restano attaccate»: su una
    // allergica ai solfiti `evaluateMeals` scrive «Uvetta → …» PRIMA che lo swap cambi il piatto.
    ingredients: [{ name: 'Avena' }, { name: 'Uvetta' }, { name: 'Mirtilli' }],
  });
  /**
   * ⚠️ Le alternative stanno tutte a ~300 kcal, LONTANE dalle 400 del piatto del piano: così
   * restano fuori dalla banda del compositore e a toccarle è **solo** lo swap. È lo stesso
   * apparecchio del test sul pool della dieta, e serve a non misurare due cose insieme.
   */
  // ⛔ La trappola: stesse kcal del pulito, ma id minore — a parità vince il tie-break sull'id,
  // quindi prima della correzione questo piatto usciva sempre. Tag `crostacei` confermato.
  const GAMBERONI = R('g1', 'Crostacei: Gamberoni al cartoccio con miglio e zucchine', 300, {
    ingredients: [{ name: 'Gamberoni' }, { name: 'Miglio' }], allergens: ['crostacei'],
  });
  // Sostituibile, non vietato: i solfiti hanno una regola per ingrediente che sa cosa metterci.
  // ⚠️ 310 è più VICINO alle 400 di partenza: senza la preferenza per i puliti vincerebbe lui.
  // ⚠️ Nome pulito, l'ingrediente sta solo nell'elenco: il titolo adesso è un filtro vero, e un
  //    piatto che nomina l'allergene nel nome non viene proprio scelto.
  const PRUGNE = R('p1', 'Ricotta e pistacchi', 310, { ingredients: [{ name: 'Ricotta' }, { name: 'Prugne secche' }] });
  const PULITO = R('ok1', 'Yogurt greco con mirtilli', 300, { ingredients: [{ name: 'Yogurt greco' }, { name: 'Mirtilli' }] });
  /** ⛔ Nessun ingrediente scritto, e il titolo nomina un allergene: qui l'unico segnale è il nome. */
  const MUTO = R('m1', 'Insalata di gamberi e avocado', 300);
  /** ⛔ Lo stesso piatto con UN ingrediente innocuo: è il caso che la prima stesura lasciava passare. */
  const MUTO_CON_UN_INGREDIENTE = R('m2', 'Insalata di gamberi e avocado', 300, { ingredients: [{ name: 'Insalata' }] });
  /**
   * ⚠️ Il pranzo NON viene mai scambiato (nessun cibo non gradito) ma ha l'uvetta, quindi per una
   * allergica ai solfiti porta una sostituzione di sicurezza. È il pasto su cui si vede se il
   * ripasso dopo lo swap riscrive anche quello che non ha toccato.
   */
  const PRANZO = R('l-fisso', 'Insalata di farro con uvetta', 500, { ingredients: [{ name: 'Farro' }, { name: 'Uvetta' }] });
  const CENA = R('d-fisso', 'Merluzzo al forno con patate', 500, { ingredients: [{ name: 'Merluzzo' }, { name: 'Patate' }] });

  function build(
    colazioniDelPool: ReturnType<typeof R>[],
    catalogo = [R('x1', 'Pane tostato e ricotta', 340, { ingredients: [{ name: 'Pane' }, { name: 'Ricotta' }] })],
    allergie: string[] = ['crostacei', 'solfiti'],
  ) {
    const byId = new Map([CON_AVENA, PRANZO, CENA, ...colazioniDelPool, ...catalogo].map((r) => [r.id, r]));
    const tmpl = (dayIndex: number, c: string) => ({
      dayIndex, level: 1,
      meals: [{ slot: 'breakfast', recipeId: c }, { slot: 'lunch', recipeId: 'l-fisso' }, { slot: 'dinner', recipeId: 'd-fisso' }],
    });
    /**
     * ⚠️ Il pool della dieta è fatto dai piatti che le GIORNATE nominano: un'alternativa che
     * nessuna giornata nomina non esiste per lo swap. Qui il giorno 1 porta il piatto con l'avena
     * (quello da cambiare) e i giorni dopo servono solo a mettere le alternative nel pool.
     */
    const giornate = [tmpl(1, 'd1'), ...colazioniDelPool.map((r, i) => tmpl(i + 2, r.id))];
    const prisma: any = {
      productRule: { findUnique: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
      equivalenceGroup: { findMany: jest.fn().mockResolvedValue([]) },
      clientProfile: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUnique: jest.fn().mockResolvedValue({
          planStartDate: DD(today), regime: 'omnivore', dietStyle: 'mediterranean', mealsPerDay: 5,
          // La cliente vera: sei allergie, qui le due che contano per questi piatti.
          allergies: allergie, intolerances: [], dislikedFoods: ['Avena'],
          assignedNutritionistId: null, prefersSimpleRecipes: false,
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
      diet: { findFirst: jest.fn().mockResolvedValue({ id: 'diet1', objective: 'dimagrimento' }) },
      dietDayTemplate: { findMany: jest.fn().mockResolvedValue(giornate) },
      recipe: {
        findMany: jest.fn((args: any) => {
          const ids = args?.where?.id?.in as string[] | undefined;
          if (ids) return Promise.resolve(ids.map((i) => byId.get(i)).filter(Boolean));
          if (args?.where?.mealSlot) return Promise.resolve(catalogo);
          return Promise.resolve([CON_AVENA, ...colazioniDelPool]);
        }),
        findUnique: jest.fn(),
      },
      menuWeight: { findMany: jest.fn().mockResolvedValue([]) },
      recipeRating: { findMany: jest.fn().mockResolvedValue([]) },
      escalation: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(), update: jest.fn(), updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      notification: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(), updateMany: jest.fn() },
    };
    const config = {
      getNumber: jest.fn((k: string, def?: number) =>
        Promise.resolve(({ menu_days_delivered: 1, menu_visible_days_before_start: 2, menu_penalty_repeat: 0, menu_variety_min_gap_days: 2 } as Record<string, number>)[k] ?? def),
      ),
      getBool: jest.fn((_k: string, def?: boolean) => Promise.resolve(def ?? false)),
    };
    const { DayComboService } = require('./day-combo.service');
    const service = new MenuService(
      prisma as PrismaService, config as unknown as ConfigParamsService, { log: jest.fn() } as unknown as AuditService,
      { activePausePeriod: jest.fn().mockResolvedValue(null), pausaAppenaFinita: jest.fn().mockResolvedValue(null) } as any,
      { stateFor: jest.fn().mockResolvedValue('normale') } as any,
      new DayComboService(), { computeTargetKcal: jest.fn().mockResolvedValue(null) } as never,
      { sendToUser: jest.fn().mockResolvedValue(undefined) } as never,
    );
    return { service, prisma };
  }

  const colazioni = (prisma: any) =>
    prisma.menuDay.upsert.mock.calls.map(
      (c: any) => (c[0].create.meals as { slot: string; recipeId: string }[]).find((m) => m.slot === 'breakfast'),
    );
  const pastoColazione = (prisma: any) =>
    (prisma.menuDay.upsert.mock.calls[0][0].create.meals as any[]).find((m) => m.slot === 'breakfast');

  it('⛔ il ripiego sul catalogo non può servire un piatto col tag allergene', async () => {
    // Dentro la dieta non c'è nessuna alternativa: lo swap si allarga al catalogo per regime.
    const { service, prisma } = build([], [GAMBERONI, R('x9', 'Pane tostato e ricotta', 300, { ingredients: [{ name: 'Pane' }, { name: 'Ricotta' }] })]);
    await service.deliverIfEligible('u1');
    const scelte = colazioni(prisma).map((m: any) => m.recipeId);
    // ← prima della correzione: 'g1' — stesse kcal, e a parità vince l'id minore. Il tag
    //   `crostacei` non veniva nemmeno letto, perché `allergens` non era nel select.
    expect(scelte).not.toContain('g1');
    expect(scelte.every((id: string) => id === 'x9')).toBe(true);
  });

  it('fra due candidati servibili si preferisce quello che non chiede sostituzioni', async () => {
    const { service, prisma } = build([PRUGNE, PULITO]);
    await service.deliverIfEligible('u1');
    // PRUGNE è più vicino in kcal (310 contro 300) ma richiede una sostituzione: vince il pulito.
    expect(colazioni(prisma).map((m: any) => m.recipeId)).toEqual(['ok1']);
  });

  it('⛔ un pasto NON scambiato non si vede le sostituzioni riscritte due volte', async () => {
    // Il ripasso dopo lo swap guarda tutti i pasti: se non distinguesse quelli cambiati,
    // riscriverebbe le righe già presenti sugli altri e l'app le stamperebbe in fila, doppie.
    const { service, prisma } = build([PULITO]);
    await service.deliverIfEligible('u1');
    const pasti = prisma.menuDay.upsert.mock.calls[0][0].create.meals as any[];
    // Il pranzo ha l'uvetta e NON viene scambiato: la sua sostituzione dev'essere scritta una volta.
    const pranzo = pasti.find((m) => m.slot === 'lunch');
    expect((pranzo.substitutions ?? []).filter((x: any) => x.from === 'Uvetta')).toHaveLength(1);
    for (const m of pasti) {
      const righe = (m.substitutions ?? []).map((x: any) => `${x.from}|${x.to}|${x.reason}`);
      expect(new Set(righe).size).toBe(righe.length);
    }
  });

  it('⛔ nemmeno dentro il pool della dieta un piatto col tag allergene può essere scelto', async () => {
    // ⚠️ Protegge il `select` del POOL: il primo caso protegge solo quello del catalogo, e i due
    // stanno in due punti diversi della stessa funzione.
    const { service, prisma } = build([GAMBERONI, PULITO]);
    await service.deliverIfEligible('u1');
    expect(colazioni(prisma).map((m: any) => m.recipeId)).toEqual(['ok1']);
  });

  it('⛔ il NOME conta anche quando la ricetta ha un ingrediente qualunque', async () => {
    // ⚠️ Il sospetto è l'UNICO candidato: così il test pinza `acceptable` e non il filtro dei
    //    «puliti», che lo scarterebbe comunque. La prima stesura guardava il titolo solo per le
    //    ricette senza ingredienti: bastava UN ingrediente innocuo per rimettere il piatto in
    //    tavola, e questo test restava verde. Ora l'insalata di gamberi ha la sua insalata.
    const { service, prisma } = build([MUTO_CON_UN_INGREDIENTE]);
    await service.deliverIfEligible('u1');
    // Nel pool non resta niente di accettabile → si ripiega sul catalogo. Mai 'm1'.
    expect(colazioni(prisma).map((m: any) => m.recipeId)).toEqual(['x1']);
  });

  it('⛔ e nemmeno senza nessun ingrediente', async () => {
    const { service, prisma } = build([MUTO]);
    await service.deliverIfEligible('u1');
    expect(colazioni(prisma).map((m: any) => m.recipeId)).toEqual(['x1']);
  });

  it('⛔ le sostituzioni del piatto BUTTATO non restano attaccate a quello nuovo', async () => {
    const { service, prisma } = build([PULITO]);
    await service.deliverIfEligible('u1');
    const pasto = pastoColazione(prisma);
    expect(pasto.recipeId).toBe('ok1');
    // Il piatto di prima aveva l'uvetta, e per una allergica ai solfiti la sua sostituzione. Lo
    // yogurt non ce l'ha: ← senza la correzione resterebbe scritto «Uvetta → …» su un piatto senza
    //   uvetta, e `ingredienti-effettivi.ts` gliela AGGIUNGEREBBE davvero.
    expect((pasto.substitutions ?? []).map((x: any) => x.from)).not.toContain('Uvetta');
    expect(pasto.substitutions).toEqual([expect.objectContaining({ to: 'Yogurt greco con mirtilli', reason: 'non gradito' })]);
  });

  it('⛔ un piatto SOSTITUIBILE nominato nel titolo si serve, non si scarta', async () => {
    /**
     * ⚠️ È la merenda del 30/8 di Sonia, ed è il caso che la prima stesura di questa consegna
     * sbagliava **al contrario**: un `hitsExclusion` sul titolo la rifiutava, mentre le albicocche
     * secche un sostituto ce l'hanno. Il titolo deve passare dalle stesse regole degli ingredienti
     * — dove c'è un sostituto si sostituisce, dove non c'è (i gamberi) si vieta.
     */
    const ALBICOCCHE = R('a1', 'Ricotta con albicocche secche e pistacchio', 310, {
      ingredients: [{ name: 'Ricotta' }, { name: 'Albicocche secche' }],
    });
    const { service, prisma } = build([ALBICOCCHE]);
    await service.deliverIfEligible('u1');
    const pasto = pastoColazione(prisma);
    expect(pasto.recipeId).toBe('a1');
    expect(pasto.substitutions).toEqual([
      expect.objectContaining({ to: 'Ricotta con albicocche secche e pistacchio', reason: 'non gradito' }),
      expect.objectContaining({ from: 'Albicocche secche', reason: 'allergia: solfiti' }),
    ]);
  });

  it('senza allergie né intolleranze la scelta non cambia: l\'elenco ingredienti non protegge da niente', async () => {
    /**
     * ⚠️ La preferenza per le ricette con gli ingredienti scritti serve **solo** dove c'è qualcosa
     * di bloccante da cercare. Applicandola a tutte cambierebbe il pasto a chi ha solo dei gusti —
     * misurato in revisione: +60 kcal, e le porzioni a valle si scalano solo all'insù.
     */
    // ⚠️ Il candidato SENZA elenco è anche il più vicino in kcal al piatto sostituito (390 contro
    //    400): se la preferenza valesse anche qui verrebbe scartato e la scelta cambierebbe.
    const SENZA_ELENCO = R('n1', 'Pancake proteici', 390);
    const CON_ELENCO = R('n2', 'Toast integrale con uova', 300, { ingredients: [{ name: 'Pane' }, { name: 'Uova' }] });
    const { service, prisma } = build([SENZA_ELENCO, CON_ELENCO], undefined, []);
    await service.deliverIfEligible('u1');
    // ← con la preferenza applicata a tutte: 'n2', cioè un pasto diverso a una cliente che non ha
    //   nessuna esclusione bloccante, per un motivo che non la riguarda.
    expect(colazioni(prisma).map((m: any) => m.recipeId)).toEqual(['n1']);
  });

  it('⛔ se resta solo un sostituibile, la sostituzione dei solfiti è SCRITTA sul pasto', async () => {
    const { service, prisma } = build([PRUGNE]);
    await service.deliverIfEligible('u1');
    const pasto = pastoColazione(prisma);
    expect(pasto.recipeId).toBe('p1');
    // ← è la merenda del 30/8: il piatto arrivava con le prugne e nessuno l'aveva detto,
    //   perché a valle dello swap non c'è più nessuno che calcoli le sostituzioni.
    // ⚠️ `toEqual` sull'elenco INTERO, non `arrayContaining`: quella passava anche con la riga
    //    scritta due volte, ed è proprio il difetto che la revisione ha trovato.
    expect(pasto.substitutions).toEqual([
      expect.objectContaining({ to: 'Ricotta e pistacchi', reason: 'non gradito' }),
      expect.objectContaining({ from: 'Prugne secche', to: 'prugne essiccate in casa a bassa temperatura', reason: 'allergia: solfiti' }),
    ]);
  });
});
