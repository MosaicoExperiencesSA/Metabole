/**
 * ⛔ **LEAD ACCETTATO A UNA COACH, SCHEDA CLIENTE DI UN'ALTRA** — chi è rimasta a metà prima del 5/11.
 *
 * Fino al 5/11 `accept()` del lead passava la coach alla scheda solo se la scheda era vuota (o della
 * riserva): una cliente riassegnata e accettata restava in scheda alla coach vecchia (caso Jessica).
 * La correzione vale da lì in avanti; queste sono quelle rimaste indietro.
 *
 * ⚠️ Non tutte sono errori: se DOPO l'accettazione qualcuno ha spostato la cliente a mano dalla scheda,
 * è la scheda ad avere ragione e il CRM a essere vecchio. Per questo l'elenco mette la data
 * dell'accettazione: si guarda caso per caso, non si corregge in blocco.
 *
 * ⚠️ **Non scrive niente.**
 *
 * USO (shell di Render, dentro ~/project/src/backend):
 *   npm run diag:coach-lead-scheda
 */
import { PrismaClient } from '@prisma/client';
import { idDellaRiserva } from '../src/common/coach-di-riserva-chiave';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const riservaId = await idDellaRiserva(prisma as never);
  const righe = await prisma.crmRecord.findMany({
    where: { assignmentStatus: 'accepted', clientId: { not: null }, assignedCoachId: { not: null } },
    select: {
      id: true,
      name: true,
      email: true,
      assignedCoachId: true,
      assignedCoach: { select: { displayName: true } },
      client: {
        select: {
          email: true,
          clientProfile: { select: { assignedCoachId: true, assignedCoach: { select: { displayName: true } } } },
        },
      },
      assignments: {
        where: { status: 'accepted' },
        orderBy: { resolvedAt: 'desc' },
        take: 1,
        select: { resolvedAt: true },
      },
    },
  });

  const storte = righe.filter((r) => {
    const scheda = r.client?.clientProfile?.assignedCoachId ?? null;
    return scheda !== r.assignedCoachId;
  });

  console.log(`\nLead accettati con cliente registrata: ${righe.length}`);
  console.log(`Coach del lead diversa da quella in scheda: ${storte.length}\n`);
  for (const r of storte) {
    const p = r.client?.clientProfile;
    const scheda = !p ? '(scheda assente)' : !p.assignedCoachId ? '(nessuna)' : p.assignedCoachId === riservaId ? `${p.assignedCoach?.displayName ?? '?'} [RISERVA]` : p.assignedCoach?.displayName ?? '?';
    const quando = r.assignments[0]?.resolvedAt?.toISOString().slice(0, 10) ?? 'data ignota';
    console.log(`- ${r.name ?? '(senza nome)'} <${r.client?.email ?? r.email ?? '?'}>`);
    console.log(`    lead: ${r.assignedCoach?.displayName ?? '?'} (accettato ${quando})  ·  scheda: ${scheda}  ·  lead id ${r.id}`);
  }
  console.log('');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
