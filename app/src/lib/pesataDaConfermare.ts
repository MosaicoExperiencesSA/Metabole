/**
 * ⛔ **CHIEDERLE «È GIUSTO?» MENTRE DIGITA** — la parte di decisione, fuori dalla schermata
 * (voce `pesata-strana-chiedi-conferma`).
 *
 * La regola clinica sta **sul server** (`backend/src/signals/pesata-da-confermare.ts`, soglie nei
 * Parametri) e qui non se ne riscrive un pezzo: la frase arriva già fatta. ⚠️ Quello che resta a
 * questo lato sono due domande piccole ma vere, ed è meglio provarle che affidarle a un `&&` dentro
 * il JSX — la schermata non ha un DOM nei test, quindi quello che sta lì dentro nessuno lo misura:
 *
 *  1. la risposta del server è quella che credo? (una rotta che non c'è ancora, una rete che cade,
 *     un `frase` vuoto: tutti casi in cui **non si chiede niente e si salva**);
 *  2. l'ho già chiesto **per questo numero**? (se lei cambia la cifra dopo aver visto la domanda, la
 *     risposta di prima non vale più).
 */

/** La domanda in sospeso: la frase da mostrarle e il numero per cui è stata fatta. */
export interface DomandaInSospeso {
  frase: string;
  pesoScritto: number;
  /**
   * ⚠️ Ha già risposto «sì, è giusto» per questo numero. ⛔ Serve perché nella correzione fra il
   * «sì» e la scrittura c'è un secondo passo (il «Sei sicuro? si corregge una volta sola»): se il
   * «sì» azzerasse la domanda, il punto che scrive non troverebbe nessuna risposta e la
   * richiederebbe — cioè un giro senza uscita. La domanda **resta**, smette solo di mostrarsi.
   */
  confermato?: boolean;
}

/**
 * La frase da mostrare, o `null` se non c'è niente da chiedere.
 *
 * ⛔ **Qualunque cosa di storto vale «non chiedere»**, mai «blocca». Questa è una cortesia, non un
 * controllo di accesso: se il server risponde `null`, o una forma che non riconosco, o non risponde
 * affatto, il salvataggio deve andare avanti come è sempre andato. *Una cliente non deve restare
 * fuori dalla sua app perché una rotta di cortesia è caduta.*
 */
export function leggiFrase(risposta: unknown): string | null {
  if (!risposta || typeof risposta !== 'object') return null;
  const f = (risposta as { frase?: unknown }).frase;
  if (typeof f !== 'string') return null;
  const pulita = f.trim();
  return pulita ? pulita : null;
}

/**
 * Va richiesto al server, o la risposta che ho già vale ancora?
 *
 * ⚠️ Vale solo per **lo stesso identico numero**: se le è stato chiesto su 113 e adesso scrive 73,
 * il «sì, è giusto» di prima parlava di un altro peso. ⛔ Rispondere `false` qui per non fare una
 * chiamata in più vorrebbe dire salvare un numero mai verificato con la conferma data su un altro —
 * cioè usare il consenso di una persona per una cosa che non ha visto.
 */
export function serveChiedere(gia: DomandaInSospeso | null | undefined, adesso: number): boolean {
  if (!gia) return true;
  return gia.pesoScritto !== adesso;
}

/**
 * ⛔ **QUANTO SI ASPETTA UNA CORTESIA PRIMA DI TIRARE DRITTO** (aggiunto in revisione).
 *
 * `chiediSeTorna` gestiva l'**errore**, non il **non-rispondere**: `fetch` non ha un timeout suo, e
 * mentre la richiesta pende la schermata tiene `busy` — che spegne anche le caselle. ⚠️ Una cliente
 * in treno con segnale ballerino restava con i campi grigi e il tasto «Salvo…» per **tutto il
 * timeout di sistema**, che in una WebView è dell'ordine del minuto: non poteva salvare e non poteva
 * nemmeno correggere il numero. *Appesa non è fallita*, ed è il modo più comune in cui una rete
 * mobile smette di funzionare.
 *
 * Cinque secondi: oltre, si risponde «nessuna domanda» e si salva. È esattamente la promessa scritta
 * in testa a questo file — qualunque cosa di storto vale «non chiedere», mai «blocca».
 */
export const ATTESA_MASSIMA_MS = 5000;

export function entroIlTempo<T>(promessa: Promise<T>, ms: number = ATTESA_MASSIMA_MS): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promessa,
    new Promise<null>((risolvi) => {
      timer = setTimeout(() => risolvi(null), ms);
    }),
    // ⚠️ Il timer si spegne comunque: lasciarlo acceso terrebbe sveglio un `setTimeout` per ogni
    // pesata salvata, e in una WebView aperta tutto il giorno se ne accumulano.
  ]).finally(() => clearTimeout(timer)) as Promise<T | null>;
}
