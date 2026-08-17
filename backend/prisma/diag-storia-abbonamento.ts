/**
 * DIAGNOSTICA: **la storia degli abbonamenti di una cliente, in ordine di tempo.**
 *
 * Nasce dal caso Lorena Polidoro (17/8): due «Conosciamoci» attivi insieme, uno con la data di fine
 * che non torna col suo periodo. La scheda mostra lo **stato di adesso**, e da lì la causa si può
 * solo indovinare — l'ho fatto una volta e ho indovinato male, dando la colpa a una corsa fra due
 * richieste che invece erano a una settimana di distanza.
 *
 * Questo script non indovina: mette in fila **tutto quello che è successo** — le sottoscrizioni
 * create, i pagamenti approvati, e ogni riga di audit che le riguarda — e lascia leggere la
 * sequenza. Le due righe che di solito rispondono da sole sono:
 *
 *  - `commerce.plan.queued` → il piano era stato messo IN CODA, e nel `metadata` c'è
 *    `inizioEffettivo`: la data da cui sarebbe dovuto partire davvero;
 *  - `client.plan_start.update` (o come si chiama lo spostamento dell'inizio piano) → qualcuno ha
 *    spostato la data a mano, e da lì in poi le due non tornano più.
 *
 * ⚠️ Sola lettura. Non scrive e non corregge niente.
 *
 * USO (shell di Render, dentro ~/project/src/backend):
 *   npm run diag:storia -- --email=cliente@esempio.it
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const iso = (d: Date | null | undefined): string => (d ? d.toISOString().slice(0, 10) : '—');
const istante = (d: Date | null | undefined): string => (d ? d.toISOString().replace('T', ' ').slice(0, 19) : '—');

function leggiEmail(): string {
  const arg = process.argv.slice(2).join(' ');
  const m = /--email=(\S+)/.exec(arg);
  return (m?.[1] ?? arg).trim().toLowerCase();
}

type Riga = { quando: Date; cosa: string; dettaglio: string; chi: string };

async function main(): Promise<void> {
  const email = leggiEmail();
  if (!email) {
    console.error('\nServe l\'email: npm run diag:storia -- --email=cliente@esempio.it\n');
    process.exit(1);
  }

  const user = (await prisma.user.findFirst({
    where: { email } as never,
    select: { id: true, email: true, firstName: true, lastName: true, createdAt: true },
  })) as { id: string; email: string; firstName: string | null; lastName: string | null; createdAt: Date } | null;
  if (!user) {
    console.error(`\nNessun utente con email «${email}».\n`);
    process.exit(1);
  }

  const [subs, pagamenti, profilo] = await Promise.all([
    prisma.subscription.findMany({
      where: { clientId: user.id },
      orderBy: { createdAt: 'asc' },
      include: { plan: { select: { name: true, period: true, priceCents: true } } },
    }) as Promise<{ id: string; status: string; startDate: Date | null; endDate: Date | null; createdAt: Date; updatedAt: Date; plan: { name: string; period: string | null; priceCents: number } | null }[]>,
    prisma.payment.findMany({
      where: { clientId: user.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, subscriptionId: true, status: true, amountCents: true, description: true, createdAt: true, updatedAt: true },
    }) as Promise<{ id: string; subscriptionId: string | null; status: string; amountCents: number; description: string | null; createdAt: Date; updatedAt: Date }[]>,
    prisma.clientProfile.findUnique({
      where: { userId: user.id },
      select: { planStartDate: true },
    }) as Promise<{ planStartDate: Date | null } | null>,
  ]);

  console.log(`\n=== ${user.firstName ?? ''} ${user.lastName ?? ''} · ${user.email} ===`);
  console.log(`Registrata: ${iso(user.createdAt)} · inizio piano sul profilo (comanda i menu): ${iso(profilo?.planStartDate)}\n`);

  console.log('--- ABBONAMENTI (nell\'ordine in cui sono nati) ---');
  const nomeSub = new Map<string, string>();
  subs.forEach((s, i) => {
    const etichetta = `#${i + 1} ${s.plan?.name ?? '?'}`;
    nomeSub.set(s.id, etichetta);
    console.log(
      `${etichetta}  ${s.status.padEnd(9)} ${String(s.plan?.period ?? '—').padEnd(6)} ` +
      `inizio ${iso(s.startDate)}  fine ${iso(s.endDate)}  creato ${istante(s.createdAt)}  modificato ${istante(s.updatedAt)}`,
    );
    console.log(`      id ${s.id}`);
  });

  /**
   * ⚠️ L'audit si cerca sull'id di OGNI abbonamento, non sul cliente: le righe che contano —
   * `commerce.plan.queued`, gli spostamenti dell'inizio piano — sono intestate all'entità
   * `subscription`, e cercando per attore o per cliente non si trovano.
   */
  const idSub = subs.map((s) => s.id);
  const idPag = pagamenti.map((p) => p.id);
  const audit = (await prisma.auditLog.findMany({
    where: {
      OR: [
        { entityType: 'subscription', entityId: { in: idSub } },
        { entityType: 'payment', entityId: { in: idPag } },
        { entityType: 'client_profile', entityId: user.id },
        { entityType: 'user', entityId: user.id },
        { actorId: user.id },
      ],
    } as never,
    orderBy: { createdAt: 'asc' },
    select: { action: true, entityType: true, entityId: true, metadata: true, actorId: true, createdAt: true },
  })) as { action: string; entityType: string | null; entityId: string | null; metadata: unknown; actorId: string | null; createdAt: Date }[];

  const attori = new Map<string, string>();
  const idAttori = [...new Set(audit.map((a) => a.actorId).filter((x): x is string => !!x))];
  if (idAttori.length) {
    const righe = (await prisma.user.findMany({
      where: { id: { in: idAttori } },
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
    })) as { id: string; email: string; firstName: string | null; lastName: string | null; role: string }[];
    for (const r of righe) attori.set(r.id, `${r.firstName ?? ''} ${r.lastName ?? ''}`.trim() || r.email);
  }

  const storia: Riga[] = [];
  for (const s of subs) {
    storia.push({
      quando: s.createdAt,
      cosa: 'abbonamento creato',
      dettaglio: `${nomeSub.get(s.id)} · ${s.plan?.period ?? '—'} · inizio ${iso(s.startDate)} fine ${iso(s.endDate)}`,
      chi: '—',
    });
  }
  for (const p of pagamenti) {
    storia.push({
      quando: p.createdAt,
      cosa: `pagamento ${p.status}`,
      dettaglio: `€${(p.amountCents / 100).toFixed(2)} — ${p.description ?? ''}${p.subscriptionId ? ` → ${nomeSub.get(p.subscriptionId) ?? p.subscriptionId}` : ''}`,
      chi: '—',
    });
  }
  for (const a of audit) {
    const meta = a.metadata && typeof a.metadata === 'object' ? JSON.stringify(a.metadata) : '';
    storia.push({
      quando: a.createdAt,
      cosa: a.action,
      dettaglio: `${a.entityId ? nomeSub.get(a.entityId) ?? `${a.entityType}` : ''} ${meta}`.trim().slice(0, 160),
      chi: a.actorId ? attori.get(a.actorId) ?? a.actorId.slice(0, 8) : '—',
    });
  }
  storia.sort((a, b) => a.quando.getTime() - b.quando.getTime());

  console.log('\n--- LA STORIA, IN ORDINE ---');
  if (!storia.length) console.log('(niente)');
  for (const r of storia) {
    console.log(`${istante(r.quando)}  ${r.cosa.padEnd(34)} ${r.chi.padEnd(20)} ${r.dettaglio}`);
  }

  // Le due righe che di solito rispondono da sole.
  const code = storia.filter((r) => r.cosa === 'commerce.plan.queued');
  const spostamenti = storia.filter((r) => /plan_start|plan-start|inizio/i.test(r.cosa));
  console.log('\n--- COSA GUARDARE ---');
  console.log(code.length
    ? `✓ ${code.length} piano/i messo/i IN CODA: dentro c'è \`inizioEffettivo\`, la data da cui doveva partire.`
    : '· nessun `commerce.plan.queued`: la coda non è mai scattata su questa cliente.');
  console.log(spostamenti.length
    ? `✓ ${spostamenti.length} spostamento/i dell'inizio piano: se viene DOPO la coda, è lì che le date si sono separate.`
    : '· nessuno spostamento dell\'inizio piano registrato.');

  const attivi = subs.filter((s) => s.status === 'active');
  if (attivi.length > 1) {
    console.log(
      `\n⚠️ ${attivi.length} ABBONAMENTI ATTIVI INSIEME. Non è vietato dal database, e non può esserlo finché\n` +
      '   «in coda» non è uno stato: un piano in fila si scrive `active` con una data d\'inizio futura.\n' +
      '   Conseguenza da sapere: `menu.service` fa `findFirst({status:"active"})` e ne prende UNO A CASO\n' +
      '   per decidere quando finisce il piano.',
    );
  }

  console.log('\nFine. Questo script non ha scritto niente.\n');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('\n❌ Errore:', (e as Error)?.message ?? e);
  await prisma.$disconnect();
  process.exit(1);
});
