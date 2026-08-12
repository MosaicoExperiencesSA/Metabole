import { MealSnapshot } from './pasto-giornata';

/**
 * QUANDO I CAMBI DIVENTANO UN SEGNALE — e Gaia invita a fermarsi un attimo.
 *
 * Richiesta di Simone (12/8): «Se poi la cliente insiste coi cambiamenti — cambia tutti i giorni —
 * Gaia dovrebbe invitarla a riflettere: posso proporti di riflettere se questo è il percorso giusto
 * per te? Vuoi provare a confrontarti con la tua coach per vedere se con un altro tipo di
 * alimentazione otterrai risultati migliori?»
 *
 * ## Cosa si conta, e perché non è il numero di cambi
 *
 * Si contano i **giorni diversi** in cui ha cambiato qualcosa, non quante volte. Una cliente che
 * un martedì scambia tre ingredienti dello stesso piatto ha avuto un martedì storto; una che ne
 * cambia uno solo ma tre giorni su sette sta dicendo un'altra cosa — ed è quella la frase di
 * Simone, «cambia tutti i giorni». È la frequenza il segnale, non il volume.
 *
 * ## ⚠️ Quello che il messaggio NON dice
 *
 * La versione iniziale del testo si chiudeva con «ricordati che ogni cambio ti allontana dal tuo
 * obiettivo». Non è vero, e il modo in cui non è vero conta: i cambi che Gaia concede stanno dentro
 * i gruppi di equivalenza approvati dal nutrizionista, a pari grammatura — sono fatti apposta per
 * NON allontanarla. Dirle il contrario significherebbe farla sentire in colpa per aver usato una
 * funzione che le abbiamo dato noi, e il risultato prevedibile non è che smette di cambiare: è che
 * smette di **dircelo**. Una cliente che cambia di nascosto è molto peggio di una che cambia.
 *
 * La sostanza però resta, ed è giusta: se cambia quasi ogni giorno il problema non è il piatto, è
 * la **dieta** — e quella si cambia parlando con la coach, non un ingrediente alla volta.
 *
 * ## Tre regole che tengono il messaggio utile
 *
 * 1. **Non blocca niente.** Il cambio si fa comunque, e l'invito arriva in coda alla conferma. Un
 *    invito al posto del cambio sarebbe un ricatto gentile.
 * 2. **Non si ripete.** Al massimo una volta ogni due settimane: ripetuto ogni giorno diventa
 *    rumore, e il rumore si smette di leggere esattamente quando conta.
 * 3. **La coach lo sa.** «Parlane con la tua coach» ha senso solo se la coach è stata avvisata:
 *    altrimenti la cliente scrive e dall'altra parte nessuno sa di cosa stia parlando.
 */

/** Su quanti giorni indietro si guarda. Una settimana: è l'unità in cui la frase è scritta. */
export const FINESTRA_GIORNI = 7;

/**
 * Quanti giorni diversi con almeno un cambio fanno scattare l'invito.
 *
 * Tre su sette, deciso da Simone il 12/8. La mia proposta era quattro (più di metà settimana);
 * l'obiezione è agli atti — con cinque pasti al giorno tre giorni di cambi possono essere ancora
 * fisiologici, e un messaggio che arriva a chi non sta insistendo perde peso per tutte le altre.
 * Il valore si legge da `config_param` (`cambi_soglia_giorni`), quindi si corregge senza un deploy
 * se i primi mesi dicono che tre erano pochi.
 */
export const SOGLIA_GIORNI_DEFAULT = 3;

/** Distanza minima fra due inviti alla stessa cliente. */
export const PAUSA_FRA_INVITI_GIORNI = 14;

const ORIGINI_DELLA_CLIENTE = ['chat', 'app'];

interface GiornataConPasti {
  date: Date;
  meals: unknown;
}

/**
 * In quanti GIORNI DIVERSI, dentro la finestra, la cliente ha chiesto un cambio.
 *
 * ⚠️ Si contano solo i cambi con `origine` fra quelle della cliente: le sostituzioni senza origine
 * sono decise dal MOTORE per sicurezza (allergeni, intolleranze, esclusioni) e non sono scelte sue.
 * Contarle vorrebbe dire invitare a riflettere una cliente che non ha chiesto niente — e, con
 * un'allergia di mezzo, invitarla a riflettere proprio sulle sostituzioni che la tengono al sicuro.
 */
export function giorniConCambioDellaCliente(giornate: GiornataConPasti[]): number {
  const giorni = new Set<string>();
  for (const g of giornate) {
    const pasti = ((g.meals as MealSnapshot[]) ?? []).filter(Boolean);
    const suo = pasti.some(
      (p) =>
        (p.substitutions ?? []).some((s) => !!s?.origine && ORIGINI_DELLA_CLIENTE.includes(s.origine)) ||
        (!!p.cambioPiatto?.origine && ORIGINI_DELLA_CLIENTE.includes(p.cambioPiatto.origine)),
    );
    if (suo) giorni.add(g.date.toISOString().slice(0, 10));
  }
  return giorni.size;
}

/**
 * L'invito. `nome` è quello con cui la cliente vuole essere chiamata; può mancare.
 *
 * Il testo è quello scelto da Simone il 12/8 fra tre versioni: tiene l'invito a riflettere e il
 * confronto con la coach, e dice esplicitamente che i cambi **non** la allontanano dall'obiettivo —
 * perché è vero, ed è la cosa che le toglie il timore di averlo fatto di nascosto.
 */
export function testoInvitoARiflettere(nome: string | null | undefined, giorniConCambio: number): string {
  const chi = nome ? ` ${nome}` : '';
  const quanti =
    giorniConCambio >= FINESTRA_GIORNI
      ? 'ogni giorno di questa settimana'
      : `${giorniConCambio} giorni di questa settimana`;
  return (
    `\n\n---\n\nUna domanda${chi}, se posso. In ${quanti} abbiamo cambiato qualcosa nel tuo menu. ` +
    'Ogni singolo cambio va benissimo — sono tutti dentro il tuo piano e non ti allontanano dal tuo obiettivo.\n\n' +
    'Però, se ti capita così spesso, forse il problema non è il piatto: è che questa alimentazione non ti somiglia. ' +
    'Vuoi provare a confrontarti con la tua coach, per vedere se con un altro tipo di alimentazione otterresti ' +
    'risultati migliori e con meno fatica? 💚'
  );
}

/** Il testo dell'avviso alla coach: senza, «parlane con la tua coach» è un vicolo cieco. */
export function testoAvvisoCoach(nomeCliente: string, giorniConCambio: number): string {
  return (
    `${nomeCliente} ha cambiato qualcosa nel menu in ${giorniConCambio} giorni su ${FINESTRA_GIORNI}. ` +
    'Gaia le ha proposto di parlarne con te: forse il tipo di alimentazione non le sta bene.'
  );
}
