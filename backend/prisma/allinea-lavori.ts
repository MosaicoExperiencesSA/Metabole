/**
 * ALLINEA LA PAGINA «LAVORI» AL RILASCIO — gira **da solo** a ogni deploy.
 *
 * Richiesta di Simone, 19/8 notte: **«non devo spuntare io le voci, fallo tu»**. Aveva ragione, e la
 * frase dice una cosa più grossa di quello che sembra: se dopo ogni consegna una persona deve
 * ricordarsi di premere un pulsante perché l'elenco dica la verità, quel pulsante **è un lavoro** —
 * e le cose che vanno ricordate ogni volta, prima o poi, non si ricordano. Poi qualcuno legge
 * l'elenco, ci trova aperte tre voci già chiuse, e ci perde una giornata. È successo il 19/8: tre
 * indagini su tre lavori già fatti.
 *
 * ⚠️ **Fa esattamente quello che fa il pulsante**, perché è **lo stesso codice**
 * (`LavoriService.caricaVociIniziali`), non una seconda copia: il pulsante resta dov'è, per quando
 * si vuole guardare prima di confermare. Due strade che scrivono la stessa cosa in due modi
 * divergono, ed è la ragione per cui questo script non ricopia niente.
 *
 * ⚠️ **Non è `carica:lavori`**, che è un'altra cosa e resta: quello fa il *primo* caricamento e
 * per scelta **non aggiorna mai** una voce già in elenco. Questo invece è l'allineamento del
 * rilascio: crea le mancanti, spunta quelle che il file dichiara finite, riscrive i testi che
 * nessuno ha corretto a mano.
 *
 * ## ⚠️ COSA NON PUÒ FARE, ED È IL PATTO
 *
 * ⛔ **Non toglie mai una spunta.** La pagina è lo stato vivo: una spunta messa a mano non si
 * discute da un file. Il file può solo *chiudere*, mai *riaprire*.
 * ⛔ **Non riscrive** una voce che qualcuno ha corretto dal backoffice (`testoAMano`).
 * ⛔ **Non crea** le voci `soloSeEsiste`: se in pagina non ci sono, per il caricamento non esistono.
 *
 * ## ⚠️ E NON FA FALLIRE IL DEPLOY
 *
 * Sta nel `preDeployCommand` accanto alle migrazioni, ma con un `|| true` intorno: se questo
 * allineamento non riesce, l'elenco dei lavori resta indietro di un giro — mentre far fallire il
 * rilascio di un'app che serve delle clienti **per la contabilità dei nostri compiti** sarebbe una
 * sproporzione. Si grida nei log e si va avanti.
 *
 * USO
 *   npm run allinea:lavori           # dice cosa farebbe, e non scrive
 *   CONFERMA=1 npm run allinea:lavori
 */
import { PrismaClient } from '@prisma/client';
import { LavoriService } from '../src/lavori/lavori.service';

const prisma = new PrismaClient();

async function main() {
  const conferma = process.env.CONFERMA === '1';
  const service = new LavoriService(prisma as never);
  const e = await service.caricaVociIniziali(conferma);

  console.log('');
  console.log('==================================================================');
  console.log(`  LAVORI — allineamento dal rilascio ${conferma ? '(SCRITTO)' : '(prova, non scrivo)'}`);
  console.log('==================================================================');
  console.log(`  voci nuove aggiunte:      ${e.aggiunte}`);
  console.log(`  voci spuntate:            ${e.spuntate}`);
  console.log(`  testi riscritti:          ${e.riscritte.length}`);
  console.log(`  date di nascita aggiunte: ${e.datate}`);
  console.log('');
  /**
   * ⚠️ **I titoli, non i numeri.** «3 voci spuntate» non si può verificare; «ho chiuso *Moduli
   * fissi in dashboard*» sì — e se ho chiuso la voce sbagliata si vede leggendo, che è l'unico modo
   * in cui un automatismo che tocca l'elenco di qualcun altro si può controllare.
   */
  for (const c of e.chiuse) console.log(`   ✔︎ chiusa:     ${c.titolo}`);
  for (const t of e.titoli) console.log(`   + aggiunta:   ${t.titolo}`);
  for (const r of e.riscritte) console.log(`   ✎ riscritta:  ${r.titolo}`);
  if (e.testiCambiati.length) {
    console.log('');
    console.log('  ⚠️ Queste hanno un testo corretto A MANO in pagina e NON le tocco:');
    for (const t of e.testiCambiati) console.log(`     · ${t.titolo}`);
  }
  if (e.fileIndietro.length) {
    console.log('');
    console.log('  ⚠️ Il file le crede aperte, la pagina le ha già chiuse (il file è indietro):');
    for (const v of e.fileIndietro) console.log(`     · ${v.titolo}`);
  }
  /**
   * ⚠️ **QUELLO CHE NON HA CHIUSO, non solo quello che ha chiuso** — revisione avversariale del 20/8.
   *
   * Lo script stampava in bella evidenza le voci spuntate e **taceva** su quelle che non era
   * riuscito a spuntare: un titolo che non combacia per un trattino diverso dava un output identico
   * a «era già chiusa». ⛔ Cioè lo strumento nato per evitare tre indagini su lavori già fatti
   * taceva **esattamente** nel caso in cui non stava funzionando. *Uno strumento che dice solo
   * quello che è riuscito a fare racconta sempre una giornata perfetta.*
   */
  if (e.titoliNonTrovati.length) {
    console.log('');
    console.log('  ⚠️ Il file voleva chiudere queste, e in pagina NON le ha trovate (il titolo non');
    console.log('     combacia: un trattino diverso, uno spazio in più, il testo riscritto a mano):');
    for (const t of e.titoliNonTrovati) console.log(`     · ${t}`);
  }
  /**
   * ⚠️ **«Già chiusa» non è «non trovata».** Fino al 27/8 una riga già spuntata usciva dalla query e
   * finiva nell'elenco delle non trovate: l'allineamento gridava al lupo proprio dove aveva
   * funzionato, e chi leggeva andava a cercare un titolo storto che non c'era.
   */
  if (e.titoliGiaChiusi.length) {
    console.log('');
    console.log('  ✔︎ Queste il file le voleva chiudere ed erano GIÀ chiuse in pagina: niente da fare.');
    for (const t of e.titoliGiaChiusi) console.log(`     · ${t}`);
  }
  if (e.titoliAmbigui.length) {
    console.log('');
    console.log('  ⚠️ E queste combaciano con PIÙ righe: non tocco niente, perché due voci intitolate');
    console.log('     uguale sono due lavori diversi e spuntarne una a caso è peggio di non spuntare.');
    for (const t of e.titoliAmbigui) console.log(`     · ${t}`);
  }
  if (e.riaperteAMano.length) {
    console.log('');
    console.log('  ✋ Queste il file le aveva già chiuse una volta, e qualcuno le ha RIAPERTE a mano.');
    console.log('     Non le richiudo: chi le ha riaperte sta dicendo che il lavoro non è finito.');
    for (const t of e.riaperteAMano) console.log(`     · ${t}`);
  }
  /**
   * ⚠️ **La categoria il file non la scrive: la dice.** È la leva con cui Simone si organizza il
   * lavoro, e riscriverla a ogni rilascio gliela toglierebbe di mano in silenzio. Ma una voce col
   * titolo «⏸ Sospesa, aspetta il paniere» dentro la colonna «Aspetta Simone» dichiara di aspettare
   * una risposta che lui ha già dato: si sposta con un clic, bisogna saperlo.
   */
  if (e.categorieDiverse.length) {
    console.log('');
    console.log('  ↔︎ Queste stanno in pagina sotto una categoria diversa da quella del file (la');
    console.log('     categoria la sposti tu dalla pagina: io non la tocco):');
    for (const c of e.categorieDiverse) console.log(`     · ${c.titolo}\n       in pagina: ${c.inPagina}  ·  nel file: ${c.nelFile}`);
  }
  if (e.soloInPagina) {
    console.log('');
    console.log(`  ⚠️ Voci scritte a mano in pagina e aperte: ${e.soloInPagina}.`);
    console.log('     Il file le può chiudere solo per TITOLO, e solo se il titolo è unico.');
  }
  console.log('');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => void prisma.$disconnect());
