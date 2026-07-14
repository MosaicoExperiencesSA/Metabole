import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { EscalationRoutingService } from './escalation-routing.service';

function make(over: { existing?: { id: string } | null; profile?: Record<string, unknown> | null }) {
  const creates: Record<string, unknown>[] = [];
  const prisma = {
    escalation: {
      findFirst: jest.fn().mockResolvedValue(over.existing ?? null),
      create: jest.fn((a: { data: Record<string, unknown> }) => { creates.push(a.data); return Promise.resolve({ id: 'e-new', ...a.data }); }),
    },
    clientProfile: {
      findUnique: jest.fn().mockResolvedValue(over.profile ?? { assignedCoachId: 'coach1', assignedNutritionistId: 'nutri1' }),
    },
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const service = new EscalationRoutingService(prisma as unknown as PrismaService, audit as unknown as AuditService);
  return { service, creates, prisma };
}

describe('EscalationRoutingService.open', () => {
  it('diet_blocked → assegna al nutrizionista della cliente + categoria', async () => {
    const { service, creates } = make({});
    await service.open({ clientId: 'c1', category: 'diet_blocked', reason: 'x' });
    expect(creates).toHaveLength(1);
    expect(creates[0].assignedToId).toBe('nutri1');
    expect(creates[0].category).toBe('diet_blocked');
  });

  it('low_adherence → assegna al coach', async () => {
    const { service, creates } = make({});
    await service.open({ clientId: 'c1', category: 'low_adherence', reason: 'x' });
    expect(creates[0].assignedToId).toBe('coach1');
    expect(creates[0].category).toBe('low_adherence');
  });

  it('mood_risk → coach', async () => {
    const { service, creates } = make({});
    await service.open({ clientId: 'c1', category: 'mood_risk', reason: 'x' });
    expect(creates[0].assignedToId).toBe('coach1');
  });

  it('dedupe: se esiste già una segnalazione aperta della stessa categoria, non ne crea un\'altra', async () => {
    const { service, creates } = make({ existing: { id: 'e-old' } });
    const r = await service.open({ clientId: 'c1', category: 'diet_blocked', reason: 'x' });
    expect(creates).toHaveLength(0);
    expect((r as { id: string }).id).toBe('e-old');
  });

  it('senza staff assegnato resta non assegnata (la vede il pool)', async () => {
    const { service, creates } = make({ profile: { assignedCoachId: null, assignedNutritionistId: null } });
    await service.open({ clientId: 'c1', category: 'clinical', reason: 'x' });
    expect(creates[0].assignedToId).toBeUndefined();
  });
});
