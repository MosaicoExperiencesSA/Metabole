/**
 * Fix una-tantum: RIALLINEA gli abbonamenti alla data d'inizio piano scelta dalla cliente
 * (profile.planStartDate) quando sono disallineati.
 *
 * Caso tipico: la prova è attivata al pagamento con la data di allora (es. start 20/07 → fine 28/07),
 * poi la cliente sceglie una data diversa (planStartDate 27/07). Prima del fix, la subscription non
 * veniva riallineata → risultava "scaduta" (fine 28/07 nel passato) pur avendo la cliente iniziato
 * il 27. Questo script ricalcola start/fine dalla planStartDate e, se la nuova fine è nel futuro,
 * riattiva l'abbonamento.
 *
 * SICURO: agisce SOLO su abbonamenti approvati (status 'active' o 'expired') per cui la fine
 * ricalcolata dalla planStartDate è NEL FUTURO (quindi la cliente ha diritto a un piano ancora in
 * corso). Non tocca 'pending'/'cancelled'.
 *
 *   npm run realign:plan-start            # DRY-RUN
 *   npm run realign:plan-start -- --apply # APPLICA
 */
import { PrismaClient } from '@prisma/client';
import { subscriptionEnd } from '../src/commerce/commerce.service';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const iso = (d: Date | null): string => (d ? new Date(d).toISOString().slice(0, 10) : '—');

async function main() {
  console.log(APPLY ? '>>> APPLICA (scrivo) <<<' : '>>> DRY-RUN (nessuna scrittura) — usa --apply <<<');
  const now = new Date();

  const subs = (await prisma.subscription.findMany({
    where: { status: { in: ['active', 'expired'] as never } } as never,
    select: {
      id: true, status: true, startDate: true, endDate: true,
      plan: { select: { name: true, period: true } },
      client: { select: { email: true, clientProfile: { select: { planStartDate: true } } } },
    },
  })) as {
    id: string; status: string; startDate: Date | null; endDate: Date | null;
    plan: { name: string; period: string };
    client: { email: string; clientProfile: { planStartDate: Date | null } | null };
  }[];

  let count = 0;
  for (const s of subs) {
    const ps = s.client.clientProfile?.planStartDate ?? null;
    if (!ps) continue;
    const newEnd = subscriptionEnd(new Date(ps), s.plan.period);
    if (newEnd.getTime() <= now.getTime()) continue; // fine ricalcolata già passata: non riattivare
    const startMatches = s.startDate && new Date(s.startDate).toISOString().slice(0, 10) === new Date(ps).toISOString().slice(0, 10);
    const endMatches = s.endDate && new Date(s.endDate).toISOString().slice(0, 10) === newEnd.toISOString().slice(0, 10);
    if (startMatches && endMatches && s.status === 'active') continue; // già a posto

    count++;
    console.log(
      `  • ${s.client.email} — ${s.plan.name} [${s.status}] · ` +
      `${iso(s.startDate)}→${iso(s.endDate)}  ⇒  ${iso(new Date(ps))}→${iso(newEnd)} · active`,
    );
    if (APPLY) {
      await prisma.subscription.update({
        where: { id: s.id },
        data: { startDate: new Date(ps), endDate: newEnd, status: 'active' as never },
      });
    }
  }

  console.log(APPLY ? `\n✔ Riallineati: ${count}` : `\nDa riallineare: ${count}. Per applicare: npm run realign:plan-start -- --apply`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
