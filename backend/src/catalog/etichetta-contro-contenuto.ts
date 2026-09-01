import { eCarne, eCarneIngrediente, ePesce } from './piatto-di-cosa';

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

export type Cosa = 'carne' | 'pesce';
export type Esito =
  | { tipo: 'ok' }
  | { tipo: 'sicura'; cosa: Cosa; prova: string; regimeGiusto: 'omnivore' | 'pescetarian' }
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
  "d'alghe", 'di alghe', 'di jackfruit', 'di muscolo di grano',
];

export const sembraUnImitazione = (testo: string): string | null => {
  const t = (testo ?? '').toLowerCase();
  return PAROLE_DA_IMITAZIONE.find((k) => t.includes(k)) ?? null;
};

/**
 * ⚠️ Il regime giusto è **il più stretto che può mangiarlo**: il pesce va a `pescetarian`, non a
 * onnivoro. Buttare il pesce nell'onnivoro lo toglierebbe alle pescetariane, che è metà del motivo
 * per cui questa correzione esiste.
 */
export const regimeGiusto = (cosa: Cosa): 'omnivore' | 'pescetarian' =>
  (cosa === 'carne' ? 'omnivore' : 'pescetarian');

export function classifica(nome: string, ingredienti: readonly string[]): Esito {
  /**
   * ⛔ **Sugli ingredienti si usa `eCarneIngrediente`**, non `eCarne`: un ingrediente è una cosa,
   * non un modo di cucinarla. «Carota **tagliata** sottile» stava per rendere onnivoro un Buddha
   * Bowl di lenticchie, dentro un blocco automatico da 549.
   *
   * ⚠️ E la carne vince sul pesce, come in `verdettoPescetariano`: «mare e monti» esiste.
   */
  const carneIng = ingredienti.find((i) => eCarneIngrediente(i));
  const pesceIng = carneIng ? undefined : ingredienti.find((i) => ePesce(i));
  const imitazione = sembraUnImitazione([nome, ...ingredienti].join(' · '));

  if (carneIng || pesceIng) {
    const cosa: Cosa = carneIng ? 'carne' : 'pesce';
    const prova = (carneIng ?? pesceIng) as string;
    if (imitazione) return { tipo: 'dubbia', cosa, prova, perche: `sembra un'imitazione: «${imitazione}»` };
    return { tipo: 'sicura', cosa, prova, regimeGiusto: regimeGiusto(cosa) };
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
