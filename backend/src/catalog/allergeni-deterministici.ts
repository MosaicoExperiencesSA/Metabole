import { INTOLERANCE_MAP } from '../menu/exclusions';
import { QUALIFICATORI, abbinaPerRicetta, paroleChe } from '../nutrient-facts/abbinamento-alimenti';
import { eAroma } from '../nutrient-facts/aromi';
import { STATI_A_CRUDO, STATI_DA_COTTO } from '../nutrient-facts/stato-alimento';
import { normalizzaNome } from '../nutrient-facts/valori-nutrizionali.service';
import { EU_ALLERGENS, ingredientNames, suggestAllergens } from './allergens';

/**
 * ALLERGENI DEDOTTI DAGLI INGREDIENTI, CON ARRESTO SULL'IGNOTO — il §2 del foglio firmato da
 * Nocanty il 31/8.
 *
 * ⛔ **La domanda non è «quali allergeni vedo», è «so che cos'è questo ingrediente».** Sono due
 * domande diverse e confonderle è il difetto che questo modulo esiste per non fare:
 * `suggestAllergens` risponde alla prima, e su un ingrediente che non conosce risponde «nessun
 * allergene» — la stessa identica risposta che dà sulle zucchine. Cioè **l'ignoto e il sicuro si
 * presentano uguali**, ed è per questo che oggi il contrassegno lo deve accendere una persona.
 *
 * Qui la seconda domanda si fa per prima: un ingrediente è **riconosciuto** se porta a una riga
 * della tabella alimenti. Se tutti lo sono, gli allergeni si scrivono da soli; se anche uno solo
 * non lo è, la ricetta **si ferma** e non entra in nessun menu. Il sistema non indovina mai.
 *
 * ⚠️ **Riconosciuto non vuol dire «ne conosco gli allergeni».** La tabella alimenti dice che
 * l'ingrediente esiste e che valori ha, non che cosa contiene: su un «pesto pronto» che avesse la
 * sua riga, la deduzione direbbe «nessun allergene» con la stessa faccia. È il limite n° 2 del
 * foglio, e resta aperto — `sembraPreparazione` serve a **misurarlo**, non a chiuderlo.
 *
 * ⚠️ Le regole del riconoscimento **non si riscrivono qui**: sono `abbinaPerRicetta`, la stessa che
 * usa il conto delle calorie. Una seconda copia che risponde «no» dove la produzione risponde «sì»
 * manderebbe una nutrizionista a lavorare su una coda che non esiste — è già successo il 19/8 con
 * «spinaci freschi», 1350 ricette.
 */

export interface RigaNota {
  name: string;
  synonyms?: string[] | null;
  state?: string | null;
}

export interface Dizionario {
  /** I nomi (e i sinonimi) normalizzati, per la risposta immediata. */
  perNome: Set<string>;
  /** Le righe candidate per parola, così l'abbinamento non gira su tutta la tabella. */
  perParola: Map<string, RigaNota[]>;
  /** Tutte le parole che il sistema conosce, da qualunque elenco arrivino: serve al criterio largo. */
  parole: Set<string>;
}

/**
 * ⚠️ **DUE CRITERI, E IL SECONDO NON È UNA PROPOSTA.**
 *
 * · `stretto` — l'ingrediente porta a una **riga vera** della tabella alimenti. È il criterio del
 *   §2 del foglio, ed è quello con cui si decide se una ricetta può entrare in un menu.
 * · `largo` — tutte le parole che distinguono il nome sono parole che il sistema conosce da
 *   qualche parte (tabella, elenchi degli allergeni, elenchi delle esclusioni, aromi).
 *
 * ⛔ Il largo serve a **misurare il tetto**, non a servire piatti: dice quante ricette si
 * sbloccherebbero se la tabella alimenti fosse completa, cioè separa «la ricetta è scritta male»
 * da «la tabella è indietro». Usato per decidere sarebbe pericoloso proprio dove sembra comodo:
 * «insalata di riso» ha due parole note, nessuna delle due nell'elenco di un allergene, e uscirebbe
 * **senza allergeni** — e un'insalata di riso vera ha dentro tonno, uova e formaggio. Sapere le
 * parole non è sapere cosa c'è dentro.
 *
 * ⚠️ Qui prima c'era scritto «torta di mele», e la revisione del 31/8 l'ha verificato: `torta` non
 * sta in nessun elenco, quindi quel nome il largo lo ferma. L'esempio non dimostrava la cosa per
 * cui era scritto — cioè il commento sembrava una misura e non lo era.
 */
export type Criterio = 'stretto' | 'largo';

/**
 * ⚠️ L'indice si costruisce **una volta**: `abbina` su ogni nome contro ogni riga sono cinque
 * secondi di event loop bloccato, e questa lezione è già scritta in `ingredienti-scoperti.ts`.
 */
export function indicizza(righe: readonly RigaNota[]): Dizionario {
  const perNome = new Set<string>();
  const perParola = new Map<string, RigaNota[]>();
  const parole = new Set<string>();
  for (const r of righe ?? []) {
    const nomi = [r.name, ...(r.synonyms ?? [])].map(normalizzaNome).filter(Boolean);
    for (const n of nomi) perNome.add(n);
    const chiavi = new Set<string>();
    for (const n of nomi) for (const p of paroleChe(n)) chiavi.add(p);
    for (const k of chiavi) { perParola.set(k, [...(perParola.get(k) ?? []), r]); parole.add(k); }
  }
  /**
   * ⚠️ Le altre parole che il sistema conosce già, e che non stanno nella tabella alimenti: i
   * termini dei 14 allergeni e quelli delle categorie di esclusione. Non se ne scrive un terzo
   * elenco — si leggono quelli che la produzione usa davvero.
   */
  for (const a of EU_ALLERGENS) for (const kw of a.keywords) for (const p of paroleChe(normalizzaNome(kw))) parole.add(p);
  for (const termini of Object.values(INTOLERANCE_MAP)) for (const t of termini) for (const p of paroleChe(normalizzaNome(t))) parole.add(p);
  return { perNome, perParola, parole };
}

/**
 * `nome` = la tabella lo chiama così; `abbinamento` = ci si arriva, ma per somiglianza;
 * `aroma` e `parole` esistono **solo** nel criterio largo (vedi `Criterio`).
 */
export type Come = 'nome' | 'abbinamento' | 'aroma' | 'parole' | null;

/**
 * Le parole che nel criterio largo non fanno testo: dicono **com'è presentato** l'alimento, non che
 * cosa è. ⚠️ Si leggono dai due elenchi che la produzione già usa — i qualificatori innocui
 * dell'abbinamento e gli stati — invece di scriverne un terzo.
 *
 * ⚠️ Qui `fresco` si accetta sempre, mentre `abbina` lo accetta solo su una riga a crudo: nel largo
 * la riga non c'è, quindi il controllo non si può fare. È una delle ragioni per cui il largo misura
 * un tetto e non decide niente.
 */
const DI_CONTORNO = new Set<string>([
  ...QUALIFICATORI,
  ...STATI_A_CRUDO, ...STATI_DA_COTTO,
  'fresco', 'fresca', 'freschi', 'fresche', 'surgelato', 'surgelata', 'surgelati', 'surgelate',
]);

export function riconosce(nomeIngrediente: string, dz: Dizionario, criterio: Criterio = 'stretto'): Come {
  const n = normalizzaNome(nomeIngrediente);
  if (!n) return null;
  if (dz.perNome.has(n)) return 'nome';
  const candidate = new Set<RigaNota>();
  for (const p of paroleChe(n)) for (const r of dz.perParola.get(p) ?? []) candidate.add(r);
  if (candidate.size && abbinaPerRicetta(n, [...candidate])) return 'abbinamento';
  if (criterio === 'stretto') return null;
  if (eAroma(n)) return 'aroma';
  const parole = paroleChe(n);
  return parole.length && parole.every((p) => dz.parole.has(p) || DI_CONTORNO.has(p)) ? 'parole' : null;
}

export interface EsitoDeduzione {
  /** Gli ingredienti che il sistema non sa classificare: se ce n'è anche uno solo, la ricetta si ferma. */
  ignoti: string[];
  /**
   * Perché si ferma, o `null` se non si ferma.
   *
   * ⛔ **`senza_ingredienti` è un arresto, non un via libera**: `ingredients` è una colonna Json, e
   * una ricetta con l'elenco vuoto o coi nomi in un campo diverso usciva da qui con `allergeni: []`
   * — cioè **«letti gli ingredienti, non contiene niente»** su una ricetta di cui non si è letto
   * niente. Il piatto che dichiara il falso con più sicurezza è quello di cui non sappiamo nulla.
   *
   * ⛔ **`elementi_illeggibili` è il caso PARZIALE, e la prima stesura non lo chiudeva** — trovato
   * dalla revisione del 31/8, che l'ha misurato: `ingredientNames` scarta in silenzio ogni elemento
   * senza `name` leggibile, quindi `[{name:'pollo'}, {nome:'gamberi'}]` usciva con `ignoti: []` e
   * `allergeni: []`. Un elenco con dentro i gamberi che dichiara di non contenere niente.
   * ⚠️ E non è ipotetico: `engine-rules.service.ts` scrive `ingredients` **come arriva dall'AI**,
   * senza controllare la forma dei singoli elementi. Il commento vecchio diceva «vuoto, malformato o
   * con i nomi in un campo diverso» e ne chiudeva uno su tre: era falso, ed è la ragione per cui in
   * questa base di codice un commento sbagliato conta come un difetto e non come una svista.
   */
  motivoArresto: 'ignoti' | 'senza_ingredienti' | 'elementi_illeggibili' | null;
  /** Riconosciuti per somiglianza e non col loro nome: si contano a parte, perché `abbina` è un'euristica. */
  perAbbinamento: string[];
  /** Riconosciuti, ma con un nome da preparazione: la deduzione può dire «nessun allergene» senza saperlo. */
  preparazioni: string[];
  /** Gli allergeni dedotti. ⛔ `null` quando la ricetta si ferma: non è «nessun allergene». */
  allergeni: string[] | null;
}

/**
 * ⛔ **`allergeni: null` e `allergeni: []` sono due cose diverse**, e tenerle distinte è tutto il
 * senso di questa consegna: `[]` vuol dire «letti gli ingredienti, non contiene niente»; `null`
 * vuol dire «non lo so» — e chi legge deve fermarsi, non servire il piatto.
 */
export function deduci(ingredients: unknown, dz: Dizionario, criterio: Criterio = 'stretto'): EsitoDeduzione {
  const nomi = [...new Set(ingredientNames(ingredients).map(normalizzaNome).filter(Boolean))];
  const ignoti: string[] = [];
  const perAbbinamento: string[] = [];
  const preparazioni: string[] = [];
  for (const n of nomi) {
    const come = riconosce(n, dz, criterio);
    if (!come) { ignoti.push(n); continue; }
    if (come === 'abbinamento') perAbbinamento.push(n);
    if (sembraPreparazione(n)) preparazioni.push(n);
  }
  /**
   * ⚠️ Quanti elementi c'erano davvero contro quanti se ne sono letti: la differenza sono gli
   * elementi che `ingredientNames` ha scartato, e uno scarto silenzioso è la cosa da cui questa
   * consegna esiste per proteggere. Si confronta con l'elenco **non** deduplicato, o due ingredienti
   * uguali sembrerebbero uno scarto.
   */
  const grezzi = Array.isArray(ingredients) ? ingredients.length : 0;
  const letti = ingredientNames(ingredients).length;
  const motivoArresto = ignoti.length
    ? 'ignoti' as const
    : grezzi > letti
      ? 'elementi_illeggibili' as const
      : (!nomi.length ? 'senza_ingredienti' as const : null);
  return {
    ignoti,
    motivoArresto,
    perAbbinamento,
    preparazioni,
    allergeni: motivoArresto ? null : suggestAllergens(ingredients).map((a) => a.allergen),
  };
}

/**
 * ⚠️ **UN INDIZIO, NON UN VERDETTO.** Serve a mettere un numero sotto al limite n° 2 del foglio
 * («gli ingredienti composti sono il caso rischioso»): quante ricette passerebbero la deduzione
 * avendo dentro qualcosa il cui nome non dice cosa contiene. Non blocca niente — se un giorno
 * dovesse bloccare, la strada giusta è dichiarare gli allergeni sulla riga dell'alimento, non
 * allungare questo elenco di parole.
 *
 * ⚠️ **`misto` e `mista` sono state tolte il 31/8**: nel giro vero i soli tre risultati erano
 * «insalata mista», che non è un composto con dentro un allergene nascosto. Un indizio che segnala
 * per lo più cose innocenti gonfia il numero che deve misurare, e chi lo legge impara a scartarlo.
 */
export const PAROLE_DA_PREPARAZIONE: readonly string[] = [
  'pronto', 'pronta', 'preparato', 'preparazione', 'sugo', 'salsa', 'condimento',
  'dado', 'brodo', 'ripieno', 'farcito', 'farcita', 'impanato', 'impanata', 'panato', 'panata',
  'burger', 'polpett', 'crocchett', 'surgelat', 'precotto', 'precotta', 'in scatola', 'affettato',
  'insaccat', 'hummus', 'pesto', 'ragu', 'besciamella', 'crema di', 'mix',
];

/**
 * ⚠️ **Una regex compilata una volta, non un `some(...includes(...))`** — e non è per eleganza.
 *
 * La forma a mano l'ha pescata `una-porta-per-le-esclusioni.spec.ts`, la sentinella che vieta di
 * riscriversi il confronto «questo testo contiene una di queste parole» in un file che importa
 * dalle esclusioni. ⛔ Qui la domanda è un'altra (un indizio sul nome di un ingrediente, che non
 * blocca niente) e la strada comoda era dichiarare l'eccezione — ma un guardiano si consuma proprio
 * così, un'eccezione ragionevole alla volta. Tolta la forma, non serve nessuna eccezione.
 *
 * ⚠️ E costa meno: trenta `includes` per ogni ingrediente di quindicimila ricette diventano una
 * sola passata.
 */
const RE_PREPARAZIONE = new RegExp(
  PAROLE_DA_PREPARAZIONE.map((p) => normalizzaNome(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'),
);

export function sembraPreparazione(nome: string): boolean {
  return RE_PREPARAZIONE.test(normalizzaNome(nome));
}

/**
 * Quanto cambierebbe rispetto a quello che la ricetta dichiara oggi. ⚠️ `guadagnati` è il numero
 * che conta: sono allergeni che oggi il piatto **non dichiara** e che dagli ingredienti risultano —
 * cioè piatti che a una cliente allergica oggi risultano sicuri.
 */
export function differenza(oggi: readonly string[], dedotti: readonly string[]): { guadagnati: string[]; persi: string[] } {
  const a = new Set(oggi ?? []);
  const b = new Set(dedotti ?? []);
  return {
    guadagnati: [...b].filter((x) => !a.has(x)).sort(),
    persi: [...a].filter((x) => !b.has(x)).sort(),
  };
}

/** I 14 codici, per stampare la coda per allergene senza reinventare l'elenco. */
export const CODICI = EU_ALLERGENS.map((a) => a.code);
