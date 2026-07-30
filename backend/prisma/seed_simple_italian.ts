/**
 * Set iniziale di ricette SEMPLICI di cucina italiana.
 *
 * Inserisce le ricette del catalogo `data/simple_italian_catalog.json` come BOZZA:
 *   - difficulty = 'semplice'
 *   - tag ['cucina italiana']
 *   - active = FALSE  → NON entrano nei menu finché la coach non le attiva
 *   - allergensReviewed = FALSE → gli allergeni vanno confermati dal nutrizionista
 *
 * È idempotente: se una ricetta con lo stesso nome+slot+regime esiste già, la salta.
 * Le ricette vanno poi RIVISTE (kcal, macro, allergeni) e ATTIVATE dal backoffice
 * (pagina Ricette): solo allora vengono proposte alle clienti che hanno scelto
 * "preferisco ricette semplici".
 *
 *   npm run seed:simple-italian            # DRY-RUN: mostra cosa creerebbe
 *   npm run seed:simple-italian -- --apply # crea le ricette (active=false)
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const ITALIAN_TAG = 'cucina italiana';

type Ingredient = { name: string; qty?: number; unit?: string };
type SeedRecipe = {
  name: string;
  regime: string;
  mealSlot: string;
  kcal: number;
  ingredients: Ingredient[];
  macros?: { protein_g?: number; carbs_g?: number; fat_g?: number };
  tags?: string[];
};

async function main() {
  console.log(APPLY ? '>>> APPLICA (creo le ricette, active=false) <<<' : '>>> DRY-RUN (nessuna scrittura) — usa --apply <<<');
  const file = join(__dirname, 'data', 'simple_italian_catalog.json');
  const parsed = JSON.parse(readFileSync(file, 'utf8')) as { recipes: SeedRecipe[] };
  const recipes = parsed.recipes ?? [];
  let created = 0;
  let skipped = 0;

  for (const r of recipes) {
    const exists = await prisma.recipe.findFirst({
      where: { name: r.name, mealSlot: r.mealSlot as never, regime: r.regime },
      select: { id: true },
    });
    if (exists) {
      skipped++;
      console.log(`  · già presente, salto: ${r.name} (${r.regime}/${r.mealSlot})`);
      continue;
    }
    const tags = Array.from(new Set([...(r.tags ?? []), ITALIAN_TAG]));
    console.log(`  ✎ ${r.name} — ${r.regime}/${r.mealSlot}, ${r.kcal} kcal`);
    if (APPLY) {
      await prisma.recipe.create({
        data: {
          name: r.name,
          regime: r.regime,
          mealSlot: r.mealSlot as never,
          kcal: r.kcal,
          ingredients: (r.ingredients ?? []) as never,
          cookingMethods: [] as never,
          macros: (r.macros ?? undefined) as never,
          tags,
          difficulty: 'semplice',
          active: false, // BOZZA: la coach la rivede e la attiva dal backoffice
          allergensReviewed: false,
        },
      });
    }
    created++;
  }

  console.log(
    APPLY
      ? `\n✔ Ricette create (active=false, da attivare dal backoffice): ${created}. Già presenti: ${skipped}.`
      : `\nDa creare: ${created}. Già presenti: ${skipped}. Per applicare: npm run seed:simple-italian -- --apply`,
  );
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
