/**
 * Ripulisce TUTTO quello che riguarda la Keto-Mediterranea, per rifarla da zero dal
 * generatore insieme alla nutrizionista (richiesta Simone, 6/8).
 *
 * Cancella:
 *  - le DIETE con stile `keto_mediterranean` o con nome che comincia per "Keto-Mediterranea"
 *    (quindi anche le varianti create dal vecchio script, tipo "Keto-Mediterranea (5 pasti)");
 *  - le loro giornate, regole per prodotto e gruppi di equivalenza;
 *  - le RICETTE referenziate SOLO da quelle diete (con voti e pesi di apprendimento).
 *
 * NON cancella:
 *  - i 12 preset del generatore (`rule_preset`, stile `keto_mediterranean`): servono proprio a
 *    rigenerare. Per togliere anche quelli si usa il generatore, dal cestino accanto al nome;
 *  - le diete già usate in menu erogati: quelle sono la storia di una cliente, non si toccano.
 *    Se ce ne sono, lo script le salta e le elenca.
 *
 * USO (shell di Render, dentro ~/project/src/backend):
 *   npx ts-node --transpile-only prisma/cleanup-keto-mediterranea.ts          → mostra e basta
 *   CONFERMA=1 npx ts-node --transpile-only prisma/cleanup-keto-mediterranea.ts → cancella
 *
 * Senza CONFERMA=1 non tocca niente: una cancellazione a catena la si guarda prima di farla.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const conferma = process.env.CONFERMA === '1';

  const diete = (await prisma.diet.findMany({
    where: { OR: [{ style: 'keto_mediterranean' }, { name: { startsWith: 'Keto-Mediterranea' } }] },
    select: { id: true, name: true, style: true, regime: true, objective: true, mealsPerDay: true, fasting: true, status: true },
  })) as {
    id: string; name: string; style: string; regime: string;
    objective: string | null; mealsPerDay: number; fasting: boolean; status: string;
  }[];

  if (diete.length === 0) {
    console.log('Nessuna dieta Keto-Mediterranea a database: niente da cancellare.');
    return;
  }

  const daCancellare: string[] = [];
  const intoccabili: string[] = [];
  const tabella: Record<string, unknown>[] = [];
  for (const d of diete) {
    const erogati = await prisma.menuDay.count({ where: { dietId: d.id } });
    const giornate = await prisma.dietDayTemplate.count({ where: { dietId: d.id } });
    if (erogati > 0) intoccabili.push(d.name);
    else daCancellare.push(d.id);
    tabella.push({
      nome: d.name, regime: d.regime, obiettivo: d.objective,
      pasti: d.fasting ? 'digiuno' : d.mealsPerDay, stato: d.status,
      giornate, menu_erogati: erogati, azione: erogati > 0 ? 'SALTATA (in uso)' : 'da cancellare',
    });
  }
  console.table(tabella);

  // Ricette referenziate SOLO dalle diete da cancellare: quelle usate anche altrove restano.
  const nostri = (await prisma.dietDayTemplate.findMany({ where: { dietId: { in: daCancellare } }, select: { meals: true } })) as { meals: unknown }[];
  const orfane = new Set<string>();
  for (const t of nostri) for (const m of (Array.isArray(t.meals) ? (t.meals as { recipeId?: string }[]) : [])) if (m?.recipeId) orfane.add(m.recipeId);
  const altrui = (await prisma.dietDayTemplate.findMany({ where: { dietId: { notIn: daCancellare } }, select: { meals: true } })) as { meals: unknown }[];
  for (const t of altrui) for (const m of (Array.isArray(t.meals) ? (t.meals as { recipeId?: string }[]) : [])) if (m?.recipeId) orfane.delete(m.recipeId);
  const ricette = [...orfane];

  const preset = await prisma.rulePreset.count({ where: { style: 'keto_mediterranean' } });
  console.log(`Diete da cancellare: ${daCancellare.length} · ricette collegate: ${ricette.length} · preset del generatore che restano: ${preset}`);
  if (intoccabili.length) console.log(`⚠️  Saltate perché hanno menu già erogati: ${intoccabili.join(', ')}`);

  if (!conferma) {
    console.log('\nProva a vuoto: non ho cancellato niente. Per procedere davvero:');
    console.log('  CONFERMA=1 npx ts-node --transpile-only prisma/cleanup-keto-mediterranea.ts');
    return;
  }
  if (daCancellare.length === 0) {
    console.log('Niente da cancellare.');
    return;
  }

  await prisma.$transaction([
    prisma.dietDayTemplate.deleteMany({ where: { dietId: { in: daCancellare } } }),
    prisma.productRule.deleteMany({ where: { dietId: { in: daCancellare } } }),
    prisma.equivalenceGroup.deleteMany({ where: { productId: { in: daCancellare } } as never }),
    ...(ricette.length ? [
      prisma.recipeRating.deleteMany({ where: { recipeId: { in: ricette } } }),
      prisma.menuWeight.deleteMany({ where: { recipeId: { in: ricette } } }),
      prisma.recipe.deleteMany({ where: { id: { in: ricette } } }),
    ] : []),
    prisma.diet.deleteMany({ where: { id: { in: daCancellare } } }),
  ]);

  const residue = await prisma.recipe.count({ where: { AND: [{ tags: { has: 'keto' } }, { tags: { has: 'mediterranea' } }] } });
  console.log(`✅ Cancellate ${daCancellare.length} diete e ${ricette.length} ricette.`);
  if (residue > 0) {
    console.log(`ℹ️  Restano ${residue} ricette con i tag "keto"+"mediterranea" non collegate a nessuna giornata (venivano dal vecchio script). Si eliminano dal Catalogo ricette, filtrando per tag.`);
  }
  console.log('I 12 preset del generatore sono intatti: puoi rigenerare quando vuoi.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
