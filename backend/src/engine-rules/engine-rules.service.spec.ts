import { EngineRulesService } from './engine-rules.service';

function build() {
  const prisma: any = {
    configParam: {
      findMany: jest.fn().mockResolvedValue([{ key: 'menu_kcal_balance_tolerance_pct', value: '18' }]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
    },
    rulePreset: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'p1', ...data })),
      update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'p1', ...data })),
      delete: jest.fn().mockResolvedValue({}),
    },
    ruleProposal: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'rp1', ...data })),
      update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'rp1', ...data })),
    },
    productRule: { upsert: jest.fn().mockResolvedValue({}) },
    diet: { findUnique: jest.fn().mockResolvedValue({ id: 'diet1' }), findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]), create: jest.fn().mockResolvedValue({ id: 'dietGen', name: 'Keto — bozza generata' }) },
    staff: { findUnique: jest.fn().mockResolvedValue({ id: 'staff1' }) },
    recipe: {
      create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: `r-${Math.round(data.kcal)}-${data.name}` })),
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    recipeRating: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    menuWeight: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    $transaction: jest.fn().mockResolvedValue([]),
    dietDayTemplate: {
      create: jest.fn().mockResolvedValue({}),
      findFirst: jest.fn().mockResolvedValue(null), // nessuna settimana ancora in catalogo
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    equivalenceGroup: { create: jest.fn().mockResolvedValue({}) },
    // Nessuna cliente su questo preset: la taglia resta quella del preset, e lo dice.
    clientProfile: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const configParams = {
    update: jest.fn().mockResolvedValue({}),
    /**
     * ⚠️ `getBool` risponde col valore predefinito che gli passa il chiamante, e `clientProfile`
     * qui sotto non trova nessuna cliente: quindi la taglia dal fabbisogno (voce 273) si ripiega
     * su quella del preset, che è il comportamento che questi test già difendevano.
     */
    getBool: jest.fn().mockImplementation((_k: string, def?: boolean) => Promise.resolve(def ?? false)),
    getString: jest.fn(async (_k: string, d?: string) => d),
    getNumber: jest.fn().mockImplementation((_k: string, def?: number) => Promise.resolve(def)),
  };
  const audit = { log: jest.fn() };
  const ai = { generateJson: jest.fn().mockResolvedValue(null) };
  /** La taglia si calcola sul fabbisogno delle clienti: qui non ce ne sono, e va bene così. */
  const kcalNeed = { computeTargetKcal: jest.fn().mockResolvedValue(null) };
  const service = new EngineRulesService(prisma as any, configParams as any, audit as any, ai as any, kcalNeed as any);
  return { service, prisma, configParams, ai, kcalNeed };
}

describe('EngineRulesService', () => {
  it('catalog: unisce metadati e valore globale attuale (o default)', async () => {
    const { service } = build();
    const c = await service.catalog();
    const tol = c.rules.find((r) => r.code === 'menu_kcal_balance_tolerance_pct')!;
    expect(tol.global).toBe(18); // dal config_param
    expect(tol.isSet).toBe(true);
    const days = c.rules.find((r) => r.code === 'menu_days_delivered')!;
    expect(days.global).toBe(2); // default dal catalogo (non a DB)
    expect(days.isSet).toBe(false);
  });

  it('setGlobal: valida contro il catalogo (rifiuta fuori range)', async () => {
    const { service } = build();
    await expect(service.setGlobal('menu_kcal_balance_tolerance_pct', 999, 'u1')).rejects.toThrow();
  });

  it('setGlobal: parametro esistente → update (invalida cache); mancante → create', async () => {
    const { service, prisma, configParams } = build();
    prisma.configParam.findUnique.mockResolvedValueOnce({ key: 'menu_select_w_eff' }); // esiste
    await service.setGlobal('menu_select_w_eff', 1.5, 'u1');
    expect(configParams.update).toHaveBeenCalledWith('menu_select_w_eff', '1.5', 'u1');

    prisma.configParam.findUnique.mockResolvedValueOnce(null); // manca (soglia agente)
    await service.setGlobal('agent_plateau_pesate', 4, 'u1');
    expect(prisma.configParam.create).toHaveBeenCalled();
  });

  it('setGlobal boolean: coerce "true" → salva "true"', async () => {
    const { service, prisma, configParams } = build();
    prisma.configParam.findUnique.mockResolvedValue({ key: 'menu_repeat_two_days_default' });
    await service.setGlobal('menu_repeat_two_days_default', 'true', 'u1');
    expect(configParams.update).toHaveBeenCalledWith('menu_repeat_two_days_default', 'true', 'u1');
  });

  it('createPreset: scarta codici regola non nel catalogo', async () => {
    const { service, prisma } = build();
    await service.createPreset(
      { style: 'keto', label: 'Test', rules: { menu_select_w_eff: 1.2, codice_finto: 5 } },
      'u1',
    );
    const data = prisma.rulePreset.create.mock.calls[0][0].data;
    expect(data.rules).toEqual({ menu_select_w_eff: 1.2 }); // niente codice_finto
    expect(data.suggested).toBe(false); // creata a mano = adottata
  });

  it('applyPresetToDiet: scrive un ProductRule per ogni regola del preset', async () => {
    const { service, prisma } = build();
    prisma.rulePreset.findUnique.mockResolvedValue({ id: 'p1', rules: { menu_repeat_two_days_default: true, menu_select_w_eff: 1.2 } });
    const res = await service.applyPresetToDiet('p1', 'diet1', 'u1');
    expect(res.applied).toBe(2);
    // boolean → enabled dal valore; numerico → enabled true + params.value
    const calls = prisma.productRule.upsert.mock.calls.map((c: any) => c[0]);
    const two = calls.find((c: any) => c.where.dietId_ruleCode.ruleCode === 'menu_repeat_two_days_default');
    expect(two.create.enabled).toBe(true);
    const eff = calls.find((c: any) => c.where.dietId_ruleCode.ruleCode === 'menu_select_w_eff');
    expect(eff.create.enabled).toBe(true);
    expect(eff.create.params).toEqual({ value: 1.2 });
  });

  it('generateCatalog: AI non disponibile → errore chiaro', async () => {
    const { service, prisma, ai } = build();
    prisma.rulePreset.findUnique.mockResolvedValue({ id: 'p1', label: 'Keto', style: 'keto', regime: 'omnivore', meals: '5', rules: {} });
    ai.generateJson.mockResolvedValue(null);
    await expect(service.generateCatalogFromPreset('p1', 'u1')).rejects.toThrow();
  });

  /**
   * Il catalogo si genera una SETTIMANA per volta. Prima si chiedeva «28 giorni» e si
   * ottenevano 5 ricette per pasto ricombinate: la Keto Mediterranea aveva 28 ricette IN TUTTO,
   * non 28 colazioni + 28 pranzi + 28 cene, e la stessa colazione tornava cinque volte al mese.
   */
  function preset5Pasti(prisma: any) {
    prisma.rulePreset.findUnique.mockResolvedValue({
      id: 'p1', label: 'Keto', style: 'keto', regime: 'omnivore', objective: 'dimagrimento', meals: '5',
      rules: { menu_daycombo_protein_min: 0.15, menu_daycombo_protein_max: 0.25, menu_repeat_two_days_default: true },
    });
  }
  /** L'AI risponde con 7 ricette per ogni pasto (una richiesta per pasto). */
  function aiSetteRicette(ai: any) {
    let n = 0;
    ai.generateJson.mockImplementation((_sys: string, user: string) => {
      if (user.includes('equivalenceGroups')) {
        return Promise.resolve({ equivalenceGroups: [{ name: 'Pesci bianchi', items: ['orata', 'branzino'] }] });
      }
      const slot = user.match(/"slot":"(\w+)"/)?.[1] ?? 'lunch';
      return Promise.resolve({
        recipes: Array.from({ length: 7 }, (_, i) => ({
          slot, name: `Piatto ${slot} ${++n}`, kcal: 400 + i,
          ingredients: [{ name: 'orata' }], macros: { protein_g: 35, carbs_g: 5, fat_g: 30 },
        })),
      });
    });
  }

  it('genera UNA settimana: 7 ricette per ogni pasto e 7 giornate, nessun piatto ripetuto', async () => {
    const { service, prisma, ai } = build();
    preset5Pasti(prisma);
    aiSetteRicette(ai);
    const res = await service.generateCatalogFromPreset('p1', 'u1', 1);
    // 5 pasti × 7 giorni = 35 ricette. Col vecchio generatore erano 5 per pasto in tutto.
    expect(res).toEqual(expect.objectContaining({ week: 1, recipes: 35, days: 7, dietId: 'dietGen' }));
    expect(prisma.recipe.create).toHaveBeenCalledTimes(35);
    expect(prisma.dietDayTemplate.create).toHaveBeenCalledTimes(7);
    // ricetta creata in BOZZA (non attiva, allergeni da confermare)
    expect(prisma.recipe.create.mock.calls[0][0].data).toEqual(expect.objectContaining({ active: false, allergensReviewed: false }));
    expect(prisma.equivalenceGroup.create).toHaveBeenCalledTimes(1);
    expect(prisma.productRule.upsert).toHaveBeenCalled(); // regole del preset applicate alla dieta

    // Dentro la settimana ogni giorno ha piatti diversi dagli altri giorni: è tutto il punto.
    const giorni = prisma.dietDayTemplate.create.mock.calls.map((c: any) => c[0].data);
    expect(giorni.map((d: any) => d.dayIndex)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    const usate = giorni.flatMap((d: any) => d.meals.map((m: any) => m.recipeId));
    expect(new Set(usate).size).toBe(usate.length);
  });

  /**
   * LE GIORNATE GIÀ IN CATALOGO su questa variante, `settimane` settimane **piene**: sette giornate
   * per settimana e sette piatti diversi per pasto.
   *
   * ⚠️ Prima qui bastava `findFirst` col giorno più alto, perché il generatore contava solo quello.
   * Dal 18/8 guarda se le settimane sono davvero piene (Simone: «le ricette vanno sempre a
   * riempimento delle settimane incomplete»), quindi il finto deve dire cosa c'è dentro — ed è
   * giusto così: un test che finge «c'è la settimana 1» senza dire cosa contiene stava fingendo
   * anche la domanda.
   */
  const CINQUE_PASTI = ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner'];
  function giornateInCatalogo(prisma: any, settimane: number, giorniUltimaSettimana = 7) {
    const giorni: any[] = [];
    for (let w = 1; w <= settimane; w++) {
      const quanti = w === settimane ? giorniUltimaSettimana : 7;
      for (let i = 0; i < quanti; i++) {
        giorni.push({
          dayIndex: (w - 1) * 7 + i + 1,
          meals: CINQUE_PASTI.map((slot) => ({ slot, recipeId: `own-${slot}-${w}-${i}` })),
        });
      }
    }
    prisma.dietDayTemplate.findFirst.mockResolvedValue(giorni.length ? { dayIndex: giorni[giorni.length - 1].dayIndex } : null);
    const prima = prisma.dietDayTemplate.findMany.getMockImplementation?.();
    prisma.dietDayTemplate.findMany.mockImplementation((args: any) => {
      // La lettura del ciclo di QUESTA variante: `dietId` secco e `dayIndex` fra i campi chiesti.
      if (typeof args?.where?.dietId === 'string' && args?.select?.dayIndex === true && !args?.where?.dayIndex) {
        return Promise.resolve(giorni);
      }
      return prima ? prima(args) : Promise.resolve([]);
    });
  }

  it('la settimana 2 si aggiunge in coda alla 1, senza ricreare la dieta', async () => {
    const { service, prisma, ai } = build();
    preset5Pasti(prisma);
    aiSetteRicette(ai);
    prisma.diet.findMany.mockResolvedValue([{ id: 'dietEsistente', name: 'Keto', mealsPerDay: 5, fasting: false }]);
    giornateInCatalogo(prisma, 1); // c'è già la settimana 1, ed è piena
    const res = await service.generateCatalogFromPreset('p1', 'u1', 2);
    expect(res.week).toBe(2);
    expect(prisma.diet.create).not.toHaveBeenCalled();
    const indici = prisma.dietDayTemplate.create.mock.calls.map((c: any) => c[0].data.dayIndex);
    expect(indici).toEqual([8, 9, 10, 11, 12, 13, 14]);
    // Gruppi e regole appartengono alla dieta, non alla settimana: non si riscrivono.
    expect(prisma.equivalenceGroup.create).not.toHaveBeenCalled();
  });

  it('una settimana già fatta non si tocca (a meno che non si chieda di rifarla)', async () => {
    const { service, prisma, ai } = build();
    preset5Pasti(prisma);
    aiSetteRicette(ai);
    prisma.diet.findMany.mockResolvedValue([{ id: 'dietEsistente', name: 'Keto', mealsPerDay: 5, fasting: false }]);
    giornateInCatalogo(prisma, 2); // due settimane piene
    const res = await service.generateCatalogFromPreset('p1', 'u1', 2);
    expect(res).toEqual(expect.objectContaining({ alreadyExists: true, week: 2, recipes: 0 }));
    expect(prisma.recipe.create).not.toHaveBeenCalled();
  });

  /**
   * ⚠️ «LE RICETTE VANNO SEMPRE A RIEMPIMENTO DELLE SETTIMANE INCOMPLETE» (Simone, 18/8).
   *
   * Il difetto: il generatore contava le settimane dal giorno più alto in catalogo. Quattro giornate
   * scritte nella settimana 2 facevano «due settimane fatte», e da quel momento la settimana 2
   * restava a metà per sempre — il pulsante rispondeva «c'è già» e il cron guardava avanti.
   */
  it('una settimana a metà si RIEMPIE, invece di rispondere «c\'è già»', async () => {
    const { service, prisma, ai } = build();
    preset5Pasti(prisma);
    aiSetteRicette(ai);
    prisma.diet.findMany.mockResolvedValue([{ id: 'dietEsistente', name: 'Keto', mealsPerDay: 5, fasting: false }]);
    // La 1 piena, la 2 con quattro giornate su sette.
    giornateInCatalogo(prisma, 2, 4);
    const res = await service.generateCatalogFromPreset('p1', 'u1', 3);
    // Non la 3: prima si finisce la 2. E NON è un «alreadyExists».
    expect(res.week).toBe(2);
    expect((res as { alreadyExists?: boolean }).alreadyExists).toBeUndefined();
    const indici = prisma.dietDayTemplate.create.mock.calls.map((c: any) => c[0].data.dayIndex);
    expect(indici).toEqual([8, 9, 10, 11, 12, 13, 14]);
  });

  it('⚠️ e chiedere ESPLICITAMENTE una settimana piena continua a rispondere «c\'è già»', async () => {
    // Il rovescio: il riempimento non deve diventare «rifà sempre qualcosa». Se la settimana
    // chiesta è piena, non si tocca niente — è il backoffice a chiedere completa o rifai.
    const { service, prisma, ai } = build();
    preset5Pasti(prisma);
    aiSetteRicette(ai);
    prisma.diet.findMany.mockResolvedValue([{ id: 'dietEsistente', name: 'Keto', mealsPerDay: 5, fasting: false }]);
    giornateInCatalogo(prisma, 2, 4);
    const res = await service.generateCatalogFromPreset('p1', 'u1', 1);
    expect(res).toEqual(expect.objectContaining({ alreadyExists: true, week: 1 }));
  });

  it('la variante a 3 pasti RIUSA le ricette di quella a 5: stessa dieta, stesso regime', async () => {
    const { service, prisma, ai } = build();
    // Preset a 3 pasti della stessa famiglia già generata a 5 pasti.
    prisma.rulePreset.findUnique.mockResolvedValue({
      id: 'p1', label: 'Keto', style: 'keto', regime: 'omnivore', objective: 'dimagrimento', meals: '3', rules: {},
    });
    aiSetteRicette(ai);
    prisma.diet.findMany.mockResolvedValue([
      { id: 'diet5', name: 'Keto', mealsPerDay: 5, fasting: false }, // la sorella già fatta
    ]);
    // La settimana 1 della sorella: 7 giornate con colazione, pranzo e cena (più gli spuntini).
    prisma.dietDayTemplate.findMany.mockImplementation((args: any) => {
      if (args?.where?.dayIndex && args?.where?.dietId?.in) {
        return Promise.resolve(Array.from({ length: 7 }, (_, i) => ({
          dayIndex: i + 1,
          meals: [
            { slot: 'breakfast', recipeId: `b${i}` },
            { slot: 'morning_snack', recipeId: `ms${i}` },
            { slot: 'lunch', recipeId: `l${i}` },
            { slot: 'afternoon_snack', recipeId: `as${i}` },
            { slot: 'dinner', recipeId: `d${i}` },
          ],
        })));
      }
      return Promise.resolve([]);
    });
    const res = await service.generateCatalogFromPreset('p1', 'u1', 1);
    // Nessuna ricetta nuova: colazione, pranzo e cena arrivano dalla variante a 5 pasti.
    expect(res.recipes).toBe(0);
    expect(res.riusate).toBe(21); // 3 pasti × 7 giorni
    expect(prisma.recipe.create).not.toHaveBeenCalled();
    expect(ai.generateJson).not.toHaveBeenCalledWith(expect.anything(), expect.stringContaining('"slot":"breakfast"'), expect.anything());
    // Le giornate però sono sue, con i suoi tre pasti.
    const giorni = prisma.dietDayTemplate.create.mock.calls.map((c: any) => c[0].data);
    expect(giorni).toHaveLength(7);
    expect(giorni[0].meals.map((m: any) => m.slot)).toEqual(['breakfast', 'lunch', 'dinner']);
    expect(giorni[0].meals.map((m: any) => m.recipeId)).toEqual(['b0', 'l0', 'd0']);
  });

  it('rigenerando una settimana non si cancellano ricette GIÀ ATTIVE (potrebbero stare in menu consegnati)', async () => {
    const { service, prisma, ai } = build();
    preset5Pasti(prisma);
    aiSetteRicette(ai);
    prisma.diet.findMany.mockResolvedValue([{ id: 'dietEsistente', name: 'Keto', mealsPerDay: 5, fasting: false }]);
    prisma.dietDayTemplate.findFirst.mockResolvedValue({ dayIndex: 7 });
    prisma.dietDayTemplate.findMany.mockImplementation((args: any) => {
      // Le giornate DELLA settimana da rifare. La query delle "altre" (quella con OR) deve
      // tornare vuota, altrimenti la ricetta non risulterebbe orfana e non si arriverebbe
      // nemmeno al filtro che questo test verifica.
      if (args?.where?.OR) return Promise.resolve([]);
      return Promise.resolve([{ dayIndex: 1, meals: [{ slot: 'lunch', recipeId: 'attiva-1' }] }]);
    });
    // La query che filtra le cancellabili chiede `active: false`: qui non ne torna nessuna.
    prisma.recipe.findMany.mockResolvedValue([]);
    await service.generateCatalogFromPreset('p1', 'u1', 1, 'rifai');
    const richiesta = prisma.recipe.findMany.mock.calls.find((c: any) => c[0]?.where?.active === false);
    expect(richiesta).toBeTruthy(); // ← senza questo filtro si cancellavano anche le attive
    expect(prisma.recipe.deleteMany).not.toHaveBeenCalled();
  });

  it('COMPLETA: le ricette che ci sono restano (anche quelle corrette a mano), si genera solo la differenza', async () => {
    const { service, prisma, ai } = build();
    preset5Pasti(prisma);
    aiSetteRicette(ai);
    prisma.diet.findMany.mockResolvedValue([{ id: 'dietVecchia', name: 'Keto', mealsPerDay: 5, fasting: false }]);
    prisma.dietDayTemplate.findFirst.mockResolvedValue({ dayIndex: 7 });
    // Catalogo vecchio di UNA settimana: 7 giornate fatte con SOLO 5 piatti per pasto,
    // ricombinati. Quei 5 non li usa nessun'altra settimana, quindi sono davvero disponibili.
    prisma.dietDayTemplate.findMany.mockImplementation((args: any) => {
      if (args?.where?.OR || args?.where?.dietId?.in) return Promise.resolve([]);
      return Promise.resolve(Array.from({ length: 7 }, (_, i) => ({
        dayIndex: i + 1,
        meals: ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner']
          .map((slot) => ({ slot, recipeId: `${slot}-${i % 5}` })),
      })));
    });

    const res = await service.generateCatalogFromPreset('p1', 'u1', 1, 'completa');

    /**
     * ⚠️ **DAL 1/9 IL CONTO È UN ALTRO, ed è il punto della Fase 2.** Spuntino e merenda sono lo
     * stesso paniere: contando cosa c'è già per lo spuntino si contano anche le merende, e
     * viceversa. Quei due pasti hanno quindi **dieci** piatti a testa invece di cinque — tagliati
     * a sette, che è quanti ne servono per una settimana — e per loro non si genera più niente.
     *
     * 5 (colazione) + 7 (spuntino) + 5 (pranzo) + 7 (merenda) + 5 (cena) = 29 riusate, e le
     * generate scendono da dieci a sei: due per colazione, pranzo e cena.
     *
     * ⛔ **Le quattro ricette che non si generano più sono quattro chiamate all'AI risparmiate su
     * una variante sola**, e il generatore gira su tutte. Era la coda dichiarata della Fase 2: da
     * quando l'agente dei pasti leggeri lavora ogni notte, quel doppio lavoro si pagava tutti i
     * giorni.
     */
    expect(res.riusate).toBe(29);
    expect(res.recipes).toBe(6);
    expect(prisma.recipe.create).toHaveBeenCalledTimes(6);
    // Nessuna ricetta cancellata: è tutto il punto della modalità "completa".
    expect(prisma.recipe.deleteMany).not.toHaveBeenCalled();
    // E la settimana ha comunque 7 giornate con 7 pranzi diversi.
    const giorni = prisma.dietDayTemplate.create.mock.calls.map((c: any) => c[0].data);
    expect(giorni).toHaveLength(7);
    const pranzi = giorni.map((d: any) => d.meals.find((m: any) => m.slot === 'lunch').recipeId);
    expect(new Set(pranzi).size).toBe(7);
    expect(pranzi.slice(0, 5)).toEqual(['lunch-0', 'lunch-1', 'lunch-2', 'lunch-3', 'lunch-4']);
    // ← i 5 originali (quelli che il nutrizionista può aver corretto a mano) sono ancora lì.
  });

  it('COMPLETA: alla settimana 2 il magazzino è finito, quindi genera tutto nuovo', async () => {
    const { service, prisma, ai } = build();
    preset5Pasti(prisma);
    aiSetteRicette(ai);
    prisma.diet.findMany.mockResolvedValue([{ id: 'dietVecchia', name: 'Keto', mealsPerDay: 5, fasting: false }]);
    prisma.dietDayTemplate.findFirst.mockResolvedValue({ dayIndex: 28 });
    prisma.dietDayTemplate.findMany.mockImplementation((args: any) => {
      if (args?.where?.OR || args?.where?.dietId?.in) return Promise.resolve([]);
      // Dopo aver completato la settimana 1 il magazzino ha 7 piatti per pasto: sono tutti
      // impegnati lì, quindi alla settimana 2 non ne resta nessuno.
      return Promise.resolve(Array.from({ length: 28 }, (_, i) => ({
        dayIndex: i + 1,
        meals: ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner']
          .map((slot) => ({ slot, recipeId: `${slot}-${i % 7}` })),
      })));
    });
    const res = await service.generateCatalogFromPreset('p1', 'u1', 2, 'completa');
    expect(res.riusate).toBe(0);
    expect(res.recipes).toBe(35);
    expect(prisma.recipe.deleteMany).not.toHaveBeenCalled();
  });

  it('COMPLETA: non ruba le ricette alle altre settimane (difetto dell\'8/8)', async () => {
    const { service, prisma, ai } = build();
    preset5Pasti(prisma);
    aiSetteRicette(ai);
    prisma.diet.findMany.mockResolvedValue([{ id: 'dietVecchia', name: 'Keto', mealsPerDay: 5, fasting: false }]);
    prisma.dietDayTemplate.findFirst.mockResolvedValue({ dayIndex: 63 });
    // Catalogo reale dopo il lavoro dell'8/8: settimane 1-4 fatte con 5 piatti ricombinati,
    // settimane 5-9 già generate con 7 piatti nuovi ciascuna.
    prisma.dietDayTemplate.findMany.mockImplementation((args: any) => {
      if (args?.where?.OR || args?.where?.dietId?.in) return Promise.resolve([]);
      return Promise.resolve(Array.from({ length: 63 }, (_, i) => {
        const giorno = i + 1;
        const vecchia = giorno <= 28;
        return {
          dayIndex: giorno,
          meals: ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner'].map((slot) => ({
            slot,
            recipeId: vecchia ? `${slot}-vecchia-${i % 5}` : `${slot}-nuova-${giorno}`,
          })),
        };
      }));
    });

    const res = await service.generateCatalogFromPreset('p1', 'u1', 1, 'completa');

    // I 5 piatti vecchi sono usati anche dalle settimane 2, 3 e 4: tenerli qui li ripeterebbe.
    // Quindi la settimana 1 va generata da capo — ed è proprio quello che prima NON succedeva:
    // pescava due piatti dalla settimana 5 e si fermava con `mancanti = 0`.
    expect(res.riusate).toBe(0);
    expect(res.recipes).toBe(35);
    const giorni = prisma.dietDayTemplate.create.mock.calls.map((c: any) => c[0].data);
    const pranzi = giorni.map((d: any) => d.meals.find((m: any) => m.slot === 'lunch').recipeId);
    expect(new Set(pranzi).size).toBe(7);
    // E nessuno dei piatti nuovi è preso in prestito dalle settimane già fatte.
    expect(pranzi.some((id: string) => String(id).includes('nuova'))).toBe(false);
  });

  /**
   * NIENTE BUCHI, MA NIENTE ECCEZIONI: chi è indietro RECUPERA un passo per volta (11/8).
   *
   * Prima qui si pretendeva un'eccezione, e l'eccezione era la trappola: la striscia del backoffice
   * conta le settimane della FAMIGLIA, questo servizio le conta sulla singola VARIANTE. Appena una
   * variante resta indietro le due cose divergono, la richiesta «settimana 10» veniva rifiutata, e nel
   * giro su diciotto varianti quel rifiuto fermava anche tutte quelle dopo: diciassette sane bloccate
   * da una. È il caso vero di «Mediterranea senza glutine»: fino alla 9 sì, la 10 no.
   *
   * Generare `settimaneFatte + 1` rispetta l'invariante che il controllo difendeva — nessun buco — e fa
   * quello che uno intende chiedendo «portale alla 10».
   */
  it('settimana lontana: genera la prossima possibile e dice che era stata chiesta un\'altra', async () => {
    const { service, prisma, ai } = build();
    preset5Pasti(prisma);
    aiSetteRicette(ai);
    prisma.diet.findMany.mockResolvedValue([{ id: 'dietEsistente', name: 'Keto', mealsPerDay: 5, fasting: false }]);
    giornateInCatalogo(prisma, 1); // una settimana fatta, e piena
    const r = await service.generateCatalogFromPreset('p1', 'u1', 4);
    // La 2, non la 4: fra la 1 e la 4 ci sarebbero due settimane vuote in mezzo.
    expect(r.week).toBe(2);
    expect((r as { settimanaChiesta?: number }).settimanaChiesta).toBe(4);
    // E le giornate scritte sono quelle della settimana 2, non della 4.
    const indici = prisma.dietDayTemplate.create.mock.calls.map((c: any) => c[0].data.dayIndex);
    expect(indici).toEqual([8, 9, 10, 11, 12, 13, 14]);
  });

  it('createProposal: senza testo → errore; con testo → pending', async () => {
    const { service, prisma } = build();
    await expect(service.createProposal({ text: '' }, 'u1')).rejects.toThrow();
    await service.createProposal({ title: 'Cap carbo', text: 'Aggiungere tetto carboidrati in grammi' }, 'u1');
    const data = prisma.ruleProposal.create.mock.calls[0][0].data;
    expect(data.status).toBe('pending');
    expect(data.title).toBe('Cap carbo');
  });
});

/**
 * «Completa» che non completava niente — il difetto del 9/8, e vale la pena capirlo bene perché
 * dal backoffice sembrava un pulsante rotto.
 *
 * Situazione vera: settimane 1-4 fatte col metodo vecchio (pochi piatti ricombinati), 5-12 fatte
 * bene, e il nutrizionista lavora con la spunta «genera tutte le 18 varianti». Si chiede di
 * completare la settimana 1. Le ricette *proprie* venivano filtrate — quei piatti compaiono
 * anche nelle altre settimane, quindi non contano — ma subito dopo arrivavano quelle delle
 * varianti SORELLE (3 pasti, digiuno), che per la settimana 1 hanno esattamente gli stessi
 * piatti presi in prestito. Quelle entravano **senza nessun controllo**: `mancanti` tornava a
 * zero, l'AI non veniva chiamata, la settimana restava magra. Rigenerando: identico.
 */
describe('EngineRulesService — completare una settimana magra', () => {
  it('i piatti delle SORELLE non contano se questa variante li usa già in un’altra settimana', async () => {
    const { service, prisma, ai } = build();
    prisma.rulePreset.findUnique.mockResolvedValue({
      id: 'p1', label: 'Basso indice glicemico', style: 'low_gi', regime: 'omnivore',
      objective: 'dimagrimento', meals: '5', clinicalNotes: null, rules: {},
    });
    // La variante esiste già, con dodici settimane.
    prisma.diet.findFirst.mockResolvedValue({ id: 'dietA', name: 'Basso indice glicemico' });
    prisma.diet.findMany.mockResolvedValue([{ id: 'dietA' }, { id: 'dietB' }]); // A + una sorella
    prisma.dietDayTemplate.findFirst.mockResolvedValue({ dayIndex: 84 });

    // Giornate: la settimana 1 usa `r-vecchia`, che però compare anche nella settimana 5 —
    // quindi non è sua. La sorella (dietB) per la settimana 1 propone lo STESSO `r-vecchia`.
    prisma.dietDayTemplate.findMany.mockImplementation(({ where }: any) => {
      const id = where?.dietId?.in ? where.dietId.in[0] : where?.dietId;
      const giorni: any[] = [];
      for (let d = 1; d <= 7; d++) giorni.push({ dayIndex: d, meals: [{ slot: 'lunch', recipeId: 'r-vecchia' }] });
      for (let d = 29; d <= 35; d++) giorni.push({ dayIndex: d, meals: [{ slot: 'lunch', recipeId: 'r-vecchia' }] });
      return Promise.resolve(id === 'dietB' ? giorni.filter((g) => g.dayIndex <= 7) : giorni);
    });
    ai.generateJson.mockResolvedValue(null); // l'AI non risponde: qui conta solo SE viene chiamata

    await service.generateCatalogFromPreset('p1', 'user-1', 1, 'completa').catch(() => undefined);

    // Prima: `mancanti` era 0 e l'AI non veniva mai interpellata — il pulsante «non faceva
    // niente». Ora il piatto della sorella viene scartato (questa variante lo usa nella
    // settimana 5) e i piatti mancanti si chiedono davvero.
    expect(ai.generateJson).toHaveBeenCalled();
  });
});
