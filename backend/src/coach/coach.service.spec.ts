import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { CoachService } from './coach.service';

const D = (iso: string) => new Date(iso + 'T00:00:00.000Z');
const user = { sub: 'u-coach', role: 'coach' } as AuthUser;

function makeService(prisma: Record<string, unknown>, expiringDays = 14) {
  const config = { getNumber: jest.fn().mockResolvedValue(expiringDays) };
  return new CoachService(prisma as unknown as PrismaService, config as unknown as ConfigParamsService);
}

describe('CoachService.clients', () => {
  it('elenca solo le clienti della coach con riepilogo e ordina per alert', async () => {
    const prisma = {
      staff: { findUnique: jest.fn().mockResolvedValue({ id: 'coach-1' }) },
      clientProfile: {
        findMany: jest.fn().mockResolvedValue([
          { userId: 'c1', name: 'Anna', planStartDate: D('2026-07-01') },
          { userId: 'c2', name: 'Bea', planStartDate: null },
        ]),
      },
      subscription: { findMany: jest.fn().mockResolvedValue([{ clientId: 'c1', status: 'active', endDate: D('2026-08-01') }]) },
      measurement: { findMany: jest.fn().mockResolvedValue([{ clientId: 'c1', date: D('2026-07-10'), weightKg: 70 }]) },
      alert: { findMany: jest.fn().mockResolvedValue([{ clientId: 'c2' }, { clientId: 'c2' }]) },
    };
    const res = (await makeService(prisma).clients(user)) as { clients: { clientId: string; openAlerts: number; planActive: boolean }[] };
    expect(res.clients).toHaveLength(2);
    expect(res.clients[0].clientId).toBe('c2'); // più alert → primo
    expect(res.clients[0].openAlerts).toBe(2);
    const anna = res.clients.find((c) => c.clientId === 'c1')!;
    expect(anna.planActive).toBe(true);
  });

  it('nessuno staff → lista vuota', async () => {
    const prisma = { staff: { findUnique: jest.fn().mockResolvedValue(null) } };
    const res = await makeService(prisma).clients(user);
    expect(res).toEqual({ clients: [] });
  });
});

describe('CoachService.dashboard', () => {
  it('compone conteggi, piani in scadenza e guadagni', async () => {
    const prisma = {
      staff: { findUnique: jest.fn().mockResolvedValue({ id: 'coach-1' }) },
      clientProfile: { count: jest.fn().mockResolvedValue(5) },
      subscription: {
        findMany: jest.fn().mockResolvedValue([
          { clientId: 'c1', endDate: D('2026-07-20'), client: { clientProfile: { name: 'Anna' } } },
        ]),
      },
      alert: { count: jest.fn().mockResolvedValue(3) },
      ledgerEntry: {
        aggregate: jest
          .fn()
          .mockResolvedValueOnce({ _sum: { amountCents: 1000 } }) // mese
          .mockResolvedValueOnce({ _sum: { amountCents: 5000 } }), // totale
      },
    };
    const res = (await makeService(prisma).dashboard(user)) as {
      isCoach: boolean;
      clientsCount: number;
      openAlerts: number;
      earningsMonthCents: number;
      earningsTotalCents: number;
      expiringPlans: unknown[];
    };
    expect(res.isCoach).toBe(true);
    expect(res.clientsCount).toBe(5);
    expect(res.openAlerts).toBe(3);
    expect(res.earningsMonthCents).toBe(1000);
    expect(res.earningsTotalCents).toBe(5000);
    expect(res.expiringPlans).toHaveLength(1);
  });

  it('nessuno staff → isCoach false', async () => {
    const prisma = { staff: { findUnique: jest.fn().mockResolvedValue(null) } };
    const res = await makeService(prisma).dashboard(user);
    expect(res).toEqual({ isCoach: false });
  });
});
