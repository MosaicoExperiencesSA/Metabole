/**
 * QUANDO LA NUTRIZIONISTA DEVE GUARDARE UNA SCELTA DI DIGIUNO — §3 e §15 del foglio decisioni.
 *
 * > «il cliente sceglie le fasce orarie ma se sceglie le più estreme mandiamo una notifica alla
 * > nutrizionista per verifica» — Simone, 19/8
 *
 * ⛔ **La cliente non viene mai bloccata.** Sceglie, parte, e in parallelo si apre un'attività. È la
 * differenza fra un prodotto che accompagna e uno che chiede il permesso: il costo di una verifica
 * fatta un giorno dopo è basso, quello di una porta chiusa in faccia a chi sta provando a fare una
 * cosa per sé è alto.
 *
 * ## Due situazioni diverse, due attività diverse
 *
 * 1. **La scelta è estrema** (`digiuno_estremo_da_verificare`). Protocollo 20:4 o 23:1 — il manuale
 *    li dà per chi ha già esperienza — oppure una finestra che lascia **un pasto solo**. ⚠️ La terza
 *    condizione del §3 la aggiunge chi chiama: `restaCorta`, cioè «anche coi moltiplicatori al tetto
 *    le calorie non ci arrivano». È la migliore delle tre perché non guarda il nome del protocollo,
 *    guarda quello che quella cliente riceve davvero — ma serve la sua dieta, e qui la dieta non c'è.
 *
 * 2. **La finestra di prima non era riproducibile** (`digiuno_finestra_non_traducibile`). Il caso
 *    della cliente su «salta la cena»: l'orologio non sa fare quella finestra, la pagina le si è
 *    aperta vuota, e **qualunque cosa abbia scelto** i suoi pasti cambiano. Non è un errore: è una
 *    notizia, e la deve avere qualcuno.
 *
 * ⚠️ Sono due `kind` e non uno con due motivi, perché **la chiave di unicità è diversa** — cioè
 * rispondono a due domande diverse su «quante volte si chiede». Vedi sotto.
 *
 * ## ⛔ E una cosa che i due testi NON dicono più, perché non era vera
 *
 * Dicevano tutti e due «la finestra si corregge dalla scheda (Modifica → Pasti che salta)». È
 * un'istruzione che **il sistema disfa**: `fastingWindow` la *deriva* l'orologio da protocollo e
 * orario, e il primo spostamento della cliente riscrive quello che la nutrizionista aveva corretto —
 * senza avvisare nessuno, perché il riferimento dell'attività non cambia per una traslazione.
 *
 * ⚠️ Adesso i testi lo dicono. Ma resta una domanda aperta a cui rispondere: **due porte scrivono
 * la stessa cosa** (la scheda staff a mano, l'orologio per derivazione), e finché è così una delle
 * due prima o poi contraddice l'altra. Sta in elenco lavori.
 */

/** La scelta è estrema. ⚠️ Metà della chiave di unicità: `clientId + kind + refId`. */
export const TIPO_DIGIUNO_ESTREMO = 'digiuno_estremo_da_verificare';

/** La finestra di prima non si sapeva riprodurre. */
export const TIPO_FINESTRA_NON_TRADUCIBILE = 'digiuno_finestra_non_traducibile';

/**
 * ⛔ **IL RIFERIMENTO DELL'ATTIVITÀ ESTREMA: protocollo + finestra, non la data e non l'orario.**
 *
 * Decisione del §3, e vale la pena dire cosa esclude. **Fisso** (come per «la domanda non è mai
 * stata fatta») sarebbe sbagliato: se fra sei mesi passa da 16:8 a OMAD, quella è una verifica
 * nuova e non deve essere zittita da una vecchia segnata fatta. **Con l'orario dentro** sarebbe
 * altrettanto sbagliato al contrario: spostare la finestra di un'ora — la cosa che il metodo A fa
 * *ogni notte* durante un adattamento graduale — riaprirebbe l'attività ogni giorno, e la coach
 * imparerebbe in una settimana a ignorare quella colonna. *Un avviso che compare sempre non è un
 * avviso.*
 *
 * Protocollo + finestra cambia quando cambia **la sostanza della scelta**: quante ore digiuna e
 * quali pasti riceve. Che è esattamente la domanda su cui la nutrizionista si deve esprimere.
 */
export const riferimentoDigiunoEstremo = (protocollo: string, finestra: string): string =>
  `${protocollo}|${finestra}`;

/**
 * ⚠️ Per la finestra non traducibile il riferimento è **la finestra di partenza**, quella che non si
 * sapeva riprodurre: si segnala una volta per ogni finestra storica da cui è uscita, non a ogni
 * ripensamento successivo. Se domani cambia di nuovo idea non è più quel passaggio lì.
 */
export const riferimentoNonTraducibile = (finestraPrecedente: string): string =>
  `da:${finestraPrecedente}`;

export interface TestoAttivita {
  title: string;
  description: string;
}

const chiamala = (nome?: string | null): string => (nome ?? '').trim() || 'la cliente';

/**
 * Il testo dell'attività «scelta estrema».
 *
 * ⚠️ Come per la voce 256, dice **cosa succede intanto**: che è partita, che non è ferma e che non
 * c'è niente di rotto. Senza quella riga «verifica il digiuno» si legge come un guasto, e una
 * nutrizionista che chiama allarmata una cliente che sta bene fa più danno del dato mancante.
 *
 * ⚠️ E le ragioni arrivano **in chiaro dall'esterno**, una per riga: sono la stessa frase che
 * `cambio-finestra.ts` ha calcolato, e passarle di mano invece di riscriverle qui evita che fra sei
 * mesi le due versioni dicano cose diverse.
 */
export function testoDigiunoEstremo(
  nome: string | null | undefined,
  ragioni: readonly string[],
  finestraLeggibile: string,
): TestoAttivita {
  const chi = chiamala(nome);
  return {
    title: `Verifica il digiuno di ${chi}: la scelta è impegnativa`,
    description:
      `${chi} ha impostato ${finestraLeggibile}. ⚠️ **È già partita, ed è voluto**: la scelta della ` +
      'finestra è libera e non la blocchiamo mai — questa è una verifica, non un blocco, e intanto ' +
      'i menu le arrivano regolarmente.\n\n' +
      `Perché ti arriva:\n${ragioni.map((r) => `• ${r}`).join('\n')}\n\n` +
      'Se dopo averla sentita va bene così, segna l\'attività fatta: non te la ripropongo finché ' +
      'non cambia protocollo o pasti. Se invece non va bene, **la correzione la deve fare lei ' +
      'dall\'orologio**, e conviene dirle perché: i suoi pasti adesso li decide la durata della ' +
      'finestra che ha impostato, quindi cambiarli dalla scheda dura fino al primo spostamento che fa.',
  };
}

/**
 * Il testo dell'attività «la finestra di prima non era riproducibile».
 *
 * ⚠️ Il motivo lo scrive `chiedi-la-finestra.motivoPerLaNutrizionista`, che sa tradurre il valore
 * della finestra in una frase. Qui NON si riscrive: si incornicia. Due punti che compongono lo
 * stesso messaggio in due modi diversi sono due messaggi che prima o poi si contraddicono.
 */
export function testoFinestraNonTraducibile(
  nome: string | null | undefined,
  motivo: string,
): TestoAttivita {
  const chi = chiamala(nome);
  return {
    title: `${chi}: i pasti del digiuno sono cambiati, valeva la pena dirtelo`,
    description:
      `${motivo}\n\n⚠️ **Non è un errore e non c'è niente da riparare**: è successo perché la sua ` +
      'vecchia finestra non era una di quelle che l\'orologio sa disegnare, quindi la pagina le si è ' +
      'aperta vuota come a una cliente nuova invece di proporle qualcosa di simile — servirle pasti ' +
      'che non ha chiesto perché somigliano ai suoi sarebbe stato peggio.\n\n' +
      'Se la scelta che ha fatto ti convince, segna l\'attività fatta. Se no, sentitela: **i pasti ' +
      'adesso li decide l\'orologio che imposta lei**, quindi la correzione va fatta da lì — dalla ' +
      'scheda durerebbe fino al primo spostamento che fa.',
  };
}

/**
 * Fra quanti giorni scade l'attività. ⚠️ Corta: è una verifica su una cosa che **sta già
 * succedendo**, non un promemoria. Una scadenza lunga su qualcosa che è già in corso è un modo di
 * dire che non era urgente, e allora tanto valeva non aprirla.
 */
export const GIORNI_PER_LA_VERIFICA = 3;

export const scadenzaVerifica = (adesso: Date): Date =>
  new Date(adesso.getTime() + GIORNI_PER_LA_VERIFICA * 24 * 3_600_000);
