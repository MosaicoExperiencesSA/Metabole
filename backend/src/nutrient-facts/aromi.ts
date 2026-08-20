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

/** Le parole che, da sole o combinate fra loro, fanno un aroma. */
const AROMI = new Set([
  // niente calorie
  'acqua', 'ghiaccio', 'sale', 'aceto',
  // si usano a pizzichi
  'pepe', 'peperoncino', 'aglio', 'spicchio', 'spicchi',
  // erbe
  'prezzemolo', 'basilico', 'timo', 'rosmarino', 'origano', 'salvia', 'alloro', 'menta',
  'erba', 'cipollina', 'aneto', 'maggiorana', 'dragoncello', 'coriandolo',
  // spezie
  'cannella', 'noce', 'moscata', 'curcuma', 'paprika', 'cumino', 'curry', 'chiodi', 'garofano',
  'zafferano', 'anice', 'cardamomo', 'spezie', 'spezia',
  // lievitanti e aromi da forno
  'lievito', 'bicarbonato', 'vanillina', 'vaniglia', 'estratto',
  // le parti del limone che sono aroma (il limone da solo NO: vedi il commento sopra)
  'scorza', 'buccia', 'succo', 'limone', 'lime',
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
  'nero', 'nera', 'neri', 'nere', 'bianco', 'bianca', 'bianchi', 'bianche', 'rosa', 'verde', 'verdi',
  'marino', 'grosso', 'fino', 'iodato', 
  'balsamico',
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
  const parole = paroleChe(normalizzaNome(nome));
  if (!parole.length) return false;
  if (!parole.every((p) => AROMI.has(p) || ACCOMPAGNANO.has(p))) return false;
  return parole.some((p) => AROMI.has(p));
}
