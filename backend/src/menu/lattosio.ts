/**
 * INTOLLERANZA AL LATTOSIO: si sostituisce con il DELATTOSATO, non con la bevanda vegetale.
 * E i formaggi stagionati non si sostituiscono affatto.
 *
 * Chiesto da Simone l'11/8/2026: «per gli intolleranti al lattosio crea un gruppo di equivalenza da
 * adottare in automatico, con latte senza lattosio e formaggi senza lattosio».
 *
 * ## Perché non bastava la mappa che c'era
 *
 * `SUBSTITUTION_MAP` mandava `latte → 'bevanda vegetale'`. Per un intollerante è una sostituzione
 * sbagliata due volte: la bevanda vegetale **non è latte** (proteine, calcio e sapore diversi, e il
 * bilanciamento della giornata è calcolato su quello che c'era prima), e non serve — il latte
 * delattosato esiste, ha **lo stesso profilo nutrizionale** del latte normale, perché l'idrolisi
 * enzimatica scinde il lattosio in glucosio e galattosio senza toccare nient'altro. Cambia solo il
 * gusto, un po' più dolce.
 *
 * ## I formaggi stagionati NON si sostituiscono
 *
 * La circolare del Ministero della Salute del 1° febbraio 2016 elenca 25 formaggi DOP con lattosio
 * **sotto lo 0,001%**, cioè milligrammi per 100 g: Parmigiano Reggiano, Grana Padano, Pecorino
 * Romano, Gorgonzola, Asiago e altri. L'EFSA non fissa una soglia unica di tolleranza (è troppo
 * individuale), ma la letteratura indica intorno ai 12 g per dose come generalmente tollerati: un
 * formaggio che ne contiene millesimi di grammo è al riparo con qualunque margine.
 * Sostituirlo sarebbe una cortesia inutile che peggiora il menu e insegna alla cliente a non fidarsi
 * delle sostituzioni.
 *
 * ## ⚠️ E ATTENZIONE ALL'ALLERGIA: qui sta il pericolo vero
 *
 * L'intolleranza al lattosio è un deficit di lattasi; l'allergia alle proteine del latte (APLV) è una
 * reazione immunitaria alle proteine — caseina, beta-lattoglobulina — che nel prodotto delattosato
 * **ci sono tutte**: l'idrolisi toglie lo zucchero, non l'allergene. Dare un «latte senza lattosio» a
 * chi è allergica al latte non è una semplificazione discutibile: è mandarle in tavola esattamente
 * ciò che le fa male, con un'etichetta che la rassicura.
 *
 * Nel nostro database i due dati convivono (`allergies` e `intolerances`) e c'è già almeno una cliente
 * con **entrambi**. Quindi la regola qui è secca: **l'allergia vince sempre**. Chi ha il latte fra le
 * allergie resta sulla strada di prima (esclusione e alternative non lattiero-casearie), e il
 * delattosato non le viene mai proposto.
 */

/** Il valore che l'onboarding salva per l'intolleranza al lattosio (`onboarding.questions.ts`). */
export const INTOLLERANZA_LATTOSIO = 'lactose';

/**
 * Termini che, fra le ALLERGIE, indicano le proteine del latte. Se uno di questi c'è, il delattosato
 * è fuori discussione.
 *
 * Volutamente larghi: qui un falso positivo costa una sostituzione più prudente del necessario, un
 * falso negativo costa una reazione allergica. L'asimmetria decide da sé come scriverli.
 */
import { soloDentroFrasi } from './exclusions';

const ALLERGIE_AL_LATTE = [
  'latte', 'latticini', 'lattiero', 'caseina', 'caseinati', 'proteine del latte', 'aplv',
  'siero di latte', 'lattoalbumina', 'lattoglobulina', 'formaggio', 'formaggi',
];

/**
 * Formaggi con lattosio trascurabile: NON si sostituiscono a un intollerante.
 *
 * L'elenco viene dalla circolare ministeriale del 2016 (25 formaggi DOP sotto lo 0,001% di lattosio)
 * più i grandi stagionati di uso comune nel nostro catalogo. Sono nomi di alimento, confrontati per
 * parola (vedi `contieneAlimento`), non per sottostringa.
 */
export const FORMAGGI_STAGIONATI_SICURI = [
  'parmigiano', 'parmigiano reggiano', 'grana', 'grana padano', 'pecorino', 'pecorino romano',
  'gorgonzola', 'asiago', 'provolone', 'emmental', 'emmenthal', 'gruviera', 'groviera',
  'fontina', 'montasio', 'taleggio', 'caciocavallo', 'ragusano', 'piave', 'bitto', 'castelmagno',
  'grattugiato',
];

/**
 * La sostituzione per l'intollerante: stesso alimento, versione senza lattosio.
 *
 * Il criterio è «il piatto resta quello che era»: chi ha una colazione con latte e yogurt deve
 * ritrovare latte e yogurt, non una bevanda vegetale e un budino di soia. Il burro è l'eccezione
 * dichiarata: il burro delattosato non è un prodotto che si trova in un supermercato qualunque, e
 * l'olio evo era già la sostituzione in uso — quella resta.
 */
export const SOSTITUTI_SENZA_LATTOSIO: Record<string, string> = {
  latte: 'latte senza lattosio',
  yogurt: 'yogurt senza lattosio',
  formaggio: 'formaggio senza lattosio',
  formaggi: 'formaggio senza lattosio',
  mozzarella: 'mozzarella senza lattosio',
  ricotta: 'ricotta senza lattosio',
  stracchino: 'stracchino senza lattosio',
  scamorza: 'scamorza senza lattosio',
  burrata: 'burrata senza lattosio',
  provola: 'provola senza lattosio',
  crescenza: 'crescenza senza lattosio',
  robiola: 'robiola senza lattosio',
  mascarpone: 'mascarpone senza lattosio',
  panna: 'panna senza lattosio',
  kefir: 'kefir senza lattosio',
  // Il burro resta all'olio evo: vedi sopra.
  burro: 'olio evo',
};

/** Normalizzazione minima: minuscolo, accenti tenuti (sono significativi in italiano), spazi puliti. */
const pulisci = (s: string): string => (s ?? '').toLowerCase().trim().replace(/\s+/g, ' ');

/**
 * Le parole di un nome di alimento, senza le troppo corte.
 *
 * ⚠️ Il confronto sui nomi di alimento **non si fa per sottostringa**: è la trappola che nel progetto
 * ha già morso tre volte («pepe» ⊂ «peperoni», «mela» ⊂ «melanzane», «pane» ⊂ «pancetta»). Qui il
 * caso concreto sarebbe «latte» ⊂ «latteria» e, peggio, «panna» dentro nomi che non c'entrano.
 */
const paroleDi = (nome: string): string[] => pulisci(nome).split(/[^a-zà-ÿ]+/).filter((p) => p.length >= 3);

/** `nome` contiene l'alimento `termine`, confrontando per parola (mai per sottostringa). */
export function contieneAlimento(nome: string, termine: string): boolean {
  const parole = new Set(paroleDi(nome));
  const cercate = paroleDi(termine);
  if (!cercate.length) return false;
  return cercate.every((c) => parole.has(c));
}

/**
 * Va applicata la regola del delattosato a questa cliente?
 *
 * `true` solo se: ha `lactose` fra le intolleranze **e** non ha nessun termine del latte fra le
 * allergie. L'ordine dei due controlli non è indifferente — la seconda condizione è quella che
 * protegge, e va valutata sempre, anche quando la prima è ovvia.
 */
export function usaDelattosati(profilo: {
  intolerances?: string[] | null;
  allergies?: string[] | null;
}): boolean {
  const intolleranze = (profilo.intolerances ?? []).map(pulisci);
  if (!intolleranze.some((i) => i === INTOLLERANZA_LATTOSIO || i.includes('lattos'))) return false;
  const allergie = (profilo.allergies ?? []).map(pulisci).filter(Boolean);
  const allergicaAlLatte = allergie.some((a) => ALLERGIE_AL_LATTE.some((t) => contieneAlimento(a, t) || contieneAlimento(t, a)));
  return !allergicaAlLatte;
}

/** Il formaggio è uno di quelli stagionati con lattosio trascurabile? */
export function eFormaggioStagionatoSicuro(ingrediente: string): boolean {
  return FORMAGGI_STAGIONATI_SICURI.some((f) => contieneAlimento(ingrediente, f));
}

/**
 * Cosa fare di questo ingrediente, per una cliente che usa i delattosati.
 *
 * - `{ azione: 'tieni' }` → è un formaggio stagionato: si lascia com'è, nessuna sostituzione;
 * - `{ azione: 'sostituisci', con }` → la versione senza lattosio;
 * - `null` → questa regola non ha nulla da dire (decide chi chiama, con le regole di prima).
 */
export function decisioneLattosio(
  ingrediente: string,
): { azione: 'tieni' } | { azione: 'sostituisci'; con: string } | null {
  const nome = pulisci(ingrediente);
  if (!nome) return null;
  // Già senza lattosio (o delattosato): non si tocca, e soprattutto non si "sostituisce" due volte
  // producendo «latte senza lattosio senza lattosio».
  if (/senza lattosio|delattosat/.test(nome)) return { azione: 'tieni' };
  if (eFormaggioStagionatoSicuro(nome)) return { azione: 'tieni' };
  for (const parola of paroleDi(nome)) {
    const sostituto = SOSTITUTI_SENZA_LATTOSIO[parola];
    /**
     * ⛔ **«latte di cocco» NON si sostituisce con «latte senza lattosio»** — trovato in revisione
     * il 31/8, ed è il difetto che fa più danno di tutta questa famiglia: le altre porte tolgono un
     * piatto (menu più povero), questa **aggiunge un derivato del latte a un piatto che non ne
     * aveva**. E il delattosato le proteine del latte le contiene tutte.
     *
     * ⚠️ L'elenco delle frasi è quello di `exclusions.ts`, letto e non ricopiato: è la stessa
     * domanda del filtro degli allergeni, e due liste che rispondono uguale un giorno divergono.
     */
    if (sostituto && !soloDentroFrasi(nome, parola)) return { azione: 'sostituisci', con: sostituto };
  }
  if (SOSTITUTI_SENZA_LATTOSIO[nome]) return { azione: 'sostituisci', con: SOSTITUTI_SENZA_LATTOSIO[nome] };
  return null;
}
