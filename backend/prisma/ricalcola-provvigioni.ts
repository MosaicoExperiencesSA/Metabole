/**
 * RICALCOLO delle provvigioni su pagamenti già approvati.
 *
 * Nasce dall'8/8: il piano «Percorso Metabole 3 mesi» aveva le percentuali scritte come
 * *quote separate* (25 / 10 / 10 / 10 / 5) invece che come **soglie cumulative**. Il motore
 * paga a differenza, quindi al secondo livello calcolava `10 − 25 = −15` — negativo — e si
 * fermava: incassava solo la coach. Corretto il piano (25 / 35 / 45 e 10 / 15) i pagamenti
 * futuri sono a posto, ma quelli già fatti **non si ricalcolano da soli**.
 *
 * ## Come lavora, e perché così
 *
 * Non cancella niente e non rifà i conti da zero: **aggiunge solo quello che manca**.
 * Per ogni pagamento ricalcola la scala con le percentuali di OGGI, guarda quanto ciascuno ha
 * già ricevuto per quel pagamento (`ledger_entry.ref`), e accredita la differenza se positiva.
 *
 * È la scelta prudente per due motivi:
 *  - cancellare righe di contabilità già registrate significa toccare compensi che qualcuno
 *    potrebbe aver già visto o incassato;
 *  - se qualcuno ha ricevuto **di più** del dovuto, questo script non gli toglie niente: lo
 *    segnala e basta. Togliere soldi a una persona non è un'operazione da script.
 *
 * Rilanciarlo due volte non raddoppia niente: la seconda volta la differenza è zero.
 *
 * USO (shell di Render, dentro ~/project/src/backend):
 *   npm run ricalcola:provvigioni -- cliente@esempio.it   → una cliente
 *   npm run ricalcola:provvigioni -- 2026-07-01               → tutti i pagamenti da quella data
 *   CONFERMA=1 npm run ricalcola:provvigioni -- ...           → applica
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const eur = (c: number) => '€ ' + (c / 100).toFixed(2).replace('.', ',');

/** Catena reale a partire da uno staff, risalendo `managerId` (max 4 anelli, cicli esclusi). */
async function catena(staffId: string | null | undefined): Promise<{ id: string; nome: string; ruolo: string }[]> {
  const out: { id: string; nome: string; ruolo: string }[] = [];
  const visti = new Set<string>();
  let cur: string | null = staffId ?? null;
  for (let hop = 0; hop < 4 && cur && !visti.has(cur); hop++) {
    visti.add(cur);
    const st = (await prisma.staff.findUnique({
      where: { id: cur },
      select: { id: true, displayName: true, managerId: true, user: { select: { role: true } } },
    })) as { id: string; displayName: string; managerId: string | null; user: { role: string } | null } | null;
    if (!st) break;
    out.push({ id: st.id, nome: st.displayName, ruolo: st.user?.role ?? '' });
    cur = st.managerId;
  }
  return out;
}

/**
 * Quanto spetta a ciascuno lungo una catena, con la regola a differenza.
 * Identica a `settleChain` in `finance.service.ts` — se un giorno cambia lì, va cambiata qui.
 */
function dovuto(
  anelli: { id: string; nome: string; ruolo: string }[],
  scala: { ruolo: string; importoCents: number }[],
): Map<string, { nome: string; ruolo: string; cents: number }> {
  const out = new Map<string, { nome: string; ruolo: string; cents: number }>();
  const livelloDi = (ruolo: string) => scala.findIndex((l) => l.ruolo === ruolo);
  let livelloPagato = -1;
  let giaPagato = 0;
  for (const a of anelli) {
    const lvl = livelloDi(a.ruolo);
    if (lvl < 0 || lvl <= livelloPagato) continue;
    const diff = scala[lvl].importoCents - giaPagato;
    if (diff > 0) out.set(a.id, { nome: a.nome, ruolo: a.ruolo, cents: diff });
    livelloPagato = lvl;
    giaPagato = Math.max(giaPagato, scala[lvl].importoCents);
    if (livelloPagato >= scala.length - 1) break;
  }
  return out;
}

function periodoCorrente(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function main(): Promise<void> {
  const arg = (process.argv.slice(2).join(' ') || '').trim();
  const conferma = process.env.CONFERMA === '1';
  if (!arg) {
    console.log(
      'Indica una cliente o una data di partenza:\n' +
      '  npm run ricalcola:provvigioni -- nome@esempio.it\n' +
      '  npm run ricalcola:provvigioni -- 2026-07-01',
    );
    return;
  }

  // Quali pagamenti guardare
  let where: Record<string, unknown>;
  if (/^\d{4}-\d{2}-\d{2}$/.test(arg)) {
    where = { status: 'approved', createdAt: { gte: new Date(`${arg}T00:00:00.000Z`) } };
  } else {
    const u = (await prisma.user.findFirst({ where: { email: arg.toLowerCase() }, select: { id: true } })) as { id: string } | null;
    if (!u) { console.log(`Nessun utente con email ${arg}.`); return; }
    where = { status: 'approved', clientId: u.id };
  }

  const pagamenti = (await prisma.payment.findMany({
    where: where as never,
    select: { id: true, clientId: true, amountCents: true, description: true, createdAt: true, subscriptionId: true },
    orderBy: { createdAt: 'asc' },
    take: 500,
  })) as { id: string; clientId: string; amountCents: number; description: string; createdAt: Date; subscriptionId: string | null }[];

  if (pagamenti.length === 0) { console.log('Nessun pagamento approvato da esaminare.'); return; }
  console.log(`Pagamenti approvati da esaminare: ${pagamenti.length}\n`);

  const daAccreditare: { staffId: string; cents: number; paymentId: string; clientId: string }[] = [];
  const tabella: Record<string, unknown>[] = [];
  const eccessi: Record<string, unknown>[] = [];

  for (const pay of pagamenti) {
    if (!pay.subscriptionId) continue; // solo abbonamenti: gli ordini prodotto hanno altre quote
    const sub = (await prisma.subscription.findUnique({
      where: { id: pay.subscriptionId },
      select: {
        plan: {
          select: {
            name: true,
            commissionCoachPct: true, commissionCoordinatorPct: true, commissionManagerPct: true,
            commissionNutritionistPct: true, commissionHeadNutritionistPct: true,
          },
        },
      },
    })) as never as { plan: Record<string, number | string> | null } | null;
    const p = sub?.plan as Record<string, number> | null | undefined;
    if (!p) continue;

    const q = (pct: number) => Math.round(pay.amountCents * (Number(pct) || 0) / 100);
    const scalaCoach = [
      { ruolo: 'coach', importoCents: q(p.commissionCoachPct) },
      { ruolo: 'coach_coordinator', importoCents: q(p.commissionCoordinatorPct) },
      { ruolo: 'sales', importoCents: q(p.commissionManagerPct) },
    ];
    const scalaNutri = [
      { ruolo: 'nutritionist', importoCents: q(p.commissionNutritionistPct) },
      { ruolo: 'head_nutritionist', importoCents: q(p.commissionHeadNutritionistPct) },
    ];
    if (scalaCoach.every((x) => x.importoCents === 0) && scalaNutri.every((x) => x.importoCents === 0)) continue;

    const profilo = (await prisma.clientProfile.findUnique({
      where: { userId: pay.clientId },
      select: { name: true, assignedCoachId: true, assignedNutritionistId: true },
    })) as { name: string | null; assignedCoachId: string | null; assignedNutritionistId: string | null } | null;

    const atteso = new Map<string, { nome: string; ruolo: string; cents: number }>();
    for (const [staffId, v] of dovuto(await catena(profilo?.assignedCoachId), scalaCoach)) atteso.set(staffId, v);
    for (const [staffId, v] of dovuto(await catena(profilo?.assignedNutritionistId), scalaNutri)) atteso.set(staffId, v);

    // Già pagato per QUESTO pagamento, per staff.
    const righe = (await prisma.ledgerEntry.findMany({
      where: { ref: pay.id, category: 'sales_commission' as never },
      select: { staffId: true, amountCents: true },
    })) as { staffId: string | null; amountCents: number }[];
    const gia = new Map<string, number>();
    for (const r of righe) if (r.staffId) gia.set(r.staffId, (gia.get(r.staffId) ?? 0) + r.amountCents);

    for (const [staffId, v] of atteso) {
      const g = gia.get(staffId) ?? 0;
      const diff = v.cents - g;
      if (diff > 0) {
        daAccreditare.push({ staffId, cents: diff, paymentId: pay.id, clientId: pay.clientId });
        tabella.push({
          cliente: profilo?.name ?? pay.clientId.slice(0, 8),
          pagamento: `${pay.description} ${eur(pay.amountCents)}`,
          a: `${v.nome} (${v.ruolo})`,
          dovuto: eur(v.cents), 'già preso': eur(g), 'da aggiungere': eur(diff),
        });
      } else if (diff < 0) {
        eccessi.push({
          cliente: profilo?.name ?? pay.clientId.slice(0, 8),
          a: `${v.nome} (${v.ruolo})`,
          dovuto: eur(v.cents), 'ha preso': eur(g), differenza: eur(-diff),
        });
      }
    }
  }

  if (tabella.length === 0) {
    console.log('Niente da aggiungere: tutti i pagamenti esaminati sono già a posto ✓');
  } else {
    console.log(`--- DA AGGIUNGERE (${tabella.length} righe) ---`);
    console.table(tabella);
    const totale = daAccreditare.reduce((n, x) => n + x.cents, 0);
    console.log(`Totale da accreditare: ${eur(totale)}`);
  }

  if (eccessi.length) {
    console.log(
      `\n--- HANNO PRESO PIÙ DEL DOVUTO (${eccessi.length}) — non tolgo niente, decidete voi ---`,
    );
    console.table(eccessi);
  }

  if (!conferma) {
    console.log('\nNiente scritto: rilancia con  CONFERMA=1 npm run ricalcola:provvigioni -- ' + arg);
    return;
  }
  if (daAccreditare.length === 0) return;

  // Accredito: stessa forma di `creditStaff` in finance.service.ts (compenso del periodo
  // CORRENTE + riga di contabilità), così i conguagli finiscono nel mese in cui li si fa.
  const period = periodoCorrente();
  for (const x of daAccreditare) {
    const existing = (await prisma.staffCompensation.findUnique({
      where: { staffId_period: { staffId: x.staffId, period } },
      select: { items: true },
    })) as { items: unknown } | null;
    const items = [
      ...((existing?.items as unknown[]) ?? []),
      { at: new Date().toISOString(), kind: 'sales_commission', amountCents: x.cents, ref: x.paymentId, nota: 'conguaglio scala provvigioni' },
    ];
    await prisma.staffCompensation.upsert({
      where: { staffId_period: { staffId: x.staffId, period } },
      create: { staffId: x.staffId, period, amountCents: x.cents, items: items as never },
      update: { amountCents: { increment: x.cents }, items: items as never },
    });
    await prisma.ledgerEntry.create({
      data: {
        type: 'expense' as never,
        amountCents: x.cents,
        category: 'sales_commission' as never,
        ref: x.paymentId,
        clientId: x.clientId,
        staffId: x.staffId,
      },
    });
  }
  console.log(`\n✓ Accreditate ${daAccreditare.length} quote mancanti nel periodo ${period}.`);
  console.log('Rilanciare non raddoppia: la seconda volta la differenza è zero.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
