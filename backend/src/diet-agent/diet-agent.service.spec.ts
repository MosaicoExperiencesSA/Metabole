import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { DietAgentService } from './diet-agent.service';

function make(prisma: Record<string, unknown>) {
  const config = { getNumber: jest.fn((_k: string, d?: number) => Promise.resolve(d ?? 0)) };
  return new DietAgentService(prisma as unknown as PrismaService, config as unknown as ConfigParamsService);
}

const base = (over: Record<string, unknown> = {}) => ({
  event: { findFirst: jest.fn().mockResolvedValue(null) },
  cycleFeedback: { findMany: jest.fn().mockResolvedValue([]) },
  dailyCheckin: { findFirst: jest.fn().mockResolvedValue(null) },
  ...over,
});

describe('DietAgentService.stateFor', () => {
  it('pre_evento: evento in arrivo', async () => {
    const prisma = base({ event: { findFirst: jest.fn().mockResolvedValue({ id: 'e1' }) } });
    expect(await make(prisma).stateFor('c1')).toBe('pre_evento');
  });

  it('plateau: ultimi cicli senza calo', async () => {
    const prisma = base({
      cycleFeedback: { findMany: jest.fn().mockResolvedValue([{ esitoPeso: 'stabile' }, { esitoPeso: 'preso' }]) },
    });
    expect(await make(prisma).stateFor('c1')).toBe('plateau');
  });

  it('conforto: umore basso recente', async () => {
    const prisma = base({
      cycleFeedback: { findMany: jest.fn().mockResolvedValue([{ esitoPeso: 'perso' }]) },
      dailyCheckin: { findFirst: jest.fn().mockResolvedValue({ mood: 'hard', date: new Date() }) },
    });
    expect(await make(prisma).stateFor('c1')).toBe('conforto');
  });

  it('normale: nessun trigger', async () => {
    const prisma = base({
      cycleFeedback: { findMany: jest.fn().mockResolvedValue([{ esitoPeso: 'perso' }]) },
      dailyCheckin: { findFirst: jest.fn().mockResolvedValue({ mood: 'good', date: new Date() }) },
    });
    expect(await make(prisma).stateFor('c1')).toBe('normale');
  });

  it('conforto ignorato se il check-in è vecchio', async () => {
    const old = new Date(Date.now() - 5 * 86_400_000);
    const prisma = base({ dailyCheckin: { findFirst: jest.fn().mockResolvedValue({ mood: 'hard', date: old }) } });
    expect(await make(prisma).stateFor('c1')).toBe('normale');
  });
});
