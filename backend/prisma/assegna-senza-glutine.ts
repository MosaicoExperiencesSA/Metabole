/**
 * CHI È GIÀ ISCRITTO: assegna la dieta senza glutine e avvisa la cliente.
 *
 * Richiesta di Simone del 9/8: da qui in avanti l'assegnazione è automatica (questionario e scheda
 * cliente la fanno da sé), ma chi ha dichiarato il glutine **prima** di oggi resta con la dieta di
 * allora. Questo script passa quelle clienti una per una.
 *
 * Usa la STESSA funzione del prodotto (`assegnaSenzaGlutineEAvvisa`): niente logica duplicata, così
 * lo script non può decidere in modo diverso dall'app — che è il modo in cui le migrazioni finiscono
 * per creare dati che il codice non si aspetta.
 *
 * USO (shell di Render, dentro ~/project/src/backend):
 *   npm run assegna:senza-glutine              → elenca chi verrebbe cambiata, non scrive niente
 *   CONFERMA=1 npm run assegna:senza-glutine   → assegna, avvisa e segnala
 *
 * Cosa fa su ogni cliente, in questo ordine:
 *  1. verifica che la variante approvata esista per il suo regime e numero di pasti;
 *  2. se esiste: scrive `dietFamily`/`dietStyle`, manda la notifica in-app, e se ha giornate già
 *     erogate da oggi in avanti apre una segnalazione alla nutrizionista perché quelle vanno
 *     **rigenerate** (contengono ancora glutine);
 *  3. se non esiste: non scrive e non promette niente, apre la segnalazione e va avanti.
 *
 * ⚠️ Prima di lanciarlo con CONFERMA=1 la variante «Mediterranea senza glutine» deve essere
 * **generata e approvata** dalla nutrizionista. Lanciato prima, l'unico effetto è una segnalazione
 * per ogni cliente — corretto ma inutile. Il dry-run lo dice a chiare lettere.
 */
import { PrismaClient } from '@prisma/client';
import { assegnaSenzaGlutineEAvvisa, dichiaraSenzaGlutine, DIETA_SENZA_GLUTINE } from '../src/menu/senza-glutine';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const conferma = process.env.CONFERMA === '1';

  // Si legge tutto e si filtra in memoria: le dichiarazioni sono array di testo libero, e cercarle
  // in SQL vorrebbe dire riscrivere in query la regola che sta in `dichiaraSenzaGlutine`. Le
  // clienti sono centinaia, non milioni.
  const profili = (await prisma.clientProfile.findMany({
    select: {
      userId: true,
      name: true,
      dietFamily: true,
      regime: true,
      mealsPerDay: true,
      allergies: true,
      intolerances: true,
      dislikedFoods: true,
      user: { select: { email: true, deletedAt: true } },
    },
  })) as {
    userId: string;
    name: string | null;
    dietFamily: string | null;
    regime: string | null;
    mealsPerDay: number | null;
    allergies: string[];
    intolerances: string[];
    dislikedFoods: string[];
    user: { email: string; deletedAt: Date | null } | null;
  }[];

  const daFare = profili.filter(
    (p) =>
      !p.user?.deletedAt &&
      dichiaraSenzaGlutine([...(p.allergies ?? []), ...(p.intolerances ?? []), ...(p.dislikedFoods ?? [])]),
  );

  console.log(`\n=== Glutine dichiarato: ${daFare.length} clienti su ${profili.length} ===\n`);
  if (!daFare.length) {
    console.log('Nessuna cliente da cambiare.\n');
    return;
  }

  // La variante esiste? Lo si dice UNA volta in testa, invece di scoprirlo cliente per cliente:
  // se manca, il lancio non serve a niente e conviene saperlo prima.
  const varianti = (await prisma.diet.findMany({
    where: { name: DIETA_SENZA_GLUTINE },
    select: { id: true, regime: true, mealsPerDay: true, fasting: true, status: true },
  })) as { id: string; regime: string; mealsPerDay: number; fasting: boolean | null; status: string }[];
  const approvate = varianti.filter((v) => v.status === 'approved');
  console.log(
    `Varianti «${DIETA_SENZA_GLUTINE}» in catalogo: ${varianti.length} (approvate: ${approvate.length})` +
      (approvate.length
        ? `\n  ${approvate.map((v) => `${v.regime} · ${v.mealsPerDay} pasti${v.fasting ? ' · digiuno' : ''}`).join('\n  ')}`
        : ''),
  );
  if (!approvate.length) {
    console.log(
      '\n⚠️  Nessuna variante APPROVATA: lanciando con CONFERMA=1 nessuna dieta cambierebbe e\n' +
        '   nascerebbe una segnalazione per ogni cliente. Prima genera e pubblica la variante dal\n' +
        '   generatore (Backoffice → Creazione e validazione), poi rilancia.\n',
    );
  }

  console.log('');
  for (const p of daFare) {
    const chi = p.name || p.user?.email || p.userId;
    const dichiarato = [...(p.allergies ?? []), ...(p.intolerances ?? []), ...(p.dislikedFoods ?? [])]
      .filter((t) => /glutin|gluten|celiac/i.test(t))
      .join(', ');
    const gia = p.dietFamily === DIETA_SENZA_GLUTINE;
    console.log(`  ${chi}  ·  ${p.regime ?? '—'} · ${p.mealsPerDay ?? '—'} pasti  ·  «${dichiarato}»  ·  dieta: ${p.dietFamily ?? '—'}${gia ? ' ✓ già a posto' : ''}`);

    if (!conferma || gia) continue;
    const esito = await assegnaSenzaGlutineEAvvisa(prisma as never, p.userId);
    if (esito.esito === 'assegnata') {
      console.log(
        `      → assegnata e avvisata${esito.giorniDaRifare ? `; ${esito.giorniDaRifare} giornate future da RIGENERARE (segnalazione aperta)` : ''}`,
      );
    } else if (esito.esito === 'variante_mancante') {
      console.log('      → variante non disponibile per il suo profilo: niente scritto, segnalazione aperta');
    } else {
      console.log(`      → ${esito.esito}`);
    }
  }

  if (!conferma) {
    console.log('\nProva: non ho scritto niente e nessuna cliente è stata avvisata.');
    console.log('Rilancia con CONFERMA=1 per assegnare la dieta e mandare le notifiche.\n');
  } else {
    console.log(
      '\nFatto. Le giornate segnalate come «da rigenerare» si rifanno dalla scheda cliente con\n' +
        '«Rigenera menu»: finché non lo fai, quelle clienti vedono ancora piatti con glutine.\n',
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
