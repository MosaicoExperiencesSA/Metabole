import { CoachTasksService } from './coach-tasks.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * I COMPITI DELLA PROVA NASCONO ANCHE SE LO STATO DICE ANCORA «IN CODA» — voce 258, 19/8.
 *
 * I compiti G0…G7 si contano dal **giorno d'inizio** della prova, quindi arrivano qui solo quando la
 * partenza è già passata (`dayN >= 0`). Se a quel punto lo stato dice ancora `queued`, vuol dire una
 * cosa sola: la promozione notturna è in ritardo — e intanto quella cliente **sta ricevendo i menu**.
 *
 * ⚠️ Guardando il solo `active`, il riquadro in cima alla pagina la contava fra le «prove attive» e
 * la coach non trovava nessuna riga di lavoro. Un numero e una lista che si contraddicono non fanno
 * perdere un compito: fanno smettere di fidarsi di tutti e due.
 *
 * ⚠️ Il finto Prisma qui **filtra come il database vero**: senza, il test passerebbe anche leggendo
 * i soli `active`, cioè non verificherebbe niente.
 */
describe('CoachTasksService.generateDaily — i compiti della prova in coda', () => {
  const giorno = (n: number) => new Date(Date.now() + n * 86_400_000);

  const vuoto = () => ({
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn().mockResolvedValue(null),
    findUnique: jest.fn().mockResolvedValue(null),
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn().mockResolvedValue({ id: 'x' }),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
  });

  /** Una prova cominciata due giorni fa, con lo stato che le si vuole dare. */
  const crea = (statoProva: string) => {
    const prova = {
      id: 'sub-prova',
      clientId: 'c1',
      status: statoProva,
      startDate: giorno(-2),
      endDate: giorno(6),
    };
    const prisma = {
      plan: { findMany: jest.fn().mockResolvedValue([]) },
      subscription: {
        ...vuoto(),
        findMany: jest.fn(({ where }: { where: { plan?: { priceCents?: unknown } } }) => {
          // Solo la domanda sulle PROVE (piani a €0) risponde: le altre tre query di questo giro
          // — piani finiti, scadenze in arrivo, mantenimento — non c'entrano con questo test.
          const chiedeLeProve = (where.plan as { priceCents?: number } | undefined)?.priceCents === 0;
          if (!chiedeLeProve) return Promise.resolve([]);
          const ammessi: string[] = ((where as { status?: { in?: string[] } }).status?.in ?? []) as string[];
          return Promise.resolve(ammessi.includes(prova.status) ? [prova] : []);
        }),
      },
      coachTask: { ...vuoto(), findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 't1' }) },
      measurement: { ...vuoto(), count: jest.fn().mockResolvedValue(0) },
      dailyCheckin: { ...vuoto(), count: jest.fn().mockResolvedValue(0) },
      clientProfile: vuoto(),
      notification: vuoto(),
      analyticsEvent: vuoto(),
      user: vuoto(),
      staff: vuoto(),
      escalation: vuoto(),
    };
    const service = new CoachTasksService(
      prisma as unknown as PrismaService,
      { log: jest.fn().mockResolvedValue(undefined) } as never,
      { getNumber: jest.fn(async (_k: string, d?: number) => d ?? 0) } as never,
      { sendToUser: jest.fn().mockResolvedValue(undefined) } as never,
    );
    return { service, prisma };
  };

  /** I tipi di compito nati in questo giro. */
  const tipiCreati = (prisma: { coachTask: { create: jest.Mock } }) =>
    prisma.coachTask.create.mock.calls.map((c) => c[0].data.kind);

  it('⚠️ una prova partita ma ancora scritta «in coda» genera i suoi compiti', async () => {
    const { service, prisma } = crea('queued');
    await service.generateDaily();
    // Due giorni dopo l'inizio: le misure iniziali (G0) e il benvenuto personale (G1).
    expect(tipiCreati(prisma)).toEqual(expect.arrayContaining(['trial_g0_measures', 'trial_g1_welcome']));
  });

  it('e con lo stato normale li genera come ha sempre fatto', async () => {
    const { service, prisma } = crea('active');
    await service.generateDaily();
    expect(tipiCreati(prisma)).toEqual(expect.arrayContaining(['trial_g0_measures', 'trial_g1_welcome']));
  });

  /** ⚠️ Ma una prova che comincia DOMANI non genera niente: i compiti si contano dall'inizio. */
  it('⚠️ la prova che deve ancora cominciare non apre nessun compito', async () => {
    const { service, prisma } = crea('queued');
    prisma.subscription.findMany.mockImplementation(({ where }: { where: { plan?: { priceCents?: unknown } } }) =>
      Promise.resolve(
        (where.plan as { priceCents?: number } | undefined)?.priceCents === 0
          ? [{ id: 'sub-prova', clientId: 'c1', status: 'queued', startDate: giorno(1), endDate: giorno(9) }]
          : [],
      ),
    );
    await service.generateDaily();
    expect(tipiCreati(prisma)).toEqual([]);
  });
});
