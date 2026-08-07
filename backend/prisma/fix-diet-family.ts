/**
 * RIPARAZIONE: clienti già registrate senza FAMIGLIA di dieta sul profilo.
 *
 * Dal 7/8 la registrazione salva `ClientProfile.dietFamily` (= `Diet.name`), che insieme a
 * `dietStyle` identifica il PRODOTTO. Sulle clienti registrate prima il campo è nullo, e
 * lasciarlo così non è neutro: `pickDiet` ordina per `approvedAt desc`, quindi il giorno in cui
 * il nutrizionista approva una dieta nuova con lo stesso stile+regime+obiettivo+pasti, quella
 * diventa la vincitrice e la cliente **cambia dieta da sola**. Con 18 diete in catalogo su
 * pochi codici stile (Vegana, Vegetariana, Flexitariana e Flessibile sono tutte `flexible`)
 * non è un caso di scuola.
 *
 * Qui non si indovina niente: la dieta che una cliente sta ricevendo è scritta. Lo script la
 * legge e la fissa sul profilo, così **oggi non cambia nulla per nessuna** e da domani il
 * catalogo può crescere senza spostare le clienti già avviate.
 *
 * Ordine delle fonti, dalla più affidabile alla meno:
 *  1. `menu_day` più recente → è letteralmente la dieta da cui escono i suoi menu;
 *  2. `client_menu_pool` più recente → la base personalizzata approvata, se i menu non ci sono
 *     ancora ma il pool sì.
 * Senza nessuna delle due il profilo si lascia vuoto: una cliente che non ha mai ricevuto un
 * menu non ha una dieta "sua" da fissare, e inventarla sarebbe peggio che non fare niente.
 *
 * Casi che NON tocca, e che elenca:
 *  - famiglia già presente (registrata dopo il 7/8, o già riparata);
 *  - la dieta trovata ha uno STILE diverso da quello sul profilo. Succede quando pickDiet ha
 *    ripiegato su un altro stile per mancanza di catalogo: fissare la famiglia lì dentro
 *    renderebbe permanente un ripiego. Vanno guardati a mano — è la stessa lista dei buchi di
 *    catalogo da colmare.
 *
 * USO (shell di Render, dentro ~/project/src/backend):
 *   npm run fix:diet-family              → mostra e basta, non scrive niente
 *   CONFERMA=1 npm run fix:diet-family   → applica
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type Riga = {
  cliente: string;
  stileProfilo: string;
  famiglia: string;
  stileDieta: string;
  fonte: string;
};

async function main(): Promise<void> {
  const conferma = process.env.CONFERMA === '1';

  const profili = (await prisma.clientProfile.findMany({
    where: { dietFamily: null } as never,
    select: { userId: true, name: true, dietStyle: true },
  })) as { userId: string; name: string | null; dietStyle: string | null }[];

  if (profili.length === 0) {
    console.log('Nessun profilo senza famiglia: sono già tutti a posto ✓');
    return;
  }

  const daScrivere: { userId: string; family: string }[] = [];
  const tabella: Riga[] = [];
  const stileDiverso: Riga[] = [];
  let senzaTraccia = 0;

  for (const p of profili) {
    // 1) L'ultimo menu erogato: la dieta da cui escono davvero i suoi giorni.
    const menu = (await prisma.menuDay.findFirst({
      where: { clientId: p.userId },
      orderBy: { date: 'desc' },
      select: { diet: { select: { name: true, style: true } } },
    })) as { diet: { name: string; style: string } | null } | null;

    let dieta = menu?.diet ?? null;
    let fonte = 'ultimo menu';

    // 2) Ripiego: il pool ricette personalizzato, se i menu non sono ancora partiti.
    if (!dieta) {
      const pool = (await prisma.clientMenuPool.findFirst({
        where: { clientId: p.userId },
        orderBy: { createdAt: 'desc' },
        select: { dietId: true },
      })) as { dietId: string } | null;
      if (pool) {
        const d = (await prisma.diet.findUnique({
          where: { id: pool.dietId },
          select: { name: true, style: true },
        })) as { name: string; style: string } | null;
        if (d) {
          dieta = d;
          fonte = 'pool ricette';
        }
      }
    }

    if (!dieta) {
      senzaTraccia++;
      continue;
    }

    const riga: Riga = {
      cliente: p.name ?? '(senza nome)',
      stileProfilo: p.dietStyle ?? '—',
      famiglia: dieta.name,
      stileDieta: dieta.style,
      fonte,
    };

    // Lo stile della dieta servita non coincide con quello scelto: è un ripiego di pickDiet,
    // non una scelta. Fissarlo lo renderebbe definitivo.
    if (p.dietStyle && p.dietStyle !== dieta.style) {
      stileDiverso.push(riga);
      continue;
    }

    daScrivere.push({ userId: p.userId, family: dieta.name });
    tabella.push(riga);
  }

  const nota = senzaTraccia
    ? `\n(${senzaTraccia} profili senza menu né pool: nessuna dieta da fissare, restano vuoti e continuano ad abbinarsi per stile.)`
    : '';

  if (tabella.length === 0 && stileDiverso.length === 0) {
    console.log(`Esaminati ${profili.length} profili senza famiglia: niente da fissare.${nota}`);
    return;
  }

  console.log(`Esaminati ${profili.length} profili senza famiglia.${nota}\n`);
  if (tabella.length) {
    console.log(`--- Da fissare: ${tabella.length} (la dieta resta quella che ricevono già) ---`);
    console.table(tabella);
  }
  if (stileDiverso.length) {
    console.log(`\n--- NON toccati: ${stileDiverso.length} (ricevono una dieta di un ALTRO stile) ---`);
    console.table(stileDiverso);
    console.log(
      'Qui pickDiet ha ripiegato su un altro stile perché per quello scelto non c’è una dieta\n' +
      'approvata compatibile. Fissare la famiglia renderebbe permanente il ripiego: meglio\n' +
      'pubblicare la variante mancante, oppure correggere il tipo di dieta dalla scheda cliente.',
    );
  }

  if (!conferma) {
    console.log('\nNiente scritto: rilancia con  CONFERMA=1 npm run fix:diet-family');
    return;
  }

  for (const { userId, family } of daScrivere) {
    await prisma.clientProfile.update({
      where: { userId },
      data: { dietFamily: family } as never,
    });
  }
  console.log(`\n✓ Famiglia fissata su ${daScrivere.length} profili.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
