/**
 * SVUOTA DIETE + CATALOGO + PRESET PERSONALI — reset per rigenerare tutto da capo
 * col nuovo sistema "famiglia" (regime × obiettivo).
 *
 * ⚠️  OPERAZIONE IRREVERSIBILE su dati di produzione. Prima della cancellazione FAI UN
 *     BACKUP/branch del database Neon.
 *
 * Cosa CANCELLA:
 *   - Catalogo: Diet, Recipe, EquivalenceGroup e i loro dati diretti
 *     (DietDayTemplate, ProductRule, RecipeRating, MenuWeight).
 *   - I TUOI preset del motore creati a mano (RulePreset con suggested=false).
 *
 * Cosa TIENE:
 *   - I preset SUGGERITI (RulePreset con suggested=true): sono la base di partenza da cui
 *     ricreare le diete, quindi restano.
 *   - Tutto il resto non-catalogo: clienti, staff, CRM, protocolli, config, negozio,
 *     email/PDF, testimonianze.
 *
 * PROTEZIONE: se una dieta è collegata a menu/cicli/pool/certificati di un cliente ANCORA
 * ESISTENTE, lo script si FERMA senza cancellare nulla, per non spezzare la storia di quel
 * cliente. In quel caso valuta prima prisma/cleanup-clients.ts (rimuove i clienti) oppure
 * prisma/cleanup-demo.ts (reset completo). I collegamenti ORFANI (resti di clienti già
 * cancellati, che queste tabelle non ripuliscono a cascata) NON bloccano: vengono rimossi
 * insieme al catalogo, così il reset va a buon fine.
 *
 * DIFFERENZA da cleanup-content.ts: quello tiene TUTTI i preset; questo elimina anche i
 * preset personali (suggested=false), tenendo solo i suggeriti.
 *
 * USO (su Render, dove il client Prisma è generato):
 *   1) ANTEPRIMA (non cancella nulla, conta solo):
 *        npx ts-node --transpile-only prisma/cleanup-diets.ts
 *   2) CANCELLAZIONE (dopo aver controllato l'anteprima E fatto il backup):
 *        METABOLE_CLEANUP_DIETS_CONFIRM=SI-CANCELLA npx ts-node --transpile-only prisma/cleanup-diets.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CONFIRM = process.env.METABOLE_CLEANUP_DIETS_CONFIRM === 'SI-CANCELLA';

type Model = { count: (a?: object) => Promise<number>; deleteMany: (a?: object) => Promise<{ count: number }> };
const model = (client: unknown, name: string) => (client as Record<string, Model>)[name];

// Passi di cancellazione, in ordine figlio → padre. `where` opzionale per i preset.
const STEPS: { label: string; name: string; where?: object }[] = [
  // Catalogo (come cleanup-content): figli prima, poi le diete.
  { label: 'MenuWeight (pesi ricetta)', name: 'menuWeight' },
  { label: 'RecipeRating (voti ricetta)', name: 'recipeRating' },
  { label: 'ProductRule (regole per dieta)', name: 'productRule' },
  { label: 'DietDayTemplate (giornate dieta)', name: 'dietDayTemplate' },
  { label: 'Recipe (ricette)', name: 'recipe' },
  { label: 'EquivalenceGroup (gruppi equivalenza)', name: 'equivalenceGroup' },
  { label: 'Diet (diete)', name: 'diet' },
  // Preset personali: solo quelli creati a mano (suggested=false). I suggeriti restano.
  { label: 'RulePreset personali (suggested=false)', name: 'rulePreset', where: { suggested: false } },
];

// Tabelle CLIENTE che referenziano una dieta. Se una riga punta a un cliente ANCORA
// esistente è storia da proteggere → STOP. Se il cliente non c'è più (riga ORFANA,
// resto di un cliente già cancellato: queste tabelle non hanno FK a cascata) allora è
// spazzatura e va rimossa insieme al catalogo. MenuDay ha onDelete: Restrict verso Diet,
// quindi va cancellata PRIMA delle diete: sta in cima a questa lista.
const CLIENT_REF_STEPS: { label: string; name: string }[] = [
  { label: 'MenuDay (menu erogati) — orfani', name: 'menuDay' },
  { label: 'ClientCycle (cicli) — orfani', name: 'clientCycle' },
  { label: 'ClientMenuPool (pool ricette) — orfani', name: 'clientMenuPool' },
  { label: 'PersonalizationCertificate (certificati) — orfani', name: 'personalizationCertificate' },
];

async function main() {
  console.log('\n=== Metabole — svuota DIETE + CATALOGO + PRESET PERSONALI ===');
  console.log(CONFIRM
    ? '>>> MODALITÀ CANCELLAZIONE (i dati verranno eliminati)\n'
    : '>>> ANTEPRIMA (nessuna cancellazione). Per cancellare: METABOLE_CLEANUP_DIETS_CONFIRM=SI-CANCELLA\n');

  let total = 0;
  for (const s of STEPS) {
    const c = await model(prisma, s.name).count(s.where ? { where: s.where } : undefined);
    total += c;
    console.log(`${String(c).padStart(8)}  ${s.label}`);
  }

  // Distingui i collegamenti a dati cliente: LIVE (cliente esistente → protetto) vs ORFANI.
  const liveClients = await prisma.user.findMany({ where: { role: 'client' }, select: { id: true } });
  const liveIds = liveClients.map((u: { id: string }) => u.id);
  let liveRefs = 0; let orphanRefs = 0;
  const liveDetails: string[] = []; const orphanDetails: string[] = [];
  for (const s of CLIENT_REF_STEPS) {
    const totalRows = await model(prisma, s.name).count();
    const live = liveIds.length ? await model(prisma, s.name).count({ where: { clientId: { in: liveIds } } }) : 0;
    const orphan = totalRows - live;
    liveRefs += live; orphanRefs += orphan;
    if (live > 0) liveDetails.push(`${s.name}=${live}`);
    if (orphan > 0) orphanDetails.push(`${s.name}=${orphan}`);
  }
  if (orphanRefs > 0) {
    console.log(`${String(orphanRefs).padStart(8)}  Menu cliente ORFANI da rimuovere (${orphanDetails.join(', ')})`);
  }
  console.log(`\nTotale righe da eliminare: ${total + orphanRefs}`);

  const [presetsKept, clients, staff] = await Promise.all([
    prisma.rulePreset.count({ where: { suggested: true } }),
    prisma.user.count({ where: { role: 'client' } }),
    prisma.user.count({ where: { role: { not: 'client' } } }),
  ]);
  console.log(`\nTenuti (non toccati): preset suggeriti=${presetsKept}, clienti=${clients}, staff=${staff}, + CRM/protocolli/config/negozio.`);

  if (liveRefs > 0) {
    console.log(`\n⛔ STOP: ci sono ${liveRefs} collegamenti a diete di CLIENTI ANCORA ESISTENTI (${liveDetails.join(', ')}).`);
    console.log('Svuotare il catalogo spezzerebbe la storia di quei clienti. Nessuna cancellazione applicata.');
    console.log('Per rimuovere prima i clienti usa prisma/cleanup-clients.ts; per un reset COMPLETO usa prisma/cleanup-demo.ts.');
    await prisma.$disconnect();
    return;
  }
  if (orphanRefs > 0) {
    console.log(`\nℹ️  Nessun cliente esistente è collegato: le ${orphanRefs} righe di menu sono ORFANE e verranno rimosse.`);
  }

  if (!CONFIRM) {
    console.log('\nAnteprima completata. Nessun dato è stato modificato.');
    await prisma.$disconnect();
    return;
  }

  console.log('\nCancellazione in corso (transazione unica; se un vincolo blocca, rollback totale)…');
  const deleted = await prisma.$transaction(async (tx) => {
    let n = 0;
    // Prima i menu cliente orfani (sblocca il vincolo MenuDay → Diet), poi il catalogo e i preset.
    for (const s of CLIENT_REF_STEPS) {
      const r = await model(tx, s.name).deleteMany();
      if (r.count > 0) console.log(`  - ${s.label}: ${r.count}`);
      n += r.count;
    }
    for (const s of STEPS) {
      const r = await model(tx, s.name).deleteMany(s.where ? { where: s.where } : undefined);
      if (r.count > 0) console.log(`  - ${s.label}: ${r.count}`);
      n += r.count;
    }
    return n;
  }, { timeout: 120_000 });
  console.log(`\n✅ Fatto: ${deleted} righe eliminate. Preset suggeriti, clienti, staff e configurazione intatti.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('\n❌ Errore (nessuna cancellazione applicata se in transazione):', (e as Error)?.message ?? e);
  await prisma.$disconnect();
  process.exit(1);
});
