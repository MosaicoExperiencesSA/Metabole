/**
 * RIPARAZIONE: clienti che hanno compilato il questionario ma risultano senza consenso sanitario,
 * e per questo non riescono a completare l'acquisto.
 *
 * IL DIFETTO (8/8/2026). Il salvataggio del profilo a fine questionario è un `upsert`, e il
 * consenso ai dati sanitari era scritto **solo nel ramo `create`**. Chi aveva già un profilo prima
 * di compilare il questionario finiva nel ramo `update`:
 *   - `onboardingCompletedAt` veniva scritto → per l'app il questionario è FATTO e non lo mostra più;
 *   - `consents.healthDataConsent` no → il carrello lo pretende e blocca l'acquisto con
 *     «serve il consenso ai dati sanitari: completa prima il questionario».
 * Cioè le chiedeva l'unica cosa che non poteva più raggiungere. Chi aveva già un profilo? I lead a
 * cui la coach manda le credenziali (il profilo nasce lì), chi arriva con un codice invito, chi è
 * stato modificato da backoffice. L'8/8 tre clienti bloccate sulla Prova Gratuita.
 * Il codice è corretto da `onboarding.service.ts` (consenso scritto in entrambi i rami); questo
 * script sistema chi era già passata da lì.
 *
 * NON INVENTA NIENTE. Il consenso lo ripristina solo se le risposte inviate lo dimostrano:
 * `onboardingAnswers.healthDataConsent === true`. Il questionario si rifiuta di partire senza
 * quel consenso (`submitAnswers`, prima riga), quindi quelle risposte SONO la prova che è stato
 * dato. Chi non ha quella prova viene elencato e non toccato: lì il consenso va richiesto davvero.
 * La data registrata è quella del questionario, non oggi, con una nota che dice che è un ripristino.
 *
 * USO (shell di Render, dentro ~/project/src/backend):
 *   npm run fix:consenso-sanitario              → mostra e basta, non scrive niente
 *   CONFERMA=1 npm run fix:consenso-sanitario   → applica
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Consensi = Record<string, unknown> & {
  // `unknown` sugli altri campi: qui dentro finiscono anche la nota di ripristino e qualunque
  // consenso raccolto altrove, che questo script non deve conoscere per non perderlo.
  healthDataConsent?: { accepted?: boolean; at?: string; [altro: string]: unknown };
};

async function main(): Promise<void> {
  const conferma = process.env.CONFERMA === '1';

  const profili = (await prisma.clientProfile.findMany({
    where: { onboardingCompletedAt: { not: null } },
    select: {
      userId: true,
      name: true,
      consents: true,
      onboardingAnswers: true,
      onboardingCompletedAt: true,
      user: { select: { email: true } },
    },
    orderBy: { onboardingCompletedAt: 'asc' },
  })) as {
    userId: string;
    name: string | null;
    consents: Consensi | null;
    onboardingAnswers: { healthDataConsent?: unknown } | null;
    onboardingCompletedAt: Date | null;
    user: { email: string } | null;
  }[];

  const daRiparare: typeof profili = [];
  const senzaProva: { cliente: string; email: string; compilato: string }[] = [];

  for (const p of profili) {
    if (p.consents?.healthDataConsent?.accepted === true) continue; // già a posto
    const riga = {
      cliente: p.name ?? '(senza nome)',
      email: p.user?.email ?? '—',
      compilato: p.onboardingCompletedAt?.toISOString().slice(0, 10) ?? '—',
    };
    // La prova sta nelle risposte inviate. `true` secco: un valore mancante o diverso non basta.
    if (p.onboardingAnswers?.healthDataConsent !== true) {
      senzaProva.push(riga);
      continue;
    }
    daRiparare.push(p);
  }

  console.log(
    `Questionari completati: ${profili.length}. ` +
    `Bloccate senza consenso: ${daRiparare.length + senzaProva.length} ` +
    `(riparabili: ${daRiparare.length}, senza prova nelle risposte: ${senzaProva.length}).\n`,
  );

  if (daRiparare.length) {
    console.table(
      daRiparare.map((p) => ({
        cliente: p.name ?? '(senza nome)',
        email: p.user?.email ?? '—',
        compilato: p.onboardingCompletedAt?.toISOString().slice(0, 10) ?? '—',
      })),
    );
  }
  if (senzaProva.length) {
    console.log(
      '\n--- NON toccate: le risposte non dimostrano il consenso ---\n' +
      'Qui il consenso va richiesto davvero: non si scrive un consenso che non risulta dato.\n',
    );
    console.table(senzaProva);
  }
  if (daRiparare.length === 0) {
    console.log('Nessun consenso da ripristinare.');
    return;
  }

  if (!conferma) {
    console.log('\nNiente scritto: rilancia con  CONFERMA=1 npm run fix:consenso-sanitario');
    return;
  }

  let fatte = 0;
  for (const p of daRiparare) {
    const quando = (p.onboardingCompletedAt ?? new Date()).toISOString();
    const consensi: Consensi = {
      ...(p.consents ?? {}),
      healthDataConsent: {
        accepted: true,
        at: quando,
        // Traccia onesta: il consenso è del giorno del questionario, la RIGA è stata riscritta oggi.
        ripristinato: {
          il: new Date().toISOString(),
          perche: 'consenso perso dal ramo update dell upsert onboarding (difetto 8/8/2026)',
          prova: 'onboardingAnswers.healthDataConsent === true',
        },
      },
    };
    await prisma.clientProfile.update({
      where: { userId: p.userId },
      data: { consents: consensi as never },
    });
    fatte++;
  }
  console.log(`\n✓ Consenso ripristinato a ${fatte} clienti: ora possono completare l'acquisto.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
