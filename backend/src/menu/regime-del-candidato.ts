import { eCarneIngrediente, ePesce } from '../catalog/piatto-di-cosa';
import { normalizza } from '../common/nomi-alimento';
import { regimiCompatibili, type Regime } from '../common/regimi';
import { exclusionKeys, hitsExclusion } from './exclusions';

/**
 * ⛔ **IL CANCELLO CHE `productId` DAVA SENZA VOLERLO** — 4/9.
 *
 * Fino a oggi i gruppi di equivalenza erano legati a una dieta (`EquivalenceGroup.productId`), e
 * quel legame faceva **due** lavori: teneva ordinata la pagina, e — senza che fosse scritto da
 * nessuna parte — impediva che il gruppo «Carni bianche» di una dieta onnivora finisse addosso a
 * una cliente vegetariana. Il secondo lavoro non lo sapeva nessuno, perché non aveva un nome.
 *
 * Simone ha deciso (4/9) che *«i gruppi non devono essere legati alle diete, sono gruppi e stop»*.
 * Giusto per la pagina — e vuol dire che quel cancello va **riscritto dove si vede**, o si toglie
 * per caso. `scegliSostituto` filtra i candidati per **allergie, intolleranze e cibi non graditi**:
 * il regime non l'ha mai guardato, perché non aveva bisogno di guardarlo.
 *
 * ⛔ **Senza questo file, dal primo menu della notte una vegetariana che chiede di cambiare il tofu
 * può sentirsi proporre il petto di pollo**, con l'aria di una scelta della sua nutrizionista. È lo
 * stesso identico difetto del 25/8 (il burro proposto a una vegana dal gruppo dei grassi), che
 * allora si era chiuso togliendo un gruppo solo perché il gruppo era uno solo.
 *
 * ## Il verso in cui si sbaglia
 *
 * ⚠️ Un falso positivo **toglie una proposta**: la cliente sente «non ho un'alternativa che mi
 * convinca» e la richiesta va alla nutrizionista. Un falso negativo **mette la carne nel piatto di
 * una vegetariana**. I due errori non si equivalgono, e per questo il regime che non conosciamo
 * vale come il **più stretto** — la stessa regola, e la stessa ragione, di `common/regimi.ts`.
 *
 * ## ⛔ I VOCABOLARI DI CASA NON BASTANO, E QUESTO L'HO MISURATO
 *
 * La prima stesura si appoggiava solo a `piatto-di-cosa.ts` e a `exclusions.ts`. La revisione del
 * 4/9 ha chiesto di provarlo sui nomi veri, e il risultato è questo — passavano **tutti**:
 *
 * ```
 * carne · carni · carne bianca · carne rossa · salumi · affettati · insaccati · strutto · lardo
 * frutti di mare · seppie
 * philadelphia · robiola · crescenza · taleggio · fontina · asiago · emmental · caciotta · skyr
 * ```
 *
 * ⚠️ **E la causa non è una svista, è che sono due domande diverse.** `exclusions.ts` risponde a
 * «questo contiene l'allergene del latte?», e il suo elenco è tarato sugli **ingredienti dei
 * piatti**; qui la domanda è «questo nome, scritto da una nutrizionista dentro un gruppo, è roba
 * animale?», e i nomi sono altri — categorie («salumi») e formaggi che nell'elenco degli allergeni
 * non ci sono mai entrati.
 *
 * ⛔ **Quei nomi mancanti sono un difetto ANCHE per gli allergeni**, e più grave di questo: chi è
 * allergica al latte e riceve un piatto col taleggio non se lo vede togliere. Ma quello **non si
 * corregge da qui**: allargare il vocabolario degli allergeni cambia i menu di tutte le clienti che
 * hanno dichiarato quell'allergia, e va fatto misurando (`npm run diag:allergeni-mancanti`), da
 * solo, con la sua consegna. È scritto nei Lavori.
 *
 * ## Perché allora un elenco QUI, che di solito non si fa
 *
 * ⚠️ Perché questo cancello sbaglia **in una direzione sola**: un falso positivo toglie una
 * proposta e manda la richiesta alla nutrizionista, e non fa male a nessuno. È l'unico posto del
 * progetto dove un elenco «largo» è la scelta prudente — e per questo non deve uscire di qui e
 * andare a filtrare i piatti.
 *
 * ## Il confine, quello vero
 *
 * ⚠️ Restano fuori il miele per una vegana, la gelatina, il caglio animale in un formaggio a nome
 * generico: nessuno dei vocabolari li conosce, e non li conosce nemmeno questo.
 */

/**
 * ⛔ **Le CATEGORIE, che nessun elenco di ingredienti contiene** — misurato il 4/9. Un gruppo si
 * chiama «Salumi» e dentro ha «salumi»: non è un ingrediente di ricetta, è il modo in cui una
 * nutrizionista scrive una riga.
 *
 * ⚠️ `carne bianca` e `carne rossa` cadono dentro `carne` per parola, e non serve elencarle.
 */
export const CARNE_GENERICA: readonly string[] = [
  'carne', 'carni', 'salume', 'salumi', 'affettato', 'affettati', 'insaccato', 'insaccati',
  'selvaggina', 'cacciagione', 'strutto', 'lardo', 'frattaglie',
];

/** ⛔ Il pescato che il vocabolario degli allergeni non nomina. Stessa misura, stesso giorno. */
export const PESCE_GENERICO: readonly string[] = [
  'pescato', 'frutti di mare', 'seppia', 'seppie', 'moscardino', 'moscardini', 'totano', 'totani',
];

/**
 * ⛔ **I formaggi che `DERIVATI_LATTE` non ha mai avuto.** Elenco chiuso, misurato, e valido solo
 * per il cancello del regime — vedi il riquadro in testa al file.
 */
export const LATTICINI_GENERICI: readonly string[] = [
  'philadelphia', 'robiola', 'crescenza', 'taleggio', 'fontina', 'asiago', 'emmental', 'emmenthal',
  'caciotta', 'skyr', 'scamorza', 'primo sale', 'squacquerone', 'quartirolo', 'casatella',
  'gruviera', 'gruyere', 'raclette', 'reblochon', 'camembert', 'gouda', 'edam', 'pecorino romano',
  'formaggio', 'formaggi', 'latticino', 'latticini',
];

/** Vero se una di queste parole compare come parola intera nel nome. */
const contieneUna = (testo: string, parole: readonly string[]): boolean =>
  parole.some((p) => new RegExp(`(?:^|\\s)${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s|$)`).test(testo));
export type FuoriRegime = 'carne' | 'pesce' | 'latticini' | 'uova';

/**
 * Cosa NON può ricevere una cliente di ciascun regime.
 *
 * ⚠️ È un `Record` completo apposta: il giorno che si aggiunge un regime a `REGIMI_IN_ORDINE`, il
 * compilatore si ferma qui invece di lasciare che il regime nuovo passi con la tabella vuota — cioè
 * con **nessun** divieto, che è il verso sbagliato.
 */
export const VIETATI: Readonly<Record<Regime, readonly FuoriRegime[]>> = {
  vegan: ['carne', 'pesce', 'latticini', 'uova'],
  vegetarian: ['carne', 'pesce'],
  pescetarian: ['carne'],
  omnivore: [],
};

/**
 * Il regime della cliente, o il **più stretto** se non lo sappiamo.
 *
 * ⚠️ Si ricava da `regimiCompatibili`, che per un regime sconosciuto risponde `['vegan']`: l'ultimo
 * elemento è sempre «il più largo che questa cliente può ricevere», cioè il suo. Ricavarlo invece di
 * riscrivere un `switch` vuol dire che il giorno che i regimi cambiano cambia una lista sola.
 */
export function regimeEffettivo(regime: string | null | undefined): Regime {
  const compatibili = regimiCompatibili(regime);
  return compatibili[compatibili.length - 1];
}

/**
 * Dice **perché** questo alimento non si può proporre a una cliente di questo regime, o `null` se
 * si può.
 *
 * ⚠️ L'ordine delle prove è quello con cui si spiega la cosa a una persona: prima la carne, poi il
 * pesce, poi i derivati. Una sola ragione, la prima che vale: elencarne tre non aiuta nessuno.
 */
export function fuoriRegime(candidato: string, regime: string | null | undefined): FuoriRegime | null {
  const nome = (candidato ?? '').trim();
  if (!nome) return null;
  const vietati = VIETATI[regimeEffettivo(regime)];
  if (!vietati.length) return null;
  const testo = normalizza(nome);
  /**
   * ⛔ **`eCarneIngrediente` e NON `eCarne`, e questa scelta l'ho cambiata due volte in un'ora.**
   *
   * `eCarne` aggiunge le **preparazioni** («hamburger», «arrosto», «cotoletta», «tagliata») e a
   * prima vista è la scelta prudente, visto che qui un falso positivo costa solo una proposta.
   * ⚠️ **Misurato, non è vero**: con `eCarne` la stringa `carota tagliata sottile` risponde
   * **carne** — è lo stesso identico falso positivo che l'1/9 ha fatto riscrivere
   * `piatto-di-cosa.ts`, e qui vorrebbe dire che una vegetariana non si vede più proporre le
   * carote. Un cancello che toglie le verdure a una vegetariana non è prudente, è rotto.
   *
   * ⚠️ **Il prezzo, detto**: un gruppo con dentro la parola nuda «hamburger» o «polpette» passa. In
   * cucina italiana quelle parole si fanno di ceci e di melanzane quanto di manzo, e indovinare
   * dalla parola sola è esattamente quello che l'1/9 ha smesso di fare — su venti nomi plausibili
   * ne sbagliava quindici.
   */
  if (vietati.includes('carne') && (eCarneIngrediente(nome) || contieneUna(testo, CARNE_GENERICA))) return 'carne';
  if (vietati.includes('pesce') && (ePesce(nome) || contieneUna(testo, PESCE_GENERICO))) return 'pesce';
  if (vietati.includes('latticini') && (hitsExclusion(testo, exclusionKeys(['latticini'])) || contieneUna(testo, LATTICINI_GENERICI))) return 'latticini';
  if (vietati.includes('uova') && hitsExclusion(testo, exclusionKeys(['uova']))) return 'uova';
  return null;
}

/** Come si chiama, in una frase, quello che il cancello ha fermato. */
export const PAROLA: Readonly<Record<FuoriRegime, string>> = {
  carne: 'carne',
  pesce: 'pesce',
  latticini: 'un derivato del latte',
  uova: 'un derivato delle uova',
};
