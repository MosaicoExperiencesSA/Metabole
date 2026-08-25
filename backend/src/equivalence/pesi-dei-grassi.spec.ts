/**
 * ⛔ **I PESI DEI GRASSI, DAL BACK OFFICE AL DATABASE.**
 *
 * Nocanty li mantiene lui dal back office (24/8: *«approvata l'integrazione della colonna
 * nell'editor dei gruppi per la gestione autonoma futura»*), e da lì Gaia li rilegge a ogni cambio.
 * Questo file guarda il pezzo di mezzo — quello che decide se il suo lavoro sopravvive a un
 * salvataggio — e nella prima stesura non era coperto da una riga di test: rimettere il difetto
 * dentro non faceva diventare rosso niente.
 */
import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { EquivalenceService } from './equivalence.service';

const FATTORI = { riferimento: 'olio evo', fonte: 'CREA / USDA', pesi: { burro: 120, 'olio evo': 100 } };

describe('⛔ EquivalenceService — i pesi dei grassi', () => {
  let service: EquivalenceService;
  let prisma: any;
  /** L'ultimo `members` scritto: è l'unica cosa che conta, ed è quello che Gaia rileggerà. */
  const scritto = () => prisma.equivalenceGroup.update.mock.calls.at(-1)?.[0]?.data?.members;

  beforeEach(async () => {
    prisma = {
      equivalenceGroup: {
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'g1', ...data })),
        findUnique: jest.fn().mockResolvedValue({
          id: 'g1',
          name: 'Oli e grassi da condimento',
          status: 'approved',
          version: 1,
          members: { items: ['burro', 'olio evo'], note: 'la nota', fattori: FATTORI },
        }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'g1', ...data })),
        delete: jest.fn(),
      },
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'capo-user' }]) },
      notification: { create: jest.fn().mockResolvedValue({}) },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        EquivalenceService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: jest.fn().mockResolvedValue(undefined) } },
        { provide: NotificationsService, useValue: { notify: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();
    service = moduleRef.get(EquivalenceService);
  });

  /**
   * ⛔ **Cambiare la nota non deve cancellare i numeri.** È il salvataggio più innocuo che esista, ed
   * è quello che nella prima stesura li portava via: `undefined` vuol dire «non l'ho toccato».
   */
  it('⛔ un aggiornamento che non parla di pesi li lascia dov’erano', async () => {
    await service.update('u1', 'g1', { note: 'un’altra nota' } as never);
    expect(scritto().fattori).toEqual(FATTORI);
  });

  it('⛔ e salvare SOLO i pesi li scrive davvero', async () => {
    await service.update('u1', 'g1', {
      fattori: { riferimento: 'olio evo', pesi: { burro: 121 } },
    } as never);
    expect(scritto().fattori.pesi).toEqual({ burro: 121 });
  });

  /** ⚠️ `null` è la cancellazione voluta, e deve restare possibile: è l'altra metà della coppia. */
  it('⚠️ «null» li toglie: cancellarli si può, va solo detto apposta', async () => {
    await service.update('u1', 'g1', { fattori: null } as never);
    expect(scritto().fattori).toBeUndefined();
  });

  /**
   * ⛔ **Un peso illeggibile si scarta, non diventa zero.** `Number('')` è 0, e un peso a zero fa
   * una divisione per zero o una quantità infinita nel piatto di una persona.
   */
  it('⛔ i pesi illeggibili, a zero, negativi o fuori scala non entrano', async () => {
    await service.update('u1', 'g1', {
      fattori: {
        riferimento: 'olio evo',
        pesi: { burro: 120, panna: 'boh', ghee: 0, lardo: -5, strutto: 1e9, margarina: '122' },
      },
    } as never);
    // ⚠️ La stringa numerica sì: la scrive un campo di testo.
    expect(scritto().fattori.pesi).toEqual({ burro: 120, margarina: 122 });
  });

  it('⚠️ e se non resta nessun peso valido il gruppo non porta fattori', async () => {
    await service.update('u1', 'g1', {
      fattori: { riferimento: 'olio evo', pesi: { burro: 'boh' } },
    } as never);
    expect(scritto().fattori).toBeUndefined();
  });

  /** ⚠️ Un peso senza riferimento non vuol dire niente: «120» rispetto a cosa? */
  it('⚠️ senza riferimento i pesi non si salvano', async () => {
    await service.update('u1', 'g1', { fattori: { riferimento: '  ', pesi: { burro: 120 } } } as never);
    expect(scritto().fattori).toBeUndefined();
  });

  /** ⚠️ E il tetto delle righe c'è, largo: la tabella vera ne ha tredici. */
  it('⚠️ oltre il tetto le righe in più si scartano, e il resto si salva', async () => {
    const tante: Record<string, number> = {};
    for (let i = 0; i < 400; i += 1) tante[`alimento ${i}`] = 100;
    await service.update('u1', 'g1', { fattori: { riferimento: 'olio evo', pesi: tante } } as never);
    expect(Object.keys(scritto().fattori.pesi)).toHaveLength(300);
  });
});
