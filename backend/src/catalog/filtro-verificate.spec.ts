/**
 * ⚠️ **«MOSTRA E NASCONDI QUELLE VERIFICATE»** — Simone, 4/9, il giorno dopo la spunta.
 *
 * La spunta serve a sapere cosa ha già guardato la nutrizionista. La domanda che si fa davanti a un
 * catalogo di ventimila ricette però è l'altra — **quali mancano** — e senza filtro si risponde
 * scorrendo, cioè non si risponde.
 *
 * ⛔ **E deve girare sul DATABASE, non sulle righe ricevute.** È lo stesso difetto del filtro
 * allergeni del 19/8 (`allergeni-bozze.spec.ts`): la pagina riceve mille righe in ordine
 * alfabetico, e un filtro applicato dopo risponde sulla fetta che comincia per A. Lì il danno era
 * una pagina vuota; qui sarebbe peggio, perché la pagina **non** sarebbe vuota — direbbe «ne
 * restano poche» mentre ne restano migliaia, e a quel numero si smette di guardare.
 */
import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogService } from './catalog.service';

describe('CatalogService — il filtro «verificate»', () => {
  let service: CatalogService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      recipe: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      dietDay: { findMany: jest.fn().mockResolvedValue([]) },
      menuDay: { findMany: jest.fn().mockResolvedValue([]) },
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
  });

  const whereRighe = () => (prisma.recipe.findMany as jest.Mock).mock.calls[0][0].where;
  const whereConto = () => (prisma.recipe.count as jest.Mock).mock.calls[0][0].where;

  it('«solo verificate» chiede al database quelle che la data ce l\'hanno', async () => {
    await service.listRecipes({ verificata: 'si', includeInactive: true });
    expect(whereRighe().verifiedAt).toEqual({ not: null });
  });

  it('«solo da verificare» chiede quelle che la data non ce l\'hanno', async () => {
    await service.listRecipes({ verificata: 'no', includeInactive: true });
    expect(whereRighe().verifiedAt).toBeNull();
  });

  /** Chi non lo chiede riceve quello che riceveva prima: un filtro non si applica da solo. */
  it('senza il filtro non compare nessuna condizione sulla spunta', async () => {
    await service.listRecipes({ includeInactive: true });
    expect(whereRighe().verifiedAt).toBeUndefined();
  });

  /**
   * ⚠️ **Il totale si conta con la stessa condizione delle righe.** È la riga che il filtro
   * allergeni ha già dovuto imparare: un conteggio fatto su un `where` diverso stampa in cima alla
   * pagina un numero che non c'entra con l'elenco sotto — e quel numero è quello che si legge.
   */
  it.each([['si', { not: null }], ['no', null]] as const)(
    '⚠️ il totale usa lo stesso filtro delle righe: %s',
    async (valore, atteso) => {
      await service.listRecipes({ verificata: valore, includeInactive: true });
      expect(whereConto().verifiedAt).toEqual(atteso);
    },
  );

  /**
   * ⛔ **E non litiga con gli altri filtri.** Il caso vero è questo: la nutrizionista cerca le
   * colazioni che le mancano ancora. Se uno dei due filtri scavalcasse l'altro, la risposta
   * sarebbe plausibile e sbagliata — che è il modo peggiore in cui può sbagliare.
   */
  it('⛔ si somma agli altri filtri invece di sostituirli', async () => {
    await service.listRecipes({ verificata: 'no', mealSlot: 'breakfast', includeInactive: true });
    const w = whereRighe();
    expect(w.verifiedAt).toBeNull();
    expect(w.mealSlot).toBe('breakfast');
  });
});
