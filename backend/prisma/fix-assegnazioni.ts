/**
 * RIPARAZIONE: clienti che il CRM dà assegnate a una coach e il backoffice a nessuno.
 *
 * Il difetto (segnalato da Simone il 6/8): la coach manda le credenziali dal lead assegnato a
 * lei; l'account nasce, il lead si collega all'account, ma `ClientProfile.assignedCoachId`
 * resta vuoto — anzi, il profilo non esiste proprio finché la cliente non compila il
 * questionario. Siccome tutte le liste clienti filtrano sul profilo, la coach vede il lead
 * come suo e la cliente come di nessuno, e non riesce ad aprirle la scheda.
 *
 * Il codice è corretto da oggi (`src/common/assegnazione-profilo.ts`, usato all'invio
 * credenziali, all'accettazione del lead e al ref code). Questo script rimette a posto
 * le clienti già finite in quello stato, che il codice nuovo da solo non ripesca.
 *
 * Cosa fa, per ogni lead collegato a un account e assegnato a una coach o a una nutrizionista:
 *  - profilo assente        → lo crea con la sola assegnazione (il questionario resta da fare:
 *                             il gate dell'app guarda `onboardingCompletedAt`, non il profilo);
 *  - profilo senza staff    → riempie il campo vuoto;
 *  - profilo con ALTRO staff→ NON tocca niente e lo elenca: uno spostamento deliberato vince
 *                             sempre sul CRM, ma è giusto vederlo.
 *
 * USO (shell di Render, dentro ~/project/src/backend):
 *   npm run fix:assegnazioni              → mostra e basta, non scrive niente
 *   CONFERMA=1 npm run fix:assegnazioni   → applica
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Riga = {
  cliente: string;
  email: string;
  coachCrm: string;
  nutriCrm: string;
  azione: string;
};

async function main(): Promise<void> {
  const conferma = process.env.CONFERMA === '1';

  const record = (await prisma.crmRecord.findMany({
    where: {
      clientId: { not: null },
      OR: [{ assignedCoachId: { not: null } }, { assignedNutritionistId: { not: null } }],
    } as never,
    select: {
      id: true,
      name: true,
      email: true,
      clientId: true,
      assignedCoachId: true,
      assignedNutritionistId: true,
      assignmentStatus: true,
      assignedCoach: { select: { displayName: true } },
      assignedNutritionist: { select: { displayName: true } },
    },
  })) as {
    id: string; name: string | null; email: string | null; clientId: string;
    assignedCoachId: string | null; assignedNutritionistId: string | null;
    assignmentStatus: string | null;
    assignedCoach: { displayName: string } | null;
    assignedNutritionist: { displayName: string } | null;
  }[];

  if (record.length === 0) {
    console.log('Nessun lead assegnato e collegato a un account: niente da riparare.');
    return;
  }

  const daCreare: typeof record = [];
  const daCompletare: { r: (typeof record)[number]; patch: Record<string, string> }[] = [];
  const divergenti: Riga[] = [];
  const tabella: Riga[] = [];

  let inAttesa = 0;
  for (const r of record) {
    // Un'assegnazione ancora «da accettare» NON si porta sul profilo: può essere rifiutata o
    // scadere, e in quei casi il CrmRecord si svuota mentre il profilo resterebbe agganciato
    // a una coach che non ha mai preso il lead. Ci arriverà con l'accettazione.
    // (`assignmentStatus` nullo = dato storico, precedente al ciclo di accettazione: vale come
    // accettato, altrimenti non ripareremmo proprio i casi più vecchi.)
    const coachDaPropagare = r.assignmentStatus === 'pending' ? null : r.assignedCoachId;
    if (r.assignmentStatus === 'pending' && r.assignedCoachId) inAttesa++;
    if (!coachDaPropagare && !r.assignedNutritionistId) continue;

    const prof = (await prisma.clientProfile.findUnique({
      where: { userId: r.clientId },
      select: { assignedCoachId: true, assignedNutritionistId: true },
    })) as { assignedCoachId: string | null; assignedNutritionistId: string | null } | null;

    const base = {
      cliente: r.name ?? '(senza nome)',
      email: r.email ?? '—',
      coachCrm: coachDaPropagare ? r.assignedCoach?.displayName ?? '—' : '—',
      nutriCrm: r.assignedNutritionist?.displayName ?? '—',
    };

    if (!prof) {
      daCreare.push({ ...r, assignedCoachId: coachDaPropagare });
      tabella.push({ ...base, azione: 'CREA profilo con assegnazione' });
      continue;
    }

    const patch: Record<string, string> = {};
    if (coachDaPropagare && !prof.assignedCoachId) patch.assignedCoachId = coachDaPropagare;
    if (r.assignedNutritionistId && !prof.assignedNutritionistId) {
      patch.assignedNutritionistId = r.assignedNutritionistId;
    }

    const coachDiversa = coachDaPropagare && prof.assignedCoachId && prof.assignedCoachId !== coachDaPropagare;
    if (coachDiversa) divergenti.push({ ...base, azione: 'profilo assegnato ad ALTRA coach — lasciato com’è' });

    if (Object.keys(patch).length > 0) {
      daCompletare.push({ r, patch });
      tabella.push({ ...base, azione: `COMPLETA profilo (${Object.keys(patch).join(', ')})` });
    }
  }

  const nota = inAttesa
    ? `\n(${inAttesa} lead assegnati ma ancora DA ACCETTARE: non si toccano, la coach arriva sul profilo quando accetta.)`
    : '';

  if (tabella.length === 0 && divergenti.length === 0) {
    console.log(`Esaminati ${record.length} lead collegati: tutte le assegnazioni sono già allineate ✓${nota}`);
    return;
  }

  console.log(`Esaminati ${record.length} lead collegati a un account.${nota}\n`);
  if (tabella.length) {
    console.log(`--- Da riparare: ${tabella.length} ---`);
    console.table(tabella);
  }
  if (divergenti.length) {
    console.log(`\n--- Divergenze NON toccate: ${divergenti.length} (il profilo ha già un'altra coach) ---`);
    console.table(divergenti);
    console.log('Se una di queste è sbagliata si corregge a mano da Utenti → assegna.');
  }

  if (!conferma) {
    console.log('\nNiente scritto: rilancia con  CONFERMA=1 npm run fix:assegnazioni');
    return;
  }

  for (const r of daCreare) {
    await prisma.clientProfile.create({
      data: {
        userId: r.clientId,
        name: r.name?.trim() || null,
        assignedCoachId: r.assignedCoachId,
        assignedNutritionistId: r.assignedNutritionistId,
      },
    });
  }
  for (const { r, patch } of daCompletare) {
    await prisma.clientProfile.update({ where: { userId: r.clientId }, data: patch as never });
  }

  console.log(`\n✅ Profili creati: ${daCreare.length} · profili completati: ${daCompletare.length}.`);
  console.log('Le coach ritrovano le loro clienti nella lista senza fare altro.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
