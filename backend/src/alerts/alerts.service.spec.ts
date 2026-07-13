import { ForbiddenException } from '@nestjs/common';
import { ConfigParamsService } from '../config-params/config-params.service';
import { MenuService } from '../menu/menu.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { AlertsService } from './alerts.service';

const dayIso = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const D = (iso: string) => new Date(iso + 'T00:00:00.000Z');

interface PrismaMock {
  clientProfile: { findUnique: jest.Mock; findMany: jest.Mock };
  measurement: { findMany: jest.Mock };
  dailyCheckin: { findMany: jest.Mock };
  recipeRating: { findMany: jest.Mock };
  waterLog: { findMany: jest.Mock };
  event: { findFirst: jest.Mock };
  escalation: { findFirst: jest.Mock };
  milestone: { findFirst: jest.Mock };
  analyticsEvent: { findFirst: jest.Mock };
  staff: { findUnique: jest.Mock };
  alert: { findMany: jest.Mock; createMany: jest.Mock; updateMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
}

function basePrisma(over: Partial<Record<string, unknown>> = {}): PrismaMock {
  return {
    clientProfile: {
      findUnique: jest.fn().mockResolvedValue({ assignedCoachId: 'coach-1', character: 'follows', planStartDate: D(dayIso(-10)) }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    measurement: { findMany: jest.fn().mockResolvedValue([]) },
    dailyCheckin: { findMany: jest.fn().mockResolvedValue([]) },
    recipeRating: { findMany: jest.fn().mockResolvedValue([]) },
    waterLog: { findMany: jest.fn().mockResolvedValue([]) },
    event: { findFirst: jest.fn().mockResolvedValue(null) },
    escalation: { findFirst: jest.fn().mockResolvedValue(null) },
    milestone: { findFirst: jest.fn().mockResolvedValue(null) },
    analyticsEvent: { findFirst: jest.fn().mockResolvedValue(null) },
    staff: { findUnique: jest.fn().mockResolvedValue({ id: 'coach-1' }) },
    alert: {
      findMany: jest.fn().mockResolvedValue([]),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    ...(over as Record<string, never>),
  } as PrismaMock;
}

function makeService(prisma: PrismaMock, gate = { blocking: false, cycleDate: null as string | null }) {
  const config = { getNumber: jest.fn((_k: string, d?: number) => Promise.resolve(d ?? 0)) };
  const menu = { measurementGate: jest.fn().mockResolvedValue({ required: gate.blocking, blocking: gate.blocking, cycleDate: gate.cycleDate }) };
  return new AlertsService(
    prisma as unknown as PrismaService,
    config as unknown as ConfigParamsService,
    menu as unknown as MenuService,
  );
}

const createdTypes = (prisma: PrismaMock): string[] => {
  const call = prisma.alert.createMany.mock.calls[0];
  return call ? (call[0].data as { type: string }[]).map((d) => d.type) : [];
};

describe('AlertsService.recompute', () => {
  it('crea missing_measurements quando il gate blocca', async () => {
    const prisma = basePrisma();
    const svc = makeService(prisma, { blocking: true, cycleDate: dayIso(-1) });
    const res = await svc.recompute('c1');
    expect(createdTypes(prisma)).toContain('missing_measurements');
    expect(prisma.alert.createMany.mock.calls[0][0].data[0].coachId).toBe('coach-1');
    expect(res.resolved).toBe(0);
  });

  it('rileva aumento di peso negli ultimi giorni', async () => {
    const prisma = basePrisma();
    prisma.measurement.findMany.mockResolvedValue([
      { date: D(dayIso(-5)), weightKg: 70 },
      { date: D(dayIso(-1)), weightKg: 71.2 },
    ]);
    const svc = makeService(prisma); // getNumber restituisce il default (weightGainDays=7)
    await svc.recompute('c1');
    expect(createdTypes(prisma)).toContain('weight_gain');
  });

  it('segnala inattività se non ci sono attività da N giorni', async () => {
    const prisma = basePrisma();
    prisma.analyticsEvent.findFirst.mockResolvedValue({ receivedAt: D(dayIso(-10)) });
    const svc = makeService(prisma);
    await svc.recompute('c1');
    expect(createdTypes(prisma)).toContain('inactive');
  });

  it('rischio abbandono: umore basso ripetuto + carattere quits', async () => {
    const prisma = basePrisma();
    prisma.clientProfile.findUnique.mockResolvedValue({ assignedCoachId: 'coach-1', character: 'quits', planStartDate: D(dayIso(-10)) });
    prisma.dailyCheckin.findMany.mockResolvedValue([
      { date: D(dayIso(0)), mood: 'hard' },
      { date: D(dayIso(-1)), mood: 'stressed' },
    ]);
    // attività recente → non "inactive"
    prisma.analyticsEvent.findFirst.mockResolvedValue({ receivedAt: D(dayIso(0)) });
    const svc = makeService(prisma);
    await svc.recompute('c1');
    expect(createdTypes(prisma)).toContain('dropout_risk');
  });

  it('risolve gli alert la cui condizione non vale più', async () => {
    const prisma = basePrisma();
    prisma.alert.findMany.mockResolvedValue([{ id: 'a1', type: 'plateau' }]);
    const svc = makeService(prisma); // nessun segnale → desired vuoto
    const res = await svc.recompute('c1');
    expect(prisma.alert.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['a1'] } }, data: { status: 'resolved' } });
    expect(res.resolved).toBe(1);
    expect(prisma.alert.createMany).not.toHaveBeenCalled();
  });

  it('non ricrea un alert già attivo (idempotente)', async () => {
    const prisma = basePrisma();
    prisma.alert.findMany.mockResolvedValue([{ id: 'a1', type: 'missing_measurements' }]);
    const svc = makeService(prisma, { blocking: true, cycleDate: dayIso(-1) });
    await svc.recompute('c1');
    expect(prisma.alert.createMany).not.toHaveBeenCalled();
    expect(prisma.alert.updateMany).not.toHaveBeenCalled();
  });
});

describe('AlertsService.updateStatus', () => {
  const coachUser = { sub: 'u-coach', role: 'coach' } as AuthUser;

  it('la coach proprietaria può gestire l alert', async () => {
    const prisma = basePrisma();
    prisma.alert.findUnique.mockResolvedValue({ id: 'a1', coachId: 'coach-1' });
    prisma.staff.findUnique.mockResolvedValue({ id: 'coach-1' });
    const svc = makeService(prisma);
    await svc.updateStatus('a1', coachUser, 'handled');
    expect(prisma.alert.update).toHaveBeenCalledWith({ where: { id: 'a1' }, data: { status: 'handled' } });
  });

  it('una coach non proprietaria è bloccata', async () => {
    const prisma = basePrisma();
    prisma.alert.findUnique.mockResolvedValue({ id: 'a1', coachId: 'coach-2' });
    prisma.staff.findUnique.mockResolvedValue({ id: 'coach-1' });
    const svc = makeService(prisma);
    await expect(svc.updateStatus('a1', coachUser, 'handled')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
