import { applicaProposta, ordinaPerRischio, Proposta } from './applica-proposta';
import { PrismaService } from '../prisma/prisma.service';

const D = (iso: string) => new Date(iso + 'T00:00:00.000Z');

const proposta = (over: Partial<Proposta> = {}): Proposta => ({
  id: 'a1',
  nutrizionistaId: 'lucia',
  azione: 'restrizione_cliente',
  ambito: 'catalogo',
  soggettoId: 'c1',
  soggettoNome: 'Giulia Rossi',
  dettaglio: { termini: ['tonno'] },
  ...over,
});

/** `role: 'nutritionist'` + una scheda staff → `perimetroClienti` filtra sulle SUE clienti. */
const makePrisma = (profili: { userId: string; dislikedFoods: string[] }[], over: Record<string, unknown> = {}) => {
  const update = jest.fn().mockResolvedValue({});
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue({ role: 'nutritionist' }) },
    staff: { findUnique: jest.fn().mockResolvedValue({ id: 'staff-lucia' }) },
    clientProfile: { findMany: jest.fn().mockResolvedValue(profili), update },
    ...over,
  } as unknown as PrismaService;
  return { prisma, update };
};

describe('applicaProposta — la restrizione estesa', () => {
  it('scrive su tutte le clienti che ne hanno bisogno, e dice quante sono', async () => {
    const { prisma, update } = makePrisma([
      { userId: 'c1', dislikedFoods: [] },
      { userId: 'c2', dislikedFoods: ['pane'] },
    ]);
    const esito = await applicaProposta(prisma, proposta());
    expect(esito.toccate).toBe(2);
    expect(esito.riepilogo).toContain('Applicata a 2 clienti su 2');
    expect(update.mock.calls[1][0].data.dislikedFoods).toEqual(['pane', 'tonno']);
  });

  it('è idempotente: chi ce l’ha già non viene toccato né contato', async () => {
    // Riapprovare non deve raddoppiare niente, e il conteggio deve restare vero.
    const { prisma, update } = makePrisma([
      { userId: 'c1', dislikedFoods: ['tonno'] },
      { userId: 'c2', dislikedFoods: [] },
    ]);
    const esito = await applicaProposta(prisma, proposta());
    expect(esito.toccate).toBe(1);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('⚠️ il perimetro è quello di CHI HA PROPOSTO, non di chi approva', async () => {
    // «A tutte» detto da una nutrizionista vuol dire «a tutte le MIE». Il capo che approva ne vede
    // molte di più, e usare il suo perimetro allargherebbe la regola a clienti di altre.
    const { prisma } = makePrisma([{ userId: 'c1', dislikedFoods: [] }]);
    await applicaProposta(prisma, proposta({ nutrizionistaId: 'lucia' }));
    expect((prisma.user.findUnique as jest.Mock).mock.calls[0][0].where.id).toBe('lucia');
    expect((prisma.clientProfile.findMany as jest.Mock).mock.calls[0][0].where.assignedNutritionistId).toEqual({
      in: ['staff-lucia'],
    });
  });

  it('sopra il tetto NON scrive: dice quante sarebbero e si ferma', async () => {
    const molte = Array.from({ length: 201 }, (_, i) => ({ userId: `c${i}`, dislikedFoods: [] }));
    const { prisma, update } = makePrisma(molte);
    const esito = await applicaProposta(prisma, proposta());
    expect(update).not.toHaveBeenCalled();
    expect(esito.toccate).toBe(0);
    expect(esito.riepilogo).toContain('oltre il tetto');
  });

  it('senza alimenti non scrive niente', async () => {
    const { prisma, update } = makePrisma([{ userId: 'c1', dislikedFoods: [] }]);
    const esito = await applicaProposta(prisma, proposta({ dettaglio: { termini: [] } }));
    expect(update).not.toHaveBeenCalled();
    expect(esito.riepilogo).toContain('nessun alimento');
  });
});

describe('applicaProposta — la sostituzione estesa', () => {
  it('scrive la riga per la cliente e MANDA a «promuovi a regola», invece di creare un gruppo', async () => {
    // Una seconda strada per creare gruppi di equivalenza prima o poi decide in modo diverso dalla
    // prima: la promozione resta il gesto che esiste già, premuto da una persona.
    const upsert = jest.fn().mockResolvedValue({ id: 'f1', volte: 1 });
    const { prisma } = makePrisma([], { foodSwap: { upsert }, equivalenceGroup: { create: jest.fn() } });
    const esito = await applicaProposta(
      prisma,
      proposta({ azione: 'sostituzione_cliente', dettaglio: { intento: { tipo: 'sostituzione', from: 'pollo', to: 'tacchino' } } }),
    );
    expect(upsert.mock.calls[0][0].create.stato).toBe('verificata');
    expect(esito.riepilogo).toContain('promuovi a regola');
    expect((prisma as unknown as { equivalenceGroup: { create: jest.Mock } }).equivalenceGroup.create).not.toHaveBeenCalled();
  });
});

describe('ordinaPerRischio', () => {
  it('prima i conflitti sanitari, poi il raggio largo, poi il resto — e a parità la più vecchia', () => {
    // Una coda cronologica fa arrivare per ultima la cosa più importante, e chi la guarda di fretta
    // legge le prime tre.
    const righe = [
      { id: 'cliente-nuova', conflittoSanitario: false, ambito: 'cliente', createdAt: D('2026-08-13') },
      { id: 'catalogo', conflittoSanitario: false, ambito: 'catalogo', createdAt: D('2026-08-13') },
      { id: 'sanitario', conflittoSanitario: true, ambito: 'cliente', createdAt: D('2026-08-13') },
      { id: 'cliente-vecchia', conflittoSanitario: false, ambito: 'cliente', createdAt: D('2026-08-01') },
    ];
    expect(ordinaPerRischio(righe).map((r) => r.id)).toEqual([
      'sanitario',
      'catalogo',
      'cliente-vecchia',
      'cliente-nuova',
    ]);
  });

  it('non modifica l’array che riceve', () => {
    const righe = [
      { conflittoSanitario: false, ambito: 'cliente', createdAt: D('2026-08-13') },
      { conflittoSanitario: true, ambito: 'cliente', createdAt: D('2026-08-13') },
    ];
    ordinaPerRischio(righe);
    expect(righe[0].conflittoSanitario).toBe(false);
  });
});

describe('il divieto su una dieta (§6.2)', () => {
  const proposta = {
    id: 'p1', nutrizionistaId: 's1', azione: 'regola_dieta', ambito: 'dieta',
    soggettoId: 'd1', soggettoNome: 'Mediterranea', dettaglio: { termini: ['Tonno'] },
  };

  it('scrive UNA riga in ProductRule, accesa', async () => {
    const create = jest.fn().mockResolvedValue({});
    const prisma = {
      productRule: { findFirst: jest.fn().mockResolvedValue(null), create, update: jest.fn() },
      recipe: { findMany: jest.fn().mockResolvedValue([]) },
      menuDay: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn() },
    };
    const esito = await applicaProposta(prisma as never, proposta as never);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ dietId: 'd1', enabled: true, params: { termini: ['tonno'] } }) }),
    );
    expect(esito.riepilogo).toContain('non entreranno più nei menu nuovi');
  });

  it('⚠️ una seconda approvazione UNISCE i termini, non li sostituisce', async () => {
    const update = jest.fn().mockResolvedValue({});
    const prisma = {
      productRule: {
        findFirst: jest.fn().mockResolvedValue({ id: 'pr1', enabled: true, params: { termini: ['salmone'] } }),
        create: jest.fn(),
        update,
      },
      recipe: { findMany: jest.fn().mockResolvedValue([]) },
      menuDay: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn() },
    };
    await applicaProposta(prisma as never, proposta as never);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'pr1' }, data: expect.objectContaining({ params: { termini: ['salmone', 'tonno'] } }) }),
    );
  });

  it('⚠️ riapprovare la stessa cosa non riscrive niente', async () => {
    const update = jest.fn();
    const prisma = {
      productRule: {
        findFirst: jest.fn().mockResolvedValue({ id: 'pr1', enabled: true, params: { termini: ['tonno'] } }),
        create: jest.fn(), update,
      },
      recipe: { findMany: jest.fn().mockResolvedValue([]) },
      menuDay: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn() },
    };
    const esito = await applicaProposta(prisma as never, proposta as never);
    expect(update).not.toHaveBeenCalled();
    expect(esito.riepilogo).toContain('c\'era già');
  });

  it('senza dieta o senza alimento non scrive', async () => {
    const create = jest.fn();
    const prisma = {
      productRule: { findFirst: jest.fn(), create, update: jest.fn() },
      recipe: { findMany: jest.fn().mockResolvedValue([]) },
      menuDay: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn() },
    };
    await applicaProposta(prisma as never, { ...proposta, soggettoId: null } as never);
    expect(create).not.toHaveBeenCalled();
  });
});

describe('i menu già preparati, quando il divieto entra in vigore', () => {
  const proposta = {
    id: 'p1', nutrizionistaId: 's1', azione: 'regola_dieta', ambito: 'dieta',
    soggettoId: 'd1', soggettoNome: 'Mediterranea', dettaglio: { termini: ['tonno'] },
  };
  const domani = new Date(Date.now() + 86_400_000);

  function prismaCon(giorni: unknown[]) {
    const deleteMany = jest.fn().mockResolvedValue({ count: giorni.length });
    return {
      deleteMany,
      prisma: {
        productRule: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(), update: jest.fn() },
        recipe: { findMany: jest.fn().mockResolvedValue([{ id: 'r1', name: 'Tonno alle olive', ingredients: [] }]) },
        menuDay: { findMany: jest.fn().mockResolvedValue(giorni), deleteMany },
      },
    };
  }

  it('⚠️ i giorni futuri NON ancora aperti col piatto vietato si rifanno', async () => {
    const { prisma, deleteMany } = prismaCon([
      { id: 'g1', clientId: 'c1', date: domani, viewedAt: null, meals: [{ slot: 'pranzo', recipeId: 'r1' }] },
    ]);
    const esito = await applicaProposta(prisma as never, proposta as never);
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['g1'] } } });
    expect(esito.riepilogo).toContain('quelle già lette restano come sono');
  });

  it('⚠️ un giorno che NON contiene il piatto vietato non si tocca', async () => {
    const { prisma, deleteMany } = prismaCon([
      { id: 'g2', clientId: 'c1', date: domani, viewedAt: null, meals: [{ slot: 'cena', recipeId: 'r-altro' }] },
    ]);
    const esito = await applicaProposta(prisma as never, proposta as never);
    expect(deleteMany).not.toHaveBeenCalled();
    expect(esito.riepilogo).toContain('non ho toccato niente');
  });
});
