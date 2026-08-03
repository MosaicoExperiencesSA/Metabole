/**
 * Diagnostica (SOLA LETTURA): trova tutte le clienti con le due anomalie di "fine piano".
 *
 *  A) Menu OLTRE la fine piano: hanno MenuDay con data successiva alla endDate dell'abbonamento
 *     attivo (bug della consegna a 2 giorni). → si sistemano con `npm run prune:menu-planend -- --apply`.
 *  B) Notifica "piano di oggi" a piano SCADUTO: hanno ricevuto una notifica engine_daily mentre
 *     NON hanno un piano attivo (endDate passata / nessun abbonamento attivo). → corretto nel
 *     codice; qui elenchiamo chi l'ha già ricevuta.
 *
 * Nessuna scrittura: stampa soltanto. Utile prima/dopo le correzioni.
 *
 *   npm run diag:anomalie
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const RECENT_DAYS = 14; // finestra per le notifiche engine_daily recenti

function dateOnly(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
const ymd = (d: Date) => d.toISOString().slice(0, 10);

async function emailOf(clientId: string): Promise<string> {
  const u = (await prisma.user.findUnique({ where: { id: clientId }, select: { email: true } })) as { email: string } | null;
  return u?.email ?? clientId;
}

async function main() {
  const today = dateOnly(new Date());
  console.log(`Diagnostica anomalie fine piano — oggi ${ymd(today)}\n`);

  // ---------- A) Menu oltre la fine piano ----------
  const activeSubs = (await prisma.subscription.findMany({
    where: { status: 'active', endDate: { not: null } },
    select: { clientId: true, endDate: true },
  })) as { clientId: string; endDate: Date | null }[];
  const endByClient = new Map<string, Date>();
  for (const s of activeSubs) {
    if (!s.endDate) continue;
    const cur = endByClient.get(s.clientId);
    if (!cur || s.endDate.getTime() > cur.getTime()) endByClient.set(s.clientId, s.endDate);
  }

  console.log('A) MENU OLTRE LA FINE PIANO');
  let aCount = 0;
  let aRows = 0;
  for (const [clientId, endDate] of endByClient) {
    const planEnd = dateOnly(endDate);
    const future = (await prisma.menuDay.findMany({
      where: { clientId, date: { gt: planEnd } },
      select: { date: true },
      orderBy: { date: 'asc' },
    })) as { date: Date }[];
    if (future.length === 0) continue;
    aCount++;
    aRows += future.length;
    console.log(`  · ${await emailOf(clientId)} — fine piano ${ymd(planEnd)} — ${future.length} giorni oltre: ${future.map((f) => ymd(f.date)).join(', ')}`);
  }
  console.log(`  → clienti: ${aCount}, giorni totali: ${aRows}${aCount ? '   (sistema: npm run prune:menu-planend -- --apply)' : ''}\n`);

  // ---------- B) Notifica "piano di oggi" a piano scaduto ----------
  const since = new Date(today.getTime() - RECENT_DAYS * 86_400_000);
  const engineNotifs = (await prisma.notification.findMany({
    where: { type: 'engine_daily', createdAt: { gte: since } },
    select: { userId: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })) as { userId: string; createdAt: Date }[];

  console.log(`B) NOTIFICA "piano di oggi" A PIANO SCADUTO (ultimi ${RECENT_DAYS} giorni)`);
  let bCount = 0;
  const seen = new Set<string>();
  for (const n of engineNotifs) {
    if (seen.has(n.userId)) continue;
    seen.add(n.userId);
    const activeSub = (await prisma.subscription.findFirst({
      where: { clientId: n.userId, status: 'active' },
      select: { endDate: true },
    })) as { endDate: Date | null } | null;
    const hasActivePlan = !!activeSub && (!activeSub.endDate || activeSub.endDate.getTime() >= today.getTime());
    if (hasActivePlan) continue;
    bCount++;
    console.log(`  · ${await emailOf(n.userId)} — ultima engine_daily ${ymd(n.createdAt)} — piano NON attivo`);
  }
  console.log(`  → clienti: ${bCount}${bCount ? '   (corretto nel codice: non verranno più inviate)' : ''}\n`);

  console.log('Fine diagnostica.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
