/**
 * CONTROLLO: si può davvero vendere un abbonamento, oggi, in produzione?
 *
 * Il codice del ricorrente è scritto e testato, ma nessun test può rispondere a questa domanda:
 * dipende da **dati** e da **configurazione**, che vivono nel database di produzione e nel
 * pannello Stripe. E i modi di essere «quasi pronti» sono tutti silenziosi:
 *
 *  - il piano esiste ma è ancora `one_time` → al checkout la cliente paga una volta e basta,
 *    senza che niente segnali l'errore: sembra andato tutto bene;
 *  - il piano è in abbonamento ma con prezzo **zero** → Stripe rifiuta la sessione, e la cliente
 *    vede un errore generico;
 *  - le **provvigioni sono a zero per tutti i ruoli** (i piani nascono così dal seed): il primo
 *    mese la coach non prende niente, e se ne accorge lei prima di noi;
 *  - il piano del monitoraggio è visibile a chiunque perché gli è stato cambiato il `period`.
 *
 * Questo script guarda i dati veri e dice cosa manca, senza toccare niente.
 *
 * USO (shell di Render, dentro ~/project/src/backend):
 *   npm run diag:ricorrente
 *
 * NON verifica la configurazione Stripe (eventi della webhook, portale clienti): quella si legge
 * solo dal pannello, ed è annotata in `progetto/STATO.md`.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const euro = (c: number): string => '€ ' + (c / 100).toFixed(2).replace('.', ',');

type Piano = {
  id: string; name: string; period: string; billing: string | null;
  priceCents: number; active: boolean; hidden: boolean;
  commissionCoachPct: number | null; commissionCoordinatorPct: number | null;
  commissionManagerPct: number | null; commissionNutritionistPct: number | null;
  commissionHeadNutritionistPct: number | null;
  commissionCoachCents: number | null; commissionManagerCoachCents: number | null;
  commissionNutritionistCents: number | null; commissionHeadNutritionistCents: number | null;
};

/** Somma "grezza" delle provvigioni impostate: serve solo a distinguere «zero ovunque» dal resto. */
function haProvvigioni(p: Piano): boolean {
  const valori = [
    p.commissionCoachPct, p.commissionCoordinatorPct, p.commissionManagerPct,
    p.commissionNutritionistPct, p.commissionHeadNutritionistPct,
    p.commissionCoachCents, p.commissionManagerCoachCents,
    p.commissionNutritionistCents, p.commissionHeadNutritionistCents,
  ];
  return valori.some((v) => (v ?? 0) > 0);
}

async function main(): Promise<void> {
  const problemi: string[] = [];
  const note: string[] = [];

  // ---------- 1. I due piani che si vendono in abbonamento ----------
  const piani = (await prisma.plan.findMany({
    where: { OR: [{ period: 'maintenance' }, { period: 'monitoring' }, { billing: { in: ['recurring', 'both'] } }] } as never,
    orderBy: { priceCents: 'asc' },
  })) as unknown as Piano[];

  if (piani.length === 0) {
    problemi.push('Nessun piano in abbonamento a database. Il seed li crea al deploy: se manca, il deploy non è passato o SEED_DEMO ha saltato qualcosa.');
  }

  const tabella = piani.map((p) => ({
    nome: p.name,
    periodo: p.period,
    'si vende come': p.billing ?? 'one_time',
    prezzo: euro(p.priceCents),
    attivo: p.active ? 'sì' : 'NO',
    nascosto: p.hidden ? 'sì' : 'no',
    provvigioni: haProvvigioni(p) ? 'impostate' : 'TUTTE A ZERO',
  }));
  if (tabella.length) {
    console.log('--- Piani in abbonamento ---');
    console.table(tabella);
  }

  for (const p of piani) {
    const billing = p.billing ?? 'one_time';
    if (p.period === 'maintenance' && billing !== 'both') {
      problemi.push(`«${p.name}»: dovrebbe vendersi come "A scelta della cliente" (both), invece è "${billing}". Si corregge dal Negozio, campo «Come si vende».`);
    }
    if (p.period === 'monitoring' && billing !== 'recurring') {
      problemi.push(`«${p.name}»: dovrebbe vendersi solo in abbonamento (recurring), invece è "${billing}". Si corregge dal Negozio, campo «Come si vende».`);
    }
    if (billing !== 'one_time' && p.priceCents <= 0) {
      problemi.push(`«${p.name}» è in abbonamento ma costa ${euro(p.priceCents)}: Stripe rifiuta una sessione ricorrente senza importo.`);
    }
    if (!p.active) {
      note.push(`«${p.name}» è disattivato: non compare nello shop. Voluto?`);
    }
    if (!haProvvigioni(p)) {
      problemi.push(`«${p.name}»: provvigioni a ZERO per tutti i ruoli. I piani nascono così dal seed — vanno compilate dal Negozio, altrimenti il primo rinnovo non paga nessuno, coach compresa. (Deciso il 7/8: quota coach ridotta sul monitoraggio.)`);
    }
  }

  // ---------- 2. Il piano ritirato non deve essere più in vendita ----------
  const rientro = (await prisma.plan.findFirst({
    where: { name: 'Menu di rientro (8 giorni)' },
    select: { active: true, hidden: true },
  })) as { active: boolean; hidden: boolean } | null;
  if (rientro && rientro.active) {
    problemi.push('«Menu di rientro (8 giorni)» risulta ancora ATTIVO: doveva essere ritirato il 7/8 (i menu di rientro sono inclusi). Il seed lo disattiva al deploy.');
  }

  // ---------- 3. Parametri di configurazione letti dal ricorrente ----------
  const chiavi = ['lead_credentials_link_days', 'referral_card_after_days', 'agent_return_days', 'travel_max_days'];
  const params = (await prisma.configParam.findMany({
    where: { key: { in: chiavi } },
    select: { key: true, value: true },
  })) as { key: string; value: string }[];
  const presenti = new Set(params.map((p) => p.key));
  const mancanti = chiavi.filter((k) => !presenti.has(k));
  if (mancanti.length) {
    note.push(`Parametri non ancora a database: ${mancanti.join(', ')}. Non è grave — il codice ha i suoi default — ma finché non ci sono non si possono cambiare dal backoffice.`);
  }

  // ---------- 4. Abbonamenti ricorrenti già esistenti ----------
  const ricorrenti = (await prisma.subscription.count({
    where: { stripeSubscriptionId: { not: null } } as never,
  })) as number;
  const senzaStripe = (await prisma.subscription.count({
    where: { status: 'active' as never, stripeSubscriptionId: null, plan: { billing: { in: ['recurring', 'both'] } } } as never,
  })) as number;
  console.log(`\n--- Abbonamenti ---`);
  console.log(`Con id Stripe (ricorrenti veri): ${ricorrenti}`);
  if (senzaStripe > 0) {
    note.push(`${senzaStripe} abbonamenti attivi su piani ricorrenti ma SENZA id Stripe: sono acquisti a mese singolo (o pre-ricorrente). Non si rinnoveranno da soli — è corretto se erano mesi singoli.`);
  }

  // ---------- Esito ----------
  if (note.length) {
    console.log('\n--- Da sapere (non bloccanti) ---');
    for (const n of note) console.log('  · ' + n);
  }
  if (problemi.length === 0) {
    console.log('\n✓ Tutto a posto lato dati: si può vendere un abbonamento.');
    console.log('  Resta da controllare a mano nel pannello Stripe: 5 eventi sulla webhook e portale clienti attivo (vedi STATO.md).');
    return;
  }
  console.log(`\n--- DA SISTEMARE: ${problemi.length} ---`);
  for (const p of problemi) console.log('  ⚠️  ' + p);
  process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
