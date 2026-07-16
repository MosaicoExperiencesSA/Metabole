/**
 * DEDUPLICA DIETE — rimuove i doppioni della stessa variante (nome+stile+regime+obiettivo)
 * creati rigenerando più volte il catalogo (ogni "Genera" creava una dieta nuova; ora la
 * rigenerazione sostituisce, ma i doppioni storici vanno puliti con questo script).
 *
 * Per ogni gruppo di doppioni TIENE la versione più recente (preferendo le approvate) ed
 * elimina le altre con: giornate (DietDayTemplate), regole (ProductRule), gruppi di
 * equivalenza (productId) e le ricette generate rimaste senza riferimenti.
 * In coda fa una passata finale: elimina le ricette "gen:*" non referenziate da NESSUNA
 * giornata rimasta (orfane di generazioni precedenti).
 *
 * PROTEZIONE: le diete usate in menu già erogati (MenuDay) non si toccano mai.
 *
 * USO (su Render, dove il client Prisma è generato):
 *   1) ANTEPRIMA:   npx ts-node --transpile-only prisma/dedupe-diets.ts
 *   2) ESECUZIONE:  METABOLE_DEDUPE_DIETS_CONFIRM=SI-DEDUPLICA npx ts-node --transpile-only prisma/dedupe-diets.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CONFIRM = process.env.METABOLE_DEDUPE_DIETS_CONFIRM === 'SI-DEDUPLICA';

type DietRow = { id: string; name: string; style: string; regime: string; objective: string; status: string; createdAt: Date };
type Tpl = { dietId: string; meals: unknown };

const recipeIdsOf = (tpls: Tpl[], dietIds?: Set<string>) => {
  const out = new Set<string>();
  for (const t of tpls) {
    if (dietIds && !dietIds.has(t.dietId)) continue;
    for (const m of (Array.isArray(t.meals) ? (t.meals as { recipeId?: string }[]) : [])) {
      if (m.recipeId) out.add(m.recipeId);
    }
  }
  return out;
};

async function main() {
  console.log('\n=== Metabole — DEDUPLICA diete (stessa variante nome+stile+regime+obiettivo) ===');
  console.log(CONFIRM
    ? '>>> MODALITÀ ESECUZIONE (i doppioni verranno eliminati)\n'
    : '>>> ANTEPRIMA (nessuna modifica). Per eseguire: METABOLE_DEDUPE_DIETS_CONFIRM=SI-DEDUPLICA\n');

  const diets = (await prisma.diet.findMany({
    select: { id: true, name: true, style: true, regime: true, objective: true, status: true, createdAt: true } as never,
    orderBy: { createdAt: 'asc' },
  })) as unknown as DietRow[];

  // Raggruppa per variante.
  const groups = new Map<string, DietRow[]>();
  for (const d of diets) {
    const k = `${d.name}\u0000${d.style}\u0000${d.regime}\u0000${d.objective}`;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(d);
  }

  // Scegli chi tenere: approvata più recente; se nessuna approvata, la più recente.
  const losers: DietRow[] = [];
  for (const rows of groups.values()) {
    if (rows.length < 2) continue;
    const sorted = [...rows].sort((a, b) => {
      const ap = (b.status === 'approved' ? 1 : 0) - (a.status === 'approved' ? 1 : 0);
      return ap !== 0 ? ap : b.createdAt.getTime() - a.createdAt.getTime();
    });
    losers.push(...sorted.slice(1));
  }

  // Protezione: mai toccare diete usate in menu erogati.
  const skipped: DietRow[] = [];
  const deletable: DietRow[] = [];
  for (const l of losers) {
    const used = await prisma.menuDay.count({ where: { dietId: l.id } });
    (used > 0 ? skipped : deletable).push(l);
  }

  const loserIds = new Set(deletable.map((l) => l.id));
  const allTpls = (await prisma.dietDayTemplate.findMany({ select: { dietId: true, meals: true } })) as unknown as Tpl[];
  const loserRecipeIds = recipeIdsOf(allTpls, loserIds);
  const keptRecipeIds = recipeIdsOf(allTpls.filter((t) => !loserIds.has(t.dietId)));
  for (const id of keptRecipeIds) loserRecipeIds.delete(id);

  // Passata finale: ricette generate (tag gen:*) non referenziate da nessuna giornata rimasta.
  const genRecipes = (await prisma.recipe.findMany({ select: { id: true, tags: true } })) as unknown as { id: string; tags: string[] }[];
  const orphanGen = genRecipes.filter((r) => (r.tags ?? []).some((t) => t.startsWith('gen:')) && !keptRecipeIds.has(r.id) && !loserRecipeIds.has(r.id)).map((r) => r.id);

  console.log(`Diete totali: ${diets.length} in ${groups.size} varianti distinte.`);
  console.log(`${String(deletable.length).padStart(8)}  Diete doppione da eliminare`);
  for (const l of deletable) console.log(`          - ${l.name} · ${l.regime} · ${l.objective} (${l.status}, creata ${l.createdAt.toISOString().slice(0, 16)})`);
  console.log(`${String(loserRecipeIds.size).padStart(8)}  Ricette dei doppioni da eliminare (non usate dalle diete tenute)`);
  console.log(`${String(orphanGen.length).padStart(8)}  Ricette generate ORFANE (di generazioni precedenti) da eliminare`);
  if (skipped.length) console.log(`\n⚠️  ${skipped.length} doppioni NON eliminabili perché usati in menu erogati: ${skipped.map((s) => `${s.name}·${s.regime}·${s.objective}`).join(', ')}`);

  if (!CONFIRM) {
    console.log('\nAnteprima completata. Nessun dato è stato modificato.');
    await prisma.$disconnect();
    return;
  }

  console.log('\nPulizia in corso (transazione unica)…');
  const ids = [...loserIds];
  const recIds = [...new Set([...loserRecipeIds, ...orphanGen])];
  const [tpl, rules, grp, rat, wgt, rec, del] = await prisma.$transaction([
    prisma.dietDayTemplate.deleteMany({ where: { dietId: { in: ids } } }),
    prisma.productRule.deleteMany({ where: { dietId: { in: ids } } }),
    prisma.equivalenceGroup.deleteMany({ where: { productId: { in: ids } } as never }),
    prisma.recipeRating.deleteMany({ where: { recipeId: { in: recIds } } }),
    prisma.menuWeight.deleteMany({ where: { recipeId: { in: recIds } } }),
    prisma.recipe.deleteMany({ where: { id: { in: recIds } } }),
    prisma.diet.deleteMany({ where: { id: { in: ids } } }),
  ], { timeout: 120_000 });
  console.log(`  - Giornate: ${tpl.count} · Regole: ${rules.count} · Gruppi: ${grp.count}`);
  console.log(`  - Voti: ${rat.count} · Pesi: ${wgt.count} · Ricette: ${rec.count}`);
  console.log(`  - Diete doppione eliminate: ${del.count}`);
  console.log('\n✅ Fatto. Una sola dieta per variante (nome+stile+regime+obiettivo).');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('\n❌ Errore (nessuna modifica applicata se in transazione):', (e as Error)?.message ?? e);
  await prisma.$disconnect();
  process.exit(1);
});
