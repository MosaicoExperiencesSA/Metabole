import type { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Inserisce la BASE KETO approvata nel motore, come catalogo ISOLATO del
 * prodotto Keto (regola ferrea: i menu non si mischiano mai tra percorsi).
 *
 * - Crea le Recipe taggate `keto` (una per piatto del catalogo approvato),
 *   con mealSlot, kcal, ingredienti chiave e metodi di cottura (Regola 6).
 * - Aggancia/crea la Diet `style: keto` con le sue DietDayTemplate (giornate
 *   bilanciate ~1450 kcal, rotazione su dayIndex).
 *
 * Idempotente: se il catalogo Keto è già presente (Diet keto con dayTemplates)
 * non fa nulla. Le grammature/porzioni le fissa il nutrizionista dal backoffice.
 *
 * Sorgente dati: prisma/data/keto_catalog.json (generato dalla base approvata
 * in percorsi/keto/). Metodo: percorsi/METODO_MOTORE_INTELLIGENTE.md.
 */

type KetoRecipe = {
  id: string;
  name: string;
  regime: 'omnivore' | 'vegetarian' | 'vegan';
  mealSlot: 'breakfast' | 'morning_snack' | 'lunch' | 'afternoon_snack' | 'dinner';
  kcal: number;
  ingredients: { name: string; qty?: number; unit?: string }[];
  cookingMethods?: { type: string }[];
  tags: string[];
};

type KetoDay = {
  level: number;
  dayIndex: number;
  kcalTotal: number;
  meals: { slot: string; recipeId: string; name: string }[];
};

type KetoCatalog = {
  product: string;
  style: 'keto';
  regime: 'omnivore' | 'vegetarian' | 'vegan';
  mealsPerDay: number;
  levels: { level: number; kcal: number }[];
  objective: string;
  clientName: string;
  note: string;
  recipes: KetoRecipe[];
  dayTemplates: KetoDay[];
};

export async function seedKetoCatalog(prisma: PrismaClient): Promise<void> {
  // Già presente e popolata? Non tocchiamo il catalogo (idempotente).
  const existing = await prisma.diet.findFirst({
    where: { style: 'keto' },
    include: { _count: { select: { dayTemplates: true } } },
  });
  if (existing && existing._count.dayTemplates > 0) {
    return;
  }

  const catalog: KetoCatalog = JSON.parse(
    readFileSync(join(__dirname, 'data', 'keto_catalog.json'), 'utf8'),
  );

  // 1) Recipe del catalogo Keto (crea se assente per nome+slot+regime).
  const nameToId = new Map<string, string>();
  for (const rec of catalog.recipes) {
    const found = await prisma.recipe.findFirst({
      where: { name: rec.name, mealSlot: rec.mealSlot as never, regime: rec.regime },
    });
    const row =
      found ??
      (await prisma.recipe.create({
        data: {
          name: rec.name,
          regime: rec.regime,
          mealSlot: rec.mealSlot as never,
          kcal: rec.kcal,
          ingredients: rec.ingredients as never,
          cookingMethods: (rec.cookingMethods ?? null) as never,
          tags: rec.tags,
        },
      }));
    nameToId.set(rec.name, row.id);
  }

  const m = (slot: string, name: string) => ({ slot, recipeId: nameToId.get(name), name });

  // 2) Diet Keto (aggiorna se esiste, altrimenti crea) con le giornate.
  const dayTemplates = catalog.dayTemplates.map((d) => ({
    level: d.level,
    dayIndex: d.dayIndex,
    meals: d.meals.map((meal) => m(meal.slot, meal.name)) as never,
  }));

  if (existing) {
    await prisma.diet.update({
      where: { id: existing.id },
      data: {
        regime: catalog.regime,
        mealsPerDay: catalog.mealsPerDay,
        levels: catalog.levels as never,
        objective: catalog.objective,
        status: 'approved',
        approvedAt: new Date(),
        dayTemplates: { create: dayTemplates },
      },
    });
  } else {
    await prisma.diet.create({
      data: {
        name: 'Keto',
        regime: catalog.regime,
        style: 'keto',
        mealsPerDay: catalog.mealsPerDay,
        levels: catalog.levels as never,
        objective: catalog.objective,
        status: 'approved',
        approvedAt: new Date(),
        clientName: catalog.clientName,
        dayTemplates: { create: dayTemplates },
      },
    });
  }

  console.log(
    `Seed: catalogo Keto inserito nel motore — ${catalog.recipes.length} ricette, ${catalog.dayTemplates.length} giornate (isolato, prodotto Keto).`,
  );
}
