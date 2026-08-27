/**
 * ⛔ **QUANTI GIORNI FUTURI RISULTANO GIÀ «VISTI» — cioè quanto è morta la funzione «rifai i giorni
 * già preparati».**
 *
 * ## Il fatto, letto nel codice (24/8)
 *
 * `MenuDay.viewedAt` si chiama «visto» e in tutto il progetto viene letto come «l'ha aperto». Non è
 * quello che ci scrive dentro il motore:
 *
 *  · `MenuService.getMenu` restituisce all'app gli ultimi 30 giorni **visibili**, futuri compresi, e
 *    subito dopo chiama `segnaVisti`, che li marca **tutti**;
 *  · i giorni nuovi, **dal secondo ciclo in poi**, nascono `visibleFrom: today` — cioè visibili
 *    subito (`menu.service.ts`, `visibleFrom: last ? today : visibleFrom`).
 *
 * ⛔ Quindi **appena la cliente apre l'app, tutti i suoi giorni futuri risultano «visti»**. Non
 * perché li abbia guardati: perché erano nella lista che l'app ha caricato.
 *
 * ## Perché conta
 *
 * Fino al 26/8 ogni percorso che «rifà i giorni non ancora aperti» (i divieti dettati a Vera, gli
 * spuntini, le proteine, la regola di dieta) filtrava su `viewedAt`. Essendo valorizzato ovunque,
 * quei percorsi **non trovavano mai niente da rifare** — e la nutrizionista leggeva «Nei giorni già
 * preparati non ce n'era: non ho toccato niente» mentre il piatto vietato era nel menu di domani. La
 * frase era falsa e non lo sembrava: è il modo peggiore in cui una funzione può essere rotta.
 *
 * ## ⚠️ COSA È CAMBIATO IL 26/8, e perché questo script serve ancora — anzi, di più
 *
 * La decisione è stata presa (voce `visto-non-vuol-dire-aperto`): adesso decide
 * `aperto_dalla_cliente_il`, che scrive l'app quando la cliente sta guardando **quel** giorno, e
 * `aperture_tracciate` dice se di quel giorno possiamo saperlo. ⛔ **Quindi la prima metà di questo
 * script misura ormai la STORIA** (quanto era rotto), e la seconda misura la cosa viva: quante righe
 * sono ancora «non lo so», cioè quanto manca perché la correzione automatica riparta davvero. Chi
 * lancia questo strumento il giorno dopo il rilascio deve leggere la seconda metà, non la prima.
 *
 * ⚠️ **Questo script non ripara e non decide: conta.** *Misurare prima di decidere* vale anche
 * dopo — soprattutto dopo, perché è così che si sa se una correzione è arrivata nel piatto.
 *
 *   npm run diag:visto
 */
import { PrismaClient } from '@prisma/client';
import { aGiorno } from '../src/common/date-only';

const prisma = new PrismaClient();

async function main() {
  const oggi = aGiorno(new Date());

  const futuri = (await prisma.menuDay.findMany({
    where: { date: { gte: oggi } },
    select: {
      clientId: true, date: true, viewedAt: true, visibleFrom: true,
      apertoDallaClienteIl: true, apertureTracciate: true,
    } as never,
  })) as {
    clientId: string; date: Date; viewedAt: Date | null; visibleFrom: Date;
    apertoDallaClienteIl: Date | null; apertureTracciate: boolean;
  }[];

  if (!futuri.length) {
    console.log('Nessun giorno di menu da oggi in avanti: non c\'è niente da contare.');
    return;
  }

  const visti = futuri.filter((g) => g.viewedAt);
  // ⚠️ Un passo solo, non un `filter` per ogni cliente dentro il ciclo: alla scala vera reggeva
  // comunque, ma un conto quadratico in uno script che gira sul database di produzione è la cosa che
  // un giorno qualcuno lancia su un anno di dati e non torna più.
  const daRifarePerCliente = new Map<string, number>();
  for (const g of futuri) {
    const suoi = daRifarePerCliente.get(g.clientId) ?? 0;
    daRifarePerCliente.set(g.clientId, suoi + (g.viewedAt ? 0 : 1));
  }
  const clienti = new Set(daRifarePerCliente.keys());
  const conTuttoVisto = [...daRifarePerCliente].filter(([, n]) => n === 0).map(([c]) => c);
  const conQualcosaDaRifare = [...daRifarePerCliente].filter(([, n]) => n > 0).map(([c]) => c);

  /**
   * ⚠️ **Il giorno di DOMANI è il caso che si racconta**: è quello che la nutrizionista si aspetta di
   * poter rifare quando detta un divieto oggi pomeriggio. Contarlo a parte evita di nascondere la
   * cosa dentro una media.
   */
  const domani = new Date(oggi.getTime() + 86_400_000).getTime();
  const diDomani = futuri.filter((g) => g.date.getTime() === domani);
  const diDomaniVisti = diDomani.filter((g) => g.viewedAt);

  const pct = (a: number, b: number) => (b === 0 ? '—' : `${Math.round((a / b) * 100)}%`);

  console.log(`Giorni di menu da oggi in avanti: ${futuri.length}, su ${clienti.size} clienti.\n`);
  console.log(`Già marcati «visti»:            ${visti.length} (${pct(visti.length, futuri.length)})`);
  console.log(`Clienti con TUTTO già «visto»:  ${conTuttoVisto.length} (${pct(conTuttoVisto.length, clienti.size)})`);
  console.log(`Clienti con qualcosa da rifare: ${conQualcosaDaRifare.length}`);
  console.log(`\nIl menu di DOMANI: ${diDomani.length} giornate, di cui già «viste» ${diDomaniVisti.length} (${pct(diDomaniVisti.length, diDomani.length)}).`);

  /**
   * ⚠️ E il controllo della premessa: se i giorni futuri **non** nascessero già visibili, tutto il
   * ragionamento qui sopra sarebbe sbagliato. Si guarda invece di darlo per buono.
   */
  const giaVisibili = futuri.filter((g) => g.visibleFrom.getTime() <= oggi.getTime());
  console.log(
    '\nGiorni futuri già VISIBILI (quindi che l\'app manda e che `segnaVisti` marca): ' +
      `${giaVisibili.length} su ${futuri.length} (${pct(giaVisibili.length, futuri.length)}).`,
  );

  /**
   * ⚠️ **IL NUMERO CHE RISPONDE ALLA DOMANDA È «clienti con tutto già visto»**, non la percentuale
   * delle giornate: chi detta un divieto agisce su **una cliente**, e per lei o c'è qualcosa da
   * rifare o non c'è. Uno script nato per mettere un numero davanti a una decisione non può indicare
   * quello sbagliato — con tre percentuali in pagina, «quella in alto» non era nemmeno un indirizzo.
   */
  console.log(
    `\nCosa vuol dire: su ${pct(conTuttoVisto.length, clienti.size)} delle clienti (${conTuttoVisto.length} su ` +
      `${clienti.size}) il comando «rifai i giorni già preparati» NON troverà niente da rifare, ` +
      'qualunque cosa detti la nutrizionista, SE si guardasse ancora `viewedAt`. È la misura di ' +
      'quanto era rotto prima del 26/8, e serve a non dimenticarlo.',
  );

  /**
   * ⛔ **LA MISURA VIVA: QUANTO PESA ANCORA «NON LO SO»** (26/8).
   *
   * Dal 26/8 la domanda è un'altra: non «quanti risultano visti» ma «di quanti **possiamo** dirlo».
   * `aperture_tracciate` nasce `false` su ogni riga esistente e diventa `true` solo sulle giornate
   * composte **dopo** che il telefono di quella cliente ha mandato il primo segnale. ⚠️ Finché questo
   * numero è alto, i rifacimenti automatici sono fermi — e Vera lo dice a voce, il che è il punto
   * della correzione; ma chi guarda i numeri deve poter vedere se sta scendendo o no. Se dopo una
   * settimana non scende, il segnale dall'app non sta arrivando e va guardato lì.
   */
  const nonSappiamo = futuri.filter((g) => !g.apertureTracciate);
  const apertiDavvero = futuri.filter((g) => g.apertoDallaClienteIl);
  const rifacibili = futuri.filter((g) => g.apertureTracciate && !g.apertoDallaClienteIl);
  const profiliConSegnale = await prisma.clientProfile.count({ where: { apertureDal: { not: null } } as never });
  const profiliTotali = await prisma.clientProfile.count();

  console.log('\n─────────── e adesso la misura che conta (dal 26/8) ───────────\n');
  console.log(`Giorni futuri di cui NON possiamo sapere se li ha aperti: ${nonSappiamo.length} (${pct(nonSappiamo.length, futuri.length)})`);
  console.log(`Giorni futuri che la cliente ha APERTO davvero:           ${apertiDavvero.length} (${pct(apertiDavvero.length, futuri.length)})`);
  console.log(`Giorni futuri che si possono ancora rifare da soli:       ${rifacibili.length} (${pct(rifacibili.length, futuri.length)})`);
  console.log(`Clienti la cui app manda il segnale:                     ${profiliConSegnale} su ${profiliTotali} (${pct(profiliConSegnale, profiliTotali)})`);
  console.log(
    '\n⚠️ «Non lo so» non è «non l\'ha aperto»: quei giorni non si toccano, e Vera lo dice invece di ' +
      'far finta che non ci fosse niente da rifare. Il numero da guardare nel tempo è l\'ultimo: ' +
      'finché le app non sono aggiornate, il primo resta alto per forza.',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
