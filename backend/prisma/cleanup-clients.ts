/**
 * PULIZIA LEAD + CLIENTI — rimuove SOLO le persone (lead e clienti) e i loro dati.
 *
 * ⚠️  OPERAZIONE IRREVERSIBILE su dati di produzione. Prima di eseguirla in modalità
 *     cancellazione, FAI UN BACKUP/branch del database Neon.
 *
 * Cosa CANCELLA: schede CRM (lead), profili cliente, utenti-cliente e TUTTO il loro
 * collegato — menu/giornate erogate, misure, check-in, obiettivi, documenti, note,
 * chat, appuntamenti/visite, notifiche, acquisti/abbonamenti/bonifici e i movimenti
 * finanziari derivati (provvigioni, compensi, ledger). Svuota anche notifiche/token/
 * sessioni ed eventi analytics (staff compresi: dovranno solo rifare login).
 *
 * Cosa TIENE (a differenza di cleanup:demo): il CATALOGO DIETE/RICETTE (Diet, Recipe,
 * DietDayTemplate, ProductRule) e i COSTI di contabilità (CostEntry). Tiene anche
 * staff, config_param, permessi/ruoli, pipeline, gruppi di equivalenza, regole/preset
 * del motore, piani/prodotti del negozio, buoni sconto, template email/PDF, testimonianze.
 *
 * USO (su Render, dove il client Prisma è generato):
 *   1) ANTEPRIMA (non cancella nulla, conta solo):
 *        npx ts-node prisma/cleanup-clients.ts
 *   2) CANCELLAZIONE (dopo aver controllato l'anteprima E fatto il backup):
 *        METABOLE_CLEANUP_CONFIRM=SI-CANCELLA npx ts-node prisma/cleanup-clients.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CONFIRM = process.env.METABOLE_CLEANUP_CONFIRM === 'SI-CANCELLA';

const STEPS: { name: string; run: (tx: PrismaClient) => Promise<number>; count: () => Promise<number> }[] = [];
const add = (name: string, model: string, where?: object) => {
  const m = (prisma as unknown as Record<string, { deleteMany: (a?: object) => Promise<{ count: number }>; count: (a?: object) => Promise<number> }>)[model];
  STEPS.push({
    name,
    count: () => m.count(where ? { where } : undefined),
    run: async (tx) => {
      const tm = (tx as unknown as Record<string, { deleteMany: (a?: object) => Promise<{ count: number }> }>)[model];
      const r = await tm.deleteMany(where ? { where } : undefined);
      return r.count;
    },
  });
};

// --- Tier 1: foglie (dati collegati a cliente/ordine) ---
add('WaterLog', 'waterLog');
add('StepLog', 'stepLog');
add('DailyCheckin', 'dailyCheckin');
add('Measurement', 'measurement');
add('MenuWeight', 'menuWeight');
add('RecipeRating', 'recipeRating');
add('ShoppingList', 'shoppingList');
add('MenuDay', 'menuDay');
add('ClientMenuPool', 'clientMenuPool');
add('CycleFeedback', 'cycleFeedback');
add('ClientCycle', 'clientCycle');
add('Milestone', 'milestone');
add('Objective', 'objective');
add('Document', 'document');
add('ClinicalNote', 'clinicalNote');
add('ClientNote', 'clientNote');
add('PersonalizationCertificate', 'personalizationCertificate');
add('Notification', 'notification');
add('PushToken', 'pushToken');
add('ActionToken', 'actionToken');
add('RefreshToken', 'refreshToken');
add('AnalyticsEvent', 'analyticsEvent');
add('Referral', 'referral');
add('ConversationSummary', 'conversationSummary');
add('Message', 'message');
add('Appointment', 'appointment');
add('Visit', 'visit');
add('Alert', 'alert');
add('EngineDecision', 'engineDecision');
add('Escalation', 'escalation');
add('DiscountRedemption', 'discountRedemption');
add('Payment', 'payment'); // acquisti + bonifici
add('PendingCommission', 'pendingCommission'); // provvigioni
add('CommissionWithdrawal', 'commissionWithdrawal');
add('StaffCompensation', 'staffCompensation'); // compensi (derivati dalle vendite ai clienti)
add('LedgerEntry', 'ledgerEntry'); // contabilità incassi (derivati dai clienti)
add('Event', 'event'); // calendario clienti
add('CrmReminder', 'crmReminder'); // promemoria CRM
add('CrmListMember', 'crmListMember');

// --- Tier 2: entità che avevano figli sopra ---
add('Order', 'order'); // acquisti
add('Subscription', 'subscription');
add('ChatThread', 'chatThread');
add('CrmRecord', 'crmRecord'); // lead

// --- Tier 3: profilo cliente ---
add('ClientProfile', 'clientProfile');

// --- Tier 4: utenti CLIENTE (mai gli staff) ---
add('User (solo ruolo client)', 'user', { role: 'client' });

// NB: NON tocca Diet, Recipe, DietDayTemplate, ProductRule (catalogo) né CostEntry (costi).

async function main() {
  console.log('\n=== Metabole — pulizia LEAD + CLIENTI (il catalogo diete resta) ===');
  console.log(CONFIRM ? '>>> MODALITÀ CANCELLAZIONE (i dati verranno eliminati)\n' : '>>> ANTEPRIMA (nessuna cancellazione). Per cancellare: METABOLE_CLEANUP_CONFIRM=SI-CANCELLA\n');

  let totalToDelete = 0;
  for (const s of STEPS) {
    const c = await s.count();
    totalToDelete += c;
    console.log(`${c.toString().padStart(8)}  ${s.name}`);
  }
  console.log(`\nTotale righe da eliminare: ${totalToDelete}`);

  const [staff, cfg, plans, products, presets, diets, recipes] = await Promise.all([
    prisma.user.count({ where: { role: { not: 'client' } } }),
    prisma.configParam.count(),
    prisma.plan.count(),
    prisma.product.count(),
    prisma.rulePreset.count(),
    prisma.diet.count(),
    prisma.recipe.count(),
  ]);
  console.log(`\nTenuti (non toccati): staff=${staff}, config_param=${cfg}, piani=${plans}, prodotti=${products}, preset regole=${presets}, diete=${diets}, ricette=${recipes}.`);

  if (!CONFIRM) {
    console.log('\nAnteprima completata. Nessun dato è stato modificato.');
    await prisma.$disconnect();
    return;
  }

  console.log('\nCancellazione in corso (transazione unica)…');
  const deleted = await prisma.$transaction(async (tx) => {
    let n = 0;
    for (const s of STEPS) {
      const c = await s.run(tx as unknown as PrismaClient);
      if (c > 0) console.log(`  - ${s.name}: ${c}`);
      n += c;
    }
    return n;
  }, { timeout: 120_000 });
  console.log(`\n✅ Fatto: ${deleted} righe eliminate. Catalogo diete, staff e configurazione intatti.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('\n❌ Errore (nessuna cancellazione applicata se in transazione):', e?.message ?? e);
  await prisma.$disconnect();
  process.exit(1);
});
