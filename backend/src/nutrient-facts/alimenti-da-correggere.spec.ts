import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ValoriNutrizionaliService } from './valori-nutrizionali.service';

/**
 * L'ELENCO DEGLI ALIMENTI DA CORREGGERE A MANO — il passo notturno che lo riempie.
 *
 * Richiesta di Simone, 19/8 sera: «crea una tabella dove possiamo correggere a mano». Fino a quel
 * momento l'elenco esisteva solo come testo dentro `npm run diag:crudo-cotto`, cioè su una shell di
 * Render. ⚠️ Un elenco di lavoro che vive dove chi deve lavorarci non entra è un elenco che nessuno
 * lavora.
 */
describe('aggiornaIngredientiScoperti — il passo notturno', () => {
  const crea = (ricette: unknown[], alimenti: unknown[], gia: unknown[] = []) => {
    const prisma: any = {
      recipe: { findMany: jest.fn().mockResolvedValue(ricette) },
      nutrientFact: { findMany: jest.fn().mockResolvedValue(alimenti) },
      nutrientLookupMiss: {
        upsert: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue(gia),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    return prisma;
  };
  const build = async (prisma: any) => {
    const m = await Test.createTestingModule({
      providers: [ValoriNutrizionaliService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    return m.get(ValoriNutrizionaliService);
  };
  const ric = (...nomi: string[]) => ({ ingredients: nomi.map((name) => ({ name })) });
  const scritte = (prisma: any) => prisma.nutrientLookupMiss.upsert.mock.calls.map((c: any[]) => c[0]);

  it('scrive il nome, quante ricette lo usano e perché non si conta', async () => {
    const prisma = crea([ric('melanzane'), ric('melanzane')], [{ name: 'mela', synonyms: [], state: 'crudo' }]);
    const esito = await (await build(prisma)).aggiornaIngredientiScoperti();

    expect(esito).toEqual({ scoperti: 1, scritti: 1, falliti: 0, fuori: 0 });
    const [call] = scritte(prisma);
    expect(call.where).toEqual({ term: 'melanzane' });
    expect(call.create).toMatchObject({ term: 'melanzane', ricette: 2, motivo: 'non_in_tabella' });
  });

  /**
   * ⚠️ IL CASO CHE FA RISPARMIARE IL LAVORO. «Olio extravergine d oliva» non è in tabella col suo
   * nome, ma l'abbinamento sa a quale riga porta: si suggerisce, e chi lavora l'elenco chiude con
   * **un sinonimo** invece che con una riga nuova — che sarebbe lo stesso alimento contato due
   * volte, con numeri che prima o poi divergono.
   */
  it('⚠️ quando l\'abbinamento saprebbe dove portarlo, lo suggerisce', async () => {
    const prisma = crea([ric('olio extravergine d oliva')], [{ name: 'olio extravergine di oliva', synonyms: [], state: 'crudo' }]);
    await (await build(prisma)).aggiornaIngredientiScoperti();
    expect(scritte(prisma)[0].create).toMatchObject({ suggerito: 'olio extravergine di oliva' });
  });

  /**
   * ⚠️ IL PASSO NOTTURNO NON RIAPRE QUELLO CHE UNA PERSONA HA CHIUSO. Se qualcuno ha detto «questo
   * non è un alimento» (`ignored`) o ha già scritto la riga (`filled`), riportarlo a `open` ogni
   * notte sarebbe un automatismo che disfa una decisione presa a mano — il difetto peggiore di
   * quello che risolve, perché ricompare all'infinito e nessuno capisce perché.
   */
  it('⚠️ non tocca `status`: una riga chiusa a mano resta chiusa', async () => {
    const prisma = crea([ric('melanzane')], [{ name: 'mela', synonyms: [], state: 'crudo' }]);
    await (await build(prisma)).aggiornaIngredientiScoperti();
    expect(scritte(prisma)[0].update).not.toHaveProperty('status');
    expect(Object.keys(scritte(prisma)[0].update).sort()).toEqual(['motivo', 'ricette', 'suggerito']);
  });

  /**
   * ⚠️ `times` NON si tocca. Racconta un fatto diverso — quante volte una cliente l'ha **chiesto** a
   * Gaia — e riscriverlo qui vorrebbe dire cancellare la domanda di qualcuno con un conteggio di
   * ricette. Le due colonne convivono sulla stessa riga proprio per non diventare due elenchi.
   */
  it('⚠️ su una riga che esiste già non riscrive `times`', async () => {
    const prisma = crea([ric('melanzane')], [{ name: 'mela', synonyms: [], state: 'crudo' }]);
    await (await build(prisma)).aggiornaIngredientiScoperti();
    expect(scritte(prisma)[0].update).not.toHaveProperty('times');
    // Sulla riga NUOVA invece parte da zero: nessuna cliente l'ha chiesto, l'ha portata una ricetta.
    expect(scritte(prisma)[0].create.times).toBe(0);
  });

  /** ⚠️ Il tetto si dichiara: un tetto in silenzio si legge come «è tutto qui». */
  it('⚠️ il tetto si vede nel risultato, non si nasconde', async () => {
    const prisma = crea([ric('melanzane', 'zucchine', 'fagiolini')], []);
    const esito = await (await build(prisma)).aggiornaIngredientiScoperti(2);
    expect(esito).toEqual({ scoperti: 3, scritti: 2, falliti: 0, fuori: 1 });
    expect(scritte(prisma)).toHaveLength(2);
  });

  /**
   * ⚠️ L'ELENCO DEVE POTER CALARE. Un nome che era in cima perché lo usavano 500 ricette e che oggi
   * non usa più nessuno deve scendere da solo: un elenco che cresce e non cala racconta un lavoro
   * che non finisce mai, e chi lo guarda smette di guardarlo.
   */
  it('⚠️ chi non è più usato da nessuna ricetta torna a zero', async () => {
    const prisma = crea(
      [ric('melanzane')],
      [{ name: 'mela', synonyms: [], state: 'crudo' }],
      [{ id: 'vecchio', term: 'cavolo nero' }, { id: 'attuale', term: 'melanzane' }],
    );
    await (await build(prisma)).aggiornaIngredientiScoperti();
    expect(prisma.nutrientLookupMiss.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['vecchio'] } }, data: { ricette: 0 } }),
    );
  });

  it('legge solo le ricette ATTIVE: una spenta non è nel piatto di nessuno', async () => {
    const prisma = crea([], []);
    await (await build(prisma)).aggiornaIngredientiScoperti();
    expect(prisma.recipe.findMany.mock.calls[0][0].where).toEqual({ active: true });
  });

  /**
   * ⚠️ SI CONTANO GLI ESITI, NON LE INTENZIONI — trovato dalla revisione avversariale del 19/8 sera.
   * Prima tornava «quante ne volevo scrivere»: con il database caduto a metà il cron avrebbe
   * riportato «300 scritte» e `ok: true`. Un guasto che si racconta come successo è peggio di un
   * guasto, perché nessuno va a guardare. ⚠️ E il doppio non poteva accorgersene: `upsert` era un
   * `mockResolvedValue` che non può fallire.
   */
  it('⚠️ se le scritture falliscono lo dice, invece di contarle come fatte', async () => {
    const prisma = crea([ric('melanzane', 'zucchine')], []);
    prisma.nutrientLookupMiss.upsert = jest.fn().mockRejectedValue(new Error('Neon giù'));
    jest.spyOn((await build(prisma) as never as { logger: { warn: jest.Mock } }).logger, 'warn').mockImplementation(() => undefined);
    const esito = await (await build(prisma)).aggiornaIngredientiScoperti();
    expect(esito.scritti).toBe(0);
    expect(esito.falliti).toBe(2);
  });
});
