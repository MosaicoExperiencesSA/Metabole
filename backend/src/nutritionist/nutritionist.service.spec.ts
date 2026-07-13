import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { NutritionistService } from './nutritionist.service';

const D = (iso: string) => new Date(iso + 'T00:00:00.000Z');
const user = { sub: 'u-nut', role: 'nutritionist' } as AuthUser;

const make = (prisma: Record<string, unknown>) => new NutritionistService(prisma as unknown as PrismaService);

describe('NutritionistService.patients', () => {
  it('elenca i pazienti con riepilogo e ordina per attenzione', async () => {
    const prisma = {
      staff: { findUnique: jest.fn().mockResolvedValue({ id: 'nut-1' }) },
      clientProfile: {
        findMany: jest.fn().mockResolvedValue([
          { userId: 'p1', name: 'Anna' },
          { userId: 'p2', name: 'Bea' },
        ]),
      },
      measurement: { findMany: jest.fn().mockResolvedValue([{ clientId: 'p1', date: D('2026-07-10') }]) },
      escalation: { findMany: jest.fn().mockResolvedValue([{ clientId: 'p2' }]) },
      document: { findMany: jest.fn().mockResolvedValue([{ clientId: 'p2' }, { clientId: 'p2' }]) },
      visit: { findMany: jest.fn().mockResolvedValue([{ clientId: 'p1', datetime: D('2026-07-20'), type: 'televisit' }]) },
    };
    const res = (await make(prisma).patients(user)) as { patients: { clientId: string; pendingDocuments: number; nextVisit: unknown }[] };
    expect(res.patients).toHaveLength(2);
    expect(res.patients[0].clientId).toBe('p2'); // 1 escalation + 2 documenti → in cima
    expect(res.patients.find((p) => p.clientId === 'p1')!.nextVisit).not.toBeNull();
  });

  it('nessuno staff → lista vuota', async () => {
    const prisma = { staff: { findUnique: jest.fn().mockResolvedValue(null) } };
    expect(await make(prisma).patients(user)).toEqual({ patients: [] });
  });
});

describe('NutritionistService.dashboard', () => {
  it('compone conteggi clinici e guadagni', async () => {
    const prisma = {
      staff: { findUnique: jest.fn().mockResolvedValue({ id: 'nut-1' }) },
      clientProfile: { findMany: jest.fn().mockResolvedValue([{ userId: 'p1', name: 'Anna' }, { userId: 'p2', name: 'Bea' }]) },
      document: { count: jest.fn().mockResolvedValue(3) },
      escalation: { count: jest.fn().mockResolvedValue(1) },
      engineDecision: { count: jest.fn().mockResolvedValue(2) },
      visit: { count: jest.fn().mockResolvedValue(4) },
      ledgerEntry: {
        aggregate: jest.fn().mockResolvedValueOnce({ _sum: { amountCents: 2000 } }).mockResolvedValueOnce({ _sum: { amountCents: 9000 } }),
      },
    };
    const res = (await make(prisma).dashboard(user)) as Record<string, number | boolean>;
    expect(res.isNutritionist).toBe(true);
    expect(res.patientsCount).toBe(2);
    expect(res.pendingDocuments).toBe(3);
    expect(res.openEscalations).toBe(1);
    expect(res.protocolsToValidate).toBe(2);
    expect(res.upcomingVisits).toBe(4);
    expect(res.earningsMonthCents).toBe(2000);
    expect(res.earningsTotalCents).toBe(9000);
  });

  it('nessuno staff → isNutritionist false', async () => {
    const prisma = { staff: { findUnique: jest.fn().mockResolvedValue(null) } };
    expect(await make(prisma).dashboard(user)).toEqual({ isNutritionist: false });
  });
});
