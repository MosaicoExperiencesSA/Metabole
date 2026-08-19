import { CoachTasksService } from './coach-tasks.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * LE PROVE NEL RIEPILOGO DELLA COACH — voce 258, 19/8.
 *
 * ⚠️ Una prova che comincia lunedì è una prova avviata, e la settimana in cui si converte è
 * **questa**: se il contatore la vedesse solo dal giorno d'inizio, la coach scoprirebbe la cliente
 * quando la prova è già a metà. Da quando la coda si scrive `queued`, contare i soli `active` faceva
 * sparire dal riquadro esattamente le prove appena vendute — quelle su cui c'è qualcosa da fare.
 *
 * ⚠️ Il finto Prisma qui **conta come il database vero**: senza, il test passerebbe anche contando i
 * soli `active`, cioè non verificherebbe niente.
 */
describe('CoachTasksService.summary — le prove in coda si contano', () => {
  const prove = [{ status: 'active' }, { status: 'queued' }, { status: 'expired' }];

  const crea = () => {
    const prisma = {
      // `admin` → nessun filtro di portata: il test resta sui contatori.
      user: { findUnique: jest.fn().mockResolvedValue({ role: 'admin' }) },
      staff: { findUnique: jest.fn().mockResolvedValue(null), findFirst: jest.fn().mockResolvedValue(null) },
      coachTask: { count: jest.fn().mockResolvedValue(0) },
      subscription: {
        count: jest.fn(({ where }: { where: { status?: unknown } }) => {
          const ammessi: string[] = (where.status as { in?: string[] })?.in ?? [where.status as string];
          return Promise.resolve(prove.filter((s) => ammessi.includes(s.status)).length);
        }),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    return {
      prisma,
      service: new CoachTasksService(
        prisma as unknown as PrismaService,
        { log: jest.fn() } as never,
        { getNumber: jest.fn(async (_k: string, d?: number) => d ?? 0) } as never,
        { sendToUser: jest.fn() } as never,
      ),
    };
  };

  it('⚠️ la prova che comincia lunedì è già fra le prove attive', async () => {
    const { service } = crea();
    expect((await service.summary('u-admin')).trialsActive).toBe(2);
  });
});
