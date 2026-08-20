import { NutrientFactsController } from './nutrient-facts.controller';

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
      ...over,
    };
    return { prisma, controller: new NutrientFactsController(prisma, { log: jest.fn() } as never) };
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

  it('senza righe raggiunte non chiede niente alla tabella alimenti', async () => {
    const { controller, prisma } = crea();
    await controller.mancantiDaEsportare();
    // Tutti i `suggerito` sono null: una query con `in: []` sarebbe una scansione per niente.
    expect(prisma.nutrientFact.findMany).not.toHaveBeenCalled();
  });
});
