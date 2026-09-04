/**
 * ⛔ **«SE SPOSTO UNA RICETTA DA COLAZIONE A CENA E SALVO NON LA SPOSTA»** — Simone, 4/9.
 *
 * ⚠️ **Questa prova è sulla CUCITURA, non sulla regola.** La decisione sta in
 * `ricetta-che-cambia-pasto.ts` e ha le sue prove; qui la domanda è se `updateRecipe` la chiama
 * davvero e scrive davvero. È la lezione del 3/9, ed è la stessa che oggi ha già fatto trovare un
 * salvataggio che rifiutava quello che la ricerca aveva appena mostrato: *le prove sui due pezzi
 * non provano la cucitura*.
 */
import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogService } from './catalog.service';

describe('CatalogService — cambiare il pasto sposta le righe di paniere', () => {
  let service: CatalogService;
  let prisma: any;

  const monta = async (ricetta: Record<string, unknown>, righe: unknown[]) => {
    prisma = {
      recipe: {
        findUnique: jest.fn().mockResolvedValue(ricetta),
        update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ ...ricetta, ...data })),
      },
      paniereRicetta: {
        findMany: jest.fn().mockResolvedValue(righe),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      /** ⚠️ Le due mosse passano da una transazione sola: il finto la esegue com'è. */
      $transaction: jest.fn().mockImplementation((p: unknown[]) => Promise.all(p)),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        CatalogService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: NotificationsService, useValue: { notify: jest.fn() } },
        { provide: ConfigParamsService, useValue: { getNumber: jest.fn(async (_k: string, d?: number) => d ?? 0) } },
      ],
    }).compile();
    service = moduleRef.get(CatalogService);
  };

  const PORRIDGE = {
    id: 'r1', name: 'Porridge di avena', mealSlot: 'breakfast', regime: 'vegan',
    ingredients: [{ name: 'avena' }], allergensReviewed: true, verifiedAt: null, active: true,
  };

  it('⛔ da colazione a cena le righe si spostano davvero', async () => {
    await monta(PORRIDGE, [{ id: 'a', paniereId: 'p1', slot: 'breakfast' }]);
    const esito = await service.updateRecipe('u1', 'r1', { mealSlot: 'dinner' } as never) as { pastoCambiato: string | null };
    expect(prisma.paniereRicetta.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['a'] } }, data: { slot: 'dinner' },
    });
    expect(esito.pastoCambiato).toContain('1 paniere');
  });

  /**
   * ⚠️ **Le due mosse in UNA scrittura.** Fra un `updateMany` e un `deleteMany` separati ci sta un
   * errore, e il risultato sarebbe metà delle righe spostate e metà no: cioè proprio lo stato che
   * questa funzione esiste per non lasciare.
   */
  it('⚠️ spostamenti e rimozioni passano da una transazione sola', async () => {
    await monta(PORRIDGE, [{ id: 'a', paniereId: 'p1', slot: 'breakfast' }]);
    await service.updateRecipe('u1', 'r1', { mealSlot: 'dinner' } as never);
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  /**
   * ⛔ **RISALVARE RIPARA — Simone, 4/9 sera**: *«il nutrizionista è entrato in una ricetta che aveva
   * già messo come cena, ha risalvato e resta nel paniere delle colazioni»*.
   *
   * La prima stesura guardava i panieri **solo quando il pasto cambiava**, e lì non cambiava niente:
   * la riga era storta da prima, da quando spostare il pasto non toccava i panieri. Chiudere la
   * falla in avanti non ripara quello che si è già storto — e chi risalva d'istinto per rimettere a
   * posto non rimetteva a posto niente.
   *
   * ⚠️ La regola è un'**invariante**, non una transizione: la riga sta sempre nella cella del pasto
   * della ricetta.
   */
  it('⛔ risalvare una ricetta già a cena ripara la riga rimasta a colazione', async () => {
    const cena = { ...PORRIDGE, name: 'Frittata al forno', mealSlot: 'dinner' };
    await monta(cena, [{ id: 'a', paniereId: 'p1', slot: 'breakfast' }]);
    await service.updateRecipe('u1', 'r1', { name: 'Frittata al forno con funghi' } as never);
    expect(prisma.paniereRicetta.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['a'] } }, data: { slot: 'dinner' },
    });
  });

  /** ⚠️ E quando è già tutto a posto non si scrive niente, e non si dice niente. */
  it('⚠️ ma se è già allineata non scrive e non parla', async () => {
    await monta(PORRIDGE, [{ id: 'a', paniereId: 'p1', slot: 'breakfast' }]);
    const esito = await service.updateRecipe('u1', 'r1', { name: 'Porridge tiepido' } as never) as { pastoCambiato: string | null };
    expect(prisma.paniereRicetta.updateMany).not.toHaveBeenCalled();
    expect(prisma.paniereRicetta.deleteMany).not.toHaveBeenCalled();
    expect(esito.pastoCambiato).toBeNull();
  });

  /**
   * ⛔ **LA QUARTA PORTA — e si chiude RIFIUTANDO, non cancellando.**
   *
   * La prima stesura del 4/9 toglieva le righe di paniere. Una revisione avversariale l'ha smontata
   * prima della consegna: una tendina premuta per sbaglio su una ricetta in dodici panieri ne
   * cancellava dodici righe, rimettere «cena» non le riportava indietro, e la regola restava aperta
   * lo stesso — perché la ricetta finiva comunque **a colazione** in catalogo.
   */
  it('⛔ un pesce non si può spostare a colazione: il salvataggio si rifiuta', async () => {
    const branzino = { ...PORRIDGE, name: 'Branzino al vapore', mealSlot: 'dinner', ingredients: [] };
    await monta(branzino, [{ id: 'a', paniereId: 'p1', slot: 'dinner' }]);
    await expect(service.updateRecipe('u1', 'r1', { mealSlot: 'breakfast' } as never))
      .rejects.toThrow(/non si può spostare a colazione/);
  });

  /** ⛔ E non si scrive NIENTE: né il pasto in catalogo, né una riga di paniere. */
  it('⛔ e non tocca né la ricetta né i panieri', async () => {
    const branzino = { ...PORRIDGE, name: 'Branzino al vapore', mealSlot: 'dinner', ingredients: [] };
    await monta(branzino, [{ id: 'a', paniereId: 'p1', slot: 'dinner' }]);
    await service.updateRecipe('u1', 'r1', { mealSlot: 'breakfast' } as never).catch(() => undefined);
    expect(prisma.recipe.update).not.toHaveBeenCalled();
    expect(prisma.paniereRicetta.deleteMany).not.toHaveBeenCalled();
    expect(prisma.paniereRicetta.updateMany).not.toHaveBeenCalled();
  });

  /**
   * ⛔ **Il giudizio si dà sugli ingredienti NUOVI**: chi corregge gli ingredienti *e* sposta il
   * pasto nello stesso salvataggio va giudicato sul piatto che sta scrivendo, non su quello di
   * prima. Qui il pesce lo sta togliendo: il salvataggio deve passare.
   */
  it('⛔ chi toglie il pesce e sposta a colazione nello stesso salvataggio passa', async () => {
    const branzino = {
      ...PORRIDGE, name: 'Crema di avena', mealSlot: 'dinner',
      ingredients: [{ name: 'branzino' }],
    };
    await monta(branzino, [{ id: 'a', paniereId: 'p1', slot: 'dinner' }]);
    await service.updateRecipe('u1', 'r1', {
      mealSlot: 'breakfast', ingredients: [{ name: 'avena' }],
    } as never);
    expect(prisma.recipe.update).toHaveBeenCalled();
  });

  /**
   * ⚠️ **Spuntino e merenda sono un paniere solo**: lo slot scritto è il capofila, altrimenti si
   * scriverebbe una riga che il resto del progetto legge come un'altra cella.
   */
  it('⚠️ a merenda si scrive il capofila, non «afternoon_snack»', async () => {
    await monta(PORRIDGE, [{ id: 'a', paniereId: 'p1', slot: 'lunch' }]);
    await service.updateRecipe('u1', 'r1', { mealSlot: 'afternoon_snack' } as never);
    expect(prisma.paniereRicetta.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['a'] } }, data: { slot: 'morning_snack' },
    });
  });

  /**
   * ⛔ **LA QUINTA PORTA: il riallineamento non spinge DENTRO un pasto leggero.**
   *
   * Il rifiuto copre il **cambio** di pasto. Ma il riallineamento gira a ogni salvataggio: una
   * ricetta di pesce che in catalogo è **già** a colazione — roba di prima che la regola esistesse —
   * vedrebbe le sue righe spostate dentro la colazione da un salvataggio che non c'entrava niente.
   */
  it('⛔ risalvare un pesce già a colazione non gli sposta dentro le righe', async () => {
    const branzino = { ...PORRIDGE, name: 'Branzino al vapore', mealSlot: 'breakfast', ingredients: [] };
    await monta(branzino, [{ id: 'a', paniereId: 'p1', slot: 'dinner' }]);
    await service.updateRecipe('u1', 'r1', { name: 'Branzino al vapore leggero' } as never);
    expect(prisma.paniereRicetta.updateMany).not.toHaveBeenCalled();
    expect(prisma.paniereRicetta.deleteMany).not.toHaveBeenCalled();
  });

  /** ⚠️ Una ricetta che non sta in nessun paniere non fa scrivere niente, e non lo racconta. */
  it('⚠️ senza panieri non si scrive e non si dice niente', async () => {
    await monta(PORRIDGE, []);
    const esito = await service.updateRecipe('u1', 'r1', { mealSlot: 'dinner' } as never) as { pastoCambiato: string | null };
    expect(prisma.paniereRicetta.updateMany).not.toHaveBeenCalled();
    expect(prisma.paniereRicetta.deleteMany).not.toHaveBeenCalled();
    expect(esito.pastoCambiato).toBeNull();
  });
});
