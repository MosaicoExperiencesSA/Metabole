/**
 * DIAGNOSTICA (sola lettura) degli abbonamenti/pagamenti di un account.
 *
 * NON scrive MAI nulla: elenca solo, per l'email indicata, tutte le subscription
 * (piano, prezzo, stato, date) e i pagamenti collegati. Serve a capire casi come
 * "prova attiva un mese": si vede subito quale piano è stato attivato, con che durata
 * e quale endDate ha davvero.
 *
 * Uso (dalla Shell di Render sul backend, dove c'è DATABASE_URL):
 *   npm run diag:subs -- simone.salogni@gmail.com     # un account
 *   npm run diag:subs                                  # riepilogo di TUTTE le prove (piani €0)
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const iso = (d: Date | null | undefined): string => (d ? new Date(d).toISOString().slice(0, 10) : '—');
const eur = (c: number | null | undefined): string => (c == null ? '—' : `€${(c / 100).toFixed(2)}`);
const daysBetween = (a: Date | null, b: Date | null): string =>
  a && b ? `${Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000)}g` : '—';

/** Il period è in un formato riconosciuto? (allineato a isKnownPeriod del backend) */
function knownPeriod(period: string): boolean {
  const p = String(period ?? '').trim().toLowerCase();
  if (p === 'maintenance') return true;
  const m = p.match(/^(\d+)\s*([dwmy]?)$/);
  return !!m && Number.isFinite(parseInt(m[1], 10)) && parseInt(m[1], 10) > 0;
}

async function dumpForEmail(email: string): Promise<void> {
  const user = (await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, email: true, createdAt: true, clientProfile: { select: { name: true, planStartDate: true } } },
  })) as
    | { id: string; email: string; createdAt: Date; clientProfile: { name: string | null; planStartDate: Date | null } | null }
    | null;

  if (!user) {
    console.log(`\n❌ Nessun account con email «${email}».`);
    return;
  }

  console.log(`\n=== ${user.email} ===`);
  console.log(`  id: ${user.id} · nome: ${user.clientProfile?.name ?? '—'} · registrato: ${iso(user.createdAt)}`);
  console.log(`  inizio piano (profilo): ${iso(user.clientProfile?.planStartDate ?? null)}`);

  const subs = (await prisma.subscription.findMany({
    where: { clientId: user.id },
    orderBy: { createdAt: 'desc' },
    include: { plan: { select: { name: true, priceCents: true, period: true } } },
  })) as {
    id: string; status: string; startDate: Date | null; endDate: Date | null; createdAt: Date;
    plan: { name: string; priceCents: number; period: string };
  }[];

  console.log(`\n  ABBONAMENTI (${subs.length}):`);
  if (subs.length === 0) console.log('    (nessuno)');
  for (const s of subs) {
    const free = s.plan.priceCents === 0;
    const durata = daysBetween(s.startDate, s.endDate);
    const flags: string[] = [];
    if (free && !knownPeriod(s.plan.period)) flags.push('⚠ piano €0 con period NON valido');
    if (free && s.plan.period && s.plan.period.trim().toLowerCase() !== '8d' && /^(\d+)\s*[wmy]$/i.test(s.plan.period.trim())) {
      flags.push('⚠ prova con durata mensile/settimanale/annuale');
    }
    console.log(
      `    • [${s.status}] ${s.plan.name} — ${eur(s.plan.priceCents)} · period="${s.plan.period}"` +
      ` · start ${iso(s.startDate)} → end ${iso(s.endDate)} (${durata}) · creato ${iso(s.createdAt)}` +
      (flags.length ? `  ${flags.join(' · ')}` : ''),
    );
  }

  const pays = (await prisma.payment.findMany({
    where: { clientId: user.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, amountCents: true, description: true, method: true, status: true, createdAt: true, approvedAt: true, subscriptionId: true, discountCents: true },
  })) as {
    id: string; amountCents: number; description: string; method: string; status: string;
    createdAt: Date; approvedAt: Date | null; subscriptionId: string | null; discountCents: number | null;
  }[];

  console.log(`\n  PAGAMENTI (${pays.length}):`);
  if (pays.length === 0) console.log('    (nessuno)');
  for (const p of pays) {
    console.log(
      `    • [${p.status}] ${eur(p.amountCents)}${p.discountCents ? ` (sconto ${eur(p.discountCents)})` : ''}` +
      ` · ${p.method} · «${p.description}» · creato ${iso(p.createdAt)} · approvato ${iso(p.approvedAt)}` +
      ` · sub ${p.subscriptionId ? p.subscriptionId.slice(0, 8) : '—'}`,
    );
  }
}

async function dumpAllTrials(): Promise<void> {
  const trials = (await prisma.subscription.findMany({
    where: { plan: { priceCents: 0 } } as never,
    orderBy: { createdAt: 'desc' },
    include: { plan: { select: { name: true, priceCents: true, period: true } }, client: { select: { email: true } } },
  })) as {
    id: string; status: string; startDate: Date | null; endDate: Date | null;
    plan: { name: string; period: string }; client: { email: string };
  }[];

  console.log(`\n=== TUTTE LE PROVE (piani €0): ${trials.length} ===`);
  console.log('(evidenzio quelle con durata effettiva > 10 giorni: una prova non dovrebbe durare così tanto)\n');
  for (const t of trials) {
    const dur = t.startDate && t.endDate ? Math.round((new Date(t.endDate).getTime() - new Date(t.startDate).getTime()) / 86_400_000) : null;
    const flag = dur != null && dur > 10 ? '  ⚠ DURATA ANOMALA' : '';
    console.log(
      `  • ${t.client.email} — [${t.status}] ${t.plan.name} · period="${t.plan.period}"` +
      ` · ${iso(t.startDate)} → ${iso(t.endDate)} (${dur != null ? dur + 'g' : '—'})${flag}`,
    );
  }
}

async function main() {
  const arg = process.argv.slice(2).find((a) => !a.startsWith('-'));
  console.log('>>> DIAGNOSTICA ABBONAMENTI (sola lettura, nessuna scrittura) <<<');
  if (arg) await dumpForEmail(arg);
  else await dumpAllTrials();
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
