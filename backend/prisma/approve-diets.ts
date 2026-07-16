/**
 * APPROVA TUTTO IL GENERATO — porta in "approvato + visibile" tutte le diete già generate
 * (utile dopo aver generato tante varianti di famiglia e averne validata solo una a mano).
 *
 * Cosa fa (solo promozioni, niente di distruttivo):
 *   - Ricette: attiva quelle archiviate (active=true) e segna gli allergeni come confermati.
 *   - Gruppi di equivalenza: li porta ad "approved".
 *   - Diete: status → approved (con approvedAt) e le rende visibili a clienti e sito.
 *
 * NB: è un backfill "amministrativo": bypassa i passi UI (audit/notifiche) e sblocca in blocco.
 * Da usare in ambiente di test/allestimento catalogo. In produzione con clienti veri valuta
 * bene: rende TUTTE le diete visibili e considera gli allergeni confermati.
 *
 * USO (su Render, dove il client Prisma è generato):
 *   1) ANTEPRIMA (non cambia nulla, conta soltanto):
 *        npx ts-node --transpile-only prisma/approve-diets.ts
 *   2) ESECUZIONE:
 *        METABOLE_APPROVE_DIETS_CONFIRM=SI-APPROVA npx ts-node --transpile-only prisma/approve-diets.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CONFIRM = process.env.METABOLE_APPROVE_DIETS_CONFIRM === 'SI-APPROVA';

async function main() {
  console.log('\n=== Metabole — APPROVA tutto il generato (diete + ricette + gruppi) ===');
  console.log(CONFIRM
    ? '>>> MODALITÀ ESECUZIONE (i dati verranno aggiornati)\n'
    : '>>> ANTEPRIMA (nessuna modifica). Per eseguire: METABOLE_APPROVE_DIETS_CONFIRM=SI-APPROVA\n');

  const [recipesInactive, recipesUnreviewed, groupsNotApproved, dietsNotApproved, dietsNotVisible] = await Promise.all([
    prisma.recipe.count({ where: { active: false } }),
    prisma.recipe.count({ where: { allergensReviewed: false } }),
    prisma.equivalenceGroup.count({ where: { status: { not: 'approved' } } as never }),
    prisma.diet.count({ where: { status: { not: 'approved' } } as never }),
    prisma.diet.count({ where: { OR: [{ clientVisible: false }, { siteVisible: false }] } as never }),
  ]);

  console.log(`${String(recipesInactive).padStart(8)}  Ricette da attivare (archiviate → attive)`);
  console.log(`${String(recipesUnreviewed).padStart(8)}  Ricette con allergeni da confermare`);
  console.log(`${String(groupsNotApproved).padStart(8)}  Gruppi di equivalenza da approvare`);
  console.log(`${String(dietsNotApproved).padStart(8)}  Diete da approvare (bozza/revisione → approvata)`);
  console.log(`${String(dietsNotVisible).padStart(8)}  Diete da rendere visibili (clienti + sito)`);

  const [totRecipes, totGroups, totDiets] = await Promise.all([
    prisma.recipe.count(), prisma.equivalenceGroup.count(), prisma.diet.count(),
  ]);
  console.log(`\nTotali attuali: ricette=${totRecipes}, gruppi=${totGroups}, diete=${totDiets}.`);

  if (!CONFIRM) {
    console.log('\nAnteprima completata. Nessun dato è stato modificato.');
    await prisma.$disconnect();
    return;
  }

  console.log('\nAggiornamento in corso (transazione unica)…');
  const now = new Date();
  const [rAct, rAll, gApp, dApp, dVis] = await prisma.$transaction([
    prisma.recipe.updateMany({ where: { active: false }, data: { active: true } }),
    prisma.recipe.updateMany({ where: { allergensReviewed: false }, data: { allergensReviewed: true } }),
    prisma.equivalenceGroup.updateMany({ where: { status: { not: 'approved' } } as never, data: { status: 'approved' } as never }),
    prisma.diet.updateMany({ where: { status: { not: 'approved' } } as never, data: { status: 'approved', approvedAt: now } as never }),
    prisma.diet.updateMany({ where: {}, data: { clientVisible: true, siteVisible: true } as never }),
  ], { timeout: 120_000 });

  console.log(`  - Ricette attivate: ${rAct.count}`);
  console.log(`  - Ricette con allergeni confermati: ${rAll.count}`);
  console.log(`  - Gruppi approvati: ${gApp.count}`);
  console.log(`  - Diete approvate: ${dApp.count}`);
  console.log(`  - Diete rese visibili (clienti + sito): ${dVis.count}`);
  console.log('\n✅ Fatto. Tutto il generato è ora approvato e visibile.');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('\n❌ Errore (nessuna modifica applicata se in transazione):', (e as Error)?.message ?? e);
  await prisma.$disconnect();
  process.exit(1);
});
