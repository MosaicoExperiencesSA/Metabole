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

  /**
   * ⚠️ VERA VINCE SEMPRE SU GAIA — decisione di Simone, 18/8, alla domanda «se la nutrizionista
   * detta una spezia, cosa si fa?».
   *
   * Dal pulsante dell'app e dalla scheda una spezia viene scartata: escluderla svuoterebbe il
   * ricettario invece di togliere un piatto. Qui no: chi detta è la professionista che firma le
   * diete. Il pool che si stringe glielo dice l'anteprima **prima** che scriva, quindi sceglie
   * sapendo — che è la differenza fra accettare una conseguenza e non vederla.
   */
  it('⚠️ una SPEZIA dettata dalla nutrizionista si scrive: non passa da `filtraSpezie`', async () => {
    const { prisma, update } = makePrisma([{ userId: 'c1', dislikedFoods: [] }]);
    const esito = await applicaProposta(prisma, proposta({ dettaglio: { termini: ['pepe'] } }));
    expect(esito.toccate).toBe(1);
    expect(update.mock.calls[0][0].data.dislikedFoods).toEqual(['pepe']);
  });

  /**
   * ⚠️ Ma l'ALTRA metà di `filtraSpezie` resta, e non c'entra col permesso: spezzare è correggere
   * la forma di un dato perché continui a funzionare. «pepe, ceci» scritto in una riga sola non
   * compare in nessun piatto e da lì in poi non esclude più niente — e qui il danno si moltiplica
   * per tutte le clienti della coorte.
   */
  it('⚠️ ma una voce con DUE alimenti dentro viene comunque spezzata in due righe', async () => {
    const { prisma, update } = makePrisma([{ userId: 'c1', dislikedFoods: [] }]);
    await applicaProposta(prisma, proposta({ dettaglio: { termini: ['pepe, ceci'] } }));
    expect(update.mock.calls[0][0].data.dislikedFoods).toEqual(['pepe', 'ceci']);
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
      dietDayTemplate: { findMany: jest.fn().mockResolvedValue([]) },
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
      dietDayTemplate: { findMany: jest.fn().mockResolvedValue([]) },
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
      dietDayTemplate: { findMany: jest.fn().mockResolvedValue([]) },
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
      dietDayTemplate: { findMany: jest.fn().mockResolvedValue([]) },
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
        dietDayTemplate: { findMany: jest.fn().mockResolvedValue([]) },
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

  /**
   * ⚠️ IL TETTO SUL RAMO DIETA — non era coperto da nessun test fino al 19/8 sera, e decide se
   * migliaia di giornate di menu vengono cancellate o no.
   *
   * ⛔ Sopra il tetto **la regola resta e il rifacimento si salta**, e i due pezzi non si possono
   * scambiare: il divieto sui menu nuovi costa zero ed è il motivo per cui la regola esiste; è il
   * rifacimento che è pesante. Un test che guardasse solo «non ha cancellato» passerebbe anche se
   * l'approvazione non avesse scritto niente — cioè se il capo avesse approvato un divieto che non
   * vale.
   */
  it('⚠️ oltre il tetto: la regola SI scrive, i giorni NON si toccano, e lo dice', async () => {
    const molti = Array.from({ length: 201 }, (_, i) => ({
      id: `g${i}`, clientId: `c${i}`, date: domani, viewedAt: null, meals: [{ slot: 'pranzo', recipeId: 'r1' }],
    }));
    const { prisma, deleteMany } = prismaCon(molti);
    const esito = await applicaProposta(prisma as never, proposta as never);

    expect(deleteMany).not.toHaveBeenCalled();
    // ⚠️ La metà che conta: il divieto vale lo stesso da adesso.
    expect(prisma.productRule.create).toHaveBeenCalled();
    expect(esito.riepilogo).toContain('oltre il tetto di 200');
    // E si dice quante persone restano indietro, invece di far finta di niente.
    expect(esito.riepilogo).toContain('201 clienti');
  });

  /**
   * ⚠️ IL CONFINE, ed è dove vive l'errore di uno. «Oltre il tetto» vuol dire **più di** 200: con
   * esattamente 200 clienti si rifà. Senza questo caso, `>` e `>=` sono indistinguibili — e la
   * differenza è duecento persone che ricevono o non ricevono il menu giusto.
   */
  it('⚠️ esattamente 200 clienti NON è «oltre»: si rifà', async () => {
    const esatti = Array.from({ length: 200 }, (_, i) => ({
      id: `g${i}`, clientId: `c${i}`, date: domani, viewedAt: null, meals: [{ slot: 'pranzo', recipeId: 'r1' }],
    }));
    const { prisma, deleteMany } = prismaCon(esatti);
    const esito = await applicaProposta(prisma as never, proposta as never);
    expect(deleteMany).toHaveBeenCalled();
    expect(esito.riepilogo).toContain('200 clienti');
    expect(esito.riepilogo).not.toContain('oltre il tetto');
  });

  /**
   * ⚠️ E il tetto si conta sulle **persone**, non sulle giornate: una cliente con novanta giorni
   * preparati è una cliente. Contare le giornate farebbe scattare il tetto su tre persone con il
   * menu del trimestre già pronto, e il divieto non arriverebbe mai ai loro piatti.
   */
  it('⚠️ il tetto conta le persone, non le giornate: 300 giorni di 2 clienti si rifanno', async () => {
    const tanti = Array.from({ length: 300 }, (_, i) => ({
      id: `g${i}`, clientId: i % 2 ? 'c1' : 'c2', date: domani, viewedAt: null, meals: [{ slot: 'pranzo', recipeId: 'r1' }],
    }));
    const { prisma, deleteMany } = prismaCon(tanti);
    const esito = await applicaProposta(prisma as never, proposta as never);
    expect(deleteMany).toHaveBeenCalled();
    expect(esito.riepilogo).toContain('2 clienti');
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

describe('l\'elenco delle scoperte arriva al capo (voce vera-regola-dieta-scoperte)', () => {
  const proposta = {
    id: 'p1', nutrizionistaId: 's1', azione: 'regola_dieta', ambito: 'dieta',
    soggettoId: 'd1', soggettoNome: 'Mediterranea', dettaglio: { termini: ['tonno'] },
  };

  it('chi resterebbe senza un pasto si dice al capo, con nome e pasto — e per lei il divieto non vale', async () => {
    const prisma = {
      productRule: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}), update: jest.fn() },
      recipe: { findMany: jest.fn().mockResolvedValue([{ id: 'r-tonno', name: 'Insalata di tonno', ingredients: [] }]) },
      dietDayTemplate: { findMany: jest.fn().mockResolvedValue([{ meals: [{ slot: 'dinner', recipeId: 'r-tonno' }] }]) },
      // Due letture diverse sulla stessa tabella: il rifacimento (viewedAt null) e la coorte (distinct).
      menuDay: {
        findMany: jest.fn().mockImplementation((args: { distinct?: string[] }) =>
          Promise.resolve(args?.distinct ? [{ clientId: 'c1' }] : [])),
        deleteMany: jest.fn(),
      },
      clientProfile: {
        findMany: jest.fn().mockResolvedValue([
          { userId: 'c1', name: 'Giulia Rossi', allergies: [], intolerances: [], dislikedFoods: [] },
        ]),
      },
    };
    const esito = await applicaProposta(prisma as never, proposta as never);
    expect(esito.riepilogo).toContain('Giulia Rossi');
    expect(esito.riepilogo).toContain('cena');
    expect(esito.riepilogo).toContain('NON vale');
    expect(esito.scoperte).toHaveLength(1);
  });

  it('⚠️ se il conto delle scoperte si rompe si DICE — la regola vale, l\'elenco va guardato a mano', async () => {
    // «Non lo so» ≠ «nessuno»: un elenco vuoto per un errore inghiottito è la bugia silenziosa
    // che questa voce esiste per chiudere.
    const prisma = {
      productRule: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}), update: jest.fn() },
      recipe: { findMany: jest.fn().mockResolvedValue([{ id: 'r-tonno', name: 'Insalata di tonno', ingredients: [] }]) },
      dietDayTemplate: { findMany: jest.fn().mockRejectedValue(new Error('boom')) },
      menuDay: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn() },
    };
    const esito = await applicaProposta(prisma as never, proposta as never);
    expect(esito.riepilogo).toContain('Non sono riuscito a calcolare chi resterebbe scoperta');
  });

  it('con tutte le clienti coperte l\'elenco non compare e non sporca il messaggio', async () => {
    const prisma = {
      productRule: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}), update: jest.fn() },
      recipe: { findMany: jest.fn().mockResolvedValue([
        { id: 'r-tonno', name: 'Insalata di tonno', ingredients: [] },
        { id: 'r-pollo', name: 'Pollo ai ferri', ingredients: [] },
      ]) },
      dietDayTemplate: { findMany: jest.fn().mockResolvedValue([{ meals: [{ slot: 'dinner', recipeId: 'r-tonno' }, { slot: 'dinner', recipeId: 'r-pollo' }] }]) },
      menuDay: {
        findMany: jest.fn().mockImplementation((args: { distinct?: string[] }) =>
          Promise.resolve(args?.distinct ? [{ clientId: 'c1' }] : [])),
        deleteMany: jest.fn(),
      },
      clientProfile: {
        findMany: jest.fn().mockResolvedValue([
          { userId: 'c1', name: 'Giulia Rossi', allergies: [], intolerances: [], dislikedFoods: [] },
        ]),
      },
    };
    const esito = await applicaProposta(prisma as never, proposta as never);
    expect(esito.riepilogo).not.toContain('NON vale');
    expect(esito.scoperte ?? []).toHaveLength(0);
  });
});
