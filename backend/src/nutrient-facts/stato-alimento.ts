/**
 * CRUDO O COTTO: LO STESSO ALIMENTO, DUE NUMERI DIVERSI — voce 228.
 *
 * `NutrientFact.state` (crudo | bollito | cotto | secco | …) fa parte del **significato** dei
 * numeri, non è un'etichetta. Dalla tabella caricata da Simone il 18/8, scheda «Crudo ↔ cotto»:
 *
 *     farro perlato    crudo 353 kcal → bollito 127 kcal     rapporto 0,36×
 *
 * ⚠️ Vuol dire che dire il numero sbagliato **sbaglia di quasi tre volte**, e sbaglia sempre nello
 * stesso verso: il crudo pesa più del cotto a parità di grammi. Chi legge «80 g di farro = 282 kcal»
 * quando ne sta mangiando 102 non ha un'imprecisione, ha un altro pasto.
 *
 * ## Cosa faceva prima
 *
 * `cerca` prendeva **la prima riga che combacia col nome**. Con due righe «riso bianco» — una crudo
 * e una bollito — quale delle due rispondeva lo decideva l'ordine di lettura del database. Nessun
 * errore, nessuna riga rossa, un numero plausibile e sbagliato.
 *
 * ## Cosa fa questo modulo
 *
 * Se lo stato è **scritto nella domanda** («riso bollito», «farro crudo»), sceglie quella riga. Se
 * non è scritto e le righe sono più d'una con stati diversi, **non sceglie**: torna l'ambiguità, e
 * chi risponde dice «dipende se crudo o cotto» invece di un numero.
 *
 * ⚠️ Non sceglie «quello più probabile» e non prende il primo con una scusa migliore. Il difetto di
 * famiglia di questo progetto è un dato che agisce e non si vede: qui l'unica risposta onesta a
 * «riso, quante calorie?» è un'altra domanda.
 */

/** Gli stati, con le parole con cui compaiono in una domanda vera. L'ordine conta: le più
 *  specifiche prima, o «cotto» prenderebbe anche «stracotto» prima che «stracotto» sia guardato. */
const PAROLE_DI_STATO: { stato: string; parole: string[] }[] = [
  { stato: 'secco', parole: ['secco', 'secca', 'secchi', 'secche', 'essiccato', 'essiccata', 'essiccati', 'essiccate', 'disidratato', 'disidratata', 'disidratati', 'disidratate'] },
  { stato: 'bollito', parole: ['bollito', 'bollita', 'bolliti', 'bollite', 'lessato', 'lessata', 'lessati', 'lessate', 'lesso', 'lessa', 'lessi', 'lesse', 'in acqua'] },
  { stato: 'crudo', parole: ['crudo', 'cruda', 'crudi', 'crude', 'a crudo', 'da crudo'] },
  { stato: 'cotto', parole: ['cotto', 'cotta', 'cotti', 'cotte', 'da cotto', 'gia cotto', 'gia cotta'] },
];

const normalizza = (t: string): string =>
  (t ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Lo stato nominato nel testo, o `null` se non è nominato.
 *
 * ⚠️ Il confronto è **per parola**: «crudo» dentro «crudité» non è uno stato, e un confronto per
 * sottostringa avrebbe risposto con sicurezza a domande che non lo dicevano.
 */
export function statoNelTesto(testo: string): string | null {
  const t = ` ${normalizza(testo)} `;
  for (const s of PAROLE_DI_STATO) {
    if (s.parole.some((p) => t.includes(` ${p} `))) return s.stato;
  }
  return null;
}

/** Una riga della tabella, ridotta a quello che serve per scegliere. */
export interface RigaConStato {
  state?: string | null;
}

export type EsitoScelta<T extends RigaConStato> =
  | { tipo: 'unica'; riga: T }
  | { tipo: 'per_stato'; riga: T; stato: string }
  /** ⚠️ Più stati e la domanda non dice quale: NON si sceglie. */
  | { tipo: 'ambiguo'; stati: string[]; righe: T[] }
  | { tipo: 'niente' };

/**
 * Quale riga rispondere, fra quelle che combaciano col nome.
 *
 * ⚠️ Righe con lo **stesso** stato (o tutte senza stato) non sono ambigue: sono duplicati, e si
 * prende la prima. L'ambiguità è fra stati **diversi**, che è dove cambia il numero.
 */
export function scegliPerStato<T extends RigaConStato>(candidati: readonly T[], testo: string): EsitoScelta<T> {
  const righe = candidati.filter(Boolean);
  if (!righe.length) return { tipo: 'niente' };
  if (righe.length === 1) return { tipo: 'unica', riga: righe[0] };

  const stati = [...new Set(righe.map((r) => (r.state ?? '').trim().toLowerCase()).filter(Boolean))];
  if (stati.length <= 1) return { tipo: 'unica', riga: righe[0] };

  const chiesto = statoNelTesto(testo);
  if (chiesto) {
    const trovata = righe.find((r) => (r.state ?? '').trim().toLowerCase() === chiesto);
    if (trovata) return { tipo: 'per_stato', riga: trovata, stato: chiesto };
  }
  return { tipo: 'ambiguo', stati, righe: [...righe] };
}

/**
 * La riga che Gaia legge quando l'alimento è ambiguo.
 *
 * ⚠️ È un'ISTRUZIONE, non un dato: dice a chi risponde di **non dire numeri** e di chiedere. Messa
 * fra i dati, il modello la userebbe come contesto e un numero lo direbbe lo stesso — e la guardia
 * in uscita lo fermerebbe lasciando la cliente senza risposta, che è il peggiore dei tre esiti.
 */
export function fraseAmbiguita(nome: string, stati: readonly string[]): string {
  const elenco = stati.join(' o ');
  return (
    `di «${nome}» abbiamo i valori per ${elenco}, e cambiano molto (da crudo a bollito le kcal per ` +
    '100 g possono ridursi di quasi tre volte). ⚠️ NON dire nessun numero: chiedi prima se lo pesa ' +
    `${elenco}.`
  );
}
