/**
 * DIAGNOSTICA delle PROVVIGIONI di un pagamento: chi ha preso quanto, e perché gli altri no.
 *
 * Nasce da una domanda concreta (8/8): «un acquisto da €349 con Coach 25% · Coord. 10% ·
 * Mgr 10% · Nutriz. 10% · Capo n. 5%, e risulta pagata solo la coach: perché?».
 *
 * Dal backoffice non si capisce, perché le ragioni sono tre e nessuna produce un errore:
 *
 * 1. **Le percentuali sono una SCALA CUMULATIVA, non quote separate.** Il motore paga *a
 *    differenza*: ogni livello incassa la sua soglia meno quello già pagato sotto. Con
 *    25/35/45 esce coach 25, coordinatrice 10, manager 10. Con 25/10/10 il secondo livello
 *    calcola `10 − 25 = −15`: negativo, quindi **nessuno prende niente** e la catena si ferma.
 *    È l'errore di configurazione più facile da fare, perché 25/10/10 è esattamente come si
 *    scriverebbe pensando «quanto prende ciascuno».
 * 2. **La catena non esiste.** I livelli sopra si trovano seguendo `Staff.managerId`. Se la
 *    coach non ha un manager, sopra di lei non c'è nessuno da pagare — e non è un errore.
 * 3. **Il ruolo non è quello atteso.** La scala è per RUOLO (`coach_coordinator`, `sales`,
 *    `head_nutritionist`): se il manager della coach ha ruolo `coach`, è fuori scala e viene
 *    saltato.
 *
 * E se il lato nutrizionista non è assegnato, la quota non sparisce: finisce **accantonata**
 * (`pending_commission`) e verrà pagata a chi sarà assegnato.
 *
 * USO (shell di Render, dentro ~/project/src/backend):
 *   npm run diag:provvigioni -- cliente@esempio.it     → l'ultimo pagamento di quella cliente
 *   npm run diag:provvigioni -- <id-pagamento>
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const eur = (c: number) => '€ ' + (c / 100).toFixed(2).replace('.', ',');

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
    out.push({ id: st.id, nome: st.displayName, ruolo: st.user?.role ?? '(senza ruolo)' });
    cur = st.managerId;
  }
  return out;
}

async function main(): Promise<void> {
  const arg = (process.argv.slice(2).join(' ') || '').trim();
  if (!arg) {
    console.log('Indica email della cliente o id del pagamento:\n  npm run diag:provvigioni -- nome@esempio.it');
    return;
  }

  let payment = (await prisma.payment.findUnique({
    where: { id: arg },
    select: { id: true, clientId: true, amountCents: true, description: true, status: true, createdAt: true, subscriptionId: true },
  })) as { id: string; clientId: string; amountCents: number; description: string; status: string; createdAt: Date; subscriptionId: string | null } | null;

  if (!payment) {
    const user = (await prisma.user.findFirst({ where: { email: arg.toLowerCase() }, select: { id: true } })) as { id: string } | null;
    if (!user) { console.log(`Nessun pagamento con id ${arg} e nessun utente con quella email.`); return; }
    payment = (await prisma.payment.findFirst({
      where: { clientId: user.id, status: 'approved' as never },
      orderBy: { createdAt: 'desc' },
      select: { id: true, clientId: true, amountCents: true, description: true, status: true, createdAt: true, subscriptionId: true },
    })) as never;
    if (!payment) { console.log('Quella cliente non ha pagamenti approvati.'); return; }
  }

  const profilo = (await prisma.clientProfile.findUnique({
    where: { userId: payment.clientId },
    select: {
      name: true, assignedCoachId: true, assignedNutritionistId: true,
      user: { select: { email: true } },
    },
  })) as { name: string | null; assignedCoachId: string | null; assignedNutritionistId: string | null; user: { email: string } | null } | null;

  console.log('=== PAGAMENTO ===');
  console.log(`${profilo?.name ?? '(cliente)'} · ${profilo?.user?.email ?? '—'}`);
  console.log(`${payment.description} · ${eur(payment.amountCents)} · ${payment.status} · ${payment.createdAt.toISOString().slice(0, 10)}`);
  console.log(`id: ${payment.id}`);

  // Percentuali del piano
  const sub = payment.subscriptionId
    ? ((await prisma.subscription.findUnique({
        where: { id: payment.subscriptionId },
        select: { plan: { select: { name: true, priceCents: true, commissionCoachPct: true, commissionCoordinatorPct: true, commissionManagerPct: true, commissionNutritionistPct: true, commissionHeadNutritionistPct: true } } },
      })) as never as { plan: Record<string, number | string> | null } | null)
    : null;
  const p = sub?.plan as Record<string, number> | null | undefined;

  console.log('\n=== SCALA DEL PIANO (cumulativa, si paga a differenza) ===');
  if (!p) {
    console.log('Nessun piano collegato: le percentuali non si applicano (modello a importi fissi).');
  } else {
    const coach = Number(p.commissionCoachPct ?? 0);
    const coord = Number(p.commissionCoordinatorPct ?? 0);
    const mgr = Number(p.commissionManagerPct ?? 0);
    const nutr = Number(p.commissionNutritionistPct ?? 0);
    const capo = Number(p.commissionHeadNutritionistPct ?? 0);
    console.table([
      { livello: '1 · coach', soglia: `${coach}%`, 'importo soglia': eur(Math.round(payment.amountCents * coach / 100)) },
      { livello: '2 · coordinatrice', soglia: `${coord}%`, 'importo soglia': eur(Math.round(payment.amountCents * coord / 100)) },
      { livello: '3 · manager (sales)', soglia: `${mgr}%`, 'importo soglia': eur(Math.round(payment.amountCents * mgr / 100)) },
      { livello: '1 · nutrizionista', soglia: `${nutr}%`, 'importo soglia': eur(Math.round(payment.amountCents * nutr / 100)) },
      { livello: '2 · capo nutrizionista', soglia: `${capo}%`, 'importo soglia': eur(Math.round(payment.amountCents * capo / 100)) },
    ]);
    const guai: string[] = [];
    if (coord > 0 && coord <= coach) guai.push(`coordinatrice ${coord}% NON supera coach ${coach}%: differenza negativa, non prende niente`);
    if (mgr > 0 && mgr <= Math.max(coach, coord)) guai.push(`manager ${mgr}% NON supera il livello sotto: differenza negativa, non prende niente`);
    if (capo > 0 && capo <= nutr) guai.push(`capo nutrizionista ${capo}% NON supera nutrizionista ${nutr}%: differenza negativa, non prende niente`);
    if (guai.length) {
      console.log(
        '\n⚠️  LA SCALA NON È CRESCENTE — è la causa più probabile di provvigioni mancanti:\n' +
        guai.map((g) => `    · ${g}`).join('\n') +
        '\n    Le percentuali sono SOGLIE CUMULATIVE, non quote separate. Per dare 25% alla coach,\n' +
        '    10% alla coordinatrice e 10% al manager si scrive 25 / 35 / 45.\n' +
        '    ⚠️ Correggere il piano NON ricalcola i pagamenti già fatti: quelli vanno sistemati a mano.',
      );
    } else {
      console.log('\nScala crescente ✓ (le differenze sono positive a ogni livello)');
    }
  }

  // Catene reali
  console.log('\n=== CATENA COACH (si risale con Staff.managerId) ===');
  if (!profilo?.assignedCoachId) {
    console.log('Nessuna coach assegnata → la quota viene ACCANTONATA, non persa.');
  } else {
    const c = await catena(profilo.assignedCoachId);
    console.table(c.map((x, i) => ({ anello: i + 1, nome: x.nome, ruolo: x.ruolo, 'in scala?': ['coach', 'coach_coordinator', 'sales'].includes(x.ruolo) ? 'sì' : 'NO — saltato' })));
    if (c.length === 1) console.log('⚠️  Sopra la coach non c\'è nessuno: `managerId` non è impostato, quindi coordinatrice e manager non esistono per questa vendita.');
  }

  console.log('\n=== CATENA NUTRIZIONISTA ===');
  if (!profilo?.assignedNutritionistId) {
    console.log('Nessuna nutrizionista assegnata → la quota viene ACCANTONATA, non persa (vedi sotto).');
  } else {
    const n = await catena(profilo.assignedNutritionistId);
    console.table(n.map((x, i) => ({ anello: i + 1, nome: x.nome, ruolo: x.ruolo, 'in scala?': ['nutritionist', 'head_nutritionist'].includes(x.ruolo) ? 'sì' : 'NO — saltato' })));
    if (n.length === 1) console.log('⚠️  Sopra la nutrizionista non c\'è nessuno: il capo nutrizionista non esiste per questa vendita.');
  }

  // Cosa è stato pagato davvero
  const righe = (await prisma.ledgerEntry.findMany({
    where: { ref: payment.id },
    select: { amountCents: true, category: true, staffId: true, date: true },
  })) as { amountCents: number; category: string; staffId: string | null; date: Date }[];
  const staffIds = [...new Set(righe.map((r) => r.staffId).filter((x): x is string => !!x))];
  const staff = staffIds.length
    ? ((await prisma.staff.findMany({ where: { id: { in: staffIds } }, select: { id: true, displayName: true, user: { select: { role: true } } } })) as { id: string; displayName: string; user: { role: string } | null }[])
    : [];
  const nomeDi = new Map(staff.map((s) => [s.id, `${s.displayName} (${s.user?.role ?? '—'})`]));

  console.log('\n=== PAGATO DAVVERO ===');
  if (righe.length === 0) console.log('nessuna provvigione registrata per questo pagamento');
  else console.table(righe.map((r) => ({ a: r.staffId ? nomeDi.get(r.staffId) ?? r.staffId : '—', voce: r.category, importo: eur(r.amountCents) })));

  const pend = (await prisma.pendingCommission.findMany({
    where: { paymentId: payment.id },
    select: { role: true, amountCents: true, status: true, resolvedAt: true },
  })) as { role: string; amountCents: number; status: string; resolvedAt: Date | null }[];
  console.log('\n=== ACCANTONATO (in attesa di assegnazione) ===');
  if (pend.length === 0) console.log('niente');
  else {
    console.table(pend.map((x) => ({
      ruolo: x.role,
      importo: eur(x.amountCents),
      stato: x.status,
      risolta: x.resolvedAt ? x.resolvedAt.toISOString().slice(0, 10) : 'no',
    })));
    console.log('Questi soldi NON sono persi: vengono pagati a chi verrà assegnato.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
