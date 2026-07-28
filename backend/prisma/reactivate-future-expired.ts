/**
 * Fix una-tantum: riattiva gli abbonamenti rimasti 'expired' ma con endDate NEL FUTURO.
 *
 * Come capita: un abbonamento scade (cron → status 'expired' sulle date vecchie), poi si sposta
 * l'inizio piano in avanti; prima del fix, `updatePlanStart` ricalcolava le date ma NON riportava
 * lo stato ad 'active' → l'abbonamento restava 'expired' pur avendo date future ("Nessun piano
 * attivo", niente menu). Un abbonamento 'expired' con endDate futura può derivare SOLO da questo
 * (il cron scade solo quando endDate < ora): quindi riattivarli è sicuro.
 *
 * DRY-RUN di default. `--apply` per scrivere.
 *   npm run reactivate:future-expired            # mostra cosa cambierebbe
 *   npm run reactivate:future-expired -- --apply # applica
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

async function main() {
  console.log(APPLY ? '>>> APPLICA (scrivo) <<<' : '>>> DRY-RUN (nessuna scrittura) — usa --apply <<<');
  const now = new Date();

  const subs = (await prisma.subscription.findMany({
    where: { status: 'expired' as never, endDate: { gt: now } } as never,
    select: {
      id: true, startDate: true, endDate: true,
      plan: { select: { name: true } },
      client: { select: { email: true } },
    },
  })) as { id: string; startDate: Date | null; endDate: Date | null; plan: { name: string }; client: { email: string } }[];

  console.log(`Abbonamenti 'expired' con fine nel futuro: ${subs.length}`);
  for (const s of subs) {
    console.log(
      `  • ${s.client.email} — ${s.plan.name} · ${s.startDate?.toISOString().slice(0, 10) ?? '—'} → ${s.endDate?.toISOString().slice(0, 10) ?? '—'}  ⇒ active`,
    );
  }

  if (APPLY && subs.length > 0) {
    const res = await prisma.subscription.updateMany({
      where: { id: { in: subs.map((s) => s.id) } },
      data: { status: 'active' as never },
    });
    console.log(`\n✔ Riattivati: ${res.count}`);
  } else {
    console.log(APPLY ? '\n(niente da fare)' : '\n(nessuna scrittura). Per applicare: npm run reactivate:future-expired -- --apply');
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
