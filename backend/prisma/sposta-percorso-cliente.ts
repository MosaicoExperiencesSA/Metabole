/**
 * SPOSTA UNA CLIENTE DA UN PERCORSO A UN ALTRO (per esempio: dal digiuno ai 3 pasti).
 *
 * Nasce dalla decisione di Simone del 18/8 sulla voce 256 — «Maria spostiamola su Mediterranea 3
 * pasti» — ma è scritto **generico** di proposito: uno script con un nome dentro è uno script che
 * si riscrive la volta dopo, e la volta dopo qualcuno copia-incolla e sbaglia una riga.
 *
 * ## ⚠️ Cosa cambia davvero, e perché non è un aggiornamento di due campi
 *
 * `pathType` e `fastingWindow` insieme decidono **quali pasti la cliente riceve** e **su quale
 * struttura di catalogo** viene composta la sua giornata (`catalog/struttura-per-digiuno.ts`,
 * `menu/finestre-digiuno.ts`). Cambiarli vuol dire cambiarle la dieta. Per questo lo script:
 *
 *  - **non scrive niente** senza `CONFERMA=1`, e in anteprima mostra il prima e il dopo;
 *  - **non tocca i giorni già erogati**, e dice quanti ne trova da oggi in avanti — quelli restano
 *    costruiti sul percorso vecchio finché non si rigenerano (`npm run diag:rigenera`);
 *  - ⚠️ **azzera `fastingWindow`** quando il percorso nuovo non è il digiuno. Lasciarla lì sarebbe
 *    il difetto di famiglia di questo progetto: un dato che non si vede più da nessuna parte ma che
 *    il giorno che qualcuno rimette il digiuno torna ad agire, con una scelta di mesi prima.
 *
 * ## USO (shell di Render, dentro ~/project/src/backend)
 *
 *   SOLO=<email> PERCORSO=classic3 npm run sposta:percorso              → anteprima
 *   SOLO=<email> PERCORSO=classic3 CONFERMA=1 npm run sposta:percorso   → scrive
 *
 * Opzionali: `PASTI=3` (se non c'è, lo deduce dal percorso), `STILE=mediterranean`,
 * `FAMIGLIA=<nome della dieta>`.
 *
 * ⚠️ `SOLO` è **obbligatorio**. Uno script che cambia il percorso di tutte le clienti se lanciato
 * senza argomenti non è uno strumento, è una trappola.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** I percorsi ammessi, con i pasti che implicano. Sono gli stessi del questionario
 *  (`onboarding.questions.ts`): se lì se ne aggiunge uno, va aggiunto qui. */
const PERCORSI: Record<string, { pasti: number; digiuno: boolean; etichetta: string }> = {
  classic3: { pasti: 3, digiuno: false, etichetta: '3 pasti' },
  five: { pasti: 5, digiuno: false, etichetta: '5 pasti' },
  intermittent_fasting: { pasti: 3, digiuno: true, etichetta: 'digiuno intermittente' },
};

async function main(): Promise<void> {
  const conferma = process.env.CONFERMA === '1';
  const solo = (process.env.SOLO ?? '').trim().toLowerCase();
  const percorso = (process.env.PERCORSO ?? '').trim();

  if (!solo) {
    console.error('⛔ Serve SOLO=<email> (anche più email separate da virgola). Senza, questo script non fa niente.');
    process.exitCode = 1;
    return;
  }
  if (!PERCORSI[percorso]) {
    console.error(`⛔ PERCORSO non valido. Ammessi: ${Object.keys(PERCORSI).join(', ')}.`);
    process.exitCode = 1;
    return;
  }
  const scelto = PERCORSI[percorso];
  const pasti = process.env.PASTI ? Number(process.env.PASTI) : scelto.pasti;
  const stile = (process.env.STILE ?? '').trim() || null;
  const famiglia = (process.env.FAMIGLIA ?? '').trim() || null;

  const email = solo.split(',').map((e) => e.trim()).filter(Boolean);
  const utenti = (await prisma.user.findMany({
    where: { email: { in: email, mode: 'insensitive' } },
    select: { id: true, email: true, firstName: true },
  })) as { id: string; email: string; firstName: string | null }[];

  // ⚠️ Un'email che non corrisponde a nessuno VA DETTA: senza, un refuso darebbe «0 clienti
  // spostate ✓», cioè la faccia del «fatto» su un lavoro che non è stato fatto.
  const trovate = new Set(utenti.map((u) => u.email.toLowerCase()));
  for (const e of email) if (!trovate.has(e)) console.warn(`⚠️  Nessun utente con l'email «${e}»: controlla come si scrive.`);
  if (!utenti.length) {
    console.log('Nessuna cliente da spostare.');
    return;
  }

  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);

  for (const u of utenti) {
    const p = (await prisma.clientProfile.findUnique({
      where: { userId: u.id },
      select: { pathType: true, fastingWindow: true, mealsPerDay: true, dietStyle: true, dietFamily: true, name: true },
    })) as {
      pathType: string | null; fastingWindow: string | null; mealsPerDay: number | null;
      dietStyle: string | null; dietFamily: string | null; name: string | null;
    } | null;
    if (!p) {
      console.warn(`⚠️  ${u.firstName ?? u.email}: nessun profilo cliente. Salto.`);
      continue;
    }

    const giorniFuturi = await prisma.menuDay.count({ where: { clientId: u.id, date: { gte: oggi } } });
    const chi = p.name || u.firstName || u.email;

    console.log(`\n── ${chi}`);
    console.log(`   percorso : ${p.pathType ?? '—'} → ${percorso} (${scelto.etichetta})`);
    console.log(`   pasti    : ${p.mealsPerDay ?? '—'} → ${pasti}`);
    if (!scelto.digiuno && p.fastingWindow) {
      console.log(`   finestra : ${p.fastingWindow} → (azzerata: fuori dal digiuno non vuol dire niente)`);
    }
    if (stile) console.log(`   stile    : ${p.dietStyle ?? '—'} → ${stile}`);
    if (famiglia) console.log(`   famiglia : ${p.dietFamily ?? '—'} → ${famiglia}`);
    console.log(
      giorniFuturi
        ? `   ⚠️  ha ${giorniFuturi} giornat${giorniFuturi === 1 ? 'a' : 'e'} già scritte da oggi in avanti: restano costruite sul percorso VECCHIO. Per rifarle: npm run diag:rigenera`
        : '   nessuna giornata futura già scritta: il prossimo ciclo nasce già col percorso nuovo.',
    );

    if (!conferma) continue;
    await prisma.clientProfile.update({
      where: { userId: u.id },
      data: {
        pathType: percorso as never,
        mealsPerDay: pasti,
        // ⚠️ Solo fuori dal digiuno: spostando FRA due finestre non si cancella la scelta.
        ...(scelto.digiuno ? {} : { fastingWindow: null }),
        ...(stile ? { dietStyle: stile } : {}),
        ...(famiglia ? { dietFamily: famiglia } : {}),
      } as never,
    });
    console.log('   ✅ scritto.');
  }

  console.log(
    conferma
      ? `\nFatto su ${utenti.length} client${utenti.length === 1 ? 'e' : 'i'}.`
      : `\nANTEPRIMA: non ho scritto niente. Per applicare: CONFERMA=1 (${utenti.length} client${utenti.length === 1 ? 'e' : 'i'}).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
