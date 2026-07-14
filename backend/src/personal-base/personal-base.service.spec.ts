import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { PersonalBaseService } from './personal-base.service';

// Ricette "sicure" abbondanti per i 3 pasti principali (5 per slot).
function bigPool() {
  const slots = ['breakfast', 'lunch', 'dinner'];
  const recipes: Record<string, unknown>[] = [];
  for (const slot of slots) {
    for (let i = 0; i < 5; i++) {
      recipes.push({
        id: `${slot}-${i}`,
        mealSlot: slot,
        regime: 'omnivore',
        allergens: [],
        allergensReviewed: true,
      });
    }
  }
  return recipes;
}

function make(over: {
  profile?: Record<string, unknown> | null;
  diet?: Record<string, unknown> | null;
  recipes?: Record<string, unknown>[];
  minPerSlot?: number;
  openBlock?: { id: string } | null;
}) {
  const created: Record<string, unknown>[] = [];
  const escalations: Record<string, unknown>[] = [];
  const resolved: { count: number } = { count: 0 };
  const prisma = {
    clientProfile: { findUnique: jest.fn().mockResolvedValue(over.profile ?? null) },
    diet: { findFirst: jest.fn().mockResolvedValue(over.diet === undefined ? { id: 'diet1' } : over.diet) },
    dietDayTemplate: {
      findMany: jest.fn().mockResolvedValue([
        { meals: (over.recipes ?? bigPool()).map((r) => ({ slot: r.mealSlot, recipeId: r.id })) },
      ]),
    },
    recipe: { findMany: jest.fn().mockResolvedValue(over.recipes ?? bigPool()) },
    clientMenuPool: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn((args: { data: Record<string, unknown> }) => {
        created.push(args.data);
        return Promise.resolve(args.data);
      }),
    },
    escalation: {
      findFirst: jest.fn().mockResolvedValue(over.openBlock ?? null),
      create: jest.fn((args: { data: Record<string, unknown> }) => {
        escalations.push(args.data);
        return Promise.resolve(args.data);
      }),
      updateMany: jest.fn(() => {
        resolved.count++;
        return Promise.resolve({ count: 1 });
      }),
    },
  };
  const config = {
    getNumber: jest.fn((_k: string, d?: number) => Promise.resolve(over.minPerSlot ?? d ?? 3)),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const service = new PersonalBaseService(
    prisma as unknown as PrismaService,
    config as unknown as ConfigParamsService,
    audit as unknown as AuditService,
  );
  return { service, created, escalations, resolved };
}

const PROFILE = {
  regime: 'omnivore',
  dietStyle: 'mediterranean',
  mealsPerDay: 3,
  allergies: [],
  assignedNutritionistId: 'nutri1',
};

describe('PersonalBaseService.buildPersonalBase', () => {
  it('certifica la base quando ogni pasto principale ha abbastanza ricette sicure', async () => {
    const { service, created } = make({ profile: { ...PROFILE } });
    const res = await service.buildPersonalBase('c1');
    expect(res.status).toBe('ready');
    expect(res.totalSafe).toBe(15);
    expect(res.perSlot).toEqual({ breakfast: 5, lunch: 5, dinner: 5 });
    expect(created).toHaveLength(1);
  });

  it('esclude le ricette che contengono un allergene codificato del cliente', async () => {
    const pool = bigPool();
    // Rendo 3 pranzi non sicuri (contengono "latte") → sotto la soglia 3.
    (pool.filter((r) => r.mealSlot === 'lunch').slice(0, 3)).forEach((r) => (r.allergens = ['latte']));
    const { service, escalations } = make({
      profile: { ...PROFILE, allergies: ['latte'] },
      recipes: pool,
    });
    const res = await service.buildPersonalBase('c1');
    expect(res.status).toBe('blocked');
    expect(escalations).toHaveLength(1);
  });

  it('blocca se il cliente ha un’allergia fuori dai 14 codici UE (testo libero)', async () => {
    const { service, escalations } = make({
      profile: { ...PROFILE, allergies: ['fragole'] },
    });
    const res = await service.buildPersonalBase('c1');
    expect(res.status).toBe('blocked');
    expect(res.reasons?.some((r) => r.includes('codificare'))).toBe(true);
    expect(escalations).toHaveLength(1);
  });

  it('non considera sicure le ricette non ancora confermate dal nutrizionista', async () => {
    const pool = bigPool().map((r) => ({ ...r, allergensReviewed: false }));
    const { service, escalations } = make({ profile: { ...PROFILE }, recipes: pool });
    const res = await service.buildPersonalBase('c1');
    expect(res.status).toBe('blocked');
    expect(escalations).toHaveLength(1);
  });

  it('blocca (senza duplicare la segnalazione) se una segnalazione è già aperta', async () => {
    const { service, escalations } = make({
      profile: { ...PROFILE, allergies: ['fragole'] },
      openBlock: { id: 'esc1' },
    });
    const res = await service.buildPersonalBase('c1');
    expect(res.status).toBe('blocked');
    expect(escalations).toHaveLength(0); // non ricrea l'escalation
  });

  it('blocca se non esiste un prodotto compatibile', async () => {
    const { service } = make({ profile: { ...PROFILE }, diet: null });
    const res = await service.buildPersonalBase('c1');
    expect(res.status).toBe('blocked');
    expect(res.reasons?.some((r) => r.includes('nessun prodotto'))).toBe(true);
  });

  it('chiude le segnalazioni aperte quando la base torna certificabile', async () => {
    const { service, resolved } = make({ profile: { ...PROFILE } });
    await service.buildPersonalBase('c1');
    expect(resolved.count).toBe(1);
  });
});
