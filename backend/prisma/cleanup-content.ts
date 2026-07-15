/**
 * SVUOTA CONTENUTI — reset del solo CATALOGO (diete, ricette, gruppi di equivalenza)
 * per ricrearlo pulito col nuovo sistema (generatore AI + regole suggerite).
 *
 * ⚠️  OPERAZIONE IRREVERSIBILE. Prima della cancellazione fai un backup/branch del DB Neon.
 *
 * Cosa CANCELLA: Diet, Recipe, EquivalenceGroup e i loro dati diretti
 * (DietDayTemplate, ProductRule, RecipeRating, MenuWeight).
 *
 * Cosa TIENE: preset/regole del motore, protocolli, CRM, clienti, staff, config,
 * negozio, email/PDF, testimonianze — tutto ciò che non è catalogo.
 *
 * PROTEZIONE: se qualche dieta è già collegata a DATI CLIENTE (menu erogati, cicli,
 * pool, certificati), lo script si FERMA senza cancellare nulla, per non spezzare la
 * storia dei clienti. In quel caso usa prisma/cleanup-demo.ts per un reset completo.
 *
 * USO (su Render):
 *   1) ANTEPRIMA:      npx ts-node --transpile-only prisma/cleanup-content.ts
 *   2) CANCELLAZIONE:  METABOLE_CLEANUP_CONFIRM=SI-CANCELLA npx ts-node --transpile-only prisma/cleanup-content.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CONFIRM = process.env.METABOLE_CLEANUP_CONFIRM === 'SI-CANCELLA';

// Tabelle del catalogo da svuotare, in ordine figlio → padre.
const CONTENT_STEPS: [string, string][] = [
  ['MenuWeight (pesi ricetta)', 'menuWeight'],
  ['RecipeRating (voti ricetta)', 'recipeRating'],
  ['ProductRule (regole per dieta)', 'productRule'],
  ['DietDayTemplate (giornate dieta)', 'dietDayTemplate'],
  ['Recipe (ricette)', 'recipe'],
  ['EquivalenceGroup (gruppi equivalenza)', 'equivalenceGroup'],
  ['Diet (diete)', 'diet'],
];

// Tabelle CLIENTE che referenziano una dieta: se hanno righe, NON si cancella.
const CLIENT_REFS = ['menuDay', 'clientMenuPool', 'clientCycle', 'personalizationCertificate'];

type Model = { count: (a?: object) => Promise<number>; deleteMany: (a?: object) => Promise<{ count: number }> };
const model = (client: unknown, name: string) => (client as Record<string, Model>)[name];

async function main() {
  console.log('\n=== Metabole — svuota CONTENUTI (diete / ricette / gruppi) ===');
  console.log(CONFIRM
    ? '>>> MODALITÀ CANCELLAZIONE (i dati verranno eliminati)\n'
    : '>>> ANTEPRIMA (nessuna cancellazione). Per cancellare: METABOLE_CLEANUP_CONFIRM=SI-CANCELLA\n');

  let total = 0;
  for (const [label, name] of CONTENT_STEPS) {
    const c = await model(prisma, name).count();
    total += c;
    console.log(`${String(c).padStart(8)}  ${label}`);
  }
  console.log(`\nTotale righe di contenuto: ${total}`);

  // Protezione: collegamenti a dati cliente
  let clientRefs = 0;
  const details: string[] = [];
  for (const name of CLIENT_REFS) {
    const c = await model(prisma, name).count();
    clientRefs += c;
    if (c > 0) details.push(`${name}=${c}`);
  }

  const [presets, clients, staff] = await Promise.all([
    prisma.rulePreset.count(),
    prisma.user.count({ where: { role: 'client' } }),
    prisma.user.count({ where: { role: { not: 'client' } } }),
  ]);
  console.log(`\nTenuti (non toccati): preset regole=${presets}, clienti=${clients}, staff=${staff}, + CRM/protocolli/config/negozio.`);

  if (clientRefs > 0) {
    console.log(`\n⛔ STOP: ci sono ${clientRefs} collegamenti a DATI CLIENTE alle diete (${details.join(', ')}).`);
    console.log('Svuotare il catalogo spezzerebbe la storia dei clienti. Nessuna cancellazione applicata.');
    console.log('Per un reset COMPLETO (anche dati cliente) usa prisma/cleanup-demo.ts.');
    await prisma.$disconnect();
    return;
  }

  if (!CONFIRM) {
    console.log('\nAnteprima completata. Nessun dato è stato modificato.');
    await prisma.$disconnect();
    return;
  }

  console.log('\nCancellazione in corso (transazione unica; se un vincolo blocca, rollback totale)…');
  const deleted = await prisma.$transaction(async (tx) => {
    let n = 0;
    for (const [label, name] of CONTENT_STEPS) {
      const r = await model(tx, name).deleteMany();
      if (r.count > 0) console.log(`  - ${label}: ${r.count}`);
      n += r.count;
    }
    return n;
  }, { timeout: 120_000 });
  console.log(`\n✅ Fatto: ${deleted} righe di contenuto eliminate. Preset regole, clienti, staff e configurazione intatti.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('\n❌ Errore (nessuna cancellazione applicata se in transazione):', (e as Error)?.message ?? e);
  await prisma.$disconnect();
  process.exit(1);
});
