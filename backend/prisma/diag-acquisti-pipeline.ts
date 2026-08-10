/**
 * CONTROLLO: perché gli acquisti non corrispondono allo stato della pipeline?
 *
 * Domanda di Simone dell'11/8, con due schermate accanto: la tabella Acquisti con dodici righe, la
 * colonna «Acquisito» della pipeline con due schede. E un caso specifico: un lead con «€ 349» sulla
 * scheda della pipeline e «€ 0,00» nella riga degli acquisti.
 *
 * ## Non sono la stessa cosa, e non lo sono per scelta
 *
 * Sono **due numeri diversi con due significati diversi**, e in tre casi divergono per come è stato
 * costruito il prodotto — non per un difetto:
 *
 * 1. **La prova gratuita è un acquisto a € 0.** Genera una riga in Acquisti (serve: è l'attivazione
 *    di un prodotto) ma porta il lead in «Prova», non in «Acquisito». Dodici righe in Acquisti con
 *    dieci prove gratuite fanno due schede in «Acquisito», ed è esatto.
 * 2. **L'attivazione manuale dalla scheda cliente non tocca il CRM.** È la regola che Simone ha
 *    chiesto: si registra a 0 e non entra in contabilità. Il servizio la riconosce (`skipIncome`) e
 *    NON avanza lo stato — altrimenti una cliente al terzo percorso verrebbe retrocessa a «Prova» e
 *    alla coach arriverebbe «ha attivato la settimana di prova», che è falso.
 * 3. **Il «€» sulla scheda della pipeline è `valueCents` del CRM, non la somma dei pagamenti.** Lo
 *    scrive un pagamento vero, ma può anche averlo messo a mano un'operatrice quando ha creato il
 *    lead (il valore *atteso* di quella trattativa), o può venire da `historicalPaidCents` per chi
 *    ha pagato fuori dall'app. Un lead con «€ 349» e un acquisto a «€ 0,00» è quasi sempre questo:
 *    valore inserito a mano o piano attivato a mano, e nessun incasso da nessuna parte.
 *
 * Questo script dice, per ogni cliente, QUALE dei tre casi è — invece di lasciar dedurre. Non tocca
 * niente: legge e stampa.
 *
 *   npm run diag:acquisti-pipeline                    → tutti i disallineamenti
 *   EMAIL=<email> npm run diag:acquisti-pipeline      → il dettaglio di una cliente sola
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const EMAIL = (process.env.EMAIL ?? '').trim().toLowerCase();

const euro = (c: number | null | undefined) => '€ ' + ((c ?? 0) / 100).toFixed(2).replace('.', ',');
const giorno = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : '—');

interface Riga {
  clientId: string;
  email: string;
  nome: string;
  stage: string;
  etichettaStage: string;
  valueCents: number | null;
  historicalPaidCents: number | null;
  pagamenti: { amountCents: number; status: string; method: string; createdAt: Date; descrizione: string }[];
}

async function main() {
  const stati = (await prisma.pipelineStage.findMany({ select: { key: true, label: true } })) as { key: string; label: string }[];
  const etichetta = new Map(stati.map((s) => [s.key, s.label]));

  const records = (await prisma.crmRecord.findMany({
    where: { clientId: { not: null }, ...(EMAIL ? { client: { email: EMAIL } } : {}) },
    select: {
      clientId: true,
      stage: true,
      valueCents: true,
      historicalPaidCents: true,
      name: true,
      client: { select: { email: true, clientProfile: { select: { name: true } } } },
    },
  } as never)) as unknown as {
    clientId: string;
    stage: string;
    valueCents: number | null;
    historicalPaidCents: number | null;
    name: string | null;
    client: { email: string; clientProfile: { name: string | null } | null } | null;
  }[];

  if (records.length === 0) {
    console.log(EMAIL ? `Nessun lead nel CRM per ${EMAIL}.` : 'Nessun lead collegato a una cliente.');
    return;
  }

  const pagamenti = (await prisma.payment.findMany({
    where: { clientId: { in: records.map((r) => r.clientId) } },
    select: { clientId: true, amountCents: true, status: true, method: true, createdAt: true, description: true },
    orderBy: { createdAt: 'desc' },
  })) as unknown as {
    clientId: string;
    amountCents: number;
    status: string;
    method: string;
    createdAt: Date;
    description: string | null;
  }[];

  const perCliente = new Map<string, Riga>();
  for (const r of records) {
    perCliente.set(r.clientId, {
      clientId: r.clientId,
      email: r.client?.email ?? '—',
      nome: r.client?.clientProfile?.name ?? r.name ?? '—',
      stage: r.stage,
      etichettaStage: etichetta.get(r.stage) ?? r.stage,
      valueCents: r.valueCents,
      historicalPaidCents: r.historicalPaidCents,
      pagamenti: [],
    });
  }
  for (const p of pagamenti) {
    perCliente.get(p.clientId)?.pagamenti.push({
      amountCents: p.amountCents,
      status: p.status,
      method: p.method,
      createdAt: p.createdAt,
      descrizione: p.description ?? '—',
    });
  }

  const righe = [...perCliente.values()];
  /** Quello che è stato davvero incassato: solo pagamenti approvati e sopra zero. */
  const incassato = (r: Riga) =>
    r.pagamenti.filter((p) => p.status === 'approved' && p.amountCents > 0).reduce((a, p) => a + p.amountCents, 0);

  if (EMAIL) {
    for (const r of righe) dettaglio(r, incassato(r));
    return;
  }

  // --- I tre disallineamenti, ognuno con il suo perché ---

  const acquisitoSenzaIncasso = righe.filter((r) => r.stage === 'paid' && incassato(r) === 0);
  const incassoSenzaAcquisito = righe.filter((r) => r.stage !== 'paid' && incassato(r) > 0);
  const valoreDiverso = righe.filter((r) => incassato(r) > 0 && (r.valueCents ?? 0) !== incassato(r));

  console.log('\n=== «Acquisito» in pipeline, ma nessun incasso registrato ===');
  console.log('   Attivazione manuale (registrata a 0, per scelta), valore messo a mano, o pagamento fuori app.');
  if (acquisitoSenzaIncasso.length === 0) console.log('   nessuno ✓');
  for (const r of acquisitoSenzaIncasso) {
    const storico = (r.historicalPaidCents ?? 0) > 0 ? ` · già pagato fuori app ${euro(r.historicalPaidCents)}` : '';
    console.log(`   ${r.nome} <${r.email}> · valore CRM ${euro(r.valueCents)}${storico}`);
    for (const p of r.pagamenti.slice(0, 3)) {
      console.log(`      ${giorno(p.createdAt)} ${euro(p.amountCents)} ${p.method}/${p.status} — ${p.descrizione}`);
    }
  }

  console.log('\n=== Ha incassato, ma in pipeline NON è «Acquisito» ===');
  console.log('   Questo sì che è da guardare: un pagamento vero avanza lo stato da solo.');
  if (incassoSenzaAcquisito.length === 0) console.log('   nessuno ✓');
  for (const r of incassoSenzaAcquisito) {
    console.log(`   ${r.nome} <${r.email}> · stato «${r.etichettaStage}» · incassato ${euro(incassato(r))}`);
  }

  console.log('\n=== Il «€» della scheda pipeline non è la somma incassata ===');
  console.log('   `valueCents` è il valore della trattativa, non la contabilità: differisce di proposito');
  console.log('   quando è stato scritto a mano o quando ci sono più pagamenti.');
  if (valoreDiverso.length === 0) console.log('   nessuno');
  for (const r of valoreDiverso.slice(0, 30)) {
    console.log(`   ${r.nome} <${r.email}> · pipeline ${euro(r.valueCents)} · incassato ${euro(incassato(r))}`);
  }

  const prove = righe.filter((r) => r.stage === 'trial').length;
  console.log(`\nEsaminate ${righe.length} clienti nel CRM · ${prove} in «Prova» (acquisti a € 0, non contano come «Acquisito»).`);
  console.log('Dettaglio di una sola: EMAIL=<email> npm run diag:acquisti-pipeline\n');
}

function dettaglio(r: Riga, incassato: number) {
  console.log(`\n${r.nome} <${r.email}>`);
  console.log(`  stato pipeline : ${r.etichettaStage} (${r.stage})`);
  console.log(`  € sulla scheda : ${euro(r.valueCents)}   ← valueCents del CRM, non la contabilità`);
  console.log(`  incassato vero : ${euro(incassato)}   ← solo pagamenti approvati sopra zero`);
  if ((r.historicalPaidCents ?? 0) > 0) console.log(`  già pagato fuori app: ${euro(r.historicalPaidCents)}`);
  console.log(`  pagamenti (${r.pagamenti.length}):`);
  for (const p of r.pagamenti) {
    console.log(`    ${giorno(p.createdAt)} ${euro(p.amountCents).padStart(12)} ${p.method}/${p.status} — ${p.descrizione}`);
  }
  if (incassato === 0 && r.stage === 'paid') {
    console.log('  → «Acquisito» senza incasso: attivazione manuale registrata a 0, oppure stato/valore messi a mano.');
  }
  if (r.pagamenti.some((p) => p.amountCents === 0)) {
    console.log('  → Le righe a € 0 sono prove gratuite o attivazioni interne: compaiono in Acquisti e non in «Acquisito».');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
