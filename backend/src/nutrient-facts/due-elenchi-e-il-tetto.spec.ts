import { NutrientFactsController } from './nutrient-facts.controller';
import { passoFinto } from './passo-notturno.finto';

/**
 * I DUE ELENCHI, IL TETTO CHE SI DICHIARA, E IL FOGLIO CHE NON HA TETTO.
 *
 * ⚠️ Nessuna di queste tre cose aveva un test, e tutte e tre sono già state rotte una volta:
 *
 *  - **due elenchi** (19/8): per mezza giornata erano uno solo, ordinato prima per «quante ricette»
 *    e poi per «quante volte l'hanno chiesto». Il passo notturno scrive trecento righe con
 *    `ricette ≥ 1`, quindi **nessun termine chiesto da una cliente arrivava più in pagina**. La
 *    frase con cui questa tabella è nata — «tempeh chiesto 40 volte è la prossima riga da
 *    scrivere» — aveva smesso di essere vera, e nessun errore lo diceva;
 *  - **il tetto si dichiara**: prima c'era `take: 200` e basta, e chi guardava non poteva sapere se
 *    erano tutti. `quanti` conta il totale VERO, non le righe restituite;
 *  - **il foglio non ha tetto** (20/8): la pagina ne mostra 100, il foglio Excel è dove il lavoro
 *    si fa davvero. Un foglio che ne contiene 100 su 300 senza dirlo manda chi lo finisce a credere
 *    di aver finito.
 *
 * ⚠️ Il finto Prisma qui sotto **applica il `take`** e distingue le due `where`. Un doppione che
 * ignora il `take` restituisce sempre tutto: il test passerebbe identico con e senza il tetto, che
 * è precisamente la cosa da verificare.
 */
describe('gli elenchi degli alimenti da correggere', () => {
  /** 250 righe da ricette e 40 chieste in chat: le proporzioni vere di produzione. */
  const daRicette = Array.from({ length: 250 }, (_, i) => ({
    id: `r${i}`, term: `alimento ${i}`, ricette: 250 - i, times: 0, motivo: 'non_in_tabella', suggerito: null,
  }));
  const chieste = Array.from({ length: 40 }, (_, i) => ({
    id: `c${i}`, term: `chiesto ${i}`, ricette: 0, times: 40 - i, motivo: 'non_in_tabella', suggerito: null,
  }));

  const crea = (over: Record<string, unknown> = {}) => {
    const prisma: any = {
      nutrientLookupMiss: {
        findMany: jest.fn(async ({ where, take }: any) => {
          // ⚠️ La stessa distinzione che fa Postgres: `ricette > 0` contro `ricette <= 0 && times > 0`.
          const tutte = where.ricette?.gt !== undefined ? daRicette : chieste.filter((c) => c.times > 0);
          return take === undefined ? tutte : tutte.slice(0, take);
        }),
        count: jest.fn(async ({ where }: any) => (where.ricette?.gt !== undefined ? daRicette.length : chieste.length)),
      },
      nutrientFact: { findMany: jest.fn().mockResolvedValue([]) },
      /**
       * ⚠️ **Il finto c'è, e risponde come l'originale** (25/8). Dal 25/8 la pagina dice anche **di
       * quando** è l'elenco, e lo legge dalla riga di registro che il passo notturno scrive. Un
       * finto che manca fa esplodere il controller; uno che risponde `null` è il caso vero di un
       * passo mai girato, che la pagina deve saper raccontare.
       */
      auditLog: { findFirst: jest.fn().mockResolvedValue({ createdAt: new Date('2026-08-25T03:12:00.000Z') }) },
      ...over,
    };
    return { prisma, controller: new NutrientFactsController(prisma, { log: jest.fn() } as never, passoFinto() as never) };
  };

  it('la pagina ne mostra 100 per elenco, e dice quanti sono davvero', async () => {
    const { controller } = crea();
    const r = (await controller.mancanti()) as any;

    expect(r.daRicette.righe).toHaveLength(100);
    expect(r.daRicette.quanti).toBe(250); // ⚠️ il totale vero, non le righe tornate
    expect(r.chieste.righe).toHaveLength(40);
    expect(r.chieste.quanti).toBe(40);
  });

  it('⚠️ i termini chiesti in chat NON finiscono sotto quelli delle ricette: sono due elenchi', async () => {
    const { controller } = crea();
    const r = (await controller.mancanti()) as any;
    // Con un elenco solo e un tetto solo, «chiesto 0» (il più chiesto) non comparirebbe mai:
    // le prime cento righe sarebbero tutte ingredienti di ricette.
    expect(r.chieste.righe[0].term).toBe('chiesto 0');
    expect(r.daRicette.righe.map((x: any) => x.term)).not.toContain('chiesto 0');
  });

  it('il foglio Excel li porta TUTTI, senza tetto', async () => {
    const { controller, prisma } = crea();
    const r = (await controller.mancantiDaEsportare()) as any;

    expect(r.righe).toHaveLength(290); // 250 + 40, non 100 + 40
    expect(r.quanti).toEqual({ daRicette: 250, chieste: 40 });
    // Nessuna delle due query ha chiesto un tetto: se un giorno ne comparisse uno, si vede qui.
    for (const call of prisma.nutrientLookupMiss.findMany.mock.calls) {
      expect(call[0].take).toBeUndefined();
    }
  });

  it('ogni riga del foglio dice da quale elenco viene, e non si mescolano', async () => {
    const { controller } = crea();
    const r = (await controller.mancantiDaEsportare()) as any;

    expect(r.righe[0].elenco).toBe('Usati dalle ricette');
    expect(r.righe[249].elenco).toBe('Usati dalle ricette');
    expect(r.righe[250].elenco).toBe('Chiesti dalle clienti');
    // A blocchi: mai un elenco dentro l'altro. Ordinarli insieme è sommare due unità diverse.
    const cambi = r.righe.filter((x: any, i: number) => i > 0 && x.elenco !== r.righe[i - 1].elenco);
    expect(cambi).toHaveLength(1);
  });

  it('⚠️ le righe che in tabella ci sono GIÀ arrivano con i loro valori: lì manca una parola, non tutta la riga', async () => {
    const conSuggerito = {
      nutrientLookupMiss: {
        findMany: jest.fn(async ({ where }: any) =>
          where.ricette?.gt !== undefined
            ? [{ id: 'm1', term: 'spinaci freschi', ricette: 1350, times: 0, motivo: 'senza_stato', suggerito: 'spinaci' }]
            : [],
        ),
        count: jest.fn(async () => 1),
      },
      nutrientFact: {
        findMany: jest.fn().mockResolvedValue([{ name: 'spinaci', state: null, kcal: 31, protein: 3.4, category: 'verdura' }]),
      },
    };
    const { controller, prisma } = crea(conSuggerito);
    const r = (await controller.mancantiDaEsportare()) as any;

    expect(r.righe[0].attuale).toEqual(expect.objectContaining({ name: 'spinaci', kcal: 31, state: null }));
    // Una query sola per tutti i nomi, non una per riga.
    expect(prisma.nutrientFact.findMany).toHaveBeenCalledTimes(1);
  });

  /**
   * DI QUANDO È L'ELENCO — voce `alimenti-da-correggere-senza-data`, 25/8.
   *
   * ⚠️ **La domanda è «quando è girato il passo», non «quando è stata toccata una riga».** Sono due
   * domande diverse: `updatedAt` sulle righe cambia anche quando una cliente chiede quel termine a
   * Gaia, e la pagina direbbe «aggiornato due minuti fa» per un elenco vecchio di un giorno. Per
   * questo si guarda il **registro**, dove il passo lascia la sua riga.
   */
  it('dice di quando è l\'elenco, leggendo l\'ultimo giro del passo notturno', async () => {
    const { controller, prisma } = crea();
    const r = (await controller.mancanti()) as any;

    expect(r.aggiornatoIl).toBe('2026-08-25T03:12:00.000Z');
    expect(prisma.auditLog.findFirst.mock.calls[0][0]).toMatchObject({
      where: { action: 'nutrient_facts.scoperti_aggiornati' },
      orderBy: { createdAt: 'desc' },
    });
  });

  /**
   * ⛔ **`null` è «mai girato», e la pagina deve poterlo dire.** Non si inventa «adesso»: era
   * esattamente il modo in cui il 21/8 un elenco di ventiquattr'ore è sembrato vivo.
   */
  it('⛔ se il passo non è mai girato torna null, non una data finta', async () => {
    const { controller } = crea({ auditLog: { findFirst: jest.fn().mockResolvedValue(null) } });
    expect(((await controller.mancanti()) as any).aggiornatoIl).toBeNull();
  });

  /**
   * L'ALTRA METÀ: rifare il conto adesso invece di aspettare la notte.
   *
   * ⚠️ **Chiama lo stesso passo del cron.** Se qui ci fosse una versione più svelta che guarda meno
   * righe, la pagina e la notte scriverebbero due elenchi diversi e nessuno saprebbe quale credere.
   * ⚠️ E torna i conti veri, non `ok: true`: un giro fallito a metà deve vedersi.
   */
  it('il pulsante «rifai il conto» lancia lo stesso passo notturno e ne torna gli esiti', async () => {
    const passo = passoFinto({ scoperti: 12, scritti: 11, falliti: 1 });
    const registro = jest.fn().mockResolvedValue(undefined);
    const controller = new NutrientFactsController(crea().prisma, { log: registro } as never, passo as never);
    const esito = await controller.ricalcolaMancanti({ sub: 'u1' } as never);

    expect(passo.aggiornaIngredientiScoperti).toHaveBeenCalledTimes(1);
    /**
     * ⛔ **Senza argomenti, cioè col tetto di sempre** — aggiunto dopo la revisione avversariale del
     * 25/8, che ha misurato il buco: cambiando la chiamata in `aggiornaIngredientiScoperti(50)` il
     * test restava **verde**, e il difetto che il commento qui sopra dichiara di prevenire — la
     * pagina e la notte che scrivono due elenchi diversi — passava liscio. `toHaveBeenCalledTimes`
     * conta le volte, non quello che si è chiesto.
     */
    expect(passo.aggiornaIngredientiScoperti).toHaveBeenCalledWith();
    expect(esito).toMatchObject({ scoperti: 12, scritti: 11, falliti: 1 });
    /** ⚠️ E chi ha premuto resta scritto: su una tabella d'audit «chi» è metà del fatto. */
    expect(registro).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'nutrient_fact.miss_recalculated', actorId: 'u1' }),
    );
  });

  /**
   * ⛔ **UN GIRO ANDATO MALE NON DEVE SEMBRARE UN ELENCO FRESCO** — dalla revisione avversariale del
   * 25/8. La riga di registro si scrive comunque, anche se **tutte** le scritture sono fallite: è un
   * fatto avvenuto. Ma se la pagina legge solo la data, la mattina dopo dice «Elenco rifatto
   * stanotte alle 03:12» — fresco, nessun avviso — per un elenco fermo da due giorni. I conti del
   * giro viaggiano col resto.
   */
  it('⛔ dice anche com\'è andato l\'ultimo giro, non solo quando è stato', async () => {
    const { controller } = crea({
      auditLog: {
        findFirst: jest.fn().mockResolvedValue({
          createdAt: new Date('2026-08-25T03:12:00.000Z'),
          metadata: { scoperti: 300, scritti: 0, falliti: 300, fuori: 0 },
        }),
      },
    });
    expect(((await controller.mancanti()) as any).ultimoGiro).toEqual({ scoperti: 300, scritti: 0, falliti: 300 });
  });

  /**
   * ⚠️ Un `metadata` scritto da un'altra versione del codice non deve inventare degli zeri: **o ci
   * sono tutti e tre i conti, o non si dice niente**. Un `metadata` a metà — `scoperti` sì,
   * `falliti` no — diventerebbe «zero falliti», cioè «è andato tutto bene», detto su un giro di cui
   * non sappiamo com'è andato.
   */
  it.each([
    ['vuoto', { altro: true }],
    ['solo scoperti', { scoperti: 10 }],
    ['senza falliti', { scoperti: 10, scritti: 10 }],
    ['con un conto non numerico', { scoperti: 10, scritti: 10, falliti: 'tanti' }],
    ['non un oggetto', 'niente'],
    ['nullo', null],
  ])('⚠️ registro %s: non si inventa «0 falliti», non si dice niente', async (_come, metadata) => {
    const { controller } = crea({
      auditLog: { findFirst: jest.fn().mockResolvedValue({ createdAt: new Date(), metadata }) },
    });
    expect(((await controller.mancanti()) as any).ultimoGiro).toBeNull();
  });

  /**
   * ⛔ **SE IL REGISTRO NON SI LEGGE, L'ELENCO ESCE LO STESSO.** La data è un accessorio; l'elenco è
   * il lavoro. Prima questa riga stava nel `Promise.all` senza rete e portava giù tutta la pagina.
   */
  it('⛔ con il registro in errore la pagina mostra comunque gli elenchi', async () => {
    const { controller } = crea({
      auditLog: { findFirst: jest.fn().mockRejectedValue(new Error('audit_log giù')) },
    });
    const r = (await controller.mancanti()) as any;
    expect(r.daRicette.righe.length).toBeGreaterThan(0);
    expect(r.aggiornatoIl).toBeNull();
  });

  it('senza righe raggiunte non chiede niente alla tabella alimenti', async () => {
    const { controller, prisma } = crea();
    await controller.mancantiDaEsportare();
    // Tutti i `suggerito` sono null: una query con `in: []` sarebbe una scansione per niente.
    expect(prisma.nutrientFact.findMany).not.toHaveBeenCalled();
  });
});
