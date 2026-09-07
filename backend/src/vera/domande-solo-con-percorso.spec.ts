/**
 * ⛔ **LE DOMANDE APERTE SI MOSTRANO SOLO PER CHI HA UN PERCORSO** — 7/9.
 *
 * `solo-chi-ha-un-percorso.spec.ts` guarda i **sorgenti** (che il filtro ci sia); questa guarda il
 * **comportamento**, perché qui il filtro non è un `where` che Prisma applica per noi: è codice
 * scritto a mano, in memoria. `RichiestaVera` porta un `clienteId` che è una stringa senza
 * relazione — di proposito, «la richiesta si legge anche per una cliente cancellata» — quindi si
 * leggono le righe e si chiede a parte chi, fra quelle, ha un piano. Un pezzo di logica scritta a
 * mano senza una prova che la esegua è una promessa.
 */
import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RichiesteVeraService } from './richieste.service';

describe('RichiesteVeraService — le domande di chi ha finito non si mostrano', () => {
  let service: RichiesteVeraService;
  let prisma: any;

  /** Le richieste aperte a database, e quali clienti hanno un piano in corso. */
  function scenario(aperte: { id: string; clienteId: string | null }[], conPiano: string[]) {
    prisma.richiestaVera.findMany.mockResolvedValue(aperte);
    prisma.user.findMany.mockImplementation(async ({ where }: any) => {
      const chiesti: string[] = where?.id?.in ?? [];
      // ⚠️ Il finto pretende che il filtro del piano ci sia davvero nella `where`: senza, risponde
      // «nessuno» — così una chiamata che si dimenticasse il filtro non passerebbe per fortuna.
      if (!where?.subscriptions) return [];
      return chiesti.filter((id) => conPiano.includes(id)).map((id) => ({ id }));
    });
  }

  beforeEach(async () => {
    prisma = {
      richiestaVera: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
      user: { findMany: jest.fn() },
      clientProfile: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), findUnique: jest.fn() },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        RichiesteVeraService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: NotificationsService, useValue: { create: jest.fn(), notify: jest.fn() } },
      ],
    })
      .useMocker(() => ({}))
      .compile();
    service = moduleRef.get(RichiesteVeraService);
  });

  it('⛔ una domanda su una cliente senza percorso non esce dall’elenco', async () => {
    scenario([{ id: 'r1', clienteId: 'viva' }, { id: 'r2', clienteId: 'conclusa' }], ['viva']);
    const fuori = await service.aperte('u-nutri', true);
    expect(fuori.map((r: any) => r.id)).toEqual(['r1']);
  });

  it('⚠️ e il CONTATORE dice lo stesso numero dell’elenco, non quello del database', async () => {
    scenario(
      [{ id: 'r1', clienteId: 'viva' }, { id: 'r2', clienteId: 'conclusa' }, { id: 'r3', clienteId: 'conclusa2' }],
      ['viva'],
    );
    expect(await service.quante('u-nutri', true)).toBe(1);
  });

  it('⛔ una riga senza `clienteId` non passa: in dubbio non si mostra', async () => {
    scenario([{ id: 'r1', clienteId: null }], []);
    expect(await service.aperte('u-nutri', true)).toEqual([]);
  });

  it('⚠️ nessuna domanda aperta: non si interroga nemmeno il database per i piani', async () => {
    scenario([], []);
    expect(await service.aperte('u-nutri', true)).toEqual([]);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('⚠️ gli id si chiedono UNA volta sola, non uno per riga', async () => {
    scenario(
      [{ id: 'r1', clienteId: 'viva' }, { id: 'r2', clienteId: 'viva' }, { id: 'r3', clienteId: 'altra' }],
      ['viva', 'altra'],
    );
    await service.aperte('u-nutri', true);
    expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
    // E senza doppioni: due righe della stessa cliente sono un id solo.
    expect(prisma.user.findMany.mock.calls[0][0].where.id.in.sort()).toEqual(['altra', 'viva']);
  });
});
