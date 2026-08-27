/**
 * SPOSTA IN AVANTI LE GIORNATE DI MENU DI UNA CLIENTE — le date, non i piatti.
 *
 * Nato il 26/8 dal caso Moreno: una sospensione era stata cancellata dal Calendario dell'app
 * (`DELETE /me/events/:id`, che la cliente può premere), il motore non ha più trovato niente che
 * lo fermasse e ha erogato **dentro la vacanza**. Rimessa la sospensione a mano, restano quattro
 * giornate di piano bruciate su giorni in cui lei non mangerà quei piatti.
 *
 * ⚠️ **Sposta le DATE, non rifà le giornate.** È la differenza con «Rigenera menu»: rigenerare
 * ricompone i piatti — e chi aveva già letto il menu e fatto la spesa se lo trova cambiato. Qui i
 * piatti restano identici, cambia il giorno in cui li mangia. Per una cliente rientrata da una
 * vacanza è quasi sempre quello che si vuole.
 *
 * ## Cosa fa, esattamente
 *
 * Prende le giornate **da una data in poi** e le fa scorrere tutte dello stesso numero di giorni,
 * scelto in modo che la **prima** giornata spostata cada esattamente sul giorno che gli si dice.
 * ⚠️ Tutte dello stesso passo: i buchi e le distanze fra le giornate restano quelli che erano —
 * compattarle sarebbe una seconda decisione, e non è questa.
 *
 * ## Cosa NON fa, e perché
 *
 * ⛔ **Non va all'indietro.** Uno spostamento verso il passato riscriverebbe giorni già vissuti e
 * potrebbe finire sopra giornate che ci sono già. Se serve, è un'altra operazione e va guardata in
 * faccia — non un segno meno in un argomento.
 * ⛔ **Non tocca né `viewedAt` né `aperto_dalla_cliente_il`.** Se una giornata le era già arrivata
 * in app, o se l'ha davvero aperta, quei fatti sono successi: cancellarli vorrebbe dire dire che non
 * sono mai accaduti. Lo script li **stampa**, perché spostare un giorno che lei ha già aperto è una
 * decisione di chi preme, non dello script.
 * ⚠️ **E il segno che conta è «l'ha aperto», non «gliel'abbiamo mostrato»** (26/8, voce
 * `visto-non-vuol-dire-aperto`): `viewedAt` lo scrive `getMenu` su tutti i trenta giorni della
 * finestra, futuri compresi, quindi comparirebbe su quasi ogni riga ed è rumore. Si stampano tutti e
 * due, distinti — uno è un fatto sulla cliente, l'altro un fatto sull'app.
 * ⛔ **Non tocca i check-in, le pesate, i voti sui piatti.** Sono il racconto di quello che è
 * successo in quel giorno: spostare il menu non sposta la giornata che una persona ha vissuto. ⚠️ Se
 * su una giornata da spostare c'è un check-in, lo script lo dice: è il segno che quel giorno lei
 * l'ha vissuto davvero, e allora forse quella giornata non va spostata.
 * ⛔ **Non allunga il piano.** La scadenza la sposta la sospensione, che ha la sua memoria dei
 * giorni concessi (`pauseRequest`); farlo anche qui vorrebbe dire regalarli due volte.
 *
 * ## USO (shell di Render, dentro ~/project/src/backend)
 *
 *   npm run sposta:menu -- <email> <da> <nuovoInizio>
 *   npm run sposta:menu -- patty@esempio.it 2026-08-25 2026-09-01
 *
 * Guarda e stampa, riga per riga, e non scrive. Per scrivere:
 *
 *   CONFERMA=1 npm run sposta:menu -- patty@esempio.it 2026-08-25 2026-09-01
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CONFERMA = process.env.CONFERMA === '1';
const GIORNO = 86_400_000;

/** Una data scritta a mano, letta come GIORNO (mezzanotte UTC), non come istante. */
function soloData(testo: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(testo)) return null;
  const d = new Date(`${testo}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

const giorno = (d: Date) => d.toISOString().slice(0, 10);

interface Giornata {
  id: string;
  date: Date;
  visibleFrom: Date;
  viewedAt: Date | null;
  apertoDallaClienteIl?: Date | null;
  apertureTracciate?: boolean;
  status: string;
}

async function main(): Promise<void> {
  const [email, daTesto, aTesto] = process.argv.slice(2);
  if (!email || !daTesto || !aTesto) {
    console.log('Uso:  npm run sposta:menu -- <email> <da AAAA-MM-GG> <nuovoInizio AAAA-MM-GG>');
    console.log('Es.:  npm run sposta:menu -- patty@esempio.it 2026-08-25 2026-09-01');
    return;
  }
  const da = soloData(daTesto);
  const a = soloData(aTesto);
  if (!da || !a) {
    console.log('⛔ Le date si scrivono così: 2026-09-01. Ho letto:', daTesto, '/', aTesto);
    return;
  }

  const user = (await prisma.user.findFirst({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, email: true, role: true, clientProfile: { select: { name: true } } },
  })) as { id: string; email: string; role: string; clientProfile: { name: string | null } | null } | null;
  if (!user) {
    console.log(`⛔ Nessun utente con l'email "${email}".`);
    return;
  }
  if (user.role !== 'client') {
    console.log(`⛔ "${email}" non è una cliente (ruolo: ${user.role}).`);
    return;
  }
  console.log(`=== ${user.clientProfile?.name ?? user.email} ===`);
  console.log(CONFERMA ? '⚠️ CONFERMA=1: SCRIVO.\n' : 'Prova a vuoto: guardo e stampo, non scrivo niente.\n');

  const daSpostare = (await prisma.menuDay.findMany({
    where: { clientId: user.id, date: { gte: da } },
    orderBy: { date: 'asc' },
    select: { id: true, date: true, visibleFrom: true, viewedAt: true, apertoDallaClienteIl: true, apertureTracciate: true, status: true } as never,
  })) as unknown as Giornata[];

  if (daSpostare.length === 0) {
    console.log(`Nessuna giornata dal ${giorno(da)} in poi: non c'è niente da spostare.`);
    return;
  }

  /**
   * ⚠️ **Il passo si calcola sulla PRIMA giornata che esiste davvero**, non sulla data scritta
   * nell'argomento. «Da ieri in poi, slittano al primo settembre» vuol dire che il blocco **comincia**
   * il primo settembre: se per caso ieri una giornata non c'era, prendere il passo dalla data scritta
   * lascerebbe il primo settembre vuoto e farebbe cominciare il blocco il giorno dopo.
   */
  const passo = a.getTime() - daSpostare[0].date.getTime();
  if (passo <= 0) {
    console.log(
      `⛔ Questo spostamento va all'indietro (o resta fermo): la prima giornata è del ${giorno(daSpostare[0].date)} ` +
        `e la vorresti al ${giorno(a)}.\n` +
        '   Questo script sposta solo in avanti: indietro riscriverebbe giorni già vissuti e potrebbe\n' +
        '   finire sopra giornate che ci sono già. Se serve davvero, è un\'altra operazione.',
    );
    return;
  }
  const giorniDiPasso = Math.round(passo / GIORNO);

  /**
   * ⛔ **IL BUCO CHE SI APRE DEVE ESSERE COPERTO DA UNA SOSPENSIONE** — dalla revisione avversariale
   * del 26/8, ed è il difetto che avrebbe fatto il danno peggiore.
   *
   * Spostando le giornate in avanti si svuotano i giorni fra `da` e il nuovo inizio. Dal 25/8 il
   * motore **riempie i buchi**: alla prima apertura dell'app `dateDaComporre` ci scrive dentro, e
   * il piano brucia quei giorni **due volte** — una prima e una dopo lo spostamento. ⚠️ E il caso
   * da cui questo script nasce è proprio una cliente a cui la sospensione **mancava**.
   *
   * Quindi l'ordine delle operazioni non è un consiglio: prima si rimette la sospensione, poi si
   * spostano le giornate. Se il buco non è coperto, qui non si scrive niente.
   *
   * ⚠️ E questa guardia chiude anche un'altra strada: finché quei giorni sono sospesi il motore non
   * può comporre, quindi fra la prova a vuoto e il `CONFERMA=1` l'elenco non può cambiare sotto le
   * mani — che era il modo in cui il passo stampato poteva non essere quello scritto.
   */
  const oggiG = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  const primoScoperto = Math.max(da.getTime(), oggiG.getTime());
  const sospensioni = (await prisma.event.findMany({
    where: { clientId: user.id, mode: 'pause_period' as never } as never,
    select: { startDate: true, endDate: true },
  })) as { startDate: Date; endDate: Date }[];
  const coperto = (t: number) =>
    sospensioni.some((p) => t >= p.startDate.getTime() && t <= p.endDate.getTime());
  const scoperti: string[] = [];
  for (let t = primoScoperto; t < a.getTime(); t += GIORNO) if (!coperto(t)) scoperti.push(giorno(new Date(t)));

  /**
   * ⛔ **E NIENTE OLTRE LA FINE DEL PIANO.** `deliverIfEligible` si rifiuta di comporre là (`finePiano`
   * in `dateDaComporre`), e `getMenu` non filtra: spostando a mano si fabbricherebbe proprio lo
   * stato che il motore vieta — una cliente che legge menu oltre la fine del suo percorso.
   */
  const abbonamento = (await prisma.subscription.findFirst({
    where: { clientId: user.id, status: 'active' } as never,
    orderBy: { startDate: 'desc' } as never,
    select: { endDate: true } as never,
  })) as { endDate: Date | null } | null;
  const finePiano = abbonamento?.endDate
    ? new Date(`${abbonamento.endDate.toISOString().slice(0, 10)}T00:00:00.000Z`)
    : null;

  /** I check-in su quei giorni: se ce n'è uno, quel giorno lei l'ha vissuto davvero. */
  const checkin = new Set(
    (
      (await prisma.dailyCheckin.findMany({
        where: { clientId: user.id, date: { gte: da } },
        select: { date: true },
      })) as { date: Date }[]
    ).map((c) => giorno(c.date)),
  );

  /**
   * ⛔ **Le date di arrivo devono essere libere.** `menu_day` ha `@@unique([clientId, date])`: una
   * collisione farebbe fallire lo spostamento a metà, con una parte delle giornate spostate e una
   * parte no — il modo peggiore di sbagliare, perché somiglia a un successo.
   */
  const inMovimento = new Set(daSpostare.map((g) => g.id));
  const arrivi = daSpostare.map((g) => new Date(g.date.getTime() + passo));
  /**
   * ⚠️ **Questa guardia è quasi sempre vuota, e va detto invece di lasciarla sembrare più forte di
   * com'è** (revisione del 26/8): il passo è positivo, quindi ogni data di arrivo è successiva a
   * `da` — e tutto quello che sta da `da` in poi si sta muovendo. Resta a coprire due cose vere: una
   * giornata composta fra questa lettura e la scrittura, e il caso in cui domani qualcuno permetta
   * un passo diverso da zero in su.
   */
  const occupate = (
    (await prisma.menuDay.findMany({
      where: { clientId: user.id, date: { in: arrivi } },
      select: { id: true, date: true },
    })) as { id: string; date: Date }[]
  ).filter((g) => !inMovimento.has(g.id));

  console.log(`Giornate da spostare: ${daSpostare.length} · passo: +${giorniDiPasso} giorni\n`);
  for (const g of daSpostare) {
    const nuova = new Date(g.date.getTime() + passo);
    const note = [
      // ⚠️ Prima: solo `viewedAt`, cioè «gliel'abbiamo mostrata» — vera su quasi tutte, quindi
      // inservibile per decidere. Il dato che serve a chi preme è il primo dei tre.
      g.apertoDallaClienteIl ? '⛔ L\'HA APERTA lei: spostarla è una tua decisione' : null,
      !g.apertoDallaClienteIl && g.apertureTracciate === false ? '❔ non so dire se l\'ha aperta (app non aggiornata)' : null,
      g.viewedAt ? '👁 gliel\'abbiamo mostrata nella lista' : null,
      checkin.has(giorno(g.date)) ? '⚠️ ha il check-in di quel giorno: forse l\'ha vissuto davvero' : null,
      g.status !== 'planned' ? `stato: ${g.status}` : null,
    ].filter(Boolean);
    console.log(`  ${giorno(g.date)} → ${giorno(nuova)}${note.length ? '   ' + note.join(' · ') : ''}`);
  }

  if (occupate.length) {
    console.log(`\n⛔ NON SPOSTO NIENTE: ${occupate.length} date di arrivo sono già occupate da altre giornate:`);
    for (const g of occupate) console.log(`   ${giorno(g.date)}`);
    console.log('   Prima va deciso cosa farne di quelle: sovrascriverle sarebbe cancellare un menu senza dirlo.');
    return;
  }

  if (scoperti.length) {
    console.log(`\n⛔ NON SPOSTO NIENTE: ${scoperti.length} dei giorni che si liberano non sono coperti da nessuna sospensione:`);
    console.log(`   ${scoperti.slice(0, 12).join(', ')}${scoperti.length > 12 ? ` … e altri ${scoperti.length - 12}` : ''}`);
    console.log('   Dal 25/8 il motore RIEMPIE i buchi: alla prima apertura dell\'app ci ricomporrebbe dentro');
    console.log('   delle giornate, e il piano brucerebbe quei giorni due volte. Prima si rimette la');
    console.log('   sospensione dalla scheda, poi si spostano le giornate.');
    return;
  }

  const oltre = finePiano ? arrivi.filter((d) => d.getTime() > finePiano.getTime()) : [];
  if (oltre.length) {
    console.log(`\n⛔ NON SPOSTO NIENTE: ${oltre.length} giornate finirebbero OLTRE la fine del piano (${giorno(finePiano as Date)}):`);
    console.log(`   ${oltre.slice(0, 12).map(giorno).join(', ')}${oltre.length > 12 ? ' …' : ''}`);
    console.log('   Il motore non compone mai oltre quella data, e la scheda mostrerebbe menu di un percorso finito.');
    console.log('   Se la sospensione ha allungato il piano, controlla che la nuova scadenza sia già scritta.');
    return;
  }

  if (!CONFERMA) {
    console.log(`\n⚠️ PROVA A VUOTO: non ho scritto niente. Per spostare le ${daSpostare.length} giornate qui sopra:`);
    console.log(`   CONFERMA=1 npm run sposta:menu -- ${email} ${daTesto} ${aTesto}`);
    return;
  }

  /**
   * ⚠️ **Si scrive dalla più LONTANA alla più vicina, e dentro una transazione.** Spostando in avanti,
   * la data di arrivo di una giornata può essere la data di partenza di un'altra che non si è ancora
   * mossa: partendo dalla più lontana quel momento non esiste mai. La transazione copre il resto — o
   * si spostano tutte, o non si sposta niente.
   */
  const inOrdineInverso = [...daSpostare].sort((x, y) => y.date.getTime() - x.date.getTime());
  await prisma.$transaction(
    inOrdineInverso.map((g) =>
      prisma.menuDay.update({
        where: { id: g.id },
        data: {
          date: new Date(g.date.getTime() + passo),
          /**
           * ⚠️ **Anche `visibleFrom` scorre**, dello stesso passo: è la data da cui la giornata si
           * vede in app, e lasciandola indietro il menu del primo settembre comparirebbe oggi, in
           * mezzo alla vacanza — cioè esattamente la cosa che questo spostamento sta togliendo.
           */
          visibleFrom: new Date(g.visibleFrom.getTime() + passo),
        } as never,
      }),
    ),
  );

  console.log(`\n✅ Spostate ${daSpostare.length} giornate di +${giorniDiPasso} giorni.`);
  console.log(`   Adesso il blocco comincia il ${giorno(a)}.`);

  await prisma.auditLog
    .create({
      data: {
        action: 'menu.giornate_spostate',
        entityType: 'user',
        entityId: user.id,
        metadata: {
          da: giorno(da),
          nuovoInizio: giorno(a),
          giorniDiPasso,
          quante: daSpostare.length,
          date: daSpostare.map((g) => giorno(g.date)),
        } as never,
      } as never,
    })
    .catch((err: unknown) => {
      /**
       * ⚠️ Il registro dice **cosa e quando**, non «chi»: questo script gira da una shell e un
       * `actorId` non ce l'ha. Prometterlo nel messaggio d'errore sarebbe raccontare una traccia che
       * non esiste — la persona la sa Render nei suoi log di sessione, non noi.
       */
      console.log(
        `⚠️ Giornate spostate, ma il registro non si è scritto (${err instanceof Error ? err.message : String(err)}): ` +
          'lo spostamento è avvenuto, non resta la traccia di quando.',
      );
    });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
