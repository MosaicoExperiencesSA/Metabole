/**
 * LE CLIENTI RIMASTE SENZA NUTRIZIONISTA — elenco, e assegnazione al capo.
 *
 * Nasce dal caso Sonia (21/8): questionario completato il 7/8 con **sei allergie dichiarate**, e il
 * 21/8 `diag:cliente` stampava ancora «Nutrizionista: — nessuna —».
 *
 * ⚠️ **Il problema è la presa in carico della CLIENTE, non il recapito della segnalazione.** La
 * prima passata di questo script, il 21/8, ha smentito una frase che avevo scritto per deduzione:
 * le segnalazioni un destinatario ce l'hanno, perché `apriSegnalazione` instrada al capo quando il
 * ruolo non è assegnato — **zero** orfane su 39 clienti. Ma senza nutrizionista in scheda quella
 * persona, nelle liste e nei perimetri, non è di nessuno: e delle 39 **sei** hanno lo screening
 * acceso, cioè un percorso in cui il menu parte dopo la visita col nutrizionista.
 *
 * Il codice è corretto da oggi — chi finisce il questionario senza nutrizionista sul lead viene
 * presa in carico dal capo (`common/nutrizionista-di-riferimento.ts`, parametro
 * `assign_head_nutritionist_by_default`) — ma il codice nuovo **non ripesca chi è già passata di
 * lì**. Questo script fa quello, e riassegna anche le **segnalazioni aperte** rimaste orfane di
 * quelle clienti — se ce ne sono: il conto si stampa comunque, anche a zero, perché un numero che
 * non si vede è un numero che si dà per scontato.
 *
 * ⚠️ **Non sposta nessuno.** Chi ha già una nutrizionista non viene toccata: qui si riempie solo il
 * vuoto. Uno spostamento è un atto esplicito, non l'effetto di uno script.
 *
 * USO (shell di Render, dentro ~/project/src/backend):
 *   npm run assegna:nutrizionista              → mostra e basta, non scrive niente
 *   CONFERMA=1 npm run assegna:nutrizionista   → applica
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function giorno(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : '—';
}

async function main(): Promise<void> {
  const conferma = process.env.CONFERMA === '1';

  const staff = (await prisma.staff.findMany({
    where: { user: { role: { in: ['head_nutritionist', 'nutritionist'] } } },
    select: { id: true, displayName: true, user: { select: { role: true, email: true } } },
  })) as { id: string; displayName: string; user: { role: string; email: string } | null }[];

  const capo = staff.find((s) => s.user?.role === 'head_nutritionist');
  if (!capo) {
    console.log('⛔ Nessun utente con ruolo `head_nutritionist`: non c\'è nessuno a cui assegnare.');
    console.log('   Crealo da Utenti nel backoffice, poi rilancia.');
    return;
  }
  const altre = staff.filter((s) => s.id !== capo.id);
  console.log(`Capo nutrizionista: ${capo.displayName} (${capo.user?.email ?? '—'})`);
  if (altre.length) {
    console.log(
      `⚠️ Ci sono anche ${altre.length} altre nutrizioniste (${altre.map((s) => s.displayName).join(', ')}).`,
    );
    console.log('   Quando sono più d\'una, distribuire i pazienti torna a essere una scelta:');
    console.log('   valuta di spegnere `assign_head_nutritionist_by_default` e assegnare dal backoffice.');
  }

  const senza = (await prisma.clientProfile.findMany({
    where: { assignedNutritionistId: null, onboardingCompletedAt: { not: null } },
    select: {
      userId: true,
      name: true,
      onboardingCompletedAt: true,
      allergies: true,
      screeningFlag: true,
      user: { select: { email: true, deletedAt: true } },
    },
    orderBy: { onboardingCompletedAt: 'asc' },
  })) as {
    userId: string; name: string | null; onboardingCompletedAt: Date | null;
    allergies: string[]; screeningFlag: boolean;
    user: { email: string; deletedAt: Date | null } | null;
  }[];

  const vive = senza.filter((p) => !p.user?.deletedAt);
  console.log(`\n=== CLIENTI CON QUESTIONARIO FATTO E NESSUNA NUTRIZIONISTA: ${vive.length} ===`);
  if (!vive.length) {
    console.log('nessuna — niente da fare.');
    return;
  }
  console.table(
    vive.map((p) => ({
      cliente: p.name ?? '(senza nome)',
      email: p.user?.email ?? '—',
      questionario: giorno(p.onboardingCompletedAt),
      // Le due colonne che dicono quanto pesa il vuoto: chi ha allergie o screening è
      // esattamente chi ha bisogno che qualcuno risponda di lei.
      allergie: (p.allergies ?? []).length,
      screening: p.screeningFlag ? 'SÌ' : '',
    })),
  );

  const ids = vive.map((p) => p.userId);
  const orfane = (await prisma.escalation.findMany({
    where: { clientId: { in: ids }, assignedToId: null, status: { in: ['open', 'in_progress'] } },
    select: { id: true, clientId: true, category: true, createdAt: true },
  })) as { id: string; clientId: string; category: string; createdAt: Date }[];
  console.log(`\nSegnalazioni APERTE e senza destinatario, di quelle clienti: ${orfane.length}`);

  if (!conferma) {
    console.log('\n--- PROVA A VUOTO: non è stato scritto niente. ---');
    console.log('Per applicare:  CONFERMA=1 npm run assegna:nutrizionista');
    return;
  }

  const p1 = await prisma.clientProfile.updateMany({
    where: { userId: { in: ids }, assignedNutritionistId: null },
    data: { assignedNutritionistId: capo.id },
  });
  const p2 = orfane.length
    ? await prisma.escalation.updateMany({
        where: { id: { in: orfane.map((e) => e.id) }, assignedToId: null },
        data: { assignedToId: capo.id },
      })
    : { count: 0 };

  console.log(`\n✅ Clienti assegnate: ${p1.count} · segnalazioni riassegnate: ${p2.count}.`);
  console.log('⚠️ I menu non ripartono da qui: l\'assegnazione dà un destinatario, non toglie i cancelli.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
