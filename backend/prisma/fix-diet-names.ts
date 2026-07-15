/**
 * FIX NOMI DIETE — rimuove il suffisso "— bozza generata" dalle diete già esistenti.
 *
 * Non distruttivo (solo rinomina). Uso sul Render Shell del backend:
 *   1) ANTEPRIMA (mostra i cambi, non applica):
 *        npx ts-node prisma/fix-diet-names.ts
 *   2) APPLICA:
 *        METABOLE_FIX_CONFIRM=SI npx ts-node prisma/fix-diet-names.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CONFIRM = process.env.METABOLE_FIX_CONFIRM === 'SI';
const SUFFIX = ' — bozza generata';

async function main() {
  const diets = await prisma.diet.findMany({
    where: { name: { contains: SUFFIX } },
    select: { id: true, name: true },
  });
  console.log(`\n=== Fix nomi diete — trovate ${diets.length} diete col suffisso "${SUFFIX.trim()}" ===`);
  console.log(CONFIRM ? '>>> APPLICO le modifiche\n' : '>>> ANTEPRIMA (nessuna modifica). Per applicare: METABOLE_FIX_CONFIRM=SI\n');

  let changed = 0;
  for (const d of diets) {
    const next = d.name.split(SUFFIX).join('').trim();
    if (next === d.name || !next) continue;
    console.log(`  "${d.name}"  ->  "${next}"`);
    if (CONFIRM) {
      await prisma.diet.update({ where: { id: d.id }, data: { name: next } });
      changed++;
    }
  }
  console.log(CONFIRM ? `\n✅ Rinominate ${changed} diete.` : `\nAnteprima completata: ${diets.length} da rinominare. Nessuna modifica applicata.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('\n❌ Errore:', e?.message ?? e);
  await prisma.$disconnect();
  process.exit(1);
});
