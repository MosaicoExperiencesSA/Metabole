/**
 * ⛔ **IL RICHIAMO RICORRENTE A CHI NON HA PIÙ UN PIANO — la parte che decide.**
 *
 * Sta in un modulo puro e non dentro lo scan perché il giudizio è tutto qui: quanti giri fare, di
 * quanti giorni tornare indietro per ognuno, e con che chiave distinguerli. Lo scan intorno è solo
 * una query e un invio.
 *
 * Il contesto (Simone, 12/9): da quando il giro notturno smette di scrivere a chi non ha più un
 * piano — promemoria check-in, misure, avvisi alla coach — questa è **l'unica** cosa che continua
 * ad arrivargli. E arriva anche alla coach, che di ogni email del ciclo di vita riceve copia.
 */

/**
 * I giri da fare: `[1, 2, … tetto]`, cioè il primo richiamo, il secondo, e così via.
 *
 * ⚠️ **Cadenza o tetto sotto 1 spengono il richiamo**, e non è una finezza: con cadenza `0` il
 * giro numero uno guarderebbe i piani scaduti **oggi**, cioè scriverebbe «ti ricordi di noi?» il
 * giorno stesso in cui il percorso finisce, mentre la cliente ha ancora l'app aperta.
 */
export const TETTO_MASSIMO = 24;

export function giriDelRichiamo(cadenzaGiorni: number, tetto: number): number[] {
  /**
   * ⚠️ **Numeri interi, e con un tetto suo.** Sono due parametri che si digitano dal backoffice,
   * quindi qui arriva quello che qualcuno ha battuto:
   *  - `Infinity` passerebbe il `< 1` e farebbe **lanciare** `Array.from` — non un richiamo
   *    sbagliato: lo scan del ciclo di vita che muore in mezzo, portandosi dietro gli altri inneschi;
   *  - `1000000` battuto per sbaglio sarebbe un milione di letture per giro, ogni ora;
   *  - una cadenza **frazionaria** (`1.5`) passerebbe il `< 1`, e `dayRange(-1.5)` guarda una
   *    finestra da mezzogiorno a mezzogiorno: certe coorti lette due volte, altre mai.
   * Non si arrotonda in silenzio: un numero che non è un numero di giri **spegne** il richiamo,
   * che è l'esito su cui non si sbaglia.
   */
  if (!Number.isInteger(cadenzaGiorni) || !Number.isInteger(tetto)) return [];
  if (cadenzaGiorni < 1 || tetto < 1) return [];
  return Array.from({ length: Math.min(tetto, TETTO_MASSIMO) }, (_, i) => i + 1);
}

/**
 * Di quanti giorni tornare indietro per il giro `n`: il richiamo si manda a chi ha il piano finito
 * **esattamente** `n × cadenza` giorni fa.
 *
 * ⚠️ **Giorno esatto e non «almeno N giorni»**, ed è la ragione per cui esiste un tetto invece di
 * un ciclo aperto: con una finestra «almeno», ogni giro dovrebbe leggere tutti gli abbonamenti
 * scaduti da sempre per scartarli quasi tutti. Il prezzo di questa scelta va detto: se lo scan non
 * gira nel giorno giusto — deploy lungo, master spento, interruttore acceso a metà giornata —
 * **quel** richiamo si perde e il prossimo arriva alla scadenza dopo. Allargare la finestra per
 * recuperarlo ne farebbe partire due vicini a chi era già stato scritto.
 */
export function giorniIndietro(n: number, cadenzaGiorni: number): number {
  return -(n * cadenzaGiorni);
}

/**
 * La chiave di deduplica del giro `n` sull'abbonamento `subId`.
 *
 * ⛔ **Il numero del giro DEVE stare nella chiave.** `lifecycle_email` è unica su
 * (utente, chiave): con una chiave uguale a ogni giro, il secondo richiamo risulterebbe già
 * inviato e ne partirebbe **uno solo in tutto** — un difetto che non si vede per due mesi, e che
 * quando si vede sembra un problema di consegna della posta.
 */
export function chiaveRichiamo(subId: string, n: number): string {
  return `wb_ricorrente:${subId}:${n}`;
}

/**
 * Il saluto: «Ciao Giulia,» se il nome c'è, «Ciao,» se non c'è.
 *
 * ⚠️ La virgola sta **dentro** la variabile di proposito. Il modello scrive `Ciao{{nome}},` e con
 * un nome vuoto darebbe «Ciao ,» — con lo spazio prima della virgola. È un dettaglio da due
 * caratteri che però si vede in cima a una email di marketing, cioè nell'unica riga che tutti
 * leggono.
 */
export function nomeDiSaluto(nome: string | null | undefined): string {
  const pulito = (nome ?? '').trim();
  return pulito ? ` ${pulito}` : '';
}
