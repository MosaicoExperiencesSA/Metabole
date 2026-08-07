/**
 * RIPARAZIONE: clienti che il questionario l'hanno GIÀ compilato prima dell'8/8.
 *
 * Da oggi, alla fine del questionario la scheda CRM passa da sola a "Questionario completato"
 * (`questionnaire_done`). Chi l'ha compilato prima è rimasto dov'era — quasi sempre in "Nuovo
 * contatto" — e sulla board sembra una che non ha ancora fatto niente. Le coach guardano quella
 * colonna per decidere chi chiamare: lasciarle lì significa farle chiamare nell'ordine sbagliato.
 *
 * Lo script applica la stessa regola dell'automazione, con lo stesso limite:
 *  - si muove SOLO chi è più indietro. Chi ha già comprato, chi ha una coach assegnata, chi ha
 *    fatto la prima visita resta dov'è: quel lavoro l'ha fatto una persona e non si sovrascrive.
 *  - `onboardingCompletedAt` è la prova che il questionario è stato compilato: senza quello non
 *    si tocca niente.
 *
 * USO (shell di Render, dentro ~/project/src/backend):
 *   npm run fix:stato-questionario              → mostra e basta, non scrive niente
 *   CONFERMA=1 npm run fix:stato-questionario   → applica
 */
import { PrismaClient } from '@prisma/client';
import { avanzaStatoSeIndietro } from '../src/commerce/avanza-stato';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const conferma = process.env.CONFERMA === '1';

  const stato = (await prisma.pipelineStage.findUnique({
    where: { key: 'questionnaire_done' },
    select: { order: true, label: true },
  })) as { order: number; label: string } | null;
  if (!stato) {
    console.log(
      'Lo stato "questionnaire_done" non esiste in pipeline.\n' +
      'Lancia prima `npm run seed` (il deploy lo fa da solo), poi rilancia questo script.',
    );
    return;
  }

  const profili = (await prisma.clientProfile.findMany({
    where: { onboardingCompletedAt: { not: null } },
    select: { userId: true, name: true, onboardingCompletedAt: true, user: { select: { email: true } } },
    orderBy: { onboardingCompletedAt: 'asc' },
  })) as {
    userId: string;
    name: string | null;
    onboardingCompletedAt: Date | null;
    user: { email: string } | null;
  }[];

  if (profili.length === 0) {
    console.log('Nessuna cliente ha completato il questionario: niente da fare.');
    return;
  }

  // Stato attuale di ognuna, per dire prima che cosa succederebbe.
  const stati = (await prisma.pipelineStage.findMany({ select: { key: true, label: true, order: true } })) as
    { key: string; label: string; order: number }[];
  const perKey = new Map(stati.map((s) => [s.key, s]));

  const daMuovere: { cliente: string; email: string; da: string; compilato: string }[] = [];
  const fermi: { cliente: string; email: string; stato: string; perche: string }[] = [];

  for (const p of profili) {
    const record = (await prisma.crmRecord.findUnique({
      where: { clientId: p.userId },
      select: { stage: true },
    })) as { stage: string } | null;
    const attuale = record ? perKey.get(record.stage) : undefined;
    const riga = {
      cliente: p.name ?? '(senza nome)',
      email: p.user?.email ?? '—',
      compilato: p.onboardingCompletedAt?.toISOString().slice(0, 10) ?? '—',
    };
    if (record && attuale && attuale.order >= stato.order) {
      fermi.push({ ...riga, stato: attuale.label, perche: 'è già più avanti' });
      continue;
    }
    if (record && !attuale) {
      fermi.push({ ...riga, stato: record.stage, perche: 'stato non più in pipeline' });
      continue;
    }
    daMuovere.push({ ...riga, da: attuale?.label ?? (record ? record.stage : 'nessuna scheda CRM') });
  }

  console.log(
    `Clienti col questionario completato: ${profili.length}. ` +
    `Da spostare in "${stato.label}": ${daMuovere.length}. Lasciate dove sono: ${fermi.length}.\n`,
  );
  if (daMuovere.length) console.table(daMuovere);
  if (fermi.length) {
    console.log('\n--- Non toccate ---');
    console.table(fermi);
  }

  if (!conferma) {
    console.log('\nNiente scritto: rilancia con  CONFERMA=1 npm run fix:stato-questionario');
    return;
  }

  let fatte = 0;
  for (const p of profili) {
    const ok = await avanzaStatoSeIndietro(prisma as never, p.userId, 'questionnaire_done', p.userId);
    if (ok) fatte++;
  }
  console.log(`\n✓ Spostate ${fatte} schede in "${stato.label}".`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
