/**
 * GLI AROMI: quello che in una ricetta pesa **zero calorie**, e che la tabella non avrà mai tutto.
 *
 * Richiesta di Simone (20/8), dopo aver visto l'elenco «Alimenti da correggere»: metà dei primi
 * venti posti sono aglio (3886 ricette), sale (3296), sale e pepe (2755), pepe nero (1754), sale
 * marino (1537), acqua (816), prezzemolo, basilico, timo, cannella. ⚠️ Occupano lo spazio delle
 * righe che servono davvero — le melanzane, i fagiolini, la carota a crudo — e toglierli uno alla
 * volta è un centinaio di clic.
 *
 * ## ⛔ DIRE «È UN AROMA» VUOL DIRE DIRE «LE SUE CALORIE NON CONTANO»
 *
 * Ed è per questo che questo elenco è **chiuso, corto e scritto a mano**, e non una regola che
 * indovina. La stessa scorciatoia — «tutto quello che non conosco è innocuo» — il 19/8 ha fatto
 * diventare «semi di zucca» la zucca in 531 ricette, con venti volte le calorie.
 *
 * Un nome entra qui solo se vale **una** di queste due cose, e si vede a occhio:
 *  - **non ha calorie**: acqua, sale, aceto;
 *  - **si usa in quantità che non spostano niente**: un cucchiaino di cannella, un rametto di
 *    timo, uno spicchio d'aglio (3 g, 4 kcal).
 *
 * ## ⚠️ CHI È RIMASTO FUORI, E PERCHÉ — è la parte che conta
 *
 * | fuori | ricette | perché |
 * |---|---|---|
 * | **cipolla**, cipolla rossa | 1690 + 739 | 40 kcal/100 g, e in una ricetta ce ne va **un etto**: è un ingrediente, non un aroma |
 * | **limone** (da solo) | 3146 | quasi sempre è il succo — ma «un limone» intero è un frutto, e da qui non si distingue. Ci entrano solo «succo di limone» e «scorza di limone», che sono scritti |
 * | **brodo vegetale** | 1449 | pochissime calorie per 100 ml, ma in un risotto ce ne vanno 500: la somma smette di essere zero |
 * | **sedano**, carota | 709 + 1017 | soffritto o no, sono verdure con una grammatura |
 *
 * ⚠️ Restare fuori non è un errore: vuol dire che quella riga la guarda una persona. Sbagliare per
 * eccesso di prudenza costa un clic; sbagliare per comodità toglie dall'elenco un alimento vero e
 * **nessuno lo rimette**, perché il passo notturno non riapre una riga chiusa a mano.
 */

import { paroleChe } from './abbinamento-alimenti';
import { normalizzaNome } from './valori-nutrizionali.service';

/**
 * ⚠️ **QUESTO ELENCO È STATO RIFATTO POCHE ORE DOPO AVERLO SCRITTO, E VALE LA PENA SAPERE PERCHÉ.**
 *
 * La prima versione conteneva `limone`, `lime`, `succo`, `scorza`, `buccia`, `noce`, `estratto`,
 * `spicchio`, `erba`, `lievito`, `aceto`. ⛔ Risultato, provato sui nomi veri della produzione:
 *
 *     eAroma('limone')  →  true          3146 ricette, ed è un FRUTTO da 11 kcal
 *     eAroma('noce')    →  true          654 kcal/100 g
 *     eAroma('succo')   →  true          «succo» di cosa?
 *
 * Cioè: premendo «Togli questi N», il limone sarebbe uscito **per sempre** dall'elenco di lavoro —
 * il passo notturno non riapre una riga chiusa a mano — e per accorgersene sarebbe servita una
 * query fatta a mano sulla tabella.
 *
 * ⚠️ **E il commento di venti righe sopra diceva già che il limone doveva restare fuori.** L'errore
 * non è stato di distrazione: `limone` era stato messo in AROMI per far funzionare «succo di
 * limone», cioè *una parola aggiunta per far passare un caso, che ne fa passare cento*. È la stessa
 * forma dell'errore delle `mele` di stamattina, alla riga sotto quella che lo raccontava.
 *
 * ✅ Adesso: nessun **nome di alimento** sta fra le parole — né in AROMI né in ACCOMPAGNANO. I nomi
 * composti che sono davvero aromi si scrivono **per intero** in `NOMI_ESATTI`, dove si leggono uno
 * per uno.
 */

/**
 * I nomi **interi** che sono aromi anche se contengono un alimento. ⚠️ Si scrivono per esteso di
 * proposito: «succo di limone» è un aroma, «limone» no, e la differenza sta tutta nelle due parole
 * che ci sono in mezzo. Un elenco di parole non sa dirlo; un elenco di nomi sì.
 */
const NOMI_ESATTI = new Set([
  'succo di limone', 'succo di lime', 'scorza di limone', 'scorza di lime',
  'buccia di limone', 'limone succo', 'noce moscata', 'lievito in polvere',
  'lievito per dolci', 'estratto di vaniglia', 'semi di finocchio',
]);

/** Le parole che, da sole o combinate fra loro, fanno un aroma. *//** Le parole che, da sole o combinate fra loro, fanno un aroma. */
const AROMI = new Set([
  // niente calorie
  'acqua', 'ghiaccio', 'sale',
  // si usano a pizzichi
  'pepe', 'peperoncino', 'aglio',
  // erbe
  'prezzemolo', 'basilico', 'timo', 'rosmarino', 'origano', 'salvia', 'alloro', 'menta',
  'cipollina', 'aneto', 'maggiorana', 'dragoncello', 'coriandolo',
  // spezie
  'cannella', 'curcuma', 'paprika', 'cumino', 'curry', 'garofano',
  'zafferano', 'anice', 'cardamomo', 'spezie', 'spezia', 'vaniglia', 'vanillina',
  'bicarbonato',
]);

/**
 * Le parole che possono accompagnare un aroma senza cambiare cosa è: come è fatto, com'è
 * presentato, quanto ce n'è. ⚠️ **Non** parole che cambiano l'alimento.
 */
const ACCOMPAGNANO = new Set([
  'fresco', 'fresca', 'freschi', 'fresche',
  'secco', 'secca', 'secchi', 'secche', 'essiccato', 'essiccata', 'essiccati', 'essiccate',
  'macinato', 'macinata', 'macinati', 'macinate', 'tritato', 'tritata', 'tritati', 'tritate',
  'polvere', 'grani', 'foglie', 'foglia', 'rametto', 'rametti', 'pizzico', 'qb',
  'chiodi', 'spicchio', 'spicchi', 'erba', 'estratto',
  'nero', 'nera', 'neri', 'nere', 'bianco', 'bianca', 'bianchi', 'bianche', 'rosa', 'verde', 'verdi',
  'marino', 'grosso', 'fino', 'iodato',
  'naturale', 'frizzante', 'tiepida', 'calda', 'fredda',
]);

/**
 * ⚠️ **QUI DENTRO NON CI VANNO NOMI DI ALIMENTI, NEMMENO COME CONTORNO DI UN ALTRO NOME.**
 *
 * La prima versione conteneva `mele`, `vino` e `riso` — messi lì per «aceto di mele», «aceto di
 * vino», «aceto di riso», che sembravano casi innocenti. ⛔ Il test li ha bocciati in due secondi:
 *
 *     «riso al curry»    →  riso (contorno) + curry (aroma)  →  ARO MA        e invece è un piatto
 *     «succo di mele»    →  succo (aroma)  + mele (contorno) →  ARO MA        e invece è succo di frutta
 *
 * Cioè: due piatti veri sarebbero usciti dall'elenco come «aromi da togliere», e nessuno li
 * avrebbe rimessi — il passo notturno non riapre una riga chiusa a mano.
 *
 * ⚠️ **Gli aceti aromatizzati restano fuori, e va bene così**: «aceto di mele» resta in elenco e lo
 * guarda una persona. *Sbagliare per prudenza costa un clic; sbagliare per comodità toglie un
 * alimento vero e non se ne accorge nessuno.*
 */

/**
 * ⚠️ **TUTTE le parole che distinguono devono essere conosciute**, e almeno una dev'essere un
 * aroma. È la stessa forma dell'elenco chiuso dei qualificatori, e per la stessa ragione: con
 * «almeno una parola è un aroma» passerebbe «olio e sale», «pollo al limone», «riso al curry» —
 * cioè piatti veri, tolti dall'elenco perché contengono la parola «sale».
 *
 * ⛔ E `succo` da solo non basta: «succo di mela» non è un aroma. Serve che ci sia **anche** un
 * aroma vero fra le parole — «succo di limone» sì, e la parola che lo salva è «limone».
 */
export function eAroma(nome: string): boolean {
  const intero = normalizzaNome(nome);
  if (NOMI_ESATTI.has(intero)) return true;
  const parole = paroleChe(intero);
  if (!parole.length) return false;
  if (!parole.every((p) => AROMI.has(p) || ACCOMPAGNANO.has(p))) return false;
  return parole.some((p) => AROMI.has(p));
}
