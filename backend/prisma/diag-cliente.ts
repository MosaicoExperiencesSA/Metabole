/**
 * DIAGNOSTICA di UNA cliente: perché vede quel messaggio al posto del menu.
 *
 * Nasce da una domanda concreta (8/8): «questa cliente mi dice "riservato al nutrizionista",
 * mi spieghi perché?». Dal backoffice non si capisce, perché il messaggio che legge lei è la
 * traduzione gentile di uno stato calcolato al volo da `menu.service.ts → menuStatus()`, e le
 * cause possibili sono otto. Questo script le percorre nello stesso ordine del codice e dice
 * quale ha vinto, con dentro il perché.
 *
 * I due stati che nominano il nutrizionista sono diversi fra loro, e vanno distinti:
 *  - `awaiting_visit` → «il menu sarà pronto dopo la visita con il nutrizionista». È lo
 *    SCREENING: nel questionario ha dichiarato una condizione clinica o dei farmaci, quindi il
 *    percorso è supervisionato per scelta, non per un guasto. Si sblocca con la visita.
 *  - `blocked` → «la nutrizionista sta sistemando il tuo menu per rispettare le tue esclusioni».
 *    Qui invece qualcosa non torna: il motore non riesce a comporre un piano sicuro con le sue
 *    esclusioni e ha aperto una segnalazione.
 *
 * USO (shell di Render, dentro ~/project/src/backend):
 *   npm run diag:cliente -- lorenzo.martino1975@gmail.com
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function giorno(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : '—';
}

async function main(): Promise<void> {
  const email = (process.argv.slice(2).join(' ') || '').trim().toLowerCase();
  if (!email) {
    console.log('Indica l\'email:  npm run diag:cliente -- nome@esempio.it');
    return;
  }

  const user = (await prisma.user.findFirst({
    where: { email },
    select: {
      id: true, email: true, firstName: true, lastName: true, createdAt: true, deletedAt: true,
      emailVerifiedAt: true,
      clientProfile: {
        select: {
          name: true, planStartDate: true, screeningFlag: true, onboardingCompletedAt: true,
          regime: true, dietStyle: true, dietFamily: true, mealsPerDay: true,
          allergies: true, intolerances: true, dislikedFoods: true,
          assignedCoach: { select: { displayName: true } },
          assignedNutritionist: { select: { displayName: true, user: { select: { email: true } } } },
        },
      },
    },
  })) as never as {
    id: string; email: string; firstName: string | null; lastName: string | null;
    createdAt: Date; deletedAt: Date | null; emailVerifiedAt: Date | null;
    clientProfile: {
      name: string | null; planStartDate: Date | null; screeningFlag: boolean;
      onboardingCompletedAt: Date | null; regime: string | null; dietStyle: string | null;
      dietFamily: string | null; mealsPerDay: number | null;
      allergies: string[]; intolerances: string[]; dislikedFoods: string[];
      assignedCoach: { displayName: string } | null;
      assignedNutritionist: { displayName: string; user: { email: string } } | null;
    } | null;
  } | null;

  if (!user) { console.log(`Nessun utente con email ${email}.`); return; }
  const p = user.clientProfile;

  console.log('=== CHI È ===');
  console.log(`${p?.name ?? (`${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || '(senza nome)')} · ${user.email}`);
  console.log(`Registrata: ${giorno(user.createdAt)} · email verificata: ${giorno(user.emailVerifiedAt)}`);
  console.log(`Questionario: ${p?.onboardingCompletedAt ? `completato il ${giorno(p.onboardingCompletedAt)}` : 'NON completato'}`);
  console.log(`Coach: ${p?.assignedCoach?.displayName ?? '— nessuna —'} · Nutrizionista: ${p?.assignedNutritionist?.displayName ?? '— nessuna —'}`);
  console.log(`Dieta: ${p?.dietFamily ?? '(famiglia non fissata)'} · ${p?.dietStyle ?? '—'} · ${p?.regime ?? '—'} · ${p?.mealsPerDay ?? '—'} pasti`);
  console.log(`Inizio piano: ${giorno(p?.planStartDate)}`);
  console.log(`Allergie: ${(p?.allergies ?? []).join(', ') || '—'}`);
  console.log(`Intolleranze: ${(p?.intolerances ?? []).join(', ') || '—'}`);
  console.log(`Cibi esclusi (${(p?.dislikedFoods ?? []).length}): ${(p?.dislikedFoods ?? []).join(', ') || '—'}`);

  // --- Abbonamenti ---
  const subs = (await prisma.subscription.findMany({
    where: { clientId: user.id },
    select: { id: true, status: true, startDate: true, endDate: true, plan: { select: { name: true, priceCents: true } } },
    orderBy: { createdAt: 'desc' },
  })) as { id: string; status: string; startDate: Date | null; endDate: Date | null; plan: { name: string; priceCents: number } | null }[];
  console.log('\n=== ABBONAMENTI ===');
  if (subs.length === 0) console.log('nessuno');
  else console.table(subs.map((s) => ({
    piano: s.plan?.name ?? '—',
    prezzo: s.plan ? `€${(s.plan.priceCents / 100).toFixed(2)}` : '—',
    stato: s.status, dal: giorno(s.startDate), al: giorno(s.endDate),
  })));

  // --- Segnalazioni aperte ---
  const esc = (await prisma.escalation.findMany({
    where: { clientId: user.id, status: { in: ['open', 'in_progress'] as never } },
    select: { id: true, reason: true, source: true, category: true, status: true, createdAt: true, assignedToId: true },
    orderBy: { createdAt: 'desc' },
  })) as { id: string; reason: string; source: string; category: string; status: string; createdAt: Date; assignedToId: string | null }[];
  console.log('\n=== SEGNALAZIONI APERTE ===');
  if (esc.length === 0) console.log('nessuna');
  else for (const e of esc) {
    console.log(`· [${e.category}] ${giorno(e.createdAt)} — ${e.status}${e.assignedToId ? '' : '  ⚠ NON ASSEGNATA A NESSUNO'}`);
    console.log(`  ${e.reason}`);
  }

  // --- Menu ---
  const oggi = new Date(new Intl.DateTimeFormat('en-CA', { timeZone: process.env.APP_TIMEZONE || 'Europe/Rome' }).format(new Date()) + 'T00:00:00.000Z');
  const [totMenu, visibili, ultimo] = await Promise.all([
    prisma.menuDay.count({ where: { clientId: user.id } }),
    prisma.menuDay.count({ where: { clientId: user.id, visibleFrom: { lte: oggi }, date: { gte: oggi } } }),
    prisma.menuDay.findFirst({ where: { clientId: user.id }, orderBy: { date: 'desc' }, select: { date: true } }) as Promise<{ date: Date } | null>,
  ]);
  const misure = await prisma.measurement.count({ where: { clientId: user.id } });
  console.log('\n=== MENU E MISURE ===');
  console.log(`Giornate erogate: ${totMenu} · visibili oggi: ${visibili} · ultima: ${giorno(ultimo?.date)}`);
  console.log(`Misure registrate: ${misure}`);

  // --- Il verdetto, nello stesso ordine di menuStatus() ---
  const attivo = subs.some((s) => s.status === 'active' && (!s.endDate || s.endDate.getTime() >= oggi.getTime()));
  const inAttesa = subs.some((s) => s.status === 'pending');
  const bloccata = esc.find((e) => e.source === 'engine' && e.reason.includes('Piano bloccato'));

  console.log('\n=== PERCHÉ VEDE QUEL MESSAGGIO ===');
  if (subs.length > 0 && !attivo && !inAttesa) {
    console.log('STATO: "Nessun piano attivo" — non ha un abbonamento attivo entro il periodo.');
  } else if (visibili > 0) {
    console.log('STATO: "menu disponibile" — nessun messaggio. Se lei ne vede uno, ricarica l\'app.');
  } else if (p?.screeningFlag) {
    console.log(
      'STATO: "Menu dopo la visita" — percorso SUPERVISIONATO.\n' +
      '  Nel questionario ha dichiarato una condizione clinica o dei farmaci, quindi il menu\n' +
      '  parte dopo la visita col nutrizionista. NON è un guasto: è la regola di sicurezza.\n' +
      '  Si sblocca fissando e svolgendo la visita.',
    );
  } else if (!p?.planStartDate) {
    console.log('STATO: "Menu in preparazione" — non ha ancora scelto la data di inizio piano.');
  } else if (misure === 0) {
    console.log('STATO: "Inserisci le misure iniziali" — manca il punto di partenza.');
  } else if (bloccata) {
    console.log(
      'STATO: "Stiamo personalizzando il tuo piano" — PIANO BLOCCATO.\n' +
      `  Segnalazione aperta il ${giorno(bloccata.createdAt)}:\n  ${bloccata.reason}\n` +
      '  Il motore non riesce a comporre un piano sicuro con le sue esclusioni: o mancano\n' +
      '  ricette compatibili, o un\'esclusione non ha sostituto sicuro.\n' +
      '  Si sblocca CHIUDENDO la segnalazione, dopo aver sistemato il catalogo o le esclusioni.',
    );
  } else {
    console.log('STATO: "Menu in preparazione" — idonea, ma le giornate non sono ancora state erogate.');
  }

  console.log(
    '\n=== DOVE LO VEDE IL NUTRIZIONISTA ===\n' +
    '· Backoffice → Segnalazioni (e nella app staff, scheda della paziente).\n' +
    '· ⚠️ NON riceve nessuna notifica: le segnalazioni "Piano bloccato" vengono scritte\n' +
    '  direttamente a database da personal-base e menu, senza passare dal servizio che avvisa\n' +
    '  coach e nutrizionista. Il tipo di notifica "Dieta bloccata" esiste ed è nel catalogo,\n' +
    '  ma nessuno lo manda. Finché non si corregge, la segnalazione la vede solo chi va a\n' +
    '  guardare l\'elenco di sua iniziativa.',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
