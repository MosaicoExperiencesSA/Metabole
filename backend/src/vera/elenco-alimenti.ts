/**
 * ⛔ **UN ELENCO NON È UN NOME LUNGO** — e finora il motore lo trattava così.
 *
 * Trovato il 31/8 sulle frasi vere della nutrizionista. Lei scrive:
 *
 *   «a Lorena sostituisci le verdure con zucchine, melanzane, peperoni, carciofi, fagiolini,
 *    spinaci, erbe cotte, carote, minestrone, insalata, pomodoro»
 *
 * e in anteprima le compariva: *«al posto di "verdure" metto "zucchine melanzane peperoni
 * carciofi"»*. **Quattro su undici**, gli altri sette spariti senza una parola.
 *
 * Il come è in due righe di `nomeAlimento`: la punteggiatura viene sostituita da spazi
 * (`replace(/[.,;:!?()"«»]/g, ' ')`), quindi l'elenco diventa una frase sola; poi c'è
 * `PAROLE_MAX = 4`, che la taglia. ⚠️ Nessuna delle due è sbagliata **per il mestiere che
 * facevano** — leggere UN nome di alimento da una frase — ma nessuno aveva detto loro che
 * gli sarebbe arrivato un elenco.
 *
 * ⛔ E il danno non è il «non ho capito»: è che l'anteprima diceva una cosa **plausibile e
 * sbagliata**, e bastava un «confermo» per scrivere una regola che vietava tre verdure su
 * undici. *Niente troncamenti silenziosi* — qui il troncamento c'era, ed era silenzioso.
 *
 * ## Le due modalità, e perché non è una finezza
 *
 * ⚠️ **«e» dentro un nome è comunissimo**: «Biscotti d'Avena **e** Banana», «sale **e** pepe»,
 * «erbe **e** spezie». Spezzare sempre su «e» trasformerebbe il nome di una ricetta in due
 * alimenti inventati — cioè rifarebbe il difetto di stamattina al contrario: una lettura
 * plausibile e sbagliata al posto di un onesto «non ci arrivo».
 *
 * Quindi il segnale che apre l'elenco è la **virgola** (o il punto e virgola):
 *
 *  · con una virgola da qualche parte nella frase → è un elenco, e si spezza su virgole **e** su
 *    «e»/«o»/«oppure» (perché l'italiano scrive «a, b e c»);
 *  · senza virgole → si spezza **solo** su «o»/«oppure», che è la forma delle alternative
 *    («ceci con fagioli **o** lenticchie») e non compare quasi mai dentro il nome di un piatto.
 *
 * ## ⛔ O si legge tutto, o non si è capito
 *
 * Se anche **un solo** pezzo non è leggibile come alimento, o se leggendolo si perderebbero
 * parole, questo modulo risponde `null`. Non un elenco parziale: `null`. Un elenco a cui manca
 * un pezzo è esattamente il difetto che questo file esiste per chiudere, e «ne ho capiti nove su
 * undici» non è una cosa che si possa dire a chi sta scrivendo una regola sul cibo di una persona.
 */
import { nomeAlimento, paroleDaLeggere } from '../food-swaps/impara-dalla-chat';
import { senzaIlQuando } from '../food-swaps/coda-di-quando';

/** I separatori di alternativa: valgono anche senza virgole. */
const ALTERNATIVE = /\s+(?:o|od|oppure)\s+/i;
/** Il separatore in più che si usa SOLO quando la frase ha già una virgola. */
const CONGIUNZIONE = /\s+(?:e|ed)\s+/i;

/** Vero se in questo testo c'è il segnale che apre la lettura a elenco. */
export function eUnElenco(testo: string): boolean {
  const t = testo ?? '';
  return /[,;]/.test(t) || ALTERNATIVE.test(t);
}

/** Quante parole «vere» ha un pezzo: serve a sapere se leggendolo se ne perde qualcuna. */
const quanteParole = (t: string): number => (t.trim().match(/[^\s]+/g) ?? []).length;

/**
 * I pezzi di un elenco, ancora grezzi. `conVirgola` decide se «e» separa o fa parte del nome.
 */
function pezzi(testo: string, conVirgola: boolean): string[] {
  const primi = (testo ?? '').split(/[,;]+/);
  const fuori: string[] = [];
  for (const p of primi) {
    const perAlternativa = p.split(ALTERNATIVE);
    for (const q of perAlternativa) {
      if (conVirgola) fuori.push(...q.split(CONGIUNZIONE));
      else fuori.push(q);
    }
  }
  return fuori.map((p) => p.trim()).filter(Boolean);
}

/**
 * L'elenco di alimenti contenuto in un pezzo di frase, oppure `null` se non si legge tutto.
 *
 * ⚠️ Torna `null` anche per un elenco di **un solo** alimento quando quel nome andrebbe troncato:
 * è lo stesso principio, e non c'è motivo di essere più indulgenti quando gli oggetti sono pochi.
 */
export function leggiElenco(testo: string): string[] | null {
  const t = (testo ?? '').trim();
  if (!t) return null;
  const conVirgola = /[,;]/.test(t);
  const grezzi = pezzi(t, conVirgola);
  if (!grezzi.length) return null;

  const nomi: string[] = [];
  for (const grezzo of grezzi) {
    /**
     * ⛔ **LA CODA DEL QUANDO SI TOGLIE ANCHE QUI** (3/9, `food-swaps/coda-di-quando.ts`).
     *
     * Senza, le due strade capivano la stessa frase in due modi diversi a seconda di quante
     * alternative avesse scritto la nutrizionista:
     *
     *     «sostituisci il pane con le gallette a colazione»              → «gallette»
     *     «sostituisci il pane con le gallette o i cracker a colazione»  → «cracker a colazione»
     *
     * ⚠️ Bastava una «o» per cambiare ramo e cambiare esito — e questo è il ramo che **esegue un
     * ordine**, cioè quello dove una lettura sporca pesa di più.
     *
     * ⚠️ **E il taglio va fatto prima di `paroleDaLeggere`**, non solo prima di `nomeAlimento`:
     * quel confronto misura «quanto ho letto contro quanto c'era», e contando la coda fra le parole
     * «che c'erano» ogni pezzo con un orario risulterebbe **letto a metà** — cioè un elenco
     * rifiutato per intero. Il controllo era giusto e guarderebbe la cosa sbagliata.
     */
    /**
     * ⛔ **E se togliere la coda rende il pezzo illeggibile, si torna a com'era** (seconda
     * revisione). «il **tè** a colazione» tolta la coda resta «tè», sotto il minimo di tre
     * caratteri; «lo **snack** a metà mattina» resta «snack», che è in `NON_ALIMENTI`. Qui un pezzo
     * illeggibile fa cadere **l'elenco intero** — cioè un «non ci arrivo» su una frase normale, e
     * su `impara-dal-nutrizionista.ts` un `return 0` senza notifica a nessuno.
     */
    const tagliato = senzaIlQuando(grezzo);
    const g = nomeAlimento(tagliato) ? tagliato : grezzo;
    const nome = nomeAlimento(g);
    // ⛔ Un pezzo illeggibile ferma tutto: vedi il cappello. Niente elenchi parziali.
    if (!nome) return null;
    /**
     * ⛔ **E nemmeno un pezzo LETTO A METÀ.** `nomeAlimento` si ferma da sé a quattro parole o
     * alla prima congiunzione: senza questo controllo «minestrone di verdure miste di stagione»
     * entrerebbe accorciato e nessuno lo saprebbe. È lo stesso troncamento silenzioso, un piano
     * più sotto.
     *
     * ⚠️ **Il confronto è con `paroleDaLeggere`, non con le parole grezze**, e la differenza non è
     * una finezza: `nomeAlimento` toglie l'**articolo** di proposito, quindi «il merluzzo» dava un
     * nome di una parola contro un pezzo di due e veniva rifiutato come «letto a metà». Misurato
     * il 31/8: cinque forme normali su sette cadevano così — «il merluzzo», «le zucchine, le
     * melanzane e i peperoni», «la ricotta o lo stracchino» — e la nutrizionista si sentiva
     * rispondere «non ci arrivo» scrivendo in italiano corrente. Il controllo era giusto e
     * guardava la cosa sbagliata.
     */
    if (quanteParole(nome) < paroleDaLeggere(g)) return null;
    const gia = nomi.some((n) => n.toLowerCase() === nome.toLowerCase());
    // Un doppione nell'elenco non è un errore di chi scrive: è una ripetizione, e si tiene una volta.
    if (!gia) nomi.push(nome);
  }
  return nomi.length ? nomi : null;
}
