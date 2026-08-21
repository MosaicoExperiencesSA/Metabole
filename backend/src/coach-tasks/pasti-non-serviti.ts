/**
 * ⛔ **RICEVE MENO PASTI DI QUELLI CHE LE ABBIAMO PROMESSO — e adesso qualcuno lo sa.**
 *
 * ## Il fatto (21/8)
 *
 * Da quando c'è l'orologio, la cliente sceglie un protocollo e l'app le scrive **quanti pasti farà**,
 * con gli orari. La 14:10 le promette quattro pasti, colazione compresa. Ma il catalogo del digiuno
 * ha pranzo, merenda e cena: se la sua famiglia di diete non ha anche la variante a **5 pasti**, la
 * colazione non c'è, e lei riceve tre pasti dopo averne letti quattro.
 *
 * Il motore se ne accorgeva già — `pastiPromessiCheMancano` gira a ogni composizione — e lo scriveva
 * in **un log e un evento di analytics che nessuna schermata legge**. Cioè: il difetto era misurato,
 * registrato, e invisibile. *Un dato che agisce e non si vede.*
 *
 * ## Perché un'attività, e perché alla nutrizionista
 *
 * Decisione di Simone del 21/8. Il rimedio è **generare la variante mancante a catalogo**: non lo può
 * fare la cliente (lei ha solo l'orologio), non lo può fare la coach. Lo fa la nutrizionista. Aprire
 * l'attività a qualcun altro vorrebbe dire chiedere una cosa a chi non può farla — che è il modo più
 * rapido di insegnare a chiudere le attività senza leggerle.
 *
 * ⚠️ **Una per cliente, non una per giornata composta.** Il motore passa di lì ogni volta che eroga:
 * senza un riferimento stabile, una cliente rotta produrrebbe un'attività al giorno per settimane, e
 * la colonna della nutrizionista diventerebbe illeggibile proprio mentre segnala una cosa vera.
 *
 * ⚠️ **E non si blocca niente.** Tre pasti su quattro sono meglio di nessun menu, e il rimedio non è
 * nelle mani di chi apre l'app. L'attività è un avviso, non un cancello.
 */

/** Il tipo dell'attività. ⚠️ È metà della chiave di unicità: `clientId + kind + refId`. */
export const TIPO_PASTI_NON_SERVITI = 'digiuno_pasti_non_serviti';

/**
 * ⛔ **IL RIFERIMENTO È *QUALI PASTI MANCANO*, e niente altro.**
 *
 * Non la dieta servita, non la data, non il protocollo. Le ragioni, in ordine:
 *
 *  - **la data no**, o nasce un'attività al giorno sullo stesso problema di catalogo;
 *  - **la dieta servita no**: la catena dei ripieghi di `pickDietFor` può cambiare la dieta scelta
 *    senza che per la cliente cambi niente — stessa colazione mancante, stessa telefonata da fare;
 *  - **il protocollo no**: 18:6 e 20:4 producono la stessa finestra e le stesse mancanze. Due
 *    attività per la stessa identica situazione sarebbero due volte lo stesso lavoro.
 *
 * ⚠️ Se invece cambia **cosa** le manca, è un'altra situazione e merita un'altra attività: passare da
 * «manca la colazione» a «mancano colazione e spuntino» è un peggioramento, e chi ha chiuso la prima
 * deve rivedere la seconda. È la stessa scelta di `riferimentoDigiunoEstremo`, che esclude l'orario
 * apposta perché un passo graduale non riapra un'attività già valutata.
 *
 * ⚠️ Ordinati: l'elenco arriva dal motore nell'ordine della giornata, ma se un giorno cambiasse
 * l'ordine senza cambiare i pasti nascerebbe un doppione. Un riferimento deve dipendere dal
 * **contenuto**, non da come è stato scritto.
 */
export const riferimentoPastiNonServiti = (mancanti: string[]): string =>
  [...mancanti].sort().join('+') || 'nessuno';

export interface TestoAttivita {
  title: string;
  description: string;
}

/**
 * Il testo.
 *
 * ⚠️ **Dice cosa succede ADESSO nel piatto**, non «manca una variante»: chi legge deve capire in una
 * riga che c'è una persona che sta mangiando meno di quello che le abbiamo scritto. Il nome della
 * variante da generare viene dopo, perché è il rimedio, non il fatto.
 *
 * ⚠️ E dice **dove NON si chiude**: non cambiandole la finestra (la sposta lei, dall'app) e non
 * cambiandole il profilo. Mandare qualcuno a cercare un comando che non esiste è peggio che non
 * dirgli niente — *una ragione falsa è peggio di un ordine sbagliato*.
 */
export function testoPastiNonServiti(
  nome: string | null | undefined,
  /** I pasti mancanti, già in italiano. */
  mancanti: string[],
  /** Come si chiama la dieta che le viene servita adesso. */
  dietaServita: string | null | undefined,
): TestoAttivita {
  const chi = (nome ?? '').trim() || 'Una cliente';
  const elenco = mancanti.join(', ') || 'alcuni pasti';
  const uno = mancanti.length === 1;
  return {
    title: `${chi}: riceve meno pasti di quelli che le abbiamo promesso`,
    description:
      `Ha impostato il suo orologio del digiuno, e l'app le ha scritto quanti pasti farà. `
      + `${uno ? 'Uno di quelli' : 'Alcuni di quelli'} non ${uno ? 'c\'è' : 'ci sono'} nel catalogo `
      + `della dieta che le viene servita${dietaServita ? ` («${dietaServita}»)` : ''}: manca ${elenco}. `
      + `⚠️ Sta già mangiando così — non è ferma e non è rotta, ma riceve meno di quello che ha letto, `
      + `e non se ne accorge nessuno finché non lo racconta lei. `
      + `⛔ Non si chiude cambiandole la finestra — quella la sposta lei dall'app — e nemmeno `
      + `cambiandole il profilo: si chiude generando la variante mancante a catalogo. `
      + `Con «npm run diag:orologio» vedi quali altre clienti sono nella stessa situazione, e quali `
      + `varianti servono. Se dopo averci guardato va bene così, segna l'attività fatta: non te la `
      + `ripropongo finché non le manca qualcos'altro.`,
  };
}

/**
 * Fra quanti giorni scade.
 *
 * ⚠️ Non è un'urgenza da oggi a domani — generare una variante a catalogo è lavoro vero, e la cliente
 * intanto mangia — ma nemmeno una cosa da lasciar scorrere: ogni giorno che passa è una giornata in
 * cui ha ricevuto meno di quello che le abbiamo scritto.
 */
export const scadenzaPastiNonServiti = (adesso: Date): Date =>
  new Date(adesso.getTime() + 7 * 24 * 60 * 60 * 1000);
