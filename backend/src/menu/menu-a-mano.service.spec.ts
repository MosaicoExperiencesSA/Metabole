/**
 * ⛔ **LA PORTA CHE SCRIVE COSA MANGIA UNA PERSONA.**
 *
 * Il giudizio sta nel modulo puro (`giornata-scritta-a-mano.ts`) e ha le sue prove. Qui si prova il
 * **montaggio**: che il servizio chiami quella regola con gli ingredienti giusti, che non riscriva
 * un giorno che la cliente ha già in mano, e che le incompatibili arrivino alla schermata
 * **barrate col motivo** invece di sparire.
 *
 * ⚠️ *Le prove sul modulo puro non provano il montaggio* — è la lezione del 3/9, e qui il punto di
 * cucitura decide un giorno di menu.
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MenuAManoService } from './menu-a-mano.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { KcalNeedService } from './kcal-need.service';
import type { ConfigParamsService } from '../config-params/config-params.service';
import type { AuditService } from '../audit/audit.service';

const RICETTE: { id: string; name: string; kcal: number; mealSlot: string; ingredients: unknown; allergens: string[]; active?: boolean; regime?: string }[] = [
  /** ⚠️ Il regime è scritto perché la ricerca fuori dal paniere ci filtra sopra: senza, «Porridge» sparirebbe. */
  { id: 'c1', name: 'Porridge', kcal: 400, mealSlot: 'breakfast', ingredients: [{ name: 'avena' }], allergens: [], regime: 'vegan' },
  { id: 'p1', name: 'Insalata di gamberi', kcal: 700, mealSlot: 'lunch', ingredients: [{ name: 'gamberi' }], allergens: ['crostacei'] },
  { id: 'd1', name: 'Pollo e verdure', kcal: 600, mealSlot: 'dinner', ingredients: [{ name: 'pollo' }], allergens: [] },
  /**
   * ⛔ **Il solo segnale è il NOME**: elenco ingredienti povero, nessun tag allergene. È il caso per
   * cui il motore, Vera e questa schermata infilano il nome fra gli ingredienti — e senza una riga
   * così la mutazione «il nome non entra più» sopravvive, come è successo.
   */
  { id: 'x1', name: 'Insalata di gamberi e avocado', kcal: 650, mealSlot: 'lunch', ingredients: [{ name: 'avocado' }], allergens: [] },
  /**
   * ⛔ **FUORI DAL PANIERE** (non è in `recipeIds`): esiste in catalogo e il pool non la conosce. È
   * il caso per cui Simone il 4/9 mandava i menu in chat — il piatto giusto c'era e da qui non si
   * trovava.
   */
  { id: 'fuori', name: 'Pancake di avena', kcal: 380, mealSlot: 'breakfast', ingredients: [{ name: 'avena' }], allergens: [], regime: 'vegan' },
  /** ⚠️ Fuori dal paniere E di un regime che una vegana non può mangiare. */
  { id: 'carne', name: 'Spezzatino di manzo', kcal: 700, mealSlot: 'dinner', ingredients: [{ name: 'manzo' }], allergens: [], regime: 'omnivore' },
  /** ⚠️ Spenta: non deve comparire da nessuna parte. */
  { id: 'spenta', name: 'Vecchia ricetta', kcal: 500, mealSlot: 'lunch', ingredients: [{ name: 'riso' }], allergens: [], active: false },
];

function servizio(over: {
  profilo?: Record<string, unknown>;
  giorno?: Record<string, unknown> | null;
  target?: number | null;
  ultimoMenu?: Record<string, unknown> | null;
  pool?: { recipeIds: string[]; dietId: string } | null;
  /** Il ruolo dell'attore: `nutritionist` ha un perimetro, `admin` no. */
  ruoloAttore?: string;
  /** Il regime della dieta della cliente: letto solo quando si esce dal paniere. */
  regimeDieta?: string | null;
  staffId?: string | null;
} = {}) {
  const upsert = jest.fn().mockResolvedValue({});
  const prisma = {
    clientMenuPool: { findFirst: jest.fn().mockResolvedValue(over.pool === undefined ? { recipeIds: ['c1', 'p1', 'd1', 'x1', 'spenta'], dietId: 'diet-1' } : over.pool) },
    /** ⚠️ Nessun override di dieta e nessun divieto: le prove che li vogliono se li mettono. */
    productRule: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
    staff: { findUnique: jest.fn().mockResolvedValue(over.staffId === undefined ? null : { id: over.staffId }) },
    user: { findUnique: jest.fn().mockResolvedValue({ role: over.ruoloAttore ?? 'admin' }) },
    clientProfile: {
      findUnique: jest.fn().mockResolvedValue({
        allergies: [], intolerances: [], dislikedFoods: [], apertureDal: new Date('2026-01-01'),
        assignedCoachId: 'staff-c', assignedNutritionistId: 'staff-n',
        pathType: null, fastingWindow: null, pastiEsclusi: [],
        ...(over.profilo ?? {}),
      }),
    },
    recipe: {
      findMany: jest.fn().mockImplementation(({ where }: never) => {
        const w = (where ?? {}) as { mealSlot?: string; name?: { contains?: string }; id?: { in?: string[] }; regime?: { in?: string[] } };
        const w2 = (where ?? {}) as { active?: boolean };
        return Promise.resolve(RICETTE
          .filter((r) => (w2.active === true ? r.active !== false : true))
          .filter((r) => (w.id?.in ? w.id.in.includes(r.id) : true))
          .filter((r) => (w.mealSlot ? r.mealSlot === w.mealSlot : true))
          .filter((r) => (w.regime?.in ? w.regime.in.includes(r.regime ?? 'omnivore') : true))
          .filter((r) => (w.name?.contains ? r.name.toLowerCase().includes(w.name.contains.toLowerCase()) : true)));
      }),
    },
    /** ⚠️ Letta SOLO quando si esce dal paniere: dentro, il regime non serve e non si chiede. */
    diet: { findUnique: jest.fn().mockResolvedValue({ regime: over.regimeDieta === undefined ? 'vegan' : over.regimeDieta }) },
    menuDay: {
      findFirst: jest.fn().mockImplementation(({ orderBy }: never) =>
        Promise.resolve(orderBy ? (over.ultimoMenu === undefined ? { dietId: 'diet-1', level: 2 } : over.ultimoMenu)
          : (over.giorno === undefined ? null : over.giorno))),
      upsert,
    },
    dietDayTemplate: {
      findMany: jest.fn().mockResolvedValue([
        { meals: [{ slot: 'breakfast' }, { slot: 'lunch' }] },
        // ⚠️ Due template, non uno: l'unione degli slot fra giornate diverse era non osservabile.
        { meals: [{ slot: 'lunch' }, { slot: 'dinner' }] },
      ]),
    },
  } as unknown as PrismaService;
  const kcal = { computeTargetKcal: jest.fn().mockResolvedValue(over.target === undefined ? 1700 : over.target) } as unknown as KcalNeedService;
  const config = { getNumber: jest.fn(async (_k: string, def: number) => def) } as unknown as ConfigParamsService;
  const audit = { log: jest.fn().mockResolvedValue(undefined) } as unknown as AuditService;
  return { s: new MenuAManoService(prisma, kcal, config, audit), upsert, prisma, audit };
}

/** ⚠️ Il client manda SOLO questo: nome, kcal e verdetto li rilegge il server. */
const GIORNATA = [
  { slot: 'breakfast', recipeId: 'c1' },
  { slot: 'lunch', recipeId: 'p1' },
  { slot: 'dinner', recipeId: 'd1' },
];
const LUCIA = { id: 'u1', nome: 'lucia@metabole.it' };

describe('le ricette che la schermata propone', () => {
  /**
   * ⛔ **Le incompatibili si MOSTRANO barrate, non spariscono.** `poolDellaCliente` di Vera le
   * scarta, e per lei è giusto — sta abbinando una frase. Qui no: chi compone deve poter decidere
   * sapendo, e chi non sa perché un piatto non c'è lo cerca.
   */
  it('⛔ una ricetta incompatibile arriva barrata col motivo, non tolta', async () => {
    const { s } = servizio({ profilo: { allergies: ['crostacei'] } });
    const { righe } = await s.ricette('u1', 'c1');
    const gamberi = righe.find((r) => r.recipeId === 'p1');
    expect(gamberi).toBeDefined();
    expect(gamberi!.bloccata).toBe(true);
    // ⚠️ Il motivo è una frase italiana pronta da mostrare, non un codice: è `valutaRicetta` a
    //    scriverla, e la schermata la stampa così com'è sotto il piatto barrato.
    expect(gamberi!.motivoBlocco).toBe('Insalata di gamberi: contiene Crostacei (allergene dichiarato)');
    // ⚠️ La controprova: senza quell'allergia la stessa ricetta non è bloccata.
    const pulita = await servizio().s.ricette('u1', 'c1');
    expect(pulita.righe.find((r) => r.recipeId === 'p1')!.bloccata).toBe(false);
  });

  /**
   * ⚠️ Un pool vuoto si dice, invece di far vedere una ricerca che non trova mai niente.
   *
   * ⛔ **E porta i regimi lo stesso** — corretto il 4/9 dopo una revisione. Questa uscita anticipata
   * riguarda la cliente **senza pool**, cioè proprio quella per cui la ricerca in tutto il catalogo
   * esiste: senza i due campi la schermata le proponeva «onnivoro» per scrivere una ricetta nuova.
   */
  it('⚠️ senza pool lo dice, e dice comunque che regime ha', async () => {
    const { s, prisma } = servizio();
    (prisma.clientMenuPool.findFirst as jest.Mock).mockResolvedValue({ recipeIds: [], dietId: 'diet-1' });
    expect(await s.ricette('u1', 'c1')).toEqual({
      righe: [], poolVuoto: true, regimiAmmessi: ['vegan'], regimeCliente: 'vegan',
    });
  });

  /** ⛔ E senza nessun pool (nemmeno la riga) resta il ripiego stretto, non «tutti». */
  it('⛔ senza nessun pool i regimi ci sono lo stesso, e il regime vero è «non lo so»', async () => {
    const { s, prisma } = servizio();
    (prisma.clientMenuPool.findFirst as jest.Mock).mockResolvedValue(null);
    expect(await s.ricette('u1', 'c1')).toEqual({
      righe: [], poolVuoto: true, regimiAmmessi: ['vegan'], regimeCliente: null,
    });
  });

  /**
   * ⛔ **CERCARE IN TUTTO IL CATALOGO** (Simone, 4/9). È la ragione per cui i menu passavano dalla
   * chat: se il piatto giusto stava fuori dal pool, da questa schermata non si trovava.
   */
  describe('fuori dal paniere', () => {
    it('⛔ dentro al paniere «Pancake di avena» non si trova', async () => {
      const { s } = servizio();
      const esito = await s.ricette('u1', 'c1', 'breakfast');
      expect((esito.righe as { recipeId: string }[]).map((r) => r.recipeId)).not.toContain('fuori');
    });

    it('⛔ e con tuttoIlCatalogo sì, marcata come eccezione', async () => {
      const { s } = servizio();
      const esito = await s.ricette('u1', 'c1', 'breakfast', undefined, true);
      const riga = (esito.righe as { recipeId: string; fuoriDalPaniere: boolean }[]).find((r) => r.recipeId === 'fuori');
      expect(riga).toBeTruthy();
      expect(riga?.fuoriDalPaniere).toBe(true);
    });

    it('⚠️ e quelle del paniere restano marcate come tali', async () => {
      const { s } = servizio();
      const esito = await s.ricette('u1', 'c1', 'breakfast', undefined, true);
      const riga = (esito.righe as { recipeId: string; fuoriDalPaniere: boolean }[]).find((r) => r.recipeId === 'c1');
      expect(riga?.fuoriDalPaniere).toBe(false);
    });

    /**
     * ⛔ **IL REGIME RESTA UN CANCELLO.** Fuori dal paniere il catalogo ha anche la carne, e
     * servire uno spezzatino a una vegana perché «non era fra le sue esclusioni» sarebbe il modo
     * più veloce di perdere una cliente. Dentro al paniere la domanda non si pone.
     */
    it('⛔ una ricetta di un regime che lei non mangia NON esce, nemmeno dal catalogo intero', async () => {
      const { s } = servizio();
      const esito = await s.ricette('u1', 'c1', 'dinner', undefined, true);
      expect((esito.righe as { recipeId: string }[]).map((r) => r.recipeId)).not.toContain('carne');
    });

    /** ⚠️ E i regimi su cui si è filtrato si **dicono**, invece di farli indovinare alla schermata. */
    it('⚠️ la risposta dice su che regimi ha filtrato', async () => {
      const { s } = servizio();
      const esito = await s.ricette('u1', 'c1', 'breakfast', undefined, true) as { regimiAmmessi?: string[] };
      expect(esito.regimiAmmessi).toEqual(['vegan']);
    });

    /**
     * ⛔ **E tornano ANCHE senza la casella alzata** — corretto il 4/9 dopo una revisione.
     *
     * La schermata li usa per proporre il regime di una **ricetta nuova**, e quel pulsante c'è
     * anche a casella abbassata: chi scriveva un piatto senza aver mai cercato in tutto il catalogo
     * si vedeva proporre «onnivoro» per una cliente vegana, e lo scopriva dopo il salvataggio.
     */
    it('⛔ i regimi tornano anche restando dentro al paniere', async () => {
      const { s } = servizio();
      const esito = await s.ricette('u1', 'c1', 'breakfast') as { regimiAmmessi?: string[] };
      expect(esito.regimiAmmessi).toEqual(['vegan']);
    });

    /**
     * ⛔ **`regimeCliente` e `regimiAmmessi` NON sono lo stesso dato**, e la differenza si vede solo
     * qui: su regime illeggibile `regimiAmmessi` vale `['vegan']` — ripiego di sicurezza, innocuo
     * come filtro — mentre `regimeCliente` resta `null`. Chi scrive una ricetta nuova deve
     * **chiedere** il regime, non ereditare il ripiego: «vegana» su un piatto che resta in catalogo
     * non è un filtro stretto, è un'affermazione falsa.
     */
    it('⛔ su regime illeggibile il ripiego filtra, ma non si spaccia per il suo regime', async () => {
      const { s } = servizio({ regimeDieta: null });
      const esito = await s.ricette('u1', 'c1', 'breakfast', undefined, true) as { regimiAmmessi?: string[]; regimeCliente?: string | null };
      expect(esito.regimiAmmessi).toEqual(['vegan']);
      expect(esito.regimeCliente).toBeNull();
    });

    /** ⚠️ E quando si legge, è quello vero. */
    it('⚠️ quando il regime si legge, la risposta lo dice', async () => {
      const { s } = servizio({ regimeDieta: 'pescetarian' });
      const esito = await s.ricette('u1', 'c1', 'breakfast') as { regimeCliente?: string | null };
      expect(esito.regimeCliente).toBe('pescetarian');
    });

    /**
     * ⛔ **IL CASO CHE HA FATTO RISCRIVERE IL FILTRO** — trovato da una revisione avversariale il
     * 4/9, prima della consegna.
     *
     * La prima stesura filtrava sul regime **solo se** riusciva a leggerlo: `dietId ? {regime} : {}`
     * — e senza pool `dietId` è nullo, cioè proprio la cliente per cui si esce dal paniere. Una
     * vegana appena inserita alzava «tutto il catalogo» e vedeva lo spezzatino di manzo **non
     * barrato**, perché il manzo non è fra le sue esclusioni.
     *
     * ⚠️ Il ripiego di `regimiCompatibili` va verso il più stretto: regime ignoto → vegano. Meno
     * scelta, e qualcuno se ne accorge; non carne nel piatto, che nessuno vede.
     */
    it('⛔ senza pool e senza dieta si mostra solo il regime più stretto, non tutto', async () => {
      const { s, prisma } = servizio();
      (prisma.clientMenuPool.findFirst as jest.Mock).mockResolvedValue(null);
      const esito = await s.ricette('u1', 'c1', 'dinner', undefined, true) as { righe: { recipeId: string }[]; regimiAmmessi?: string[] };
      expect(esito.regimiAmmessi).toEqual(['vegan']);
      expect(esito.righe.map((r) => r.recipeId)).not.toContain('carne');
    });

    /** ⛔ Il pool vuoto non ferma più la ricerca, se si sta guardando il catalogo intero. */
    it('⛔ col pool vuoto il catalogo si può guardare lo stesso', async () => {
      const { s, prisma } = servizio();
      (prisma.clientMenuPool.findFirst as jest.Mock).mockResolvedValue({ recipeIds: [], dietId: 'diet-1' });
      const esito = await s.ricette('u1', 'c1', 'breakfast', undefined, true);
      expect(esito.poolVuoto).toBe(true);
      expect(esito.righe.length).toBeGreaterThan(0);
    });
  });
});

/**
 * ⛔ **LA CUCITURA FRA LA RICERCA E IL SALVATAGGIO — il difetto che annullava tutto il lavoro.**
 *
 * Trovato da una revisione avversariale il 4/9, prima della consegna, e non da una prova: **nessuna
 * prova copriva la coppia.** Le prove sulla ricerca dicevano che «Pancake di avena» si trova, quelle
 * sul salvataggio non lo provavano mai — e in mezzo `scrivi()` rifiutava con 400 tutto ciò che non
 * stava nel pool. Cioè: si alzava la casella, si componeva la giornata intera, e il salvataggio
 * diceva di no proprio sul piatto per cui la casella esiste.
 *
 * ⚠️ *Le prove sui due pezzi non provano la cucitura* — è la stessa lezione del 3/9 scritta in cima
 * a questo file, ripetuta sul punto esatto in cui la funzione nasce o muore.
 */
describe('⛔ quello che la ricerca mostra, il salvataggio lo accetta', () => {
  const giornataConFuori = [
    { slot: 'breakfast', recipeId: 'fuori' },
    { slot: 'lunch', recipeId: 'p1' },
    { slot: 'dinner', recipeId: 'd1' },
  ];

  it('⛔ un piatto fuori dal paniere si SALVA: era il senso della richiesta del 4/9', async () => {
    const { s, upsert } = servizio();
    await s.scrivi('c1', LUCIA, { data: '2026-09-10', pasti: giornataConFuori, conferma: true });
    const meals = (upsert.mock.calls[0][0].create.meals ?? []) as { recipeId: string; name: string }[];
    expect(meals.find((m) => m.recipeId === 'fuori')?.name).toBe('Pancake di avena');
  });

  /**
   * ⛔ **Ma il regime resta un cancello, e si rilegge dal database.** Il pool non è più il confine;
   * questo sì. E si rilegge in `valutate`, non si eredita da quello che la ricerca aveva mostrato:
   * il client può proporre, non certificare.
   */
  it('⛔ un piatto di un regime che lei non mangia NON si salva, nemmeno chiedendolo per id', async () => {
    const { s } = servizio();
    await expect(s.scrivi('c1', LUCIA, {
      data: '2026-09-10',
      pasti: [{ slot: 'breakfast', recipeId: 'c1' }, { slot: 'lunch', recipeId: 'p1' }, { slot: 'dinner', recipeId: 'carne' }],
      conferma: true,
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  /**
   * ⚠️ **E dentro al pool il regime non si chiede**, ed è voluto: quelle ricette sono già state
   * scelte per lei. Chiederlo di nuovo vorrebbe dire che una ricetta col regime scritto male in
   * catalogo smette di essere salvabile per tutte le clienti che ce l'hanno nel paniere — una
   * consegna che rompe quello che funzionava per riparare quello che non esisteva ancora.
   */
  it('⚠️ una ricetta del suo paniere si salva anche senza regime scritto', async () => {
    const { s, upsert } = servizio();
    await s.scrivi('c1', LUCIA, { data: '2026-09-10', pasti: GIORNATA, conferma: true });
    const meals = (upsert.mock.calls[0][0].create.meals ?? []) as { recipeId: string }[];
    expect(meals.map((m) => m.recipeId)).toEqual(['c1', 'p1', 'd1']);
  });
});

describe('scrivere la giornata', () => {
  it('⛔ una giornata completa si scrive, col marchio di chi l\'ha scritta', async () => {
    const { s, upsert } = servizio();
    const esito = await s.scrivi('c1', LUCIA, { data: '2026-09-10', pasti: GIORNATA });
    expect(esito.scritta).toBe(true);
    const meals = upsert.mock.calls[0][0].create.meals as { scrittaAMano?: { origine?: string; da?: string } }[];
    expect(meals).toHaveLength(3);
    expect(meals[0].scrittaAMano).toMatchObject({ origine: 'nutrizionista', da: 'lucia@metabole.it' });
  });

  /**
   * ⛔ **Il giudizio gira ANCHE qui.** Una schermata che valida e un server che si fida sono un
   * cancello solo, dalla parte sbagliata: chi chiama l'API a mano — o un backoffice vecchio —
   * passerebbe da lì.
   */
  it('⛔ una giornata a cui manca un pasto non si scrive', async () => {
    const { s, upsert } = servizio();
    await expect(s.scrivi('c1', LUCIA, { data: '2026-09-10', pasti: GIORNATA.slice(0, 2) }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(upsert).not.toHaveBeenCalled();
  });

  /**
   * ⛔ **Quello che la cliente ha già aperto resta suo** — magari ci ha già fatto la spesa. Stessa
   * regola di `scriviGiornataDettata`, stesso motivo.
   */
  it('⛔ un giorno già aperto dalla cliente non si riscrive', async () => {
    const { s, upsert } = servizio({ giorno: { id: 'g1', meals: [], apertoDallaClienteIl: new Date(), apertureTracciate: true } });
    await expect(s.scrivi('c1', LUCIA, { data: '2026-09-10', pasti: GIORNATA }))
      .rejects.toThrow(/già aperto/);
    expect(upsert).not.toHaveBeenCalled();
  });

  /**
   * ⚠️ **«Non si sa se l'ha aperto» AVVISA, non ferma** — differenza voluta rispetto a Vera, che lì
   * si arrende. Vera agisce da sola; qui c'è una persona che ha deciso di scrivere quel giorno, e
   * la stessa condizione la porta **la giornata che ha appena scritto lei** (per una cliente che non
   * ha mai aperto l'app `apertureDal` è nullo, cioè il caso del 31/8). Fermarla vorrebbe dire che
   * chi sbaglia un piatto non può più correggerlo: la via d'uscita che non esce.
   */
  it('⚠️ «non si sa se l\'ha aperto» chiede conferma e poi passa, non blocca', async () => {
    const g = { id: 'g1', meals: [], apertoDallaClienteIl: null, apertureTracciate: false };
    await expect(servizio({ giorno: g }).s.scrivi('c1', LUCIA, { data: '2026-09-10', pasti: GIORNATA }))
      .rejects.toThrow(/Da confermare.*Non si sa/);
    const { s, upsert } = servizio({ giorno: g });
    await s.scrivi('c1', LUCIA, { data: '2026-09-10', pasti: GIORNATA, conferma: true });
    expect(upsert).toHaveBeenCalled();
  });

  /**
   * ⚠️ **Gli avvisi non fermano, ma vanno confermati.** Un `POST` che li ignora in silenzio
   * renderebbe la schermata l'unico posto dove esistono.
   */
  it('⚠️ fuori banda serve la conferma, e con la conferma passa', async () => {
    const { s } = servizio({ target: 1000 }); // 1700 su 1000 = +70%
    await expect(s.scrivi('c1', LUCIA, { data: '2026-09-10', pasti: GIORNATA })).rejects.toThrow(/Da confermare/);
    const esito = await s.scrivi('c1', LUCIA, { data: '2026-09-10', pasti: GIORNATA, conferma: true });
    expect(esito.avvisi.join(' ')).toContain('sopra');
  });

  /**
   * ⛔ **Senza una dieta non si scrive, e si dice perché.** Il profilo non porta una dieta — quella
   * la sceglie `pickDietFor` a ogni erogazione — e rifare quella scelta qui sarebbe una seconda
   * copia di una regola che tiene conto di regime, pasti al giorno, digiuno e completezza.
   */
  it('⛔ una cliente senza nessun menu mai erogato: si dice, non si indovina la dieta', async () => {
    const { s, upsert } = servizio({ ultimoMenu: null, pool: { recipeIds: ['c1', 'p1', 'd1'], dietId: '' } });
    await expect(s.scrivi('c1', LUCIA, { data: '2026-09-10', pasti: GIORNATA }))
      .rejects.toBeInstanceOf(NotFoundException);
    /** ⚠️ E il messaggio dice cosa fare, non solo cosa manca. */
    await expect(s.scrivi('c1', LUCIA, { data: '2026-09-10', pasti: GIORNATA }))
      .rejects.toThrow(/non ha ancora una dieta/);
    expect(upsert).not.toHaveBeenCalled();
  });

  /** ⚠️ Una data storta si ferma prima di toccare qualunque cosa. */
  it('⚠️ una data non valida non arriva alla banca dati', async () => {
    const { s, upsert } = servizio();
    await expect(s.scrivi('c1', LUCIA, { data: '10/09/2026', pasti: GIORNATA })).rejects.toThrow(/Data non valida/);
    expect(upsert).not.toHaveBeenCalled();
  });

  /**
   * ⛔ **Il registro tiene il motivo della forzatura.** Fra sei mesi «chi ha messo questo piatto, e
   * perché» deve avere una risposta.
   */
  it('⛔ una forzatura finisce nel registro col suo motivo', async () => {
    const { s, audit } = servizio({ profilo: { allergies: ['crostacei'] } });
    await s.scrivi('c1', LUCIA, {
      data: '2026-09-10',
      conferma: true,
      pasti: GIORNATA.map((p) => (p.recipeId === 'p1'
        ? { ...p, bloccata: true, motivoBlocco: 'crostacei', forzatoPerche: 'concordato con la cliente' } : p)),
    });
    const riga = (audit.log as jest.Mock).mock.calls[0][0];
    expect(riga.action).toBe('menu.scritto_a_mano');
    expect(JSON.stringify(riga.metadata)).toContain('concordato con la cliente');
  });
});

describe('⛔ il server rigiudica: il client propone, non certifica', () => {
  /**
   * ⛔ **LA PROVA CHE CONTA.** La prima stesura leggeva `bloccata` **dal corpo del POST**: bastava
   * mandare `{"bloccata": false}` perché un piatto con l'allergene finisse nel menu senza avvisi,
   * senza conferma e **senza traccia nel registro** — che filtra le forzature proprio su quel campo.
   * Adesso il DTO quel campo non lo accetta nemmeno, e il verdetto lo rifà il server.
   */
  it('⛔ un piatto vietato resta vietato anche se il client non lo dice', async () => {
    const { s, upsert } = servizio({ profilo: { allergies: ['crostacei'] } });
    // Il client manda solo slot e recipeId: nessun modo di dichiarare «non è bloccata».
    await expect(s.scrivi('c1', LUCIA, { data: '2026-09-10', pasti: GIORNATA }))
      .rejects.toThrow(/scrivi perché/);
    expect(upsert).not.toHaveBeenCalled();
  });

  /** ⛔ E col motivo passa, ma la forzatura finisce nel registro col verdetto del SERVER. */
  it('⛔ col motivo passa, e il registro conta la forzatura vera', async () => {
    const { s, audit } = servizio({ profilo: { allergies: ['crostacei'] } });
    await s.scrivi('c1', LUCIA, {
      data: '2026-09-10', conferma: true,
      pasti: GIORNATA.map((p) => (p.recipeId === 'p1' ? { ...p, forzatoPerche: 'concordato con la cliente' } : p)),
    });
    const meta = (audit.log as jest.Mock).mock.calls[0][0].metadata;
    expect(meta.forzature).toHaveLength(1);
    expect(meta.forzature[0].perche).toBe('concordato con la cliente');
  });

  /** ⛔ Nome e kcal sono quelli del catalogo: `kcal` è il numero che l'app somma da sola. */
  it('⛔ nome e kcal li mette il server, non il client', async () => {
    const { s, upsert } = servizio();
    await s.scrivi('c1', LUCIA, {
      data: '2026-09-10',
      pasti: GIORNATA.map((p) => ({ ...p, name: 'INVENTATO', kcal: 1 })) as never,
    });
    const meals = upsert.mock.calls[0][0].create.meals as { name: string; kcal: number }[];
    expect(meals.map((m) => m.name)).toEqual(['Porridge', 'Insalata di gamberi', 'Pollo e verdure']);
    expect(meals.map((m) => m.kcal)).toEqual([400, 700, 600]);
  });

  it('⛔ una ricetta che non esiste o non è attiva non si scrive', async () => {
    const { s, upsert } = servizio();
    await expect(s.scrivi('c1', LUCIA, {
      data: '2026-09-10', pasti: [...GIORNATA.slice(0, 2), { slot: 'dinner', recipeId: 'inventata' }],
    })).rejects.toThrow(/non esiste o non è più attiva/);
    expect(upsert).not.toHaveBeenCalled();
  });

  /** ⛔ E dev'essere del pasto giusto: una cena a colazione la manda una schermata che ha sbagliato. */
  it('⛔ una ricetta messa nel pasto sbagliato non si scrive', async () => {
    const { s } = servizio();
    await expect(s.scrivi('c1', LUCIA, {
      data: '2026-09-10',
      pasti: [{ slot: 'breakfast', recipeId: 'd1' }, { slot: 'lunch', recipeId: 'p1' }, { slot: 'dinner', recipeId: 'c1' }],
    })).rejects.toThrow(/è un piatto da/);
  });

  /**
   * ⛔ **LE SOSTITUZIONI ARRIVANO FINO ALLA GIORNATA** — è la voce 953, che questa porta nuova
   * aveva riaperto. `valutaRicetta` alza una violation **solo se non c'è un sostituto**: un piatto
   * col latte per un'intollerante al lattosio esce **non barrato**, con dentro «latte → delattosato».
   * Perderla vuol dire scriverle la giornata senza la riga che le dice cosa non mettere.
   */
  it('⛔ le sostituzioni di ingrediente finiscono nel pasto scritto', async () => {
    const { s, upsert } = servizio({ profilo: { intolerances: ['lattosio'] } });
    const conLatte = { id: 'c1', name: 'Porridge al latte', kcal: 400, mealSlot: 'breakfast', ingredients: [{ name: 'latte' }], allergens: [] };
    RICETTE[0] = conLatte;
    try {
      await s.scrivi('c1', LUCIA, { data: '2026-09-10', pasti: GIORNATA });
      const meals = upsert.mock.calls[0][0].create.meals as { substitutions?: unknown[] }[];
      expect(meals[0].substitutions?.length).toBeGreaterThan(0);
    } finally {
      RICETTE[0] = { id: 'c1', name: 'Porridge', kcal: 400, mealSlot: 'breakfast', ingredients: [{ name: 'avena' }], allergens: [] };
    }
  });
});

describe('⛔ il nome del piatto entra fra gli ingredienti', () => {
  /**
   * ⛔ Su una ricetta con l'elenco vuoto o povero `valutaRicetta` non vedrebbe niente, e «Insalata
   * di gamberi e avocado» comparirebbe **pulita** nella schermata di un'allergica ai crostacei. È
   * il caso che il motore e Vera chiudono così, e che qui era **non osservabile** perché il
   * fixture aveva anche il tag.
   */
  it('⛔ una ricetta che tradisce l\'allergene SOLO nel nome esce barrata', async () => {
    const { s } = servizio({ profilo: { allergies: ['crostacei'] } });
    const { righe } = await s.ricette('u1', 'c1');
    const x = righe.find((r) => r.recipeId === 'x1');
    expect(x?.bloccata).toBe(true);
    expect(x?.motivoBlocco).toBe('Insalata di gamberi e avocado: incompatibile con "allergia: crostacei"');
  });

  /** ⚠️ E in scrittura vale uguale: il verdetto è lo stesso, perché la funzione è la stessa. */
  it('⚠️ e in scrittura si ferma allo stesso modo', async () => {
    const { s } = servizio({ profilo: { allergies: ['crostacei'] } });
    await expect(s.scrivi('c1', LUCIA, {
      data: '2026-09-10',
      pasti: [{ slot: 'breakfast', recipeId: 'c1' }, { slot: 'lunch', recipeId: 'x1' }, { slot: 'dinner', recipeId: 'd1' }],
    })).rejects.toThrow(/scrivi perché/);
  });
});

describe('⛔ le ricette spente non esistono', () => {
  it('⛔ non compaiono nella ricerca', async () => {
    const { righe } = await servizio().s.ricette('u1', 'c1');
    expect(righe.map((r) => r.recipeId)).not.toContain('spenta');
  });

  it('⛔ e non si possono scrivere nemmeno chiedendole per id', async () => {
    const { s, upsert } = servizio();
    await expect(s.scrivi('c1', LUCIA, {
      data: '2026-09-10',
      pasti: [{ slot: 'breakfast', recipeId: 'c1' }, { slot: 'lunch', recipeId: 'spenta' }, { slot: 'dinner', recipeId: 'd1' }],
    })).rejects.toThrow(/non esiste o non è più attiva/);
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe('⛔ il perimetro: si scrive solo alle clienti proprie', () => {
  /**
   * ⛔ Il pulsante gemello sulla stessa card passa da `assertClientAccess`; questa rotta non lo
   * faceva, e con `menu_a_mano: manage` — il **default** della nutrizionista — si scriveva il menu
   * di qualunque cliente, leggendone le esclusioni dai motivi.
   */
  it('⛔ una cliente non assegnata non si tocca', async () => {
    const { s, upsert } = servizio({ ruoloAttore: 'nutritionist', staffId: 'staff-altra' });
    await expect(s.scrivi('c1', LUCIA, { data: '2026-09-10', pasti: GIORNATA })).rejects.toThrow(/non è assegnata a te/);
    await expect(s.ricette('u1', 'c1')).rejects.toThrow(/non è assegnata a te/);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('⚠️ e la sua invece sì', async () => {
    const { s, upsert } = servizio({ ruoloAttore: 'nutritionist', staffId: 'staff-n' });
    await s.scrivi('c1', LUCIA, { data: '2026-09-10', pasti: GIORNATA });
    expect(upsert).toHaveBeenCalled();
  });
});

describe('la cornice della giornata', () => {
  it('⛔ gli slot li detta la DIETA, non il paniere', async () => {
    const { s } = servizio();
    const c = await s.giornata('u1', 'c1', '2026-09-10');
    expect(c.slotAttesi).toEqual(['breakfast', 'lunch', 'dinner']);
    expect(c.targetKcal).toBe(1700);
  });

  /** ⚠️ E dice se quel giorno è già scritto a mano: chi apre deve sapere cosa sta per sovrascrivere. */
  it('⚠️ dice se il giorno c\'è già ed è scritto a mano', async () => {
    const { s } = servizio({
      giorno: { id: 'g1', apertureTracciate: true, apertoDallaClienteIl: null, meals: [{ slot: 'lunch', scrittaAMano: { origine: 'nutrizionista' } }] },
    });
    const c = await s.giornata('u1', 'c1', '2026-09-10');
    expect(c.esistente?.scrittaAMano).toBe(true);
  });
});
