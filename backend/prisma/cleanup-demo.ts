/**
 * PULIZIA DATI DI TEST/DEMO — reset pre-lancio dei dati OPERATIVI.
 *
 * ⚠️  OPERAZIONE IRREVERSIBILE su dati di produzione. Prima di eseguirla in modalità
 *     cancellazione, FAI UN BACKUP/branch del database Neon.
 *
 * Cosa CANCELLA (richiesto da Simone): lead, clienti, calendario, visite, segnalazioni,
 * chat, acquisti, bonifici, provvigioni, compensi e catalogo diete — più tutti i dati
 * collegati ai clienti (menu, misure, check-in, documenti, abbonamenti, notifiche…).
 *
 * Cosa TIENE: account staff (ruolo diverso da `client`), configurazione (config_param),
 * permessi/ruoli, stati pipeline, gruppi di equivalenza, regole/preset del motore,
 * piani e prodotti del negozio, buoni sconto, template email/PDF, testimonianze, caselle
 * di posta staff.
 *
 * USO (su Render, dove il client Prisma è generato):
 *   1) ANTEPRIMA (non cancella nulla, conta solo):
 *        npx ts-node prisma/cleanup-demo.ts
 *   2) CANCELLAZIONE (dopo aver controllato l'anteprima E fatto il backup):
 *        METABOLE_CLEANUP_CONFIRM=SI-CANCELLA npx ts-node prisma/cleanup-demo.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CONFIRM = process.env.METABOLE_CLEANUP_CONFIRM === 'SI-CANCELLA';

// Ordine figlio→padre: le tabelle più dipendenti prima. `client-only` per la tabella User.
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

// --- Tier 1: foglie (dati collegati a cliente/ricetta/ordine, nessuno le referenzia) ---
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
add('StaffCompensation', 'staffCompensation'); // compensi
add('LedgerEntry', 'ledgerEntry'); // contabilità/bonifici
add('CostEntry', 'costEntry');
add('Event', 'event'); // calendario clienti
add('CrmReminder', 'crmReminder'); // calendario/promemoria CRM
add('CrmListMember', 'crmListMember');
add('ProductRule', 'productRule');
add('DietDayTemplate', 'dietDayTemplate');

// --- Tier 2: entità che avevano figli sopra ---
add('Order', 'order'); // acquisti
add('Subscription', 'subscription');
add('ChatThread', 'chatThread');
add('Recipe', 'recipe'); // catalogo diete
add('CrmRecord', 'crmRecord'); // lead

// --- Tier 3: profilo cliente PRIMA della dieta (il profilo referenzia la dieta) ---
add('ClientProfile', 'clientProfile');
add('Diet', 'diet'); // catalogo diete

// --- Tier 4: utenti CLIENTE (mai gli staff) ---
add('User (solo ruolo client)', 'user', { role: 'client' });

async function main() {
  console.log('\n=== Metabole — pulizia dati di test/demo ===');
  console.log(CONFIRM ? '>>> MODALITÀ CANCELLAZIONE (i dati verranno eliminati)\n' : '>>> ANTEPRIMA (nessuna cancellazione). Per cancellare: METABOLE_CLEANUP_CONFIRM=SI-CANCELLA\n');

  // Anteprima conteggi
  let totalToDelete = 0;
  for (const s of STEPS) {
    const c = await s.count();
    totalToDelete += c;
    console.log(`${c.toString().padStart(8)}  ${s.name}`);
  }
  console.log(`\nTotale righe da eliminare: ${totalToDelete}`);

  // Verifica di sicurezza: quante cose TENIAMO
  const [staff, cfg, plans, products, presets] = await Promise.all([
    prisma.user.count({ where: { role: { not: 'client' } } }),
    prisma.configParam.count(),
    prisma.plan.count(),
    prisma.product.count(),
    prisma.rulePreset.count(),
  ]);
  console.log(`\nTenuti (non toccati): staff=${staff}, config_param=${cfg}, piani=${plans}, prodotti=${products}, preset regole=${presets}.`);

  if (!CONFIRM) {
    console.log('\nAnteprima completata. Nessun dato è stato modificato.');
    await prisma.$disconnect();
    return;
  }

  // Cancellazione atomica: se un vincolo blocca, rollback totale (nessuna cancellazione parziale).
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
  console.log(`\n✅ Fatto: ${deleted} righe eliminate. Staff, configurazione e strutture intatti.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('\n❌ Errore (nessuna cancellazione applicata se in transazione):', e?.message ?? e);
  await prisma.$disconnect();
  process.exit(1);
});
