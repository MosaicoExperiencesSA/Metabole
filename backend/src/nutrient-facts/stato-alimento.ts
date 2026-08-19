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

/**
 * ⚠️ NELLE RICETTE LE GRAMMATURE SONO A **CRUDO** — convenzione decisa da Simone il 19/8: «diamo
 * per assodato che gli ingredienti siano a crudo in tutte le ricette, come si fa nei libri».
 *
 * È una convenzione buona perché è **una sola**, ed è quella che una persona si aspetta: nei libri
 * di cucina «80 g di riso» sono 80 g di riso secco. Ma una convenzione vale solo se il codice la
 * rispetta, e qui c'è un punto in cui non la rispettava.
 *
 * ⚠️ **Il caso che conta.** La tabella nutrienti ha molte righe **solo da cotto**: pasta, riso,
 * quinoa, cuscus, orzo, farro, tutti i legumi, le patate — 37 righe su 96 dell'import verificato.
 * Contando «80 g di quinoa» con la riga bollita (120 kcal/100 g) si scrivono 96 kcal dove ce ne
 * sono ~284: **tre volte meno**, sull'ingrediente più pesante del piatto. Nessun errore, nessuna
 * riga rossa, un totale plausibile e sbagliato.
 *
 * ⚠️ **Senza stato non è «cotto»**: è «non lo so». Rifiutare anche quelle bloccherebbe quasi ogni
 * ricetta — nella tabella verificata quasi tutta la frutta e la verdura è `crudo`, ma le righe
 * arrivate da altre fonti lo stato non ce l'hanno. Si contano, **e si dice** che non sappiamo se
 * quel valore è a crudo: è la stessa regola che il modulo dei macro applica già ai millilitri e al
 * «sale q.b.» — un'approssimazione dichiarata è un dato, una nascosta è un errore.
 */
export const STATI_A_CRUDO = ['crudo', 'secco'];

/** Gli stati che vogliono dire «già cotto»: su una grammatura a crudo il loro numero non si usa. */
export const STATI_DA_COTTO = ['cotto', 'bollito'];

/**
 * ⚠️ LO STATO SI NORMALIZZA PRIMA DI CONFRONTARLO — e non è un dettaglio di stile.
 *
 * Il primo giro in produzione (19/8) ha bocciato **«quinoa (cruda)»**, **«patata dolce (cruda)»** e
 * **«patate (crude)»**: in tabella lo stato è scritto **al femminile e al plurale**, e il confronto
 * andava con `['crudo','secco']`. Tre alimenti a crudo dichiarati «solo da cotto» — cioè il codice
 * avrebbe rifiutato di scrivere una ricetta con la quinoa **proprio perché il dato era giusto**.
 *
 * ⚠️ E ha mostrato la seconda cosa: in tabella ci sono stati che **non parlano di cottura** —
 * `liquido` (i latti), `fresco` (ricotta, yogurt), `viscoso` (sciroppo d'acero), `tostato` (gli
 * anacardi). Trattarli come «cotto» bloccava il latte, che crudo o cotto non è: per il latte la
 * domanda non esiste. Qui diventano «non lo so» — si contano e si dichiarano — che è la risposta
 * onesta: sono stati che nessuno ha mai definito rispetto alla convenzione delle grammature.
 */
export function normalizzaStato(v: unknown): string {
  const t = (typeof v === 'string' ? v : '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (!t) return '';
  // ⚠️ La radice, non la parola intera: `crudo | cruda | crudi | crude` sono lo stesso stato, e
  // pretendere la forma esatta è il difetto che il 19/8 ha bocciato la quinoa.
  for (const radice of ['crud', 'secc', 'essicc', 'disidrat']) {
    if (t.startsWith(radice)) return radice === 'crud' ? 'crudo' : 'secco';
  }
  for (const radice of ['bollit', 'less']) if (t.startsWith(radice)) return 'bollito';
  for (const radice of ['cott', 'arrost', 'al forno']) if (t.startsWith(radice)) return 'cotto';
  // ⚠️ Tutto il resto NON è uno stato di cottura: `liquido`, `fresco`, `viscoso`, `tostato`. Non si
  // finge di saperlo — vedi `scegliPerRicetta`, dove diventa «non lo so».
  return 'altro';
}

export type EsitoPerRicetta<T extends RigaConStato> =
  /** Si può contare: la riga è a crudo (o a secco), come la ricetta. */
  | { tipo: 'va_bene'; riga: T }
  /** ⚠️ Si può contare, ma NON sappiamo se quel valore è a crudo: si conta e si dichiara. */
  | { tipo: 'stato_ignoto'; riga: T }
  /** ⚠️ In tabella c'è **solo da cotto**: contarla su una grammatura a crudo sbaglia di volte. */
  | { tipo: 'solo_cotto'; stati: string[] }
  | { tipo: 'niente' };

/**
 * Quale riga usare per **una ricetta**, dove per convenzione la grammatura è a crudo.
 *
 * ⚠️ Diverso da `scegliPerStato`, che serve a rispondere a una **domanda**: lì lo stato lo dice chi
 * chiede, e se non lo dice la risposta onesta è «dipende». Qui lo stato lo dice la convenzione, e la
 * risposta onesta quando la tabella ha solo il cotto non è «dipende»: è «questo numero non lo so».
 */
export function scegliPerRicetta<T extends RigaConStato>(candidati: readonly T[]): EsitoPerRicetta<T> {
  const righe = (candidati ?? []).filter(Boolean);
  if (!righe.length) return { tipo: 'niente' };
  const stato = (r: RigaConStato) => normalizzaStato(r.state);

  const aCrudo = righe.find((r) => STATI_A_CRUDO.includes(stato(r)));
  if (aCrudo) return { tipo: 'va_bene', riga: aCrudo };

  /**
   * ⚠️ «Non lo so» copre due casi, e sono la stessa cosa per chi legge: lo stato **manca**, oppure
   * c'è ma **non parla di cottura** (`liquido`, `fresco`, `tostato`). In tutti e due nessuno ha mai
   * detto se quel numero valga a crudo — e il latte crudo o cotto non è. Si conta e si dichiara.
   */
  const ignoto = righe.find((r) => stato(r) === '' || stato(r) === 'altro');
  if (ignoto) return { tipo: 'stato_ignoto', riga: ignoto };

  return { tipo: 'solo_cotto', stati: [...new Set(righe.map((r) => (r.state ?? '').trim().toLowerCase()))] };
}

/** La riga che Vera scrive quando di un alimento ha **solo** il valore da cotto. */
export function fraseSoloCotto(nomi: readonly string[]): string {
  const elenco = nomi.join(', ');
  const uno = nomi.length === 1;
  return (
    `⚠️ Di ${elenco} in tabella ho **solo il valore da cotto**, e nelle ricette le grammature sono a ` +
    `crudo: ${uno ? 'contarlo' : 'contarli'} così darebbe un totale molto più basso del vero (sul riso ` +
    'e sui legumi anche tre volte). Non li ho contati. Aggiungi la riga a crudo dalla pagina Alimenti ' +
    'e rifacciamo il conto.'
  );
}
