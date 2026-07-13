import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { EngineService } from '../engine/engine.service';
import { NutritionistService } from './nutritionist.service';

const D = (iso: string) => new Date(iso + 'T00:00:00.000Z');
const user = { sub: 'u-nut', role: 'nutritionist' } as AuthUser;
const head = { sub: 'u-head', role: 'head_nutritionist' } as AuthUser;

const makeEngine = (over: Partial<EngineService> = {}) => ({ reviewDecision: jest.fn().mockResolvedValue({ id: 'd1' }), ...over }) as unknown as EngineService;
const make = (prisma: Record<string, unknown>, engine: EngineService = makeEngine()) =>
  new NutritionistService(prisma as unknown as PrismaService, engine);

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

describe('NutritionistService.validationQueue', () => {
  it('nutrizionista: solo decisioni dei propri pazienti + protocolli altrui (no diete)', async () => {
    const engineDecisionFindMany = jest.fn().mockResolvedValue([
      { id: 'dec1', clientId: 'p1', date: D('2026-07-12'), flagReason: 'fuori range', action: { note: 'x' }, rule: { id: 'r1', name: 'Soglia' } },
    ]);
    const prisma = {
      staff: { findUnique: jest.fn().mockResolvedValue({ id: 'nut-1' }) },
      clientProfile: { findMany: jest.fn().mockResolvedValue([{ userId: 'p1', name: 'Anna' }]) },
      engineDecision: { findMany: engineDecisionFindMany },
      diet: { findMany: jest.fn().mockResolvedValue([]) },
      protocol: { findMany: jest.fn().mockResolvedValue([{ id: 'pr1', name: 'Menu corr', type: 'menu_correction', updatedAt: D('2026-07-10') }]) },
    };
    const res = await make(prisma).validationQueue(user);
    // le decisioni sono filtrate sui pazienti assegnati
    expect(engineDecisionFindMany.mock.calls[0][0].where.clientId).toEqual({ in: ['p1'] });
    expect(res.engineDecisions).toHaveLength(1);
    expect((res.engineDecisions[0] as { patientName: string }).patientName).toBe('Anna');
    expect(res.dietsInReview).toHaveLength(0); // il nutrizionista non approva diete
    expect(res.protocolsPending).toHaveLength(1);
    expect(res.counts).toEqual({ engineDecisions: 1, dietsInReview: 0, protocolsPending: 1 });
  });

  it('nutrizionista senza pazienti → nessuna query globale sulle decisioni', async () => {
    const engineDecisionFindMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      staff: { findUnique: jest.fn().mockResolvedValue({ id: 'nut-1' }) },
      clientProfile: { findMany: jest.fn().mockResolvedValue([]) },
      engineDecision: { findMany: engineDecisionFindMany },
      diet: { findMany: jest.fn().mockResolvedValue([]) },
      protocol: { findMany: jest.fn().mockResolvedValue([]) },
    };
    await make(prisma).validationQueue(user);
    expect(engineDecisionFindMany.mock.calls[0][0].where.clientId).toEqual({ in: ['__none__'] });
  });

  it('capo: vede tutte le decisioni flaggate + diete in revisione', async () => {
    const engineDecisionFindMany = jest.fn().mockResolvedValue([
      { id: 'dec1', clientId: 'p9', date: D('2026-07-12'), flagReason: null, action: {}, rule: null },
    ]);
    const prisma = {
      staff: { findUnique: jest.fn().mockResolvedValue({ id: 'head-1' }) },
      clientProfile: { findMany: jest.fn().mockResolvedValue([{ userId: 'p9', name: 'Zoe' }]) },
      engineDecision: { findMany: engineDecisionFindMany },
      diet: { findMany: jest.fn().mockResolvedValue([{ id: 'di1', name: 'Mediterranea', regime: 'omnivore', style: 'mediterranean', updatedAt: D('2026-07-11') }]) },
      protocol: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const res = await make(prisma).validationQueue(head);
    // il capo non filtra per paziente (nessun clientId nel where)
    expect(engineDecisionFindMany.mock.calls[0][0].where.clientId).toBeUndefined();
    expect(res.dietsInReview).toHaveLength(1);
    expect((res.engineDecisions[0] as { patientName: string }).patientName).toBe('Zoe');
  });
});

describe('NutritionistService.reviewDecision (scoping per-paziente)', () => {
  it('nutrizionista: rifiuta la revisione se il paziente non è assegnato', async () => {
    const engine = makeEngine();
    const prisma = {
      staff: { findUnique: jest.fn().mockResolvedValue({ id: 'nut-1' }) },
      engineDecision: { findUnique: jest.fn().mockResolvedValue({ id: 'dec1', clientId: 'p-altrui' }) },
      clientProfile: { findUnique: jest.fn().mockResolvedValue({ assignedNutritionistId: 'nut-2' }) },
    };
    await expect(make(prisma, engine).reviewDecision(user, 'dec1', 'confirmed')).rejects.toThrow('non assegnato');
    expect(engine.reviewDecision).not.toHaveBeenCalled();
  });

  it('nutrizionista: revisiona il proprio paziente → delega al motore', async () => {
    const engine = makeEngine();
    const prisma = {
      staff: { findUnique: jest.fn().mockResolvedValue({ id: 'nut-1' }) },
      engineDecision: { findUnique: jest.fn().mockResolvedValue({ id: 'dec1', clientId: 'p1' }) },
      clientProfile: { findUnique: jest.fn().mockResolvedValue({ assignedNutritionistId: 'nut-1' }) },
    };
    await make(prisma, engine).reviewDecision(user, 'dec1', 'corrected', 'nota');
    expect(engine.reviewDecision).toHaveBeenCalledWith('u-nut', 'dec1', 'corrected', 'nota');
  });

  it('capo: revisiona qualsiasi paziente senza controllo di assegnazione', async () => {
    const engine = makeEngine();
    const prisma = {
      engineDecision: { findUnique: jest.fn().mockResolvedValue({ id: 'dec1', clientId: 'p-qualsiasi' }) },
    };
    await make(prisma, engine).reviewDecision(head, 'dec1', 'confirmed');
    expect(engine.reviewDecision).toHaveBeenCalled();
  });

  it('decisione inesistente → 404', async () => {
    const prisma = { engineDecision: { findUnique: jest.fn().mockResolvedValue(null) } };
    await expect(make(prisma).reviewDecision(user, 'x', 'confirmed')).rejects.toThrow('non trovata');
  });
});
