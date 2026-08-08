/**
 * Cambio piatto concordato in chat con Gaia — LOGICA PURA.
 *
 * Il progetto sta in `progetto/PROGETTO_gaia-cambio-menu.md`. Qui c'è il pezzo che si può
 * testare senza database: il riconoscimento dell'intenzione, i motivi, il controllo di
 * plausibilità delle grammature e i testi che Gaia pronuncia.
 *
 * ## Perché il flusso è deterministico e non "chiedilo all'AI"
 *
 * Due ragioni, e la seconda è quella che decide.
 *
 * 1. In produzione l'AI generativa della chat è SPENTA: risponde solo se esistono sia
 *    `AI_API_KEY` su Render sia il parametro `ai_assistant_enabled = 'true'` (vedi
 *    `AiService.assistantEnabled`), e oggi il parametro vale `'false'`. Un ponte che
 *    funzionasse solo con l'AI accesa oggi non funzionerebbe affatto.
 * 2. Questo flusso SCRIVE sul menu di una cliente. Il passaggio da "conversazione" a
 *    "grammi nel piatto" deve essere codice leggibile e testabile, non un'inferenza:
 *    l'errore qui non è una frase goffa, è una porzione sbagliata.
 *
 * Quando l'AI verrà accesa riformulerà questi testi (è già il suo ruolo altrove: layer di
 * riformulazione sopra un contenuto deciso dal codice), senza toccare la decisione.
 *
 * ## Perché si chiede PERCHÉ e non "per quanto"
 *
 * Il pop-up precedente chiedeva la durata — oggi / questi giorni / per sempre — cioè la
 * CONSEGUENZA. La causa non l'abbiamo mai chiesta, e così «non ce l'ho in casa» (un problema
 * di martedì) e «mi resta sullo stomaco» (un segnale clinico) finivano nella stessa casella.
 * Qui la domanda è una sola, il motivo, e la durata la deduce il codice.
 */

/** La domanda che conta. La durata è la conseguenza, non la scelta della cliente. */
export type MotivoKey = 'non_disponibile' | 'non_piace' | 'digestione' | 'no_tempo';

/**
 * Per quanto vale il cambio.
 * - `oggi`: solo la giornata di oggi. Domani l'alimento torna.
 * - `sempre`: i giorni già erogati da oggi in poi, e l'alimento entra nei cibi non graditi
 *   del profilo, quindi esce dal pool di TUTTI i menu futuri.
 */
export type Durata = 'oggi' | 'sempre';

export interface Motivo {
  key: MotivoKey;
  /** Il numero con cui la cliente può rispondere. */
  numero: number;
  /** Come lo legge la cliente. */
  label: string;
  durata: Durata;
  /** Segnale clinico: apre una segnalazione alla nutrizionista. */
  clinico: boolean;
  /**
   * Dice qualcosa sui GUSTI. Solo questo autorizza a restringere i menu futuri: «non ce
   * l'ho in casa» non è un rifiuto, e trattarlo come tale impoverisce il menu per una
   * spesa saltata. (Su una cliente reale 13 esclusioni accumulate avevano ridotto a 1 su 5
   * i pranzi utilizzabili della sua dieta.)
   */
  gusto: boolean;
  pattern: RegExp;
}

/**
 * ⚠️ L'ordine di questo elenco è quello in cui la cliente li legge (1..4), NON l'ordine in cui
 * si riconoscono: per quello vale `PRIORITA_MOTIVI` qui sotto.
 */
export const MOTIVI: Motivo[] = [
  {
    key: 'non_disponibile',
    numero: 1,
    label: "non ce l'ho in casa",
    durata: 'oggi',
    clinico: false,
    gusto: false,
    pattern: /non ce l.?ho|non l.?ho compr|non l.?ho in casa|ho finit|e finit|manca|dimenticat|non l.?ho pres|non si trova|non ne ho/,
  },
  {
    key: 'non_piace',
    numero: 2,
    label: 'non mi piace',
    durata: 'sempre',
    clinico: false,
    gusto: true,
    pattern: /non mi piace|non mi piacciono|non mi va|non lo mangio|non la mangio|non li mangio|detest|odio|fa schifo|mi fa schifo|proprio no/,
  },
  {
    key: 'digestione',
    numero: 3,
    label: 'mi resta sullo stomaco o mi gonfia',
    durata: 'oggi',
    clinico: true,
    gusto: false,
    pattern: /stomaco|digeri|digest|gonfi|pesant|nausea|acidit|reflusso|bruciore|intestin|meteorism|mal di pancia|mi sento male dopo/,
  },
  {
    key: 'no_tempo',
    numero: 4,
    label: 'non ho tempo di cucinarlo',
    durata: 'oggi',
    clinico: false,
    gusto: false,
    pattern: /non ho tempo|troppo tempo|troppo lung|ci vuole tropp|di frett|non riesco a cucin|non ho voglia di cucin|troppo complicat|troppo elaborat/,
  },
];

/**
 * Ordine di RICONOSCIMENTO dei motivi, che non è quello in cui la cliente li legge.
 *
 * Il clinico va guardato per primo, e non è un dettaglio: è il difetto che questo progetto
 * nasce per chiudere. «Non mi piace, mi resta sullo stomaco» contiene entrambe le cose, e
 * scorrendo l'elenco nell'ordine dei numeri vincerebbe «non mi piace» — cioè il segnale
 * clinico finirebbe nella casella dei gusti, senza segnalazione alla nutrizionista, con
 * l'aggravante di un'esclusione permanente. Esattamente quello che succedeva prima.
 */
const PRIORITA_MOTIVI: MotivoKey[] = ['digestione', 'non_piace', 'non_disponibile', 'no_tempo'];

export const SLOT_LABEL: Record<string, string> = {
  breakfast: 'colazione',
  morning_snack: 'spuntino del mattino',
  lunch: 'pranzo',
  afternoon_snack: 'spuntino del pomeriggio',
  dinner: 'cena',
};

export const etichettaSlot = (slot: string): string => SLOT_LABEL[slot] ?? slot;

/**
 * «a colazione», «a pranzo», «allo spuntino del mattino». La preposizione sta in tabella e non
 * si calcola: «colazione» è femminile e «pranzo» maschile, e una regola sul genere dedotta dal
 * nome dello slot produceva «nello colazione».
 */
const SLOT_IN: Record<string, string> = {
  breakfast: 'a colazione',
  morning_snack: 'allo spuntino del mattino',
  lunch: 'a pranzo',
  afternoon_snack: 'allo spuntino del pomeriggio',
  dinner: 'a cena',
};

export const nelloSlot = (slot: string): string => SLOT_IN[slot] ?? `nel ${etichettaSlot(slot)}`;

/** Passo del dialogo. Lo stato vive nel `meta` dell'ultimo messaggio di Gaia: niente tabelle. */
export type PassoSostituzione = 'cibo' | 'motivo' | 'conferma';

export interface PropostaSostituzione {
  /** Giornata su cui si scrive (YYYY-MM-DD): quella di oggi. */
  data: string;
  slot: string;
  recipeId: string;
  /** Nome del piatto, per i testi e per la scheda cliente. */
  piatto: string;
  /** Ingrediente da togliere, col nome che ha nella ricetta. */
  da: string;
  /** Sostituto proposto. */
  a: string;
  qtaDa?: number;
  qtaA?: number;
  unita?: string;
  /** Vero se `qtaA` è stata riportata a pari grammatura dal controllo di plausibilità. */
  grammaturaCorretta?: boolean;
}

export interface StatoSostituzione {
  passo: PassoSostituzione;
  /** Come l'ha scritto la cliente. */
  cibo?: string;
  motivo?: MotivoKey;
  /** Risposte non capite di fila: a 2 il flusso si arrende e passa alla coach. */
  tentativi?: number;
  proposta?: PropostaSostituzione;
}

/** Oltre questo, lo stato appeso a un messaggio vecchio non è più una conversazione in corso. */
export const SCADENZA_FLUSSO_MS = 60 * 60 * 1000;

const normalizza = (testo: string): string =>
  (testo ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

/**
 * Intenzione di sostituire, riconosciuta dal testo libero. Volutamente NARROW: pretende un
 * verbo esplicito di sostituzione. Il punto d'ingresso normale è il pulsante dell'app, e un
 * riconoscimento generoso qui dirotterebbe conversazioni che non c'entrano dentro un dialogo
 * a domande chiuse — un danno peggiore del non averlo riconosciuto.
 */
const INTENTO: RegExp[] = [
  /sostitui/,
  /(voglio|vorrei|posso|potrei|si pu[oò]|come faccio a?|c.e modo di) .{0,14}(cambiar|sostituir|toglier|levar)/,
  /cambiare (un |una |l.|lo |la |il |le |i |gli )?(ingrediente|aliment|cibo)/,
  // «al posto di» da solo non basta: «ho mangiato una banana al posto della mela, va bene?» è un
  // resoconto, non una richiesta, e aprirle un dialogo a domande chiuse sopra sarebbe peggio che
  // non averla capita. Serve un marcatore di richiesta davanti.
  /(cosa|che cosa|posso|potrei|vorrei|si pu[oò]|metto|mettere).{0,30}al posto (di|del|della|delle|dei|degli)/,
];

export function rilevaIntentoSostituzione(testo: string): boolean {
  const t = normalizza(testo);
  return INTENTO.some((p) => p.test(t));
}

export function riconosciMotivo(testo: string): Motivo | null {
  const t = normalizza(testo);
  // Prima il numero: è la risposta che suggeriamo, e "1" non deve finire su una regex.
  const soloNumero = t.match(/^\(?([1-4])\)?[.)]?$/);
  if (soloNumero) return MOTIVI.find((m) => m.numero === Number(soloNumero[1])) ?? null;
  // Poi le parole, in ordine di PRIORITÀ e non di numero: vedi `PRIORITA_MOTIVI`.
  for (const key of PRIORITA_MOTIVI) {
    const m = MOTIVI.find((x) => x.key === key);
    if (m && m.pattern.test(t)) return m;
  }
  return null;
}

export function riconosciConferma(testo: string): 'si' | 'no' | null {
  const t = normalizza(testo);
  if (/^(si|s|ok|okey|okay|va bene|confermo|conferma|certo|perfetto|d.accordo|procedi|yes|ci sta|volentieri|grazie si)\b/.test(t)) {
    return 'si';
  }
  if (/^(no|nn|annulla|lascia stare|lascia perdere|niente|nulla|non importa|meglio no|aspetta|fermati|stop)\b/.test(t)) {
    return 'no';
  }
  return null;
}

/** Parole di servizio: da sole non identificano un alimento. */
const STOPWORDS = new Set([
  'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una', 'del', 'dello', 'della', 'dei',
  'degli', 'delle', 'di', 'da', 'per', 'con', 'senza', 'nel', 'nella', 'nei', 'sul', 'sulla',
  'che', 'non', 'mi', 'ho', 'ce', 'ci', 'e', 'ed', 'o', 'ma', 'al', 'allo', 'alla', 'ai',
  'agli', 'alle', 'questo', 'questa', 'quello', 'quella', 'oggi', 'domani', 'menu', 'piatto',
  'pasto', 'pranzo', 'cena', 'colazione', 'spuntino', 'ricetta', 'vorrei', 'voglio', 'posso',
  'cambiare', 'cambio', 'sostituire', 'sostituisci', 'togliere', 'togli', 'grammi', 'grammo',
  'quantita', 'proprio', 'tanto', 'poco', 'molto', 'sono', 'sto', 'una', 'anche',
]);

/**
 * Termini con cui provare a riconoscere l'alimento dentro il menu vero: prima le coppie di
 * parole (gli ingredienti reali sono «petto di pollo», non «pollo»), poi le singole.
 *
 * L'abbinamento lo fa il chiamante contro gli ingredienti della giornata, non una regex: è
 * l'unico modo per essere sicuri che il cambio riguardi un alimento che la cliente ha
 * davvero nel piatto oggi.
 */
export function terminiCandidati(testo: string): string[] {
  const parole = normalizza(testo)
    .replace(/[^a-z0-9\s']/g, ' ')
    .split(/\s+/)
    .filter((p) => p.length >= 3 && !STOPWORDS.has(p));
  const coppie: string[] = [];
  for (let i = 0; i < parole.length - 1; i += 1) coppie.push(`${parole[i]} ${parole[i + 1]}`);
  // Le coppie prima: più specifiche, quindi meno ambigue.
  return [...new Set([...coppie, ...parole])];
}

/** Parole di servizio dentro il NOME di un alimento: da sole non lo identificano. */
const PAROLE_NEUTRE = new Set(['di', 'del', 'della', 'dei', 'delle', 'con', 'alla', 'allo', 'ben', 'tipo']);

/**
 * Radice grezza: toglie la vocale finale alle parole lunghe, così «carote» e «carota» coincidono
 * senza dover elencare i plurali. Le parole corte non si toccano — accorciare «pepe» a «pep» è
 * proprio il modo di farlo combaciare con «peperoni».
 */
export function radice(parola: string): string {
  const p = normalizza(parola);
  return p.length >= 5 && /[aeio]$/.test(p) ? p.slice(0, -1) : p;
}

/** Le parole che portano significato dentro il nome di un alimento. */
export function paroleAlimento(nome: string): string[] {
  return normalizza(nome)
    .replace(/[^a-z0-9\s']/g, ' ')
    .split(/\s+/)
    .filter((p) => p.length >= 3 && !PAROLE_NEUTRE.has(p));
}

/**
 * Vero se il termine scritto dalla cliente indica quell'ingrediente.
 *
 * Il confronto è PER PAROLA, non per sottostringa, e questa è la riga che conta di più in tutto
 * il file. Con `nome.includes(termine)` «pepe» combaciava con «peperoni»: il cancello delle
 * spezie non scattava (viene interrogato sul nome trovato, e «peperoni» non è una spezia) e la
 * cliente che voleva togliere il pepe si vedeva sostituire i peperoni — e, con «non mi piace»,
 * escludere i peperoni per sempre. È esattamente il caso che `spezie.ts` dichiara di temere:
 * «"pepe" è una spezia, "peperoni" sono una verdura». Stessa storia con «mela» e «melanzane».
 */
export function combaciaAlimento(nomeIngrediente: string, termine: string): boolean {
  const nome = normalizza(nomeIngrediente);
  const t = normalizza(termine);
  if (!nome || !t) return false;
  if (radice(nome) === radice(t)) return true;
  const paroleN = paroleAlimento(nomeIngrediente).map(radice);
  const paroleT = paroleAlimento(termine).map(radice);
  if (!paroleN.length || !paroleT.length) return false;
  // Ogni parola del termine deve trovare una parola dell'ingrediente: «yogurt greco» prende
  // «yogurt greco» e «yogurt», «pepe» non prende «peperoni».
  return paroleT.every((pt) => paroleN.includes(pt));
}

/**
 * Vero se due nomi di alimento condividono una parola: serve a scartare i sostituti che sono una
 * VARIANTE dello stesso cibo.
 *
 * `SUBSTITUTION_MAP` nasce per rendere un piatto sicuro con un'intolleranza, non per accontentare
 * un gusto: «yogurt» → «yogurt senza lattosio» risolve il lattosio e non risolve niente a chi lo
 * yogurt non piace, o a chi non ce l'ha in casa. Senza questo controllo Gaia rispondeva «metti
 * 150 g di yogurt senza lattosio al posto di 150 g di yogurt greco», che è una presa in giro.
 * Lo stesso per pane, pasta, pizza, panna, mozzarella, ricotta, formaggio, parmigiano.
 *
 * Conseguenza voluta: su quei cibi la mappa non offre più niente e la richiesta passa alla
 * nutrizionista. È la risposta onesta — l'alternativa giusta è cambiare piatto, che è mestiere
 * del motore, o un gruppo di equivalenza che il nutrizionista deve ancora scrivere.
 */
export function condividonoAlimento(a: string, b: string): boolean {
  const radiciA = new Set(paroleAlimento(a).map(radice));
  return paroleAlimento(b).map(radice).some((p) => radiciA.has(p));
}

/**
 * Controllo di plausibilità sui grammi (protezione richiesta dal progetto): una sostituzione
 * fuori scala — meno di un terzo o più del triplo della quantità di partenza — non entra da
 * sola. Un errore di battitura non deve diventare una porzione tripla.
 */
export function grammaturaAmmessa(qtaDa: number, qtaA: number): boolean {
  if (!Number.isFinite(qtaDa) || !Number.isFinite(qtaA) || qtaDa <= 0 || qtaA <= 0) return false;
  return qtaA >= qtaDa / 3 && qtaA <= qtaDa * 3;
}

/**
 * Grammatura da scrivere davvero. Fuori scala → si ripiega su pari grammatura e si segnala,
 * invece di rifiutare: la cliente ha ragione a voler cambiare l'alimento, è solo il numero
 * che non regge.
 */
export function correggiGrammatura(
  qtaDa: number | undefined,
  qtaProposta: number | undefined,
): { qta: number | undefined; corretta: boolean } {
  if (qtaDa === undefined || !Number.isFinite(qtaDa) || qtaDa <= 0) return { qta: undefined, corretta: false };
  if (qtaProposta === undefined) return { qta: qtaDa, corretta: false };
  if (grammaturaAmmessa(qtaDa, qtaProposta)) return { qta: qtaProposta, corretta: false };
  return { qta: qtaDa, corretta: true };
}

// ---------- Testi di Gaia ----------

const quantita = (qta?: number, unita?: string): string =>
  qta !== undefined && qta > 0 ? `${qta}${unita ? ` ${unita}` : ''} di ` : '';

const maiuscola = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export function testoChiediCibo(pasti: { slot: string; piatto: string }[]): string {
  if (!pasti.length) {
    return 'Per cambiare un alimento mi serve il menu di oggi, e adesso non lo vedo. Prova a riaprire la home: se resta vuoto scrivilo alla tua coach, ci pensiamo noi. 💚';
  }
  const elenco = pasti.map((p) => `${etichettaSlot(p.slot)}: ${p.piatto}`).join(' · ');
  return (
    'Certo, vediamo insieme. Quale alimento vuoi cambiare?\n\n' +
    `Oggi hai — ${elenco}.\n\n` +
    'Scrivimi solo il nome dell\'alimento (per esempio «le carote»).'
  );
}

export function testoCiboNonTrovato(cibo: string, ultimoTentativo: boolean): string {
  if (ultimoTentativo) {
    return `Continuo a non trovare «${cibo}» nel menu di oggi, e non voglio farti perdere tempo: ho girato la richiesta alla tua coach, che ti scrive nel vostro thread. 💚`;
  }
  return `Non trovo «${cibo}» tra gli ingredienti di oggi. Controlla come si scrive, oppure dimmi il piatto in cui l'hai visto.`;
}

export function testoChiediMotivo(p: PropostaSostituzione): string {
  const elenco = MOTIVI.map((m) => `${m.numero}) ${m.label}`).join('\n');
  return (
    `${maiuscola(nelloSlot(p.slot))} (${p.piatto}) ci sono ${quantita(p.qtaDa, p.unita)}${p.da}.\n\n` +
    'Perché lo vuoi cambiare? Te lo chiedo perché la risposta cambia per quanto vale il cambio.\n\n' +
    `${elenco}\n\nRispondi col numero, o a parole tue.`
  );
}

export function testoMotivoNonCapito(ultimoTentativo: boolean): string {
  if (ultimoTentativo) {
    return 'Non sono sicura di aver capito il motivo, e su questo non voglio indovinare: ne parli con la tua coach, le ho girato la richiesta. 💚';
  }
  return `Non ho capito il motivo. Rispondi con un numero: ${MOTIVI.map((m) => `${m.numero}) ${m.label}`).join(' · ')}.`;
}

const testoDurata = (durata: Durata): string =>
  durata === 'oggi' ? 'solo per oggi: domani torna come prima' : "da oggi in avanti, e non te lo propongo più nei menu nuovi";

export function testoConferma(p: PropostaSostituzione, motivo: Motivo): string {
  const daQta = quantita(p.qtaDa, p.unita);
  const aQta = quantita(p.qtaA, p.unita);
  return (
    `Allora facciamo così: ${nelloSlot(p.slot)} metti ` +
    `${aQta}${p.a} al posto di ${daQta}${p.da} — ${testoDurata(motivo.durata)}.\n\n` +
    'Confermi? (sì / no)'
  );
}

export function testoAnnullato(): string {
  return 'Va bene, non cambio niente: il menu di oggi resta com\'è. Se cambi idea sono qui. 💚';
}

export function testoFatto(p: PropostaSostituzione, motivo: Motivo): string {
  const aQta = quantita(p.qtaA, p.unita);
  let out =
    `Fatto: il menu di oggi è aggiornato. ${maiuscola(nelloSlot(p.slot))} ` +
    `trovi ${aQta}${p.a} al posto ${/^[aeiou]/i.test(p.da) ? "dell'" : 'di '}${p.da}.`;
  if (motivo.durata === 'sempre') out += ` E «${p.da}» non lo metterò più nei tuoi menu nuovi.`;
  if (p.grammaturaCorretta) out += ' Ho tenuto la stessa grammatura: la tua nutrizionista la ricontrolla.';
  if (motivo.clinico) {
    out +=
      '\n\nUna cosa importante: «mi resta sullo stomaco» non è una questione di gusto, quindi l\'ho segnalata alla tua nutrizionista. Ti scriverà lei.';
  }
  return out;
}

/**
 * Il cambio c'era già: succede quando la cliente riconferma. Dirle «il menu è cambiato e non ho
 * toccato niente» sarebbe falso — il cambio c'è, l'ha chiesto lei.
 */
export function testoGiaFatto(p: PropostaSostituzione): string {
  return `Quel cambio c'è già: ${nelloSlot(p.slot)} trovi ${quantita(p.qtaA, p.unita)}${p.a}. Non ho fatto niente di nuovo. 💚`;
}

export function testoNessunSostituto(cibo: string): string {
  return `Su «${cibo}» preferisco non decidere da sola: non ho un'alternativa che mi convinca del tutto. Ho girato la richiesta alla tua nutrizionista, che ti risponde nel vostro thread. 🩺`;
}

export function testoAllergene(cibo: string): string {
  return `Non posso proporti un sostituto per «${cibo}» senza rischiare di toccare una cosa a cui sei allergica, e su questo non si media. Ne ho scritto alla tua nutrizionista: decide lei. 🩺`;
}
