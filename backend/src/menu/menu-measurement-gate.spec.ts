import { AuditService } from '../audit/audit.service';
import { EventsService } from '../calendar/events.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { MenuService } from './menu.service';

const dayIso = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const D = (iso: string) => new Date(iso + 'T00:00:00.000Z');

function makeService(prisma: unknown) {
  const config = {
    getNumber: jest.fn((k: string) =>
      Promise.resolve(({ menu_days_delivered: 2, menu_visible_days_before_start: 2 } as Record<string, number>)[k]),
    ),
  };
  const audit = { log: jest.fn() };
  const events = { activePausePeriod: jest.fn().mockResolvedValue(null) };
  return new MenuService(
    prisma as PrismaService,
    config as unknown as ConfigParamsService,
    audit as unknown as AuditService,
    events as unknown as EventsService,
  );
}

describe('MenuService — gate misure', () => {
  it('nessun menu erogato → gate non richiesto', async () => {
    const prisma = { menuDay: { findFirst: jest.fn().mockResolvedValue(null) } };
    const res = await makeService(prisma).measurementGate('c1');
    expect(res).toEqual({ required: false, blocking: false, cycleDate: null });
  });

  it('2° giorno del ciclo passato e nessuna misura → bloccante', async () => {
    const prisma = {
      menuDay: { findFirst: jest.fn().mockResolvedValue({ date: D(dayIso(-1)) }) },
      measurement: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const res = await makeService(prisma).measurementGate('c1');
    expect(res.blocking).toBe(true);
    expect(res.cycleDate).toBe(dayIso(-1));
  });

  it('2° giorno del ciclo oggi e nessuna misura → bloccante', async () => {
    const prisma = {
      menuDay: { findFirst: jest.fn().mockResolvedValue({ date: D(dayIso(0)) }) },
      measurement: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const res = await makeService(prisma).measurementGate('c1');
    expect(res.blocking).toBe(true);
  });

  it('2° giorno del ciclo nel futuro → non bloccante', async () => {
    const prisma = {
      menuDay: { findFirst: jest.fn().mockResolvedValue({ date: D(dayIso(1)) }) },
      measurement: { findFirst: jest.fn() },
    };
    const res = await makeService(prisma).measurementGate('c1');
    expect(res.blocking).toBe(false);
    expect(prisma.measurement.findFirst).not.toHaveBeenCalled();
  });

  it('misura del ciclo presente → non bloccante', async () => {
    const prisma = {
      menuDay: { findFirst: jest.fn().mockResolvedValue({ date: D(dayIso(-1)) }) },
      measurement: { findFirst: jest.fn().mockResolvedValue({ id: 'm1' }) },
    };
    const res = await makeService(prisma).measurementGate('c1');
    expect(res.blocking).toBe(false);
  });

  it('erogazione: senza misura del ciclo NON eroga (ciclo successivo "held")', async () => {
    const prisma = {
      clientProfile: {
        findUnique: jest.fn().mockResolvedValue({
          planStartDate: D(dayIso(-3)),
          regime: 'omnivore',
          dietStyle: 'mediterranean',
          mealsPerDay: 5,
        }),
      },
      subscription: { findFirst: jest.fn().mockResolvedValue({ id: 'sub', status: 'active' }) },
      menuDay: { findFirst: jest.fn().mockResolvedValue({ date: D(dayIso(-2)) }) },
      dailyCheckin: { findUnique: jest.fn().mockResolvedValue({ id: 'ck' }) },
      measurement: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const created = await makeService(prisma).deliverIfEligible('c1');
    expect(created).toEqual([]); // held: l'avviso coach lo genera l'Alert engine
  });
});
