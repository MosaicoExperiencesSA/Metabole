import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { DietAgentService } from './diet-agent.service';

function make(prisma: Record<string, unknown>) {
  // Default config: pre/post 3, plateau 2, comfortMax 3, reentry 3 (i default reali).
  const config = { getNumber: jest.fn((_k: string, d?: number) => Promise.resolve(d ?? 0)) };
  return new DietAgentService(prisma as unknown as PrismaService, config as unknown as ConfigParamsService);
}

const DAY = 86_400_000;
const ago = (n: number) => new Date(Date.now() - n * DAY);

const base = (over: Record<string, unknown> = {}) => ({
  event: { findFirst: jest.fn().mockResolvedValue(null) },
  cycleFeedback: { findMany: jest.fn().mockResolvedValue([]) },
  dailyCheckin: { findMany: jest.fn().mockResolvedValue([]) },
  ...over,
});

describe('DietAgentService.stateFor', () => {
  it('pre_evento: evento in arrivo', async () => {
    const prisma = base({ event: { findFirst: jest.fn().mockResolvedValue({ id: 'e1' }) } });
    expect(await make(prisma).stateFor('c1')).toBe('pre_evento');
  });

  it('post_evento: evento concluso di recente (pre-evento assente)', async () => {
    // 1a findFirst (pre-evento) → null, 2a (post-evento) → evento concluso.
    const prisma = base({
      event: { findFirst: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'e2' }) },
    });
    expect(await make(prisma).stateFor('c1')).toBe('post_evento');
  });

  it('plateau: ultimi cicli senza calo', async () => {
    const prisma = base({
      cycleFeedback: { findMany: jest.fn().mockResolvedValue([{ esitoPeso: 'stabile' }, { esitoPeso: 'preso' }]) },
    });
    expect(await make(prisma).stateFor('c1')).toBe('plateau');
  });

  it('conforto: umore basso recente sotto la soglia del guardrail', async () => {
    const prisma = base({
      cycleFeedback: { findMany: jest.fn().mockResolvedValue([{ esitoPeso: 'perso' }]) },
      dailyCheckin: { findMany: jest.fn().mockResolvedValue([{ mood: 'hard', date: ago(0) }, { mood: 'hard', date: ago(1) }]) },
    });
    expect(await make(prisma).stateFor('c1')).toBe('conforto');
  });

  it('rientro (guardrail): troppi giorni di conforto di fila → si spinge l\'efficacia', async () => {
    // 4 giorni "difficili" consecutivi > comfortMax (3) → rientro.
    const prisma = base({
      cycleFeedback: { findMany: jest.fn().mockResolvedValue([{ esitoPeso: 'perso' }]) },
      dailyCheckin: {
        findMany: jest.fn().mockResolvedValue([
          { mood: 'hard', date: ago(0) },
          { mood: 'stressed', date: ago(1) },
          { mood: 'hard', date: ago(2) },
          { mood: 'hard', date: ago(3) },
        ]),
      },
    });
    expect(await make(prisma).stateFor('c1')).toBe('rientro');
  });

  it('rientro (recupero): umore risalito dopo un periodo difficile', async () => {
    const prisma = base({
      cycleFeedback: { findMany: jest.fn().mockResolvedValue([{ esitoPeso: 'perso' }]) },
      dailyCheckin: { findMany: jest.fn().mockResolvedValue([{ mood: 'good', date: ago(0) }, { mood: 'hard', date: ago(1) }]) },
    });
    expect(await make(prisma).stateFor('c1')).toBe('rientro');
  });

  it('normale: umore buono senza periodi difficili recenti', async () => {
    const prisma = base({
      cycleFeedback: { findMany: jest.fn().mockResolvedValue([{ esitoPeso: 'perso' }]) },
      dailyCheckin: { findMany: jest.fn().mockResolvedValue([{ mood: 'good', date: ago(0) }, { mood: 'ok', date: ago(1) }]) },
    });
    expect(await make(prisma).stateFor('c1')).toBe('normale');
  });

  it('conforto ignorato se il check-in più recente è vecchio', async () => {
    const prisma = base({
      dailyCheckin: { findMany: jest.fn().mockResolvedValue([{ mood: 'hard', date: ago(5) }]) },
    });
    expect(await make(prisma).stateFor('c1')).toBe('normale');
  });
});
