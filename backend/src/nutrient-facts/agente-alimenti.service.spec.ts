import { AgenteAlimentiService } from './agente-alimenti.service';
import { AZIONE_RIGA, AZIONE_TAG, SCRITTO_DA } from './agente-alimenti';

/**
 * ⛔ **IL SERVIZIO, CON UN PRISMA E UN'AI FINTI**: spento non chiama e non legge la coda; acceso scrive
 * la riga com'è stata vagliata, chiude il termine e registra; l'errore fatale ferma al primo colpo;
 * lo scarto lascia il termine aperto ma non lo richiede; i tag dalla tabella arrivano alle ricette.
 */

const rispostaBuona = {
  e_un_alimento: true, nome: 'taleggio', categoria: 'formaggi', stato: 'crudo',
  kcal: 315, proteine: 19, carboidrati: 0.9, zuccheri: 0.9, grassi: 26, fibre: 0, alcol: 0,
  allergeni: ['latte'], fonte: { nome: 'CREA', url: 'https://www.crea.gov.it/taleggio' }, affidabilita: 'solida',
};

function monta(opzioni: {
  acceso?: boolean; max?: number;
  coda?: { id: string; term: string; ricette: number }[];
  righe?: Record<string, unknown>[];
  ricette?: Record<string, unknown>[];
  audit?: { entityId: string; createdAt?: Date; metadata?: Record<string, unknown> }[];
  risposte?: (unknown | null)[];
  fatale?: boolean;
} = {}) {
  const risposte = [...(opzioni.risposte ?? [rispostaBuona])];
  const ai = {
    lastError: null as string | null, lastErrorFatale: false, lastRicerche: 0,
    generateJsonConRicerca: jest.fn(async (_system: string, _prompt: string) => {
      const r = risposte.length ? risposte.shift() : null;
      ai.lastRicerche = 2;
      if (r === null) { ai.lastError = opzioni.fatale ? 'il credito dell\'AI è esaurito' : 'timeout'; ai.lastErrorFatale = !!opzioni.fatale; }
      return r ?? null;
    }),
  };
  const prisma = {
    nutrientLookupMiss: {
      findMany: jest.fn().mockResolvedValue(opzioni.coda ?? []),
      update: jest.fn().mockResolvedValue({}),
    },
    nutrientFact: {
      findMany: jest.fn(async (args: { where?: unknown }) => (args?.where ? (opzioni.righe ?? []).filter((r) => (r.allergens as string[])?.length) : (opzioni.righe ?? []))),
      create: jest.fn().mockResolvedValue({ id: 'nf-1' }),
    },
    recipe: {
      findMany: jest.fn().mockResolvedValue(opzioni.ricette ?? []),
      update: jest.fn().mockResolvedValue({}),
    },
    auditLog: { findMany: jest.fn().mockResolvedValue((opzioni.audit ?? []).map((a) => ({ createdAt: new Date(), metadata: { esito: 'scartata' }, ...a }))) },
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined), logMany: jest.fn().mockResolvedValue(undefined) };
  const config = {
    getBool: jest.fn().mockResolvedValue(opzioni.acceso ?? false),
    getNumber: jest.fn().mockResolvedValue(opzioni.max ?? 20),
  };
  return { ai, prisma, audit, service: new AgenteAlimentiService(prisma as never, ai as never, config as never, audit as never) };
}

const coda = [
  { id: 'm1', term: 'taleggio', ricette: 22 },
  { id: 'm2', term: 'sale e pepe', ricette: 3577 },
];

describe('compila', () => {
  it('⚠️ spento: non legge la coda e non chiama l\'AI; i tag dalla tabella girano lo stesso (zero righe → niente)', async () => {
    const { ai, prisma, service } = monta({ acceso: false, coda });
    const out = await service.passoNotturno();
    expect(out.compilazione.acceso).toBe(false);
    expect(prisma.nutrientLookupMiss.findMany).not.toHaveBeenCalled();
    expect(ai.generateJsonConRicerca).not.toHaveBeenCalled();
    expect(prisma.nutrientFact.findMany).toHaveBeenCalledTimes(1);
    expect(out.tag).toEqual({ righeConAllergeni: 0, ricette: 0, tag: 0, perAllergene: [] });
  });

  it('⛔ acceso: salta gli aromi, scrive la riga vagliata (allergeni, fonte, filledBy, da confermare), chiude il termine, registra', async () => {
    const { ai, prisma, audit, service } = monta({ acceso: true, coda, ricette: [{ name: 'Frittata al taleggio', ingredients: [{ name: 'Taleggio' }] }] });
    const out = await service.compila();
    expect(out).toMatchObject({ acceso: true, guardati: 1, scritte: 1, nonAlimenti: 0, ricerche: 2 });
    expect(ai.generateJsonConRicerca).toHaveBeenCalledTimes(1);
    expect(String(ai.generateJsonConRicerca.mock.calls[0][1])).toContain('«Frittata al taleggio»');
    expect(prisma.nutrientFact.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        name: 'taleggio', synonyms: [], allergens: ['latte'], kcal: 315, state: 'crudo',
        source: 'CREA', sourceRef: 'https://www.crea.gov.it/taleggio', note: null, filledBy: SCRITTO_DA, verifiedAt: null,
      }),
    }));
    expect(prisma.nutrientLookupMiss.update).toHaveBeenCalledWith({ where: { id: 'm1' }, data: { status: 'filled' } });
    expect(prisma.nutrientLookupMiss.update).not.toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'm2' } }));
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: AZIONE_RIGA, entityId: 'nf-1', metadata: expect.objectContaining({ esito: 'scritta', allergens: ['latte'] }) }));
  });

  it('⛔ errore fatale dell\'AI: si ferma al primo colpo e lo dice', async () => {
    const { ai, prisma, service } = monta({ acceso: true, coda: [{ id: 'a', term: 'x', ricette: 1 }, { id: 'b', term: 'y', ricette: 1 }], risposte: [null, null], fatale: true });
    const out = await service.compila();
    expect(out.fermatoPer).toMatch(/credito/);
    expect(ai.generateJsonConRicerca).toHaveBeenCalledTimes(1);
    expect(prisma.nutrientFact.create).not.toHaveBeenCalled();
  });

  it('⚠️ risposta scartata dal vaglio: niente riga, il termine resta aperto, ma lo scarto va nel registro (e non si richiede)', async () => {
    const { prisma, audit, service } = monta({ acceso: true, coda: [coda[0]], risposte: [{ ...rispostaBuona, fonte: null }] });
    const out = await service.compila();
    expect(out.scartate).toEqual({ senza_fonte: 1 });
    expect(prisma.nutrientFact.create).not.toHaveBeenCalled();
    expect(prisma.nutrientLookupMiss.update).not.toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: AZIONE_RIGA, entityId: 'm1', metadata: expect.objectContaining({ esito: 'scartata', motivo: 'senza_fonte' }) }));
  });

  it('⛔ un termine scartato di recente (nel registro) si toglie NELLA QUERY: il tetto non si spende a rifare ieri', async () => {
    const { ai, prisma, service } = monta({ acceso: true, coda: [], audit: [{ entityId: 'm1' }] });
    await service.compila();
    expect(prisma.nutrientLookupMiss.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: { notIn: ['m1'] } }) }));
    expect(ai.generateJsonConRicerca).not.toHaveBeenCalled();
  });

  it('⚠️ uno scarto di 40 giorni fa si richiede; un «non alimento» di 40 giorni fa no (un anno)', async () => {
    const vecchio = new Date(Date.now() - 40 * 86_400_000);
    const { prisma, service } = monta({ acceso: true, coda: [], audit: [
      { entityId: 'm1', createdAt: vecchio, metadata: { esito: 'scartata' } },
      { entityId: 'm2', createdAt: vecchio, metadata: { esito: 'non_alimento' } },
    ] });
    await service.compila();
    expect(prisma.nutrientLookupMiss.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: { notIn: ['m2'] } }) }));
  });

  it('⚠️ «non è un alimento»: niente riga, il termine resta nella lista di una persona (non «ignored»), il registro lo ricorda', async () => {
    const { prisma, audit, service } = monta({ acceso: true, coda: [{ id: 'q', term: 'q.b.', ricette: 9 }], risposte: [{ e_un_alimento: false }] });
    const out = await service.compila();
    expect(out.nonAlimenti).toBe(1);
    expect(prisma.nutrientLookupMiss.update).not.toHaveBeenCalled();
    expect(prisma.nutrientFact.create).not.toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ entityId: 'q', metadata: expect.objectContaining({ esito: 'non_alimento' }) }));
  });

  it('⚠️ una riga «da cotto» entra ma NON chiude il termine: domani torna come «solo da cotto» nella lista della nutrizionista', async () => {
    const { prisma, service } = monta({ acceso: true, coda: [{ id: 'c', term: 'ceci lessati', ricette: 9 }], risposte: [{ ...rispostaBuona, stato: 'bollito' }] });
    const out = await service.compila();
    expect(out.scritte).toBe(1);
    expect(prisma.nutrientLookupMiss.update).not.toHaveBeenCalled();
  });

  it('⚠️ già in tabella come sinonimo nel frattempo: si chiude senza chiamare', async () => {
    const { ai, prisma, service } = monta({ acceso: true, coda: [coda[0]], righe: [{ name: 'taleggio dop', synonyms: ['taleggio'], kcal: 300, allergens: [] }] });
    await service.compila();
    expect(ai.generateJsonConRicerca).not.toHaveBeenCalled();
    expect(prisma.nutrientLookupMiss.update).toHaveBeenCalledWith({ where: { id: 'm1' }, data: { status: 'filled' } });
  });

  it('⛔ la GEMELLA di stanotte: due risposte con gli stessi numeri di un alimento che non c\'entra → la seconda non entra', async () => {
    const righe = [{ name: 'peperone rosso', synonyms: [], kcal: 315, protein: 19, carbs: 0.9, sugars: 0.9, fat: 26, fiber: 0, allergens: [] }];
    const { prisma, service } = monta({
      acceso: true, righe,
      coda: [{ id: '1', term: 'taleggio', ricette: 5 }, { id: '2', term: 'olio di sesamo', ricette: 4 }],
      risposte: [rispostaBuona, { ...rispostaBuona, nome: 'olio di sesamo', allergeni: ['sesamo'] }],
    });
    const out = await service.compila();
    expect(out.scritte).toBe(1);
    expect(out.scartate).toEqual({ gemella: 1 });
    expect(prisma.nutrientFact.create).toHaveBeenCalledTimes(1);
  });
});

describe('propagaTag', () => {
  const righe = [{ name: 'pesto pronto', synonyms: [], allergens: ['latte', 'frutta_a_guscio'] }, { name: 'riso', synonyms: [], allergens: [] }];

  it('⛔ aggiunge alle ricette i tag della riga, unendoli a quelli che ci sono, e registra il conto', async () => {
    const { prisma, audit, service } = monta({
      righe,
      ricette: [
        { id: 'r1', name: 'Pasta al pesto', ingredients: [{ name: 'Pesto pronto' }], allergens: ['glutine'] },
        { id: 'r2', name: 'Riso', ingredients: [{ name: 'riso' }], allergens: [] },
      ],
    });
    const out = await service.propagaTag();
    expect(out).toMatchObject({ righeConAllergeni: 1, ricette: 1, tag: 2 });
    expect(prisma.recipe.update).toHaveBeenCalledTimes(1);
    expect(prisma.recipe.update).toHaveBeenCalledWith({ where: { id: 'r1' }, data: { allergens: ['glutine', 'latte', 'frutta_a_guscio'] } });
    // ⚠️ Una riga di registro per ricetta, con ingrediente e riga della tabella: per poter disfare.
    expect(audit.logMany).toHaveBeenCalledWith([expect.objectContaining({
      action: AZIONE_TAG, entityId: 'r1',
      metadata: { aggiunti: [{ allergen: 'latte', ingrediente: 'Pesto pronto', alimento: 'pesto pronto' }, { allergen: 'frutta_a_guscio', ingrediente: 'Pesto pronto', alimento: 'pesto pronto' }] },
    })]);
  });

  it('⛔ la ricetta con i tag scelti a mano non si tocca', async () => {
    const { prisma, service } = monta({
      righe, audit: [{ entityId: 'r1' }],
      ricette: [{ id: 'r1', name: 'Pasta al pesto', ingredients: [{ name: 'pesto pronto' }], allergens: [] }],
    });
    const out = await service.propagaTag();
    expect(out.tag).toBe(0);
    expect(prisma.recipe.update).not.toHaveBeenCalled();
  });
});
