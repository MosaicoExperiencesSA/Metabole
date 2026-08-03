/**
 * Pulizia una-tantum: rimuove i giorni di menu (MenuDay) erogati OLTRE la fine del piano.
 *
 * Bug corretto nel generatore: la consegna a 2 giorni poteva creare menu per domani/dopodomani
 * anche quando il piano finiva oggi, così la cliente vedeva menu oltre la fine del percorso.
 * Questo script cancella i MenuDay con `date` successiva alla `endDate` dell'abbonamento ATTIVO
 * della cliente. Tocca solo chi ha un abbonamento attivo con una data di fine.
 *
 *   npm run prune:menu-planend            # DRY-RUN: elenca cosa cancellerebbe
 *   npm run prune:menu-planend -- --apply # cancella
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

function dateOnly(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

async function main() {
  console.log(APPLY ? '>>> APPLICA (cancello) <<<' : '>>> DRY-RUN (nessuna cancellazione) — usa --apply <<<');
  const today = dateOnly(new Date());

  // Abbonamenti attivi con data di fine: la fine piano è la loro endDate.
  const subs = (await prisma.subscription.findMany({
    where: { status: 'active', endDate: { not: null } },
    select: { clientId: true, endDate: true },
  })) as { clientId: string; endDate: Date | null }[];

  // Per cliente tengo la endDate più avanzata (se avesse più abbonamenti attivi).
  const endByClient = new Map<string, Date>();
  for (const s of subs) {
    if (!s.endDate) continue;
    const cur = endByClient.get(s.clientId);
    if (!cur || s.endDate.getTime() > cur.getTime()) endByClient.set(s.clientId, s.endDate);
  }

  let totalRows = 0;
  let clientsTouched = 0;
  for (const [clientId, endDate] of endByClient) {
    const planEnd = dateOnly(endDate);
    const future = (await prisma.menuDay.findMany({
      where: { clientId, date: { gt: planEnd } },
      select: { id: true, date: true },
      orderBy: { date: 'asc' },
    })) as { id: string; date: Date }[];
    if (future.length === 0) continue;
    clientsTouched++;
    totalRows += future.length;
    const days = future.map((f) => f.date.toISOString().slice(0, 10)).join(', ');
    console.log(`  · ${clientId}: fine piano ${planEnd.toISOString().slice(0, 10)} — ${future.length} giorni oltre: ${days}`);
    if (APPLY) {
      await prisma.menuDay.deleteMany({ where: { id: { in: future.map((f) => f.id) } } });
    }
  }

  console.log(
    APPLY
      ? `\n✔ Rimossi ${totalRows} giorni di menu oltre fine piano, su ${clientsTouched} clienti.`
      : `\nDa rimuovere: ${totalRows} giorni su ${clientsTouched} clienti. (today=${today.toISOString().slice(0, 10)}) Per applicare: npm run prune:menu-planend -- --apply`,
  );
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
