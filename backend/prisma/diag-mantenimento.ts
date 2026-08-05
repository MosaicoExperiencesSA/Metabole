/**
 * Diagnostica (SOLA LETTURA): il piano di MANTENIMENTO è ancora riconosciuto come tale?
 *
 * Il mantenimento non si riconosce dal nome: si riconosce dal campo `period` valorizzato
 * esattamente a «maintenance». Su quella parola si reggono quattro cose diverse:
 *   1. la visibilità del piano nello shop solo a obiettivo raggiunto;
 *   2. il riquadro dedicato nel report di fine percorso;
 *   3. lo sblocco del monitoraggio;
 *   4. l'attività coach «peso che risale».
 *
 * Fino al 5 agosto 2026 il salvataggio dal Negozio rifiutava un periodo di 11 caratteri: chi
 * modificava il prezzo del piano si vedeva rifiutare il salvataggio e, per uscirne, accorciava
 * il Periodo (es. a «1m»). Da quel momento il piano diventava un abbonamento come gli altri —
 * visibile a tutte — e le altre tre funzioni smettevano di scattare senza segnalare niente.
 *
 * Questo script dice se in produzione è successo, e a chi.
 *
 *   npm run diag:mantenimento
 *
 * Nessuna scrittura: si può lanciare in produzione senza rischi.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ymd = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : '—');

/** Stessa regola del backend (`isMaintenancePlan`): tollerante a spazi e maiuscole. */
const isMantenimento = (period: string | null | undefined) =>
  String(period ?? '').trim().toLowerCase() === 'maintenance';

/** Il nome "sembra" quello del mantenimento? Serve solo a sospettare, non a decidere. */
const nomeDaMantenimento = (name: string) => /manteni|maintenance/i.test(name);

async function main() {
  const plans = (await prisma.plan.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, period: true, active: true, hidden: true, priceCents: true, updatedAt: true },
  })) as {
    id: string;
    name: string;
    period: string;
    active: boolean;
    hidden: boolean;
    priceCents: number;
    updatedAt: Date;
  }[];

  console.log(`\nPiani a catalogo (${plans.length}):`);
  for (const p of plans) {
    const marca = isMantenimento(p.period) ? '►' : ' ';
    const stato = [p.active ? 'attivo' : 'non attivo', p.hidden ? 'nascosto' : null].filter(Boolean).join(', ');
    console.log(
      `${marca} ${p.name.padEnd(28)} periodo «${p.period}»`.padEnd(60) +
        ` ${(p.priceCents / 100).toFixed(2)} €  (${stato})  modificato ${ymd(p.updatedAt)}`,
    );
  }
  console.log('\n► = riconosciuto come MANTENIMENTO dal backend.');

  const mantenimento = plans.filter((p) => isMantenimento(p.period));
  const sospetti = plans.filter((p) => !isMantenimento(p.period) && nomeDaMantenimento(p.name));

  console.log('\nDiagnosi:');
  if (mantenimento.length === 0) {
    console.log('  ✗ NESSUN piano ha periodo «maintenance»: per il backend il mantenimento non esiste.');
    console.log('    Conseguenze: il piano (se c\'è) compare nello shop a TUTTE le clienti, il riquadro');
    console.log('    nel report non appare, il monitoraggio non si sblocca, l\'attività coach non scatta.');
  } else if (mantenimento.length === 1) {
    console.log(`  ✓ Il mantenimento è «${mantenimento[0].name}» ed è riconosciuto correttamente.`);
  } else {
    console.log(`  ⚠ Ci sono ${mantenimento.length} piani con periodo «maintenance»: il backend li tratta tutti da mantenimento.`);
    for (const p of mantenimento) console.log(`      - ${p.name} (id ${p.id})`);
  }

  for (const p of sospetti) {
    console.log(
      `  ✗ «${p.name}» sembra il mantenimento ma ha periodo «${p.period}»: è un abbonamento come gli altri.`,
    );
    console.log(`    → Rimetti il Periodo a «maintenance» dal Negozio (ultima modifica: ${ymd(p.updatedAt)}).`);
  }
  if (mantenimento.length === 0 && sospetti.length === 0) {
    console.log('    Nessun piano dal nome riconducibile al mantenimento: forse non è mai stato creato.');
  }

  // ---- Chi ha comprato il mantenimento senza aver raggiunto l'obiettivo ----------------------
  const idMantenimento = new Set([...mantenimento, ...sospetti].map((p) => p.id));
  if (idMantenimento.size === 0) return;

  const subs = (await prisma.subscription.findMany({
    where: { planId: { in: [...idMantenimento] } },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true,
      status: true,
      startDate: true,
      createdAt: true,
      clientId: true,
      plan: { select: { name: true, period: true } },
      client: { select: { email: true } },
    },
  })) as {
    id: string;
    status: string;
    startDate: Date | null;
    createdAt: Date;
    clientId: string;
    plan: { name: string; period: string } | null;
    client: { email: string } | null;
  }[];

  console.log(`\nAbbonamenti al mantenimento (${subs.length}, dal più recente):`);
  if (subs.length === 0) {
    console.log('  Nessuno: il piano non è mai stato sottoscritto.');
    return;
  }

  let fuoriRegola = 0;
  for (const s of subs) {
    // Stessa regola del backend (`hasReachedObjective`): obiettivo più recente, ultima misura.
    const [obiettivo, misura] = await Promise.all([
      prisma.objective.findFirst({
        where: { clientId: s.clientId },
        orderBy: { createdAt: 'desc' },
        select: { targetWeightKg: true },
      }) as Promise<{ targetWeightKg: number | null } | null>,
      prisma.measurement.findFirst({
        where: { clientId: s.clientId },
        orderBy: { date: 'desc' },
        select: { weightKg: true },
      }) as Promise<{ weightKg: number } | null>,
    ]);
    const target = obiettivo?.targetWeightKg ?? null;
    const raggiunto = target != null && misura != null && misura.weightKg <= target;
    if (!raggiunto) fuoriRegola++;
    const dettaglio =
      target == null
        ? 'nessun obiettivo di peso impostato'
        : misura == null
          ? 'nessuna misura registrata'
          : `ultima misura ${misura.weightKg} kg su obiettivo ${target} kg`;
    console.log(
      `  ${raggiunto ? '✓' : '✗'} ${(s.client?.email ?? s.clientId).padEnd(34)} ${s.status.padEnd(9)} ` +
        `dal ${ymd(s.startDate ?? s.createdAt)}  — ${dettaglio}`,
    );
  }

  console.log('');
  if (fuoriRegola === 0) {
    console.log('  ✓ Tutte le clienti col mantenimento avevano raggiunto l\'obiettivo.');
  } else {
    console.log(
      `  ⚠ ${fuoriRegola} abbonamenti risultano attivati senza obiettivo raggiunto. Attenzione: possono`,
    );
    console.log(
      '    essere legittimi (attivazione manuale decisa da un\'operatrice, oppure peso risalito dopo),',
    );
    console.log('    quindi vanno guardati uno per uno, non corretti in blocco.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
