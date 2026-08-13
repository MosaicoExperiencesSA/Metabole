/**
 * IL VIA LIBERA CLINICO — «questa cliente può proseguire?»
 *
 * Domanda di Simone (13/8): «se poi metti Visita obbligatoria e la nutrizionista decide che la
 * cliente può proseguire, come fa a dircelo? Questo succede per tutte le persone in percorso, parte
 * il messaggio sorveglianza sanitaria ma lei come fa a dirci ok può proseguire?»
 *
 * La risposta era che **non aveva un modo**. C'era la segnalazione clinica da chiudere, e non basta:
 *
 *  1. ⚠️ la tregua di `escalations/riapertura.ts` dura 14 giorni, poi la segnalazione **si riapre**.
 *     Per il calo peso è giusto — quella condizione peggiora; per «ha un'allergia, serve la visita»
 *     no: un'allergia non passa, e il via libera non scade su un timer;
 *  2. ⚠️ «risolta» dice uno stato e una data, non **cosa** ha deciso;
 *  3. ⚠️ un flag derivato dalle allergie non si spegne chiudendo una segnalazione: si riaccende da
 *     solo, per sempre.
 *
 * Quindi è una **decisione scritta sulla cliente**, con chi, quando e la nota che la spiega. Non
 * scade: una valutazione clinica vale finché non arriva un fatto nuovo.
 *
 * ⚠️ **Vale per tutta la sorveglianza sanitaria, non solo per le allergie** — era la seconda metà
 * della domanda di Simone. Lo screening del questionario parte per chiunque dichiari patologie o
 * farmaci: un via libera che risponde solo alle allergie lascerebbe l'altra metà com'era.
 */

/** `null` = nessuno l'ha ancora valutata. È lo stato in cui si trova oggi chiunque. */
export type Idoneita = 'idonea' | 'serve_visita';

export const IDONEITA_VALIDE: readonly Idoneita[] = ['idonea', 'serve_visita'];

/**
 * ⚠️ La nota è OBBLIGATORIA (richiesta di Simone: «possiamo rendere obbligatoria la scrittura di una
 * nota... in modo che anche la coach entrando vede la nota del nutrizionista»).
 *
 * Il minimo serve a non far passare «ok» o «.»: una decisione clinica senza una riga che la spieghi
 * è indistinguibile da un clic per sbaglio, e chi la legge fra un mese — la coach, o un'altra
 * nutrizionista — non ha modo di sapere se la cliente è stata valutata o solo sfiorata col mouse.
 */
export const NOTA_MIN = 10;

export class NotaMancante extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotaMancante';
  }
}

/** Il testo che finisce nella lista note, dove la coach le cerca già. */
export function testoNota(esito: Idoneita, nota: string): string {
  const intestazione = esito === 'idonea' ? 'Può proseguire' : 'Serve una visita';
  return `Valutazione clinica — ${intestazione}: ${nota.trim()}`;
}

/**
 * Controlla la richiesta e restituisce la nota ripulita.
 *
 * Solleva `NotaMancante` con una frase che dice **cosa fare**, non quale campo manca: chi la legge
 * è una nutrizionista davanti a una scheda, non chi ha scritto l'endpoint.
 */
export function validaDecisione(esito: unknown, nota: unknown): { esito: Idoneita; nota: string } {
  if (!IDONEITA_VALIDE.includes(esito as Idoneita)) {
    throw new NotaMancante('Scegli se la cliente può proseguire o se serve una visita.');
  }
  const testo = typeof nota === 'string' ? nota.trim() : '';
  if (testo.length < NOTA_MIN) {
    throw new NotaMancante(
      'Scrivi una nota che spieghi la decisione: la leggerà anche la coach, e fra un mese sarà l’unica cosa che dice perché hai deciso così.',
    );
  }
  return { esito: esito as Idoneita, nota: testo };
}

/**
 * «Questa cliente ha bisogno di essere valutata?» — il flag derivato del §8 dell'handoff, in sola
 * lettura.
 *
 * ⚠️ Ha bisogno di essere valutata chi ha allergie dichiarate **e** nessuna decisione. Una volta
 * decisa — in un senso o nell'altro — non ricompare: è tutta la differenza con la segnalazione, che
 * dopo quattordici giorni tornava.
 *
 * ⚠️ E `serve_visita` **non** è «da valutare»: qualcuno l'ha guardata e ha deciso che la visita
 * serve. Quella cliente sta in un altro elenco — quelle da visitare — non in quello di chi nessuno
 * ha ancora aperto.
 */
export function daValutare(p: {
  allergies?: string[] | null;
  idoneita?: string | null;
  screeningFlag?: boolean | null;
}): boolean {
  if (p.idoneita) return false;
  return (p.allergies ?? []).length > 0 || !!p.screeningFlag;
}

/**
 * LA STESSA DOMANDA, MA CHIESTA A POSTGRES — il filtro «solo da valutare» dell'elenco Clienti.
 *
 * `daValutare()` qui sopra guarda **una** cliente che abbiamo già in mano. Il filtro dell'elenco no:
 * deve scegliere le righe **prima** di leggerle, perché l'elenco pagina a cento per volta, stampa un
 * totale in cima ed esporta in Excel tutte le pagine. Filtrare dopo darebbe un totale che non
 * corrisponde alle righe e un file che dichiara filtri che non ha applicato.
 *
 * ⚠️ **Quindi la regola finisce scritta due volte, ed è il rischio da tenere d'occhio.** Il modo in
 * cui una coppia così muore è che una delle due cambi da sola: qualcuno aggiunge un motivo per
 * essere valutate, lo scrive nella funzione, e l'elenco continua a non mostrarle — senza nessun
 * errore, e con la nutrizionista convinta di vedere tutte le sue. Per questo le due stanno **una
 * sotto l'altra** e `idoneita-filtro.spec.ts` le confronta **caso per caso**: se divergono, diventa
 * rosso.
 *
 * Il frammento è pensato per stare sotto `client.clientProfile` di `CrmRecord`. Conseguenza voluta:
 * un contatto **senza cliente collegata** non compare mai fra le da valutare — non ha un profilo, e
 * non c'è niente da valutare.
 *
 * ⚠️ `idoneita: ''` è trattato come «nessuna decisione» esattamente come fa `daValutare` (`if
 * (p.idoneita)`). Oggi in colonna ci finiscono solo `idonea` e `serve_visita` — l'endpoint non
 * accetta altro — ma se le due leggessero la stringa vuota in modo diverso, la cliente sparirebbe
 * dalla coda senza che nessuno l'abbia guardata.
 */
export function filtroDaValutare(): Record<string, unknown> {
  return {
    AND: [
      { OR: [{ idoneita: null }, { idoneita: '' }] },
      { OR: [{ allergies: { isEmpty: false } }, { screeningFlag: true }] },
    ],
  };
}
