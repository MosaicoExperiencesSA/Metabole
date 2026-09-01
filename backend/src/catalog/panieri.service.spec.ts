import { PanieriService } from './panieri.service';

/**
 * ⚠️ Fase 7 del piano panieri: il paniere si vede e si tocca dal back office.
 *
 * ⛔ **Chi tocca una riga qui cambia il menu di tutte insieme** — non la giornata di una cliente,
 * il pool da cui il motore pesca per tutte quelle di quella famiglia e di quel regime. Per questo
 * i tre controlli qui sotto sono la parte che conta più della pagina.
 */
const audit = () => ({ log: jest.fn().mockResolvedValue(undefined) });

const prismaBase = () => ({
  paniere: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
  paniereRicetta: {
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
  recipe: { findUnique: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
});

describe('le celle del paniere', () => {
  it('⚠️ conta le ricette DISTINTE, non le righe', async () => {
    const prisma = prismaBase();
    prisma.paniere.findMany.mockResolvedValue([{ id: 'p1', famiglia: 'Mediterranea', regime: 'vegan' }]);
    // la stessa ricetta a pranzo E a cena: sono due righe, ma un piatto solo
    prisma.paniereRicetta.findMany.mockResolvedValue([
      { paniereId: 'p1', recipeId: 'r1', slot: 'lunch' },
      { paniereId: 'p1', recipeId: 'r1', slot: 'dinner' },
      { paniereId: 'p1', recipeId: 'r2', slot: 'lunch' },
    ]);
    const svc = new PanieriService(prisma as never, audit() as never);
    const celle = await svc.celle();
    const med = celle.find((c) => c.famiglia === 'Mediterranea' && c.regime === 'vegan')!;
    expect(med.totale).toBe(2);
    expect(med.perSlot.lunch.piatti).toBe(2);
    expect(med.perSlot.dinner.piatti).toBe(1);
  });

  /** ⚠️ Fase 2: i due spuntini si contano uniti, perché è quello che vede la cliente. */
  it('⚠️ spuntino e merenda si contano insieme', async () => {
    const prisma = prismaBase();
    prisma.paniere.findMany.mockResolvedValue([{ id: 'p1', famiglia: 'Mediterranea', regime: 'vegan' }]);
    prisma.paniereRicetta.findMany.mockResolvedValue([
      { paniereId: 'p1', recipeId: 's1', slot: 'morning_snack' },
      { paniereId: 'p1', recipeId: 'm1', slot: 'afternoon_snack' },
    ]);
    const svc = new PanieriService(prisma as never, audit() as never);
    const med = (await svc.celle()).find((c) => c.famiglia === 'Mediterranea' && c.regime === 'vegan')!;
    expect(med.perSlot.morning_snack.piatti).toBe(2);
    expect(med.perSlot.afternoon_snack.piatti).toBe(2);
  });

  /**
   * ⛔ **DUE NUMERI, NON UNO.** Un piatto generato nasce in bozza: un paniere con 200 piatti di cui
   * 20 attivi **è un paniere da 20**, perché gli altri il motore non li vede. Con un numero solo la
   * pagina direbbe che va tutto bene proprio nel caso peggiore — il lavoro c'è e non arriva a
   * nessuna cliente.
   */
  it('⛔ e dice quanti di quei piatti il motore userebbe davvero', async () => {
    const prisma = prismaBase();
    prisma.paniere.findMany.mockResolvedValue([{ id: 'p1', famiglia: 'Mediterranea', regime: 'vegan' }]);
    prisma.paniereRicetta.findMany.mockResolvedValue([
      { paniereId: 'p1', recipeId: 'viva', slot: 'lunch' },
      { paniereId: 'p1', recipeId: 'bozza', slot: 'lunch' },
    ]);
    prisma.recipe.findMany.mockResolvedValue([{ id: 'viva' }]); // solo questa è attiva
    const svc = new PanieriService(prisma as never, audit() as never);
    const med = (await svc.celle()).find((c) => c.famiglia === 'Mediterranea' && c.regime === 'vegan')!;
    expect(med.perSlot.lunch).toEqual({ piatti: 2, attivi: 1 });
    expect(med.totale).toBe(2);
    expect(med.totaleAttivi).toBe(1);
  });

  it('le celle ci sono tutte, anche quelle che in tabella non esistono ancora', async () => {
    const svc = new PanieriService(prismaBase() as never, audit() as never);
    const celle = await svc.celle();
    expect(celle).toHaveLength(40); // 10 famiglie × 4 regimi
    expect(celle.every((c) => !c.esiste)).toBe(true);
  });

  /** ⛔ Le due impossibili si vedono per quello che sono, non come panieri vuoti. */
  it('⛔ e le combinazioni impossibili lo dicono', async () => {
    const svc = new PanieriService(prismaBase() as never, audit() as never);
    const celle = await svc.celle();
    const keto = celle.find((c) => c.famiglia === 'Keto (non terapeutica)' && c.regime === 'vegan')!;
    expect(keto.impossibile).toBeTruthy();
    expect(celle.find((c) => c.famiglia === 'Mediterranea' && c.regime === 'vegan')!.impossibile).toBeNull();
  });
});

describe('aggiungere una ricetta a un paniere', () => {
  const conPaniere = () => {
    const prisma = prismaBase();
    prisma.paniere.findFirst.mockResolvedValue({ id: 'p1' });
    return prisma;
  };

  /**
   * ⛔ Una ricetta onnivora dentro il paniere vegano finirebbe nel piatto di una cliente vegana, e
   * nessuno se ne accorgerebbe fino a lì.
   */
  it('⛔ una ricetta di un altro regime non entra', async () => {
    const prisma = conPaniere();
    prisma.recipe.findUnique.mockResolvedValue({ id: 'r1', name: 'Pollo', regime: 'omnivore', allergensReviewed: true });
    const svc = new PanieriService(prisma as never, audit() as never);
    await expect(svc.aggiungi('Mediterranea', 'vegan', 'lunch', 'r1', 'u1')).rejects.toThrow(/vegan/);
    expect(prisma.paniereRicetta.create).not.toHaveBeenCalled();
  });

  /** ⛔ Da qui non si ripassa dal controllo di pubblicazione: gli allergeni devono già essere confermati. */
  it('⛔ una ricetta con gli allergeni non confermati non entra', async () => {
    const prisma = conPaniere();
    prisma.recipe.findUnique.mockResolvedValue({ id: 'r1', name: 'Zuppa', regime: 'vegan', allergensReviewed: false });
    const svc = new PanieriService(prisma as never, audit() as never);
    await expect(svc.aggiungi('Mediterranea', 'vegan', 'lunch', 'r1', 'u1')).rejects.toThrow(/allergeni/i);
    expect(prisma.paniereRicetta.create).not.toHaveBeenCalled();
  });

  /**
   * ⚠️ Fase 2: spuntino e merenda sono un paniere solo. Scrivere due righe per la stessa ricetta
   * la conterebbe due volte in ogni tabulato — si scrive sul capofila, e la lettura allarga.
   */
  it('⚠️ una merenda si scrive sul capofila, non su due righe', async () => {
    const prisma = conPaniere();
    prisma.recipe.findUnique.mockResolvedValue({ id: 'r1', name: 'Yogurt', regime: 'vegan', allergensReviewed: true });
    const svc = new PanieriService(prisma as never, audit() as never);
    await svc.aggiungi('Mediterranea', 'vegan', 'afternoon_snack', 'r1', 'u1');
    expect(prisma.paniereRicetta.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ slot: 'morning_snack' }) }),
    );
  });

  it('e la scrittura finisce nell\'audit', async () => {
    const prisma = conPaniere();
    prisma.recipe.findUnique.mockResolvedValue({ id: 'r1', name: 'Zuppa', regime: 'vegan', allergensReviewed: true });
    const a = audit();
    await new PanieriService(prisma as never, a as never).aggiungi('Mediterranea', 'vegan', 'lunch', 'r1', 'u1');
    expect(a.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'paniere.ricetta.aggiunta' }));
  });

  it('due volte la stessa ricetta non fa due righe', async () => {
    const prisma = conPaniere();
    prisma.recipe.findUnique.mockResolvedValue({ id: 'r1', name: 'Zuppa', regime: 'vegan', allergensReviewed: true });
    prisma.paniereRicetta.findFirst.mockResolvedValue({ id: 'x' });
    const svc = new PanieriService(prisma as never, audit() as never);
    expect(await svc.aggiungi('Mediterranea', 'vegan', 'lunch', 'r1', 'u1')).toEqual({ aggiunta: false });
    expect(prisma.paniereRicetta.create).not.toHaveBeenCalled();
  });
});

/**
 * ⛔ Chi toglie una merenda dallo spuntino si aspetta che sparisca, non che resti servita al
 * pomeriggio: sono un paniere solo anche quando si disfa.
 */
describe('togliere una ricetta', () => {
  it('⛔ toglie da tutti gli slot gemelli', async () => {
    const prisma = prismaBase();
    prisma.paniere.findFirst.mockResolvedValue({ id: 'p1' });
    prisma.paniereRicetta.deleteMany.mockResolvedValue({ count: 2 });
    const svc = new PanieriService(prisma as never, audit() as never);
    await svc.togli('Mediterranea', 'vegan', 'morning_snack', 'r1', 'u1');
    expect(prisma.paniereRicetta.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ slot: { in: ['morning_snack', 'afternoon_snack'] } }) }),
    );
  });

  it('e se non c\'era niente da togliere non si scrive nell\'audit', async () => {
    const prisma = prismaBase();
    prisma.paniere.findFirst.mockResolvedValue({ id: 'p1' });
    const a = audit();
    await new PanieriService(prisma as never, a as never).togli('Mediterranea', 'vegan', 'lunch', 'r1', 'u1');
    expect(a.log).not.toHaveBeenCalled();
  });
});
