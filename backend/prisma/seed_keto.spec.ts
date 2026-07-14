import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { seedKetoCatalog } from './seed_keto';

/**
 * Test di verifica del caricamento della base Keto nel motore.
 * - integrità del catalogo dati (keto_catalog.json)
 * - creazione: crea le ricette + la dieta keto con le giornate
 * - idempotenza: se il catalogo keto è già popolato, non fa nulla
 *
 * Usa un finto PrismaClient in memoria (nessun DB reale).
 */

type AnyRec = Record<string, unknown>;

function loadCatalog(): AnyRec {
  return JSON.parse(
    readFileSync(join(__dirname, 'data', 'keto_catalog.json'), 'utf8'),
  );
}

/** Finto Prisma: tiene recipe/diet/dayTemplate in array. */
function makeFakePrisma(seededDiet?: { dayTemplates: number }) {
  const recipes: AnyRec[] = [];
  const diets: AnyRec[] = [];
  const dayTemplates: AnyRec[] = [];
  if (seededDiet) {
    diets.push({ id: 'keto-existing', style: 'keto' });
    for (let i = 0; i < seededDiet.dayTemplates; i++)
      dayTemplates.push({ dietId: 'keto-existing' });
  }
  const prisma = {
    recipe: {
      findFirst: async ({ where }: AnyRec) =>
        recipes.find(
          (r) =>
            r.name === (where as AnyRec).name &&
            r.mealSlot === (where as AnyRec).mealSlot &&
            r.regime === (where as AnyRec).regime,
        ) ?? null,
      create: async ({ data }: AnyRec) => {
        const row = { id: `r${recipes.length + 1}`, ...(data as AnyRec) };
        recipes.push(row);
        return row;
      },
    },
    diet: {
      findFirst: async ({ where }: AnyRec) => {
        const d = diets.find((x) => x.style === (where as AnyRec).style);
        if (!d) return null;
        return {
          ...d,
          _count: {
            dayTemplates: dayTemplates.filter((t) => t.dietId === d.id).length,
          },
        };
      },
      create: async ({ data }: AnyRec) => {
        const id = 'keto-new';
        diets.push({ id, style: (data as AnyRec).style });
        const dts = ((data as AnyRec).dayTemplates as AnyRec)?.create as AnyRec[];
        (dts ?? []).forEach((t) => dayTemplates.push({ ...t, dietId: id }));
        return { id };
      },
      update: async ({ where, data }: AnyRec) => {
        const dts = ((data as AnyRec).dayTemplates as AnyRec)?.create as AnyRec[];
        (dts ?? []).forEach((t) =>
          dayTemplates.push({ ...t, dietId: (where as AnyRec).id }),
        );
        return { id: (where as AnyRec).id };
      },
    },
    _state: { recipes, diets, dayTemplates },
  };
  return prisma;
}

describe('seedKetoCatalog', () => {
  it('il catalogo dati è integro (118 ricette, giornate valide)', () => {
    const cat = loadCatalog() as AnyRec;
    const recipes = cat.recipes as AnyRec[];
    const days = cat.dayTemplates as AnyRec[];

    expect(recipes.length).toBe(118);
    // conteggi per pasto
    const bySlot: Record<string, number> = {};
    for (const r of recipes) bySlot[r.mealSlot as string] = (bySlot[r.mealSlot as string] ?? 0) + 1;
    expect(bySlot).toEqual({
      breakfast: 28,
      lunch: 32,
      dinner: 31,
      morning_snack: 21,
      afternoon_snack: 6,
    });
    // campi minimi + tag keto + kcal valida
    for (const r of recipes) {
      expect(typeof r.name).toBe('string');
      expect((r.tags as string[]).includes('keto')).toBe(true);
      expect(r.kcal as number).toBeGreaterThan(0);
    }
    // nomi unici
    const names = new Set(recipes.map((r) => r.name));
    expect(names.size).toBe(recipes.length);
    // giornate: 5 pasti, riferimenti risolvibili, totale in range keto
    expect(days.length).toBeGreaterThanOrEqual(7);
    for (const d of days) {
      const meals = d.meals as AnyRec[];
      expect(meals.length).toBe(5);
      for (const m of meals) expect(names.has(m.name as string)).toBe(true);
      expect(d.kcalTotal as number).toBeGreaterThanOrEqual(1200);
      expect(d.kcalTotal as number).toBeLessThanOrEqual(1750);
    }
  });

  it('creazione: inserisce ricette + dieta keto con le giornate', async () => {
    const prisma = makeFakePrisma(); // catalogo vuoto
    await seedKetoCatalog(prisma as never);
    const cat = loadCatalog() as AnyRec;
    expect(prisma._state.recipes.length).toBe((cat.recipes as AnyRec[]).length);
    expect(prisma._state.diets.some((d) => d.style === 'keto')).toBe(true);
    expect(prisma._state.dayTemplates.length).toBe((cat.dayTemplates as AnyRec[]).length);
  });

  it('idempotenza: se la dieta keto ha già giornate, non fa nulla', async () => {
    const prisma = makeFakePrisma({ dayTemplates: 8 }); // già popolata
    const before = prisma._state.recipes.length;
    await seedKetoCatalog(prisma as never);
    expect(prisma._state.recipes.length).toBe(before); // nessuna nuova ricetta
    expect(prisma._state.dayTemplates.length).toBe(8); // invariato
  });
});
