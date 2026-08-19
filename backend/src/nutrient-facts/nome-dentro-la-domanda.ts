/**
 * IL NOME DELLA TABELLA DENTRO LA DOMANDA — e i due modi di cercarlo.
 *
 * Gaia risponde a «quante calorie ha il riso basmati?» cercando i nomi della tabella **dentro** il
 * testo della domanda. È il modo più semplice, funziona sulle frasi vere, e ha un difetto che si
 * vede solo scrivendo gli esempi giusti:
 *
 *     «melanzane»  contiene  «mela»          18 kcal contro 34
 *     «risotto»    contiene  «riso»
 *     «panettone»  contiene  «pane»
 *     «melagrana»  contiene  «mela»
 *     «farrotto»   contiene  «farro»
 *     «finocchio»  contiene  «finocchi»      (questo invece va benissimo: è il plurale)
 *
 * ⚠️ **Il danno non è che sbaglia: è che sbaglia in modo plausibile.** «34 kcal» per una melanzana
 * non fa alzare il sopracciglio a nessuno, e nessuno va a controllare.
 *
 * ⚠️ **Ma il pezzo di parola non fa solo danni, ed è per questo che qui ci sono DUE modi e non
 * uno.** È anche quello che fa combaciare una parola della domanda con una riga più corta:
 *
 *     «pomodorini»  trova la riga  «pomodori»       e va bene
 *     «melanzane»   trova la riga  «mela»           e non va bene
 *
 * ⛔ **Sono lo stesso meccanismo**, e da fuori non si distinguono: in tutti e due i casi il nome
 * della riga è un pezzo della parola scritta dalla cliente. Quante ne salva e quante ne sbaglia
 * **non si indovina** — si misura sulle domande vere, ed è quello che fa `npm run diag:ricerca`.
 *
 * ⚠️ **Attenzione a una scorciatoia che avevo scritto io e che è falsa**: «a parole intere si
 * perdono i plurali» **non è vero**, e basta scriverlo per vederlo — «melanzana» non è dentro
 * «melanzane» (finiscono diverse), «mela» non è dentro «mele», «carota» non è dentro «carote». Il
 * pezzo di parola aiuta solo quando la parola della domanda **allunga** il nome della riga in
 * fondo, non quando lo cambia. Una ragione falsa fa scegliere per il motivo sbagliato, ed è peggio
 * di una scelta sbagliata: la seconda si corregge, la prima si tramanda.
 *
 * ⚠️ **Questo modulo esiste perché la misura e la produzione usino LO STESSO codice.** Una
 * diagnostica che si riscrive la regola per conto suo misura la propria copia, e la copia è sempre
 * un po' diversa dall'originale — è lo stesso motivo per cui un test double che si comporta
 * diversamente dall'originale non verifica niente.
 *
 * ⛔ **Il modo si cambia in un punto solo (`MODO_DI_OGGI`), e lo decide Simone**, non io: è una
 * scelta su come parla il prodotto, non una pulizia di codice. Finché non ha scelto, resta com'è.
 */

export type ModoDiCercare = 'pezzo_di_parola' | 'parole_intere';

/**
 * ⚠️ COM'È OGGI, e non è una svista: è la riga che si cambia il giorno che Simone sceglie.
 *
 * Sta scritta qui e non sparsa nei chiamanti perché una scelta che vive in un punto solo si può
 * cambiare leggendo una riga; la stessa scelta ripetuta in tre posti si cambia in due su tre.
 */
export const MODO_DI_OGGI: ModoDiCercare = 'pezzo_di_parola';

/** Ciò che, attaccato a un nome, vuol dire che il nome è solo un pezzo di un'altra parola. */
const LETTERA = /[a-z0-9]/;

/**
 * Il nome compare nella domanda? `domanda` e `nome` arrivano già normalizzati (`normalizzaNome`).
 *
 * ⚠️ A `parole_intere` non basta che il nome ci sia: deve stare **fra due confini** — inizio, fine o
 * qualcosa che non è una lettera. E si controllano **tutte** le occorrenze, non la prima: in «una
 * mela e la melanzana» la prima «mela» è intera e la seconda no, e fermarsi alla prima darebbe la
 * risposta giusta per il motivo sbagliato — o quella sbagliata, a seconda dell'ordine delle parole.
 */
export function nomeDentro(domanda: string, nome: string, modo: ModoDiCercare): boolean {
  return posizioneDentro(domanda, nome, modo) >= 0;
}

/**
 * **Dove** compare il nome, o `-1`. È la stessa domanda di `nomeDentro`, e sta qui perché
 * `cercaTutti` della posizione ha bisogno davvero: la usa per mettere gli alimenti nell'ordine in
 * cui la cliente li ha scritti («meglio A o B» si risponde su A e poi su B) e per scartare un nome
 * **contenuto** in un altro già trovato.
 *
 * ⚠️ Due funzioni che rispondono alla stessa domanda devono chiamarsi fra loro, non somigliarsi:
 * `nomeDentro` è questa, letta come un sì/no.
 */
export function posizioneDentro(domanda: string, nome: string, modo: ModoDiCercare): number {
  if (!nome || !domanda) return -1;
  if (modo === 'pezzo_di_parola') return domanda.indexOf(nome);
  for (let i = domanda.indexOf(nome); i !== -1; i = domanda.indexOf(nome, i + 1)) {
    const prima = i === 0 ? ' ' : domanda[i - 1];
    const dopo = i + nome.length >= domanda.length ? ' ' : domanda[i + nome.length];
    if (!LETTERA.test(prima) && !LETTERA.test(dopo)) return i;
  }
  return -1;
}
