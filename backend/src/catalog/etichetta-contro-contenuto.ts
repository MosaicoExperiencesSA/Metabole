import { eCarne, eCarneIngrediente, ePesce } from './piatto-di-cosa';
import { suggestAllergens } from './allergens';

/**
 * L'ETICHETTA CONTRO IL CONTENUTO — il giudizio, fuori dallo script che riscrive il catalogo.
 *
 * ⛔ **Sta qui perché `regime:contenuto` con `APPLICA=1` riscrive `Recipe.regime` in blocco** — 549
 * ricette al primo giro. Il 1/9 il suo mucchio «sicuro» conteneva due errori nelle prime trenta
 * righe, e li ha visti una persona che leggeva l'output: non una prova, perché il giudizio stava
 * dentro lo script, dove nessuna prova arriva. Adesso arriva.
 *
 * ## Tre esiti, e solo uno si applica a macchina
 *
 * - **`sicura`** — carne o pesce fra gli **ingredienti**, e niente che faccia pensare a
 *   un'imitazione. Si corregge in blocco.
 * - **`dubbia`** — o ha scattato solo il **nome**, o nel piatto c'è una parola da imitazione. Non
 *   si tocca: la legge una persona.
 * - **`ok`** — l'etichetta regge.
 *
 * ⚠️ **E l'asimmetria è il motivo di tutto**: una correzione mancata è una riga in più da leggere;
 * una correzione sbagliata è un'etichetta falsa scritta in catalogo per sempre — e in un verso è
 * un Buddha Bowl che diventa onnivoro, nell'altro è carne che resta dichiarata vegetariana.
 */

/**
 * ⚠️ **`uova` e `latticini` dal 5/9**, e valgono solo per il regime **vegano**: il vegetariano li
 * mangia. `diag:vegani-con-latte-e-uova` sul catalogo vero: circa 300 ricette dichiarate vegane con
 * uova strapazzate, stracchino, mozzarella, parmigiano dentro — il difetto dei 175 dell'1/9, nella
 * versione latte-e-uova. Simone, 5/9: si rietichettano come allora (vegan → vegetarian).
 */
export type Cosa = 'carne' | 'pesce' | 'uova' | 'latticini';
export type RegimeGiusto = 'omnivore' | 'pescetarian' | 'vegetarian';
export type Esito =
  | { tipo: 'ok' }
  | { tipo: 'sicura'; cosa: Cosa; prova: string; regimeGiusto: RegimeGiusto }
  | { tipo: 'dubbia'; cosa: Cosa; prova: string; perche: string };

/**
 * ⛔ **LE PAROLE CHE DICHIARANO UN'IMITAZIONE** — e servono a spostare nei dubbi, mai a correggere.
 *
 * In questo catalogo esistono e non sono rare: «prosciutto di tofu affumicato», «Pollo di Tempeh»,
 * «Branzino di melanzane», «Polpo di ceci», «acciughe vegetali», «Petto d'Anatra di Tofu».
 *
 * ⚠️ Finora si prendevano solo se la parola stava nel NOME. Ma «prosciutto vegetale» può stare fra
 * gli **ingredienti**, e allora finiva nel mucchio sicuro: una ricetta vegetariana riscritta
 * onnivora a macchina.
 *
 * ⛔ **E non decidono al contrario.** «Prosciutto con contorno vegetale» è prosciutto vero: una
 * regola che lo dichiarasse imitazione lascerebbe carne etichettata vegetariana, che è l'errore
 * peggiore dei due. Quindi la parola sposta nei dubbi e basta — costa qualche riga in più da
 * leggere a mano, e non costa nessuna etichetta sbagliata.
 */
export const PAROLE_DA_IMITAZIONE: readonly string[] = [
  'vegetale', 'vegetali', 'vegan', 'vegano', 'vegana', 'finto', 'finta', 'finti', 'finte',
  'di tofu', 'di seitan', 'di soia', 'di tempeh', 'di lupini', 'di ceci', 'di melanzane',
  "d'alghe", 'di alghe', 'di jackfruit', 'di muscolo di grano', 'di grano saraceno',
];

/**
 * ⛔ **LA PAROLA DEVE STARE SUBITO DOPO L'ANIMALE — non da qualche parte nel piatto** (1/9,
 * seconda stesura, e la prima ha fatto danno in produzione).
 *
 * La prima versione cercava la parola nel testo intero. In cucina italiana è un disastro: «brodo
 * **vegetale**» sta in metà delle ricette di pesce, «purè **di ceci**» è un contorno normale,
 * «salsa **di soia**» è salsa di soia. Risultato: **152 ricette finite fra le dubbie**, quasi tutte
 * a torto — e 147 piatti di pesce veri rimasti etichettati `omnivore`, che `panieri:pulisci` stava
 * per togliere dai panieri pescetariani.
 *
 * ⚠️ **L'imitazione è una cosa che si dichiara ATTACCATA al nome dell'animale**: «prosciutto
 * vegetale», «polpo di ceci», «branzino di melanzane», «pollo di tempeh», «acciughe vegetali». Se
 * fra i due c'è una frase — «tonno al sesamo su purè di ceci» — non è un'imitazione, è un contorno.
 *
 * ⚠️ La finestra è corta apposta (poche lettere dopo il termine): allargarla vorrebbe dire tornare
 * al problema di prima un pezzetto alla volta.
 */
/**
 * Vero se la parola-imitazione ha **come parola immediatamente precedente** il nome di un animale.
 *
 * ⚠️ Si guarda indietro e non avanti perché la parola-imitazione è quella che si trova: partire da
 * lì e chiedere «di cosa dice di essere l'imitazione?» è una domanda sola, mentre partire
 * dall'animale vorrebbe dire sapere quale dei suoi cinquanta nomi ha fatto scattare.
 *
 * ⛔ **UNA PAROLA, NON UNA FINESTRA DI LETTERE.** La seconda stesura guardava le 18 lettere prima,
 * e su «filetto di merluzzo · brodo vegetale» ci finiva dentro «merluzzo»: falso positivo uguale a
 * quello di partenza, solo più corto. La parola attaccata è l'unica cosa che distingue «prosciutto
 * vegetale» da «brodo vegetale», e va guardata quella e basta.
 */
const ultimaParola = (testo: string): string =>
  testo.trimEnd().split(/[^a-zà-ú]+/i).filter(Boolean).pop() ?? '';

export const sembraUnImitazione = (testo: string): string | null => {
  const t = (testo ?? '').toLowerCase();
  for (const k of PAROLE_DA_IMITAZIONE) {
    let i = t.indexOf(k);
    while (i !== -1) {
      const parola = ultimaParola(t.slice(0, i));
      if (parola && (eCarneIngrediente(parola) || ePesce(parola))) return k;
      i = t.indexOf(k, i + 1);
    }
  }
  return null;
};

export const regimeGiusto = (cosa: Cosa): RegimeGiusto =>
  (cosa === 'carne' ? 'omnivore' : cosa === 'pesce' ? 'pescetarian' : 'vegetarian');

/** Un ingrediente che si dichiara vegetale da sé: «formaggio vegano», «panna vegetale», «maionese veg». */
const DETTO_VEGETALE = /\b(?:vegan[oaei]?|vegetal[ei]|veg)\b/;

/**
 * ⛔ **LE UOVA E I LATTICINI IN UN PIATTO VEGANO — si chiede alla deduzione degli allergeni**, che
 * li conosce (`classifica` da sola conosce carne e pesce). ⚠️ Due porte, due versi: per gli
 * allergeni «panna vegetale» resta latte (31/8, il caseinato), qui no — chi l'ha scritta l'ha
 * dichiarata vegetale, e un giudizio che la chiamasse latticino sarebbe una rietichettatura
 * sbagliata scritta in catalogo per sempre. I derivati «di ‹pianta›» li scarta già la porta unica.
 */
export function uovaOLatticini(ingredienti: readonly string[]): { cosa: 'uova' | 'latticini'; prova: string } | null {
  const trovati = suggestAllergens(ingredienti.map((name) => ({ name })))
    .filter((a) => a.allergen === 'latte' || a.allergen === 'uova')
    .map((a) => ({ ...a, matched: a.matched.filter((nome) => !DETTO_VEGETALE.test(nome)) }))
    .filter((a) => a.matched.length);
  if (!trovati.length) return null;
  const primo = trovati.find((a) => a.allergen === 'uova') ?? trovati[0];
  return { cosa: primo.allergen === 'uova' ? 'uova' : 'latticini', prova: primo.matched[0] };
}

/**
 * ⛔ **I REGIMI DA GUARDARE, E PERCHÉ ORA C'È ANCHE L'ONNIVORO** (1/9, seconda scoperta).
 *
 * `diag:carne-fuori-posto` ha trovato **2351 righe** con una ricetta dichiarata `omnivore` dentro
 * un paniere `pescetarian`. Non è un errore di riempimento: è `panieri:pesce` che fa il suo
 * mestiere — il pesce del paniere onnivoro entra in quello pescetariano, ed è tutta la Fase 5.
 *
 * ⛔ **Ma allora due regole di casa si contraddicono**: la derivazione dice che quel salmone sta
 * bene nel paniere pescetariano, il controllo sul regime dice che una ricetta onnivora lì non ci
 * sta, e `panieri:pulisci` lo butterebbe fuori — svuotando i panieri appena costruiti.
 *
 * ⚠️ **La radice è l'etichetta, come sempre oggi**: un piatto di solo pesce non è `omnivore`, è
 * `pescetarian` — il regime più stretto che può mangiarlo. Corretta quella, le due regole tornano
 * a dire la stessa cosa e nessuna riga va buttata.
 *
 * ⛔ E l'onnivoro si guarda **solo per il pesce**: un piatto onnivoro con la carne dentro è
 * onnivoro e basta, non c'è niente da correggere.
 */
export const REGIMI_DA_CONTROLLARE: readonly string[] = ['vegan', 'vegetarian', 'omnivore'];

export function classifica(nome: string, ingredienti: readonly string[], regimeDichiarato?: string): Esito {
  /**
   * ⛔ **Sugli ingredienti si usa `eCarneIngrediente`**, non `eCarne`: un ingrediente è una cosa,
   * non un modo di cucinarla. «Carota **tagliata** sottile» stava per rendere onnivoro un Buddha
   * Bowl di lenticchie, dentro un blocco automatico da 549.
   *
   * ⚠️ E la carne vince sul pesce, come in `verdettoPescetariano`: «mare e monti» esiste.
   */
  const carneIng = ingredienti.find((i) => eCarneIngrediente(i));
  const pesceIng = carneIng ? undefined : ingredienti.find((i) => ePesce(i));
  /**
   * ⚠️ **Si parte dal termine che ha fatto scattare**, non dal piatto intero: l'imitazione è la
   * parola attaccata a quel termine. «Prosciutto di tofu» sì, «tonno con purè di ceci» no.
   */
  const imitazione = sembraUnImitazione(`${nome} · ${ingredienti.join(' · ')}`);

  if (carneIng || pesceIng) {
    const cosa: Cosa = carneIng ? 'carne' : 'pesce';
    const prova = (carneIng ?? pesceIng) as string;
    /**
     * ⚠️ **Su una ricetta già ONNIVORA c'è una sola cosa da correggere: il pesce.** La carne lì è
     * al suo posto, e dire «sicura» significherebbe proporre di riscrivere `omnivore` in
     * `omnivore` — rumore che fa sembrare grosso un lavoro che non c'è.
     */
    if (regimeDichiarato === 'omnivore' && cosa !== 'pesce') return { tipo: 'ok' };
    if (imitazione) return { tipo: 'dubbia', cosa, prova, perche: `sembra un'imitazione: «${imitazione}»` };
    return { tipo: 'sicura', cosa, prova, regimeGiusto: regimeGiusto(cosa) };
  }
  /** ⚠️ E sul nome, per una onnivora, non c'è niente da dubitare: sta già nel regime più largo. */
  if (regimeDichiarato === 'omnivore') return { tipo: 'ok' };
  /**
   * ⛔ **Le uova e i latticini, solo per il vegano** (5/9). Vengono DOPO carne e pesce — «uova
   * strapazzate con pancetta» è onnivora, non vegetariana — e sono sempre «sicure»: stanno negli
   * ingredienti, e l'imitazione («formaggio vegano», «ricotta di mandorla») è già stata scartata
   * da `uovaOLatticini`. Su un piatto vegetariano non c'è niente da correggere.
   */
  if (regimeDichiarato === 'vegan') {
    const animale = uovaOLatticini(ingredienti);
    if (animale) return { tipo: 'sicura', cosa: animale.cosa, prova: animale.prova, regimeGiusto: 'vegetarian' };
  }
  /**
   * ⚠️ Sul NOME invece le preparazioni contano — «Cotoletta alla milanese» è un piatto di carne — ma
   * qui non si corregge mai: può essere un piatto vegetale che si chiama come un animale, oppure
   * ⛔ una ricetta a cui manca l'ingrediente nell'elenco, che è un difetto di catalogo a sé.
   */
  if (eCarne(nome)) return { tipo: 'dubbia', cosa: 'carne', prova: nome, perche: 'solo nel nome' };
  if (ePesce(nome)) return { tipo: 'dubbia', cosa: 'pesce', prova: nome, perche: 'solo nel nome' };
  return { tipo: 'ok' };
}
