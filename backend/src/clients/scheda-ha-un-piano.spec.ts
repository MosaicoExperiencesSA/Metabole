import { ClientsService } from './clients.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * LA PASTIGLIA «NESSUN PIANO ATTIVO» SU CHI HA APPENA PAGATO — voce 258, 19/8.
 *
 * ⚠️ Nelle schermate dello staff un piano in coda conta come «ha un piano»: è la decisione del 17/8
 * scritta in testa a `stati-abbonamento.ts`. Con il confronto vecchio (`status === 'active'`), da
 * quando la coda si scrive `queued` la scheda di una cliente il cui piano parte lunedì mostrava la
 * pastiglia arancione «Nessun piano attivo» — ed è la riga che fa richiamare qualcuno per
 * rivenderle quello che ha già comprato.
 */
describe('ClientsService.getDetail — chi ha comprato ha un piano', () => {
  const vuoto = () => ({
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn().mockResolvedValue(null),
    findUnique: jest.fn().mockResolvedValue(null),
    count: jest.fn().mockResolvedValue(0),
  });

  const fra = (giorni: number) => new Date(Date.now() + giorni * 86_400_000);

  const conAbbonamenti = (subs: unknown[]) => {
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'c1', email: 'g@x.it', role: 'client', createdAt: new Date() }),
        // `assertClientAccess`: un admin vede tutte le schede, così il test resta sui piani.
        findUnique: jest.fn().mockResolvedValue({ role: 'admin' }),
      },
      clientProfile: vuoto(),
      objective: vuoto(),
      measurement: vuoto(),
      dailyCheckin: vuoto(),
      waterLog: vuoto(),
      stepLog: vuoto(),
      subscription: { ...vuoto(), findMany: jest.fn().mockResolvedValue(subs) },
      payment: vuoto(),
      crmRecord: vuoto(),
      clientNote: vuoto(),
      pendingCommission: vuoto(),
      pipelineStage: vuoto(),
      menuDay: vuoto(),
      diet: vuoto(),
      staff: vuoto(),
      auditLog: vuoto(),
    };
    return new ClientsService(
      prisma as unknown as PrismaService,
      {} as never,
      { log: jest.fn().mockResolvedValue(undefined) } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      // ⚠️ `PauseService`: la modalità viaggio sospende davvero (23/8). Non è l'oggetto di questi test.
      {} as never,
    );
  };

  const piano = (status: string, startDate: Date, endDate: Date) => ({
    id: 's1',
    status,
    startDate,
    endDate,
    createdAt: new Date(),
    plan: { name: '3 mesi', period: '3m', priceCents: 29700 },
  });

  it('⚠️ con il solo piano IN CODA la scheda NON dice «nessun piano attivo»', async () => {
    const service = conAbbonamenti([piano('queued', fra(7), fra(97))]);
    const scheda = (await service.getDetail('c1', 'admin')) as unknown as { hasActivePlan: boolean };
    expect(scheda.hasActivePlan).toBe(true);
  });

  /** Col solo piano scaduto invece sì: quella è una cliente da richiamare davvero. */
  it('col solo piano scaduto la pastiglia resta, ed è giusto', async () => {
    const service = conAbbonamenti([piano('expired', fra(-120), fra(-30))]);
    const scheda = (await service.getDetail('c1', 'admin')) as unknown as { hasActivePlan: boolean };
    expect(scheda.hasActivePlan).toBe(false);
  });
});
