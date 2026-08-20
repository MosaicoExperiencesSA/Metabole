/**
 * «PRIMO ACCESSO EFFETTUATO» — la scheda CRM si muove quando la cliente entra davvero.
 *
 * Richiesta di Simone (20/8): «tutte le volte che un cliente accede la prima volta o registra
 * account lo spostiamo lì». La colonna l'ha creata lui dal backoffice, e sta **fra «Lavorato» e
 * «Questionario completato»**: prima c'è il contatto che abbiamo, qui c'è chi è entrato nell'app,
 * dopo chi ha finito il questionario.
 *
 * ## Perché una porta sola, e non due righe uguali in `AuthService`
 *
 * I punti che devono segnare il primo accesso sono due (registrazione e accesso) e domani
 * potrebbero essere tre. Se la chiave dello stato è scritta in due posti, il giorno che cambia —
 * o il giorno che si aggiunge una condizione, come è successo con la master password — cambia in
 * uno solo. Qui la chiave sta scritta **una volta**, e c'è un test che controlla che nessun altro
 * la scriva a mano.
 *
 * ## ⚠️ NON SERVE SAPERE SE È DAVVERO IL PRIMO
 *
 * `avanzaStatoSeIndietro` non fa mai retrocedere una scheda: dal secondo accesso in poi la
 * chiamata trova la scheda già lì (o più avanti) e non fa niente. Quindi si può chiamare a ogni
 * accesso senza tenere da nessuna parte un `firstLoginAt` — che sarebbe una colonna nuova, una
 * migrazione, e un secondo posto dove sta scritta la stessa cosa.
 * ⚠️ E la data del primo accesso resta comunque registrata: finisce in
 * `stageDates.primo_accesso_effettuato.at`, scritta la prima volta e mai più.
 *
 * ## ⛔ CHI NON LO SEGNA, E PERCHÉ
 *
 *  · **La master password.** Se l'assistenza entra nell'account di una cliente con
 *    `MASTER_PASSWORD`, sulla board comparirebbe «ha fatto il primo accesso» — e non l'ha fatto
 *    lei. Una ragione falsa in mano a chi telefona è peggio di una colonna vuota.
 *  · **Il refresh del token.** Non è un accesso nuovo, ed è una strada calda: due o tre query in
 *    più a ogni rinnovo, per un esito che dalla seconda volta è sempre «non faccio niente».
 *  · **Il cambio di utenza collegata** (`switch_account`). Chi preme quel pulsante è l'altra
 *    utenza della stessa persona, e non so dire se «è entrata la cliente». Non è un caso deciso:
 *    è un caso lasciato fuori apposta, e se serve si aggiunge qui, in questo file.
 *
 * ## ⚠️ E SE LA COLONNA NON C'È
 *
 * `avanzaStatoSeIndietro` per progetto tace se lo stato non esiste: la pipeline è dell'admin, e
 * un'automazione non deve protestare perché lui ha eliminato una colonna. Ma questa colonna è
 * stata creata **a mano**, e la sua chiave dipende dall'etichetta scritta in quel momento: se non
 * combacia, questa funzione non farebbe niente per sempre, in silenzio. Perciò lo dice — **una
 * volta per processo**, che è la differenza fra un avviso e un rumore di fondo.
 */
import { avanzaStatoSeIndietro, type PrismaPerStato } from './avanza-stato';

/**
 * La chiave dello stato, scritta una volta sola. Viene da `slug('Primo accesso effettuato')`, che
 * è l'etichetta che Simone ha scritto creando la colonna.
 */
export const STATO_PRIMO_ACCESSO = 'primo_accesso_effettuato';

/** Il rumore si fa una volta per processo, non a ogni accesso. */
let giaDetto = false;

/** Solo per i test: rimette il contatore a zero fra un caso e l'altro. */
export function dimenticaAvviso(): void {
  giaDetto = false;
}

export async function segnaPrimoAccesso(
  prisma: PrismaPerStato,
  clientId: string,
  log: { warn(m: string): void } = console,
): Promise<boolean> {
  const mosso = await avanzaStatoSeIndietro(prisma, clientId, STATO_PRIMO_ACCESSO, clientId);
  if (!mosso && !giaDetto) {
    const esiste = await prisma.pipelineStage
      .findUnique({ where: { key: STATO_PRIMO_ACCESSO }, select: { order: true } })
      .catch(() => null);
    if (!esiste) {
      giaDetto = true;
      log.warn(
        `[pipeline] Lo stato «${STATO_PRIMO_ACCESSO}» non esiste: nessuna scheda si sposterà al primo accesso. ` +
          'Controlla il nome della colonna con `npm run diag:pipeline-stati`.',
      );
    }
  }
  return mosso;
}
