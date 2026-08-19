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
 * ⛔ **Il modo si cambia in un punto solo (`MODO_DI_OGGI`), e l'ha deciso Simone** il 19/8 sera
 * leggendo i numeri della misura: **parole intere**. I due modi restano tutti e due perché
 * `diag:ricerca` continua a confrontarli — il giorno che la tabella si riempie, la stessa misura
 * dice se il pezzo di parola è tornato a valere qualcosa.
 */

export type ModoDiCercare = 'pezzo_di_parola' | 'parole_intere';

/**
 * ⚠️ **PAROLE INTERE — scelto da Simone il 19/8 sera, dopo aver letto la misura.**
 *
 * Fino a quel momento era `pezzo_di_parola`, ed era com'era sempre stato. `npm run diag:ricerca` ha
 * contato in produzione **40 trappole, e tutte e 40 possono scattare** — perché in nessun caso la
 * parola lunga è in tabella:
 *
 *     «melanzane» / «melanzana» → «mela»       1025 usi
 *     «denocciolate»            → «nocciola»    385 usi   (le olive denocciolate: 628 kcal)
 *     «melagrana»               → «grana»        72 usi   (il melograno diventa il parmigiano)
 *     «cipollotto»              → «pollo»        55 usi
 *     «pescatrice»              → «pesca»        32 usi   (la coda di rospo diventa una pesca)
 *     «surgelato» / «congelato» → «gelato»       45 usi
 *     «datterini»               → «datteri»      22 usi   (18 kcal contro ~280)
 *     «fagiolini»               → «fagioli»      15 usi   (31 kcal contro ~300)
 *
 * ⚠️ E quelle **giuste** erano tre in tutto: «pomodorini» e «pomodorino» → «pomodori», «spinacino» →
 * «spinaci». Circa 1700 usi sbagliati contro 231 giusti.
 *
 * ⚠️ **Sulle domande vere il cambio non toglie e non aggiunge niente**: in tutta la storia della
 * chat ci sono 210 messaggi di clienti e **una sola** domanda nutrizionale, e le due ricerche
 * rispondevano uguale. Cioè la trappola era **carica ma non ancora scattata** — si chiude adesso che
 * costa zero, non quando il traffico di Gaia la fa scattare su una cliente.
 *
 * ✅ **E perdere i tre casi buoni non è un danno**: quando Gaia non trova «pomodorini» dice «non ce
 * l'ho» e il termine finisce in `nutrient_lookup_miss`, che è **il modo in cui la tabella cresce
 * guidata dalle domande vere**. Un «non lo so» si vede e diventa una riga; «44 kcal» detto dalla
 * mela non si vede e resta lì.
 *
 * Sta scritta qui e non sparsa nei chiamanti perché una scelta che vive in un punto solo si può
 * cambiare leggendo una riga; la stessa scelta ripetuta in tre posti si cambia in due su tre.
 */
export const MODO_DI_OGGI: ModoDiCercare = 'parole_intere';

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


/**
 * IL NOME DELLA TABELLA COME **SEQUENZA DI PAROLE** DENTRO LA DOMANDA — e perché non basta togliere
 * le paroline da tutte e due i lati.
 *
 * ⚠️ Prima `cercaTutti` faceva così: toglieva le paroline dalla domanda e dal nome, riattaccava le
 * parole con uno spazio e cercava una stringa dentro l'altra. Il commento diceva «non può abbinare
 * niente che non fosse già a un "di" di distanza». ⛔ **Era falso**, e la revisione avversariale del
 * 19/8 sera l'ha rotto con due domande vere:
 *
 *     «quante calorie hanno le gallette E IL riso?»  →  «gallette riso»  →  «gallette di riso»
 *     «quante calorie hanno il succo E IL limone?»   →  «succo limone»   →  «succo di limone»
 *
 * Chi chiedeva di **due** alimenti riceveva **un** numero, sbagliato e plausibile. Togliere le
 * paroline non salta una parolina: ne salta quante ne trova, quindi **incolla parole che nella
 * domanda erano lontane**. Era la stessa classe di errore chiusa la sera stessa passando a
 * «parole intere», riaperta da un'altra porta nella stessa funzione.
 *
 * ✅ La regola giusta è: le parole che **distinguono** devono comparire **nell'ordine**, e in mezzo
 * si può saltare **solo** una parolina. «Olio extravergine d oliva» trova «olio extravergine di
 * oliva» (in mezzo c'è «di», una parolina); «gallette e il riso» non trova «gallette di riso»,
 * perché fra «gallette» e «riso» c'è «e il» — due paroline che nella domanda separano due cose
 * diverse... e infatti anche «di» separerebbe, se non fosse che nel nome della tabella c'è.
 *
 * ⚠️ **Il confronto è fra le parole della domanda e quelle del nome, una per una.** Quindi
 * `parole_intere` è il comportamento naturale; `pezzo_di_parola` resta possibile (una parola della
 * domanda che **contiene** quella del nome) perché `diag:ricerca` continua a confrontare i due modi.
 */
export interface Sequenza {
  /** Indice della prima parola della domanda che fa parte dell'abbinamento. */
  da: number;
  /** Indice **dopo** l'ultima. Serve a scartare un nome contenuto dentro un altro già trovato. */
  a: number;
}

export function sequenzaDentro(
  paroleDomanda: readonly string[],
  /** Le parole del nome della tabella **tutte**, paroline comprese: servono a contare i buchi. */
  paroleNome: readonly string[],
  modo: ModoDiCercare,
  eParolina: (p: string) => boolean,
): Sequenza | null {
  /**
   * ⚠️ LA REGOLA, IN UNA RIGA: **la domanda può TOGLIERE paroline, non aggiungerne.**
   *
   * Il nome si legge come «parole che distinguono, separate da N paroline»:
   *
   *     «olio extravergine di oliva»  →  olio · extravergine · [1] · oliva
   *     «gallette di riso»            →  gallette · [1] · riso
   *
   * Fra due parole che distinguono, la domanda può avere **al massimo** le paroline che ha il nome:
   *
   *     «olio extravergine oliva»    0 ≤ 1   ✅  è lo stesso olio scritto più corto
   *     «olio extravergine d oliva»  1 ≤ 1   ✅  è lo stesso olio scritto con l'apostrofo
   *     «gallette e il riso»         2 >  1  ⛔  sono DUE alimenti, e prima diventavano uno
   *
   * ⚠️ Il primo tentativo di questa correzione diceva «in mezzo si salta solo una parolina» ed era
   * ancora sbagliato: «e» e «il» **sono** paroline, quindi «gallette e il riso» passava lo stesso.
   * Il numero conta. Se ne accorge solo chi prova la frase vera — l'ho scoperto scrivendola.
   */
  const distintive: { parola: string; buchiPrima: number }[] = [];
  let buchi = 0;
  for (const w of paroleNome) {
    if (eParolina(w)) { if (distintive.length) buchi++; continue; }
    distintive.push({ parola: w, buchiPrima: buchi });
    buchi = 0;
  }
  if (!distintive.length || !paroleDomanda.length) return null;

  const combacia = (parolaDomanda: string, parolaNome: string) =>
    modo === 'parole_intere' ? parolaDomanda === parolaNome : parolaDomanda.includes(parolaNome);

  for (let inizio = 0; inizio < paroleDomanda.length; inizio++) {
    if (!combacia(paroleDomanda[inizio], distintive[0].parola)) continue;
    let i = inizio + 1;
    let k = 1;
    let ok = true;
    while (k < distintive.length) {
      let saltate = 0;
      while (i < paroleDomanda.length && eParolina(paroleDomanda[i])) { i++; saltate++; }
      if (i >= paroleDomanda.length || saltate > distintive[k].buchiPrima || !combacia(paroleDomanda[i], distintive[k].parola)) {
        ok = false;
        break;
      }
      i++;
      k++;
    }
    if (ok) return { da: inizio, a: i };
  }
  return null;
}
