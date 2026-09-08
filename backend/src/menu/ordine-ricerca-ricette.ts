/**
 * ⛔ **CHI COMINCIA CON QUELLO CHE HAI SCRITTO STA IN CIMA** — richiesta di Simone, 8/9: *«se faccio
 * la ricerca nel scrivi menu deve dare priorità alle parole che iniziano con quelle che scrivo, poi
 * quelle che lo contengono»*.
 *
 * Fino a oggi l'ordine era **solo alfabetico**: cercando «yogurt» uscivano prima *Ciotola granola
 * vegan e yogurt di cocco*, *Coppa yogurt di soia*, *Grano saraceno…*, e uno *Yogurt greco con
 * frutta* — se esisteva — finiva in mezzo o **oltre il tetto**. Chi cerca una parola si aspetta di
 * vedere per prime le cose che si chiamano così.
 *
 * ⛔ **IL TETTO È IL VERO DIFETTO, non l'ordine.** La ricerca prende le prime `TETTO_RICERCA` **in
 * ordine alfabetico**: riordinare solo quelle che sono già arrivate lascerebbe *Yogurt greco* fuori
 * dall'elenco quando davanti a lui ci stanno duecento nomi che cominciano per A. Per questo il
 * servizio non fa una query sola: cerca **prima** i due gruppi che devono esserci, e solo dopo
 * riempie con il resto. Qui sta il giudizio; là la garanzia che le righe giuste arrivino.
 *
 * ⚠️ **«Parola» vuol dire "preceduta da uno spazio", e la definizione è volutamente grezza** — la
 * stessa, identica, che sa fare la query (`contains: ' ' + cerca`). Una definizione più fine qui
 * (dopo una parentesi, un trattino, una virgola) sarebbe più giusta in astratto e **peggiore in
 * pratica**: darebbe il secondo livello a righe che la query non è andata a prendere, cioè un ordine
 * che promette una completezza che non c'è. Meglio due regole uguali che una bella e una vera.
 */

/** ⚠️ Più basso = più in alto nell'elenco. Il nome dice cosa vuol dire, così non si legge un numero. */
export const LIVELLO = {
  /** Il nome **comincia** con quello che hai scritto: «yogurt» → *Yogurt greco con frutta*. */
  comincia: 0,
  /** Una **parola** del nome comincia così: «yogurt» → *Coppa **yogurt** di soia*. */
  parolaComincia: 1,
  /** Il nome lo **contiene** e basta: «gurt» → *Coppa yo**gurt** di soia*. */
  contiene: 2,
} as const;

export type Livello = (typeof LIVELLO)[keyof typeof LIVELLO];

/**
 * ⚠️ Minuscolo e basta: gli accenti non si toccano. Toglierli qui e non nella query vorrebbe dire
 * un ordine che parla di righe che la query non ha cercato — lo stesso difetto del cappello sopra.
 */
const piatto = (s: string): string => s.trim().toLowerCase();

/** A che livello di somiglianza sta questo nome rispetto a quello che è stato scritto. */
export function livelloDiSomiglianza(nome: string, cerca: string): Livello | null {
  const q = piatto(cerca);
  if (!q) return null;
  const n = piatto(nome);
  if (n.startsWith(q)) return LIVELLO.comincia;
  if (n.includes(` ${q}`)) return LIVELLO.parolaComincia;
  if (n.includes(q)) return LIVELLO.contiene;
  return null;
}

/**
 * Rimette in fila le righe: prima i tre livelli, **dentro ognuno l'ordine alfabetico**.
 *
 * ⛔ **L'alfabetico dentro il livello non è un dettaglio.** Senza, due ricerche uguali possono dare
 * due ordini diversi a seconda di come il database ha restituito le righe, e chi cerca due volte la
 * stessa cosa vede due elenchi diversi senza aver cambiato niente.
 *
 * ⚠️ Una riga che **non somiglia affatto** resta in fondo invece di sparire: questa funzione ordina,
 * non filtra. Chi filtra è la query, e due posti che filtrano sono due posti che un giorno filtrano
 * cose diverse.
 */
export function ordinaPerSomiglianza<T>(
  righe: T[],
  cerca: string,
  /**
   * ⚠️ Dove sta il nome. Serve perché si ordina **prima** di giudicare le ricette (là il campo si
   * chiama `name`, qui `nome`): giudicare seicento righe per poi buttarne quattrocento sarebbe
   * lavoro fatto per niente, e il giudizio su una ricetta non è gratis.
   */
  nomeDi: (r: T) => string = (r) => (r as unknown as { nome: string }).nome,
): T[] {
  if (!piatto(cerca)) return righe;
  const conLivello = righe.map((r) => ({ r, n: nomeDi(r), l: livelloDiSomiglianza(nomeDi(r), cerca) ?? 99 }));
  return conLivello
    .sort((a, b) => (a.l !== b.l ? a.l - b.l : a.n.localeCompare(b.n, 'it')))
    .map((x) => x.r);
}
