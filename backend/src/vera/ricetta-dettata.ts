/**
 * LA RICETTA COME LA SCRIVE UNA PERSONA — lettura, e niente di più.
 *
 * «Poi può scrivere: inseriamo una ricetta per il menu keto, e scrive la ricetta» (Simone, 12/8).
 * Quello che arriva davvero non è un modulo compilato: è un nome su una riga e gli ingredienti
 * sotto, come su un quaderno.
 *
 *     Tonno alle olive
 *     tonno 120 g
 *     olive nere 30 g
 *     olio evo 10 g
 *     pranzo, vegetariana
 *
 * ## ⚠️ Quello che NON si indovina
 *
 * Se una riga non ha una quantità leggibile, non diventa un ingrediente da zero grammi: resta
 * fuori e si dice. Se manca il pasto o il regime, non si sceglie il più probabile: si chiede. Una
 * ricetta è un oggetto che finisce nel piatto di persone che non l'hanno chiesta, e l'unica cosa
 * peggiore di una domanda in più è un campo riempito da solo con un valore plausibile.
 *
 * ## ⚠️ Perché `regime` non è la dieta
 *
 * `Recipe.regime` è **onnivora / vegetariana / vegana**: dice chi può mangiare quel piatto. «Keto»
 * è un altro asse — è lo stile della dieta — e finisce fra i `tags`. Scambiarli vorrebbe dire
 * pubblicare una ricetta con la carne dentro un regime vegetariano, cioè l'errore che nessuna
 * schermata riprenderebbe perché il campo *è* compilato.
 */

export interface IngredienteDettato {
  name: string;
  qty: number | null;
  unit: string | null;
  /** La riga originale, per rimetterla davanti agli occhi quando non si è capita. */
  riga: string;
}

export interface RicettaDettata {
  nome: string | null;
  ingredienti: IngredienteDettato[];
  /** breakfast | morning_snack | lunch | afternoon_snack | dinner */
  slot: string | null;
  /** omnivore | vegetarian | vegan */
  regime: string | null;
  tags: string[];
}

const SLOT_DA_PAROLA: [RegExp, string][] = [
  [/\b(colazione)\b/iu, 'breakfast'],
  [/\b(spuntino|spuntino\s+mattina|met[àa]\s+mattina)\b/iu, 'morning_snack'],
  [/\b(pranzo)\b/iu, 'lunch'],
  [/\b(merenda|spuntino\s+pomerid|met[àa]\s+pomeriggio)\b/iu, 'afternoon_snack'],
  [/\b(cena)\b/iu, 'dinner'],
];

const REGIME_DA_PAROLA: [RegExp, string][] = [
  // ⚠️ «vegana» prima di «vegetariana»: la seconda non contiene la prima, ma l'ordine rende
  // esplicito che sono due cose diverse — e chi legge non deve chiederselo.
  [/\bvegan[ae]?\b/iu, 'vegan'],
  [/\bvegetarian[ao]\b/iu, 'vegetarian'],
  [/\b(onnivor[ao]|carne|pesce)\b/iu, 'omnivore'],
];

/** Gli stili di dieta che si nominano parlando: finiscono nei tag, non nel regime. */
const STILI = [
  ['keto', 'keto'],
  ['chetogenic', 'keto'],
  ['mediterrane', 'mediterranea'],
  ['proteic', 'proteica'],
  ['low carb', 'low_carb'],
  ['dash', 'dash'],
] as const;

/**
 * Una riga che è un ingrediente: nome + quantità + unità.
 *
 * ⚠️ La quantità sta in fondo o subito dopo il nome, e le due forme convivono nelle ricette vere
 * («tonno 120 g» e «120 g di tonno»). Riconoscerne una sola vorrebbe dire scartare metà di quello
 * che scrive una persona, e la parte scartata sarebbe silenziosa.
 */
const UNITA = 'g|gr|grammi|kg|ml|cl|l|litri|cucchiai[on]?|cucchiaini?|foglie|spicchi[o]?|pizzichi?|q\\.?b\\.?|qb';
const NOME_PRIMA = new RegExp(`^\\s*[-•*·–]?\\s*(.+?)[\\s:,]+(\\d+(?:[.,]\\d+)?)\\s*(${UNITA})?\\s*$`, 'iu');
const QUANTITA_PRIMA = new RegExp(`^\\s*[-•*·–]?\\s*(\\d+(?:[.,]\\d+)?)\\s*(${UNITA})\\s+(?:di\\s+|d'\\s*)?(.+?)\\s*$`, 'iu');
const SENZA_PESO = new RegExp(`^\\s*[-•*·–]\\s*(.+?)\\s*(?:[\\s,]+(q\\.?b\\.?|qb|quanto basta))?\\s*$`, 'iu');

const numero = (s: string): number => Number(s.replace(',', '.'));

function leggiIngrediente(riga: string): IngredienteDettato | null {
  const q = QUANTITA_PRIMA.exec(riga);
  if (q) return { name: q[3].trim(), qty: numero(q[1]), unit: q[2].toLowerCase(), riga };

  const n = NOME_PRIMA.exec(riga);
  if (n) return { name: n[1].trim(), qty: numero(n[2]), unit: (n[3] ?? '').toLowerCase() || null, riga };

  // ⚠️ Solo le righe che cominciano con un trattino: senza questo vincolo, «pranzo» o una frase di
  // servizio diventerebbero un ingrediente senza peso, e nella ricetta comparirebbe una riga che
  // nessuno ha scritto.
  const s = SENZA_PESO.exec(riga);
  if (s && /^\s*[-•*·–]/.test(riga)) return { name: s[1].trim(), qty: null, unit: s[2] ? 'q.b.' : null, riga };

  return null;
}

export function leggiRicetta(testo: string): RicettaDettata {
  const righe = (testo ?? '').split('\n').map((r) => r.trim()).filter(Boolean);
  const ingredienti: IngredienteDettato[] = [];
  const avanzo: string[] = [];
  let nome: string | null = null;

  for (const riga of righe) {
    const ing = leggiIngrediente(riga);
    if (ing && ing.name.length >= 2) {
      ingredienti.push(ing);
      continue;
    }
    // La prima riga che non è un ingrediente è il nome del piatto; le altre sono contorno (pasto,
    // regime, stile) e si leggono cercandoci dentro le parole che contano.
    if (nome === null && !SLOT_DA_PAROLA.some(([r]) => r.test(riga)) && !REGIME_DA_PAROLA.some(([r]) => r.test(riga))) {
      nome = riga.replace(/^(ricetta|piatto)\s*[:\-]\s*/iu, '').replace(/[:\s]+$/, '').slice(0, 120);
      continue;
    }
    avanzo.push(riga);
  }

  const contorno = [...avanzo, nome ?? ''].join(' \n ');
  const slot = SLOT_DA_PAROLA.find(([r]) => r.test(contorno))?.[1] ?? null;
  const regime = REGIME_DA_PAROLA.find(([r]) => r.test(contorno))?.[1] ?? null;
  const tags = [...new Set(STILI.filter(([parola]) => contorno.toLowerCase().includes(parola)).map(([, tag]) => tag))];

  return { nome, ingredienti, slot, regime, tags };
}

/** Cosa manca per poterla scrivere. Elenco vuoto = si può procedere. */
export function cosaManca(r: RicettaDettata): string[] {
  const manca: string[] = [];
  if (!r.nome) manca.push('il nome del piatto');
  if (!r.ingredienti.length) manca.push('gli ingredienti, uno per riga con la quantità');
  if (!r.slot) manca.push('per quale pasto (colazione, spuntino, pranzo, merenda, cena)');
  if (!r.regime) manca.push('se è onnivora, vegetariana o vegana');
  return manca;
}
