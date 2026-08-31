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

import { quantitaScalata } from './porzione-scalata';

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

/**
 * Passo del dialogo. Lo stato vive nel `meta` dell'ultimo messaggio di Gaia: niente tabelle.
 *
 * Due passi nascono dalle conversazioni vere dell'8/8, ed è utile ricordare da quale difetto:
 * - `scelta_piatto`: la cliente non vuole un ingrediente diverso, vuole **un altro piatto**. Gaia
 *   propone due alternative approvate e aspetta un numero.
 * - `rifiuto`: la cliente ha risposto «no perché non voglio 70 gr di burro» e Gaia ha chiuso con
 *   «va bene, non cambio niente», lasciandola col piatto che non voleva. Simone: «quando la cliente
 *   dice no non si deve fermare, deve indagare sul perché». Un «no» alla proposta non è un «no» al
 *   cambio: quasi sempre vuol dire *non quel sostituto*. Qui si chiede quale delle tre cose è.
 */
export type PassoSostituzione =
  | 'cibo'
  | 'motivo'
  | 'conferma'
  | 'scelta_piatto'
  | 'rifiuto'
  /**
   * «Lo voglio diverso» senza dire di quale pasto. Prima si ripiegava sulla domanda
   * dell'ingrediente — una domanda diversa da quella che serviva — o, peggio, si scegliva il pasto
   * per lei. Qui si chiede quale, con l'elenco di oggi.
   */
  | 'scelta_pasto'
  /**
   * «Sostituisco tutto il pasto con X, Y e Z». Il bivio chiesto da Simone il 12/8: prima di
   * arrendersi e passare alla nutrizionista, si chiede se è quello che vuole **oppure** se
   * preferisce un'alternativa scelta da Gaia fra i piatti approvati per lei, a pari calorie.
   * Prima questa richiesta finiva dentro la ricerca dell'ingrediente, e ne usciva un pasto a caso.
   */
  | 'pasto_intero'
  /**
   * Cambio della COLAZIONE senza una preferenza detta: «la vuoi dolce o salata?» (Simone, 14/8).
   * La risposta filtra le alternative per i tag di Lucia (`piatto:dolce`/`piatto:salato`).
   */
  | 'colazione_gusto'
  /**
   * ⛔ **LE DUE DOMANDE A NUMERI, PRIMA DELL'ALIMENTO** — Simone, 24/8: *«questa domanda non
   * funziona, Gaia si perde, miglioriamola così: (domanda uno) su quale menu vuoi lavorare? 1 oggi
   * 2 domani 3 dopodomani; (domanda due) di quale pasto parliamo? 1 Colazione 2 spuntino…; e con lo
   * stesso principio mettiamo l'elenco dei cibi, in modo che la cliente scriva dei numeri»*.
   *
   * Prima Gaia apriva con **una** domanda sola — «quale alimento vuoi cambiare?» — e sotto ci
   * incollava l'intera giornata: «colazione: Ricotta fresca con prugne secche reidratate e pane di
   * segale · pranzo: Pasta integrale al branzino e pomodorini · cena: Filetto di salmone con
   * asparagi e limone». Tre piatti, quindici alimenti, e alla cliente si chiedeva di **scriverne uno
   * a mano**: se sbagliava una parola («il pane di segale» invece di «pane»), o nominava il piatto,
   * la conversazione ripartiva — e al secondo tentativo passava alla coach.
   *
   * ⚠️ Un numero non si scrive male. E ogni elenco è quello **vero** di quella cliente: i giorni che
   * vede davvero (chi ha solo oggi non si sente chiedere «1 oggi»), i pasti che ha quel giorno,
   * gli alimenti di **quel** piatto — sostituzioni già concordate comprese.
   *
   * ⚠️ **Le parole continuano a funzionare** in tutti e tre i passi: chi scrive «domani», «a pranzo»
   * o «le carote» va avanti come prima. I numeri sono la strada facile, non l'unica.
   */
  | 'giorno'
  | 'pasto';

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
  /** Unità della quantità di partenza. */
  unita?: string;
  /** Unità del sostituto, se diversa (vedi `unitaPerSostituto`). Assente = la stessa. */
  unitaA?: string;
  /** Vero se `qtaA` è stata riportata a pari grammatura dal controllo di plausibilità. */
  grammaturaCorretta?: boolean;
  /**
   * IL FATTORE DI PORZIONE DEL PIATTO — quello con cui si **dicono** le grammature (19/8, decisione
   * di Simone: «il numero del piatto»).
   *
   * ⚠️ `qtaDa` e `qtaA` restano di **catalogo**, e devono restarci: sono i numeri che finiscono
   * nella sostituzione scritta sul menu, e il piatto viene scalato al momento di mostrarlo. Se qui
   * si salvasse il numero già scalato, il piatto verrebbe scalato **due volte** — 120 g diventano
   * 216, poi 389 — e nessuno se ne accorgerebbe finché una cliente non cucina.
   *
   * Quindi il fattore viaggia accanto ai numeri di catalogo, e si applica **solo quando si parla**.
   * `1` (o assente) = questo piatto non è scalato, e si dice il numero di catalogo.
   */
  fattore?: number;
}

/**
 * ⚠️ **Quanti motivi al massimo in una riga sola.** Oltre, si smette di accodare e lo si scrive.
 */
export const TETTO_MOTIVI = 5;

/**
 * Il testo nuovo di una segnalazione a cui si accoda un motivo, o `null` se non c'è niente da
 * scrivere (motivo già presente, oppure tetto raggiunto e già dichiarato).
 *
 * ⚠️ **`null` e non il testo invariato**: chi chiama fa una `update` sul database, e una scrittura
 * che non cambia niente è comunque una scrittura — con il suo rischio di corsa e la sua riga di
 * log. Distinguere «non c'è niente da fare» da «ecco cosa scrivere» è il modo di non farla.
 */
export function accodaMotivo(attuale: string, motivo: string): string | null {
  const nuovo = (motivo ?? '').trim();
  if (!nuovo) return null;
  const testo = (attuale ?? '').trim();
  if (!testo) return nuovo;
  const righe = testo.split('\n').filter((r) => r.trim());
  /**
   * Già scritto: la stessa richiesta ripetuta non si accoda due volte.
   *
   * ⚠️ **Il confronto è sulla RIGA INTERA, non `includes`** — corretto in revisione, 25/8. Con
   * `testo.includes(nuovo)` un motivo che fosse **sottostringa** di uno già scritto spariva senza
   * traccia: «Cambio in chat: «panna»» dentro «Cambio in chat: «panna» → «olio»». Sono due
   * richieste diverse, e la seconda non sarebbe arrivata a nessuno.
   */
  const gia = (r: string) => r.replace(/^·\s*/, '').trim() === nuovo;
  if (righe.some(gia)) return null;
  /**
   * ⚠️ **Il tetto conta i motivi ACCODATI DA NOI**, non le righe del testo — corretto in revisione,
   * 25/8. Una segnalazione di categoria «other» può portare il testo di un altro sottosistema, che
   * di righe ne ha le sue: contandole tutte, il tetto scattava a caso e la stessa cliente si vedeva
   * troncata sulla segnalazione e non su Vera, dove il testo è vergine. I due tavoli divergevano.
   */
  const nostri = righe.filter((r) => r.trimStart().startsWith('·')).length;
  if (nostri >= TETTO_MOTIVI) {
    const avviso = "· … e altre richieste della cliente in chat: aprile dalla sua scheda.";
    return testo.includes(avviso) ? null : `${testo}\n${avviso}`;
  }
  return `${testo}\n· ${nuovo}`;
}

/**
 * La proposta **senza il sostituto**: quello che resta uguale quando l'alimento cambia.
 *
 * ⚠️ Serve a rifare una proposta con un altro sostituto passando dall'unico punto che sa costruirla
 * (`conSostituto`). Toglie i quattro campi che **dipendono dal sostituto** — nome, quantità, unità
 * e il flag della grammatura corretta — perché tenerne anche uno solo vuol dire riportarsi dietro
 * il numero dell'alimento di prima: è così che 70 ml di panna diventavano «52 g di olio».
 */
export function senzaSostituto(
  p: PropostaSostituzione,
): Omit<PropostaSostituzione, 'a' | 'qtaA' | 'unitaA' | 'grammaturaCorretta'> {
  const { a: _a, qtaA: _qtaA, unitaA: _unitaA, grammaturaCorretta: _corretta, ...resto } = p;
  return resto;
}

export interface StatoSostituzione {
  passo: PassoSostituzione;
  /** Come l'ha scritto la cliente. */
  cibo?: string;
  motivo?: MotivoKey;
  /** Risposte non capite di fila: a 2 il flusso si arrende e passa alla coach. */
  tentativi?: number;
  proposta?: PropostaSostituzione;
  /** Ramo «altro piatto»: le alternative proposte, nell'ordine mostrato alla cliente. */
  alternativePiatto?: { recipeId: string; nome: string; kcal: number }[];
  /** Lo slot su cui si sta cambiando il piatto (la proposta riguarda quello). */
  slotPiatto?: string;
  /** Il piatto attuale, per registrare il cambio e per i testi. */
  piattoAttuale?: { recipeId: string; nome: string; kcal: number };
  /** Che cosa aveva chiesto: serve nel testo e finisce nel registro del cambio. */
  preferenzaPiatto?: string | null;
  /** Il gusto scelto per la colazione («dolce»/«salato»), quando la domanda è stata fatta. */
  gustoColazione?: string | null;
  /**
   * Sostituti che la cliente ha già rifiutato in questa conversazione. Servono per non riproporre
   * il burro dopo che ha detto «non voglio il burro» — e restano QUI, nella conversazione, senza
   * finire nei cibi non graditi del profilo: quel campo restringe i menu futuri, e un alimento
   * scartato in una proposta non è un gusto dichiarato su un alimento che ha nel piatto.
   */
  scartati?: string[];
  /**
   * I pasti di oggi, come sono stati elencati alla cliente quando le si è chiesto **quale** pasto
   * vuole cambiare: l'ordine è quello che ha letto, quindi «2» qui vuol dire la seconda riga di
   * quel messaggio. Rileggerli dal database al giro dopo darebbe un ordine che nessuno ha visto.
   */
  pastiPerScelta?: { slot: string; piatto: string }[];
  /**
   * I GIORNI proposti al passo «su quale menu vuoi lavorare?», in ISO e **nell'ordine mostrato**:
   * «2» vuol dire la seconda riga di quel messaggio. Stessa ragione di `pastiPerScelta` — rileggerli
   * al giro dopo darebbe un ordine che nessuno ha visto.
   */
  giorniPerScelta?: string[];
  /**
   * Gli ALIMENTI elencati al passo «quale vuoi cambiare?», nell'ordine mostrato. Sono i nomi veri
   * degli ingredienti del piatto, sostituzioni già concordate comprese.
   */
  cibiPerScelta?: string[];
  /**
   * La giornata di cui si sta parlando, `YYYY-MM-DD` (§16.2). Assente = oggi, che è il caso di
   * tutte le conversazioni aperte prima e il valore predefinito di tutte le altre.
   */
  data?: string;
  /**
   * L'ULTIMA domanda che Gaia ha fatto, parola per parola.
   *
   * Serve a una cosa sola, ed è la richiesta di Simone del 12/8: quando la risposta non si capisce,
   * si dice «perdonami, non ho capito, la mia domanda è…» e si **ripete quella domanda**, identica.
   * Ricostruirla darebbe un testo leggermente diverso, e chi non aveva capito la prima volta non
   * saprebbe più se è la stessa domanda o una nuova.
   */
  ultimaDomanda?: string;
}

/**
 * ⛔ **IL CONTESTO DI UN «1», per chi legge la chat dello staff.**
 *
 * Simone, 31/8, guardando la conversazione con Sonia: *«se il nutrizionista legge 1 e 2 come fa a
 * capire di cosa si parla? mettiamo un breve riassunto — la signora Romina vuole correggere il
 * pollo nel pranzo di domani»*.
 *
 * I numeri nascono dagli elenchi numerati che Gaia mostra alla cliente (voluti da Simone il 24/8,
 * §170 qui sopra): nella chat con Gaia hanno un senso, perché la domanda è la riga sopra. Ma il
 * messaggio viene **inoltrato** nel thread della coach o della nutrizionista, e lì arriva **nudo**:
 * un «1» senza niente intorno.
 *
 * ⚠️ La frase **non si inventa e non si ricostruisce a mano**: tutto quello che serve è già nello
 * stato del dialogo — il giorno, il pasto, il piatto, l'alimento come l'ha scritto lei — e
 * `ultimaDomanda` porta perfino la domanda di Gaia parola per parola. Qui si mette in fila quello
 * che c'è: se non c'è niente, `null`, e nella chat non compare nessuna riga inventata.
 */
export function contestoPerLoStaff(
  stato: StatoSostituzione | null | undefined,
  oggiIso: string,
): string | null {
  if (!stato) return null;
  const quando = stato.data ? etichettaGiorno(stato.data, oggiIso) : null;
  const dove = stato.slotPiatto ? etichettaSlot(stato.slotPiatto) : null;
  const piatto = stato.piattoAttuale?.nome;
  /** «pranzo di domani», «pranzo», «domani» — quello che si sa, senza buchi da riempire. */
  const momento = [dove, quando].filter(Boolean).join(' di ');

  let cosa: string | null = null;
  if (stato.proposta?.da && stato.proposta?.a) {
    cosa = `Vuole cambiare «${stato.proposta.da}» con «${stato.proposta.a}»`;
  } else if (stato.cibo) {
    cosa = `Vuole cambiare «${stato.cibo}»`;
  } else if (momento) {
    cosa = 'Sta cambiando un piatto';
  }
  if (!cosa && !stato.ultimaDomanda) return null;

  /**
   * ⚠️ Il momento si attacca col trattino e non con una preposizione: «nel **cena** di oggi» era il
   * primo tentativo, e per dirlo bene servirebbe sapere il genere di ogni pasto — una tabella di
   * articoli da tenere aggiornata per guadagnare niente.
   */
  const prima = cosa
    ? `${cosa}${momento ? ` — ${momento}` : ''}${piatto ? `, «${piatto}»` : ''}.`
    : null;
  /**
   * ⚠️ La domanda di Gaia va messa **per intero e fra virgolette**: è l'unica cosa che dà un senso
   * al numero, e riassumerla vorrebbe dire far indovinare a chi legge quale riga era la «2».
   */
  const dopo = stato.ultimaDomanda ? `Gaia le aveva chiesto: «${stato.ultimaDomanda.trim()}»` : null;
  return [prima, dopo].filter(Boolean).join(' ') || null;
}

/** Oltre questo, lo stato appeso a un messaggio vecchio non è più una conversazione in corso. */
export const SCADENZA_FLUSSO_MS = 60 * 60 * 1000;

/**
 * Il confronto fra nomi di alimento vive in `common/nomi-alimento.ts` da §16.9: da quando esiste
 * la tabella delle sostituzioni non lo interroga più solo il dialogo in chat, ma anche
 * «promuovi a regola» — e importare il file della chat da lì sarebbe stato il primo passo verso
 * una seconda copia leggermente diversa. Si ri-esportano perché mezzo `menu/` li importa da qui.
 */
import {
  combaciaAlimento,
  condividonoAlimento,
  normalizza,
  paroleAlimento,
  radice,
} from '../common/nomi-alimento';

export { combaciaAlimento, condividonoAlimento, normalizza, paroleAlimento, radice };

// Gli aggettivi che descrivono un cibo senza nominarlo: vedi il riquadro di `ascolto.ts`, che
// racconta la conversazione in cui «cruda» è stata scambiata per un ingrediente.
import { QUALIFICATORI } from './ascolto';
import { etichettaGiorno } from './giorno-conversazione';

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
  // Verbi e avverbi con cui si PROPONE qualcosa. Aggiunti col riconoscimento della controproposta
  // (9/8): senza di loro «posso usare il burro vegetale?» produceva anche il termine «usare», che
  // non combacia con niente in catalogo e faceva finire alla nutrizionista una richiesta che era
  // già stata capita. Nessuno di questi è il nome di un alimento.
  'usare', 'uso', 'usiamo', 'userei', 'mettere', 'metto', 'mettiamo', 'metterei', 'preferirei',
  'preferisco', 'invece', 'piuttosto', 'magari', 'andrebbe', 'bene', 'peso', 'forse', 'boh', 'mah',
  'grazie', 'allora', 'ecco', 'davvero', 'sicura', 'certo',
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
  // L'apostrofo si tratta come uno spazio, e non è un dettaglio ortografico: prima restava dentro
  // la parola, quindi «l'olio» era un token a sé — non combaciava con «olio evo», e chi scriveva
  // «vorrei togliere l'olio» si sentiva rispondere che non lo trovava fra gli ingredienti di oggi.
  // In italiano l'elisione è la norma («l'uovo», «l'avena», «dell'olio»). Gli articoli elisi
  // restano fuori da soli, perché più corti di tre lettere; «all'aglio» diventa «aglio».
  const parole = normalizza(testo)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((p) => p.length >= 3 && !STOPWORDS.has(p));
  const coppie: string[] = [];
  for (let i = 0; i < parole.length - 1; i += 1) coppie.push(`${parole[i]} ${parole[i + 1]}`);
  /**
   * ⚠️ Le singole perdono i QUALIFICATORI, le coppie no.
   *
   * «cruda» da sola non è un alimento: descrive un alimento. Lasciandola passare, la frase «voglio
   * cambiare il menu di oggi a pranzo con verdura cruda e tonno al naturale» produceva il termine
   * «cruda», che combacia con la «quinoa cruda» della CENA — e la cliente si sentiva rispondere di
   * un pasto di cui non aveva parlato (12/8, conversazione girata da Simone).
   * Le coppie restano intatte perché «verdura cruda» e «tonno naturale» sono nomi di ingredienti
   * veri, e vengono provate per prime.
   */
  const singole = parole.filter((p) => !QUALIFICATORI.has(radice(p)));
  // Le coppie prima: più specifiche, quindi meno ambigue.
  return [...new Set([...coppie, ...singole])];
}

// `radice`, `paroleAlimento`, `combaciaAlimento` e `condividonoAlimento` stanno ora in
// `common/nomi-alimento.ts` (§16.9) e sono ri-esportate in testa a questo file: mezzo `menu/` le
// importa da qui, e spostarle senza ri-esportarle avrebbe voluto dire toccare otto file per niente.
// Il perché del confronto per parola — «pepe» ⊄ «peperoni» — è scritto lì, in testa.

/**
 * Controllo di plausibilità sui grammi (protezione richiesta dal progetto): una sostituzione
 * fuori scala — meno di un terzo o più del triplo della quantità di partenza — non entra da
 * sola. Un errore di battitura non deve diventare una porzione tripla.
 */
export function grammaturaAmmessa(qtaDa: number, qtaA: number, minimo = 1 / 3): boolean {
  if (!Number.isFinite(qtaDa) || !Number.isFinite(qtaA) || qtaDa <= 0 || qtaA <= 0) return false;
  /**
   * ⚠️ **La soglia inferiore si può allargare, quella superiore no** (25/8, risposta di Nocanty).
   *
   * Lui ha chiesto **0,20** al posto di un terzo *«per tutti i prodotti in cui il numero di
   * equivalenza è esplicitamente dichiarato»*, e la ragione è che questo controllo, scattando,
   * **ripiega su pari grammatura** — cioè sull'errore che i fattori esistono per togliere. Un limite
   * che quando morde riporta al difetto è peggio di nessun limite.
   *
   * ⚠️ Il tetto resta il triplo per tutti: là il difetto è una porzione tripla in tavola, e nessun
   * numero di equivalenza lo giustifica.
   */
  const sotto = Number.isFinite(minimo) && minimo > 0 ? minimo : 1 / 3;
  return qtaA >= qtaDa * sotto && qtaA <= qtaDa * 3;
}

/**
 * Grammatura da scrivere davvero. Fuori scala → si ripiega su pari grammatura e si segnala,
 * invece di rifiutare: la cliente ha ragione a voler cambiare l'alimento, è solo il numero
 * che non regge.
 */
export function correggiGrammatura(
  qtaDa: number | undefined,
  qtaProposta: number | undefined,
  minimo?: number,
): { qta: number | undefined; corretta: boolean } {
  if (qtaDa === undefined || !Number.isFinite(qtaDa) || qtaDa <= 0) return { qta: undefined, corretta: false };
  if (qtaProposta === undefined) return { qta: qtaDa, corretta: false };
  if (grammaturaAmmessa(qtaDa, qtaProposta, minimo)) return { qta: qtaProposta, corretta: false };
  return { qta: qtaDa, corretta: true };
}

/**
 * L'unità con cui esprimere il SOSTITUTO.
 *
 * Difetto visto l'8/8 nella conversazione vera: Gaia ha proposto «70 ml di burro al posto di 70 ml
 * di panna fresca», e la cliente ha risposto parlando di «70 gr di burro» — perché il burro in
 * millilitri non esiste. L'unità veniva copiata dall'ingrediente di partenza, e su una coppia
 * liquido → solido copiarla è sbagliato.
 *
 * Si converte SOLO da `ml`, dove 1 ml ≈ 1 g per gli alimenti di cui parliamo; `cl`, `dl` e `l` si
 * lasciano stare, perché lì lo stesso numero cambierebbe la porzione di un fattore dieci o cento.
 * La grammatura resta quella di partenza: è la scelta dichiarata di tutto il flusso (pari
 * grammatura, e la nutrizionista ricontrolla).
 */
const LIQUIDI = /acqua|latte|bevanda|panna|brodo|succo|olio|vino|aceto|sciroppo|caffe|birra|kefir|passata|salsa/;

export function unitaPerSostituto(unita: string | undefined, sostituto: string): string | undefined {
  if (!unita) return unita;
  if (normalizza(unita) !== 'ml') return unita;
  return LIQUIDI.test(normalizza(sostituto)) ? unita : 'g';
}

// ---------- Testi di Gaia ----------

/**
 * LA GRAMMATURA CHE SI DICE — quella **del piatto suo**, non quella di catalogo (19/8).
 *
 * ⚠️ Il caso che l'ha deciso: Gaia diceva «metti 120 g di biete al posto di 100 g di carote» mentre
 * nel piatto di quella cliente, scalato sul suo fabbisogno, ce n'erano 216. La chat è il posto dove
 * lei ha detto «sì» e dove torna a controllare: era l'unico numero che non poteva usare in cucina.
 *
 * ⚠️ L'arrotondamento passa da `quantitaScalata`, la **stessa** funzione della scheda ricetta e
 * della lista della spesa: due arrotondamenti diversi darebbero «216 g» di là e «215 g» di qua, che
 * si legge come un errore di misura invece che come una regola.
 */
const quantitaNelPiatto = (qta?: number, fattore?: number, unita?: string): string => {
  const scalata = quantitaScalata(qta, fattore, unita);
  return scalata !== null && scalata > 0 ? `${scalata}${unita ? ` ${unita}` : ''} di ` : '';
};

const maiuscola = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);


/**
 * COME SI CHIAMA. Richiesta di Simone (8/8): «Gaia non potrebbe rispondere chiamando per nome la
 * cliente?». Sì, e cambia il tono di tutta la conversazione — ma con tre regole, se no diventa il
 * venditore che ripete il tuo nome ogni tre parole:
 *
 *  1. **una volta per messaggio**, e all'inizio, dove un nome sta naturalmente;
 *  2. **solo il nome proprio**: la prima parola, e mai il cognome. «Ciao Maria Grazia Cerchiara»
 *     è una raccomandata, non una conversazione;
 *  3. se il nome non c'è (o è finito vuoto dopo la pulizia degli import), **non si inventa
 *     niente**: la frase deve funzionare identica anche senza, e per questo l'appellativo è un
 *     prefisso e non un buco in mezzo al testo.
 */
export function soloNomeProprio(nome?: string | null): string | null {
  const pulito = (nome ?? '').trim().replace(/\s+/g, ' ');
  if (!pulito) return null;
  const primo = pulito.split(' ')[0];
  // Un "nome" di una lettera o pieno di cifre non è un nome: meglio niente che «Ciao M3!».
  if (primo.length < 2 || /\d/.test(primo)) return null;
  return primo.charAt(0).toUpperCase() + primo.slice(1);
}

/** «Giulia, » se il nome c'è, stringa vuota se non c'è. Da mettere in TESTA alla frase. */
export function appellativo(nome?: string | null): string {
  const n = soloNomeProprio(nome);
  return n ? `${n}, ` : '';
}

/**
 * Apre una frase col nome, tenendo la maiuscola al posto giusto:
 *   con nome → «Antonella, per cambiare un alimento…»
 *   senza    → «Per cambiare un alimento…»
 * Senza questo, togliendo il nome restava una frase che comincia in minuscolo — e l'ha trovato un
 * test, non una rilettura: è il genere di dettaglio che si vede solo in chat, dalla cliente.
 */
export function apreFrase(nome: string | null | undefined, resto: string): string {
  const n = soloNomeProprio(nome);
  if (n) return `${n}, ${resto.charAt(0).toLowerCase()}${resto.slice(1)}`;
  return `${resto.charAt(0).toUpperCase()}${resto.slice(1)}`;
}

/** Come sopra, ma per una frase che comincia già con una parola sua: «Certo Giulia, ...». */
export function conNome(nome?: string | null): string {
  const n = soloNomeProprio(nome);
  return n ? ` ${n}` : '';
}

/**
 * ⚠️ `quando` è l'etichetta del giorno di cui si sta parlando («oggi», «domani», «sabato 15
 * agosto»): §16.2. Il valore predefinito è «oggi» in TUTTI i testi di questo file, e non per pigrizia
 * — è quello che garantisce che una conversazione sulla giornata di oggi suoni esattamente come
 * prima, parola per parola. Il giorno diverso cambia le frasi solo quando c'è davvero.
 */
/**
 * ⛔ **DOMANDA UNO: SU QUALE MENU** (Simone, 24/8). Numerata, e **solo sui giorni che vede davvero**:
 * chi ha in mano soltanto oggi non si sente chiedere di scegliere fra tre.
 *
 * ⚠️ Con un giorno solo questa domanda non si fa affatto — la fa saltare chi chiama. Una domanda con
 * una risposta sola non è una domanda: è un passaggio in più prima di quella vera.
 */
export function testoChiediGiorno(etichette: string[], nome?: string | null): string {
  const righe = etichette.map((e, i) => `${i + 1}) ${e}`).join('\n');
  return (
    `Ciao${conNome(nome)}! Su quale menu vuoi lavorare?\n\n${righe}\n\n` +
    'Rispondi col numero (o scrivimi il giorno, se preferisci).'
  );
}

/**
 * La risposta alla domanda del giorno: il numero della riga, oppure il giorno scritto a parole
 * («domani», «dopodomani», «sabato»). `null` = non capita.
 *
 * ⚠️ Le parole le riconosce chi chiama, con `giornoDellaConversazione`, che è già l'unico posto dove
 * sta scritto cosa vuol dire «domani»: qui si legge **solo il numero**. Due letture della stessa
 * cosa divergono, e su una data divergono in silenzio.
 */
export function giornoDaNumero(testo: string, giorni: string[]): string | null {
  const t = (testo ?? '').trim();
  const numero = t.match(/^\(?([1-9])\)?[.)]?$/);
  if (!numero) return null;
  return giorni[Number(numero[1]) - 1] ?? null;
}

/**
 * ⛔ **DOMANDA DUE: DI QUALE PASTO** (Simone, 24/8). Le righe sono i pasti che ha **quel giorno**,
 * col piatto accanto: il numero basta, ma il piatto le dice di cosa stiamo parlando.
 *
 * ⚠️ La risposta la legge `slotDaRisposta` (in `cambio-piatto.ts`), che già capisce il numero, il
 * nome del pasto e perfino il nome del piatto — ed è la stessa funzione che serve al ramo «voglio un
 * altro piatto». Una seconda copia qui vorrebbe dire due modi diversi di capire «2».
 */
export function testoChiediPasto(pasti: { slot: string; piatto: string }[], nome?: string | null, quando = 'oggi'): string {
  const righe = pasti.map((p, i) => `${i + 1}) ${maiuscola(etichettaSlot(p.slot))} — ${p.piatto}`).join('\n');
  // ⚠️ Il giorno si RIPETE qui, e non è una ridondanza: la domanda uno può essere stata saltata
  // (un giorno solo, o il pulsante dell'app che porta la data con sé), e senza questa riga la
  // cliente non saprebbe di quale giornata stiamo parlando — §16.2.
  return (
    `${apreFrase(nome, `per il menu di ${quando}: di quale pasto parliamo?`)}\n\n${righe}\n\n` +
    'Rispondi col numero.'
  );
}

/**
 * ⛔ **DOMANDA TRE: QUALE ALIMENTO**, numerato — la parte che Simone ha visto rompersi: «scrivimi
 * solo il nome dell'alimento» su quindici alimenti di tre piatti.
 *
 * ⚠️ Gli alimenti sono quelli di **quel** piatto e nell'ordine della ricetta, sostituzioni già
 * concordate comprese: è l'elenco che la cliente ha davanti quando apre il menu.
 */
export function testoChiediCiboNumerato(
  piatto: string,
  alimenti: string[],
  nome?: string | null,
  quando = 'oggi',
  tagliato = false,
): string {
  const righe = alimenti.map((a, i) => `${i + 1}) ${a}`).join('\n');
  /**
   * ⚠️ **La porta per le parole si dice sempre** (rilievo della revisione del 25/8). Serve a due
   * casi che senza questa riga finiscono male: l'elenco **tagliato** — il suo alimento è l'undicesimo
   * e non lo vede — e quello che nel piatto c'è ma nell'elenco non compare (le spezie, che Gaia non
   * sostituisce). La strada a parole esiste ancora nel codice; se non gliela diciamo, per lei non
   * esiste.
   */
  const coda = tagliato
    ? 'Quale vuoi cambiare? Rispondi col numero — o scrivimi il nome, se quello che cerchi non è in elenco (ce ne sono altri).'
    : 'Quale vuoi cambiare? Rispondi col numero, oppure scrivimi il suo nome.';
  return `${apreFrase(nome, `${quando} in «${piatto}» ci sono questi:`)}\n\n${righe}\n\n${coda}`;
}

/** Il numero della riga scelta fra gli alimenti elencati. `null` = non è un numero valido. */
export function ciboDaNumero(testo: string, alimenti: string[]): string | null {
  const t = (testo ?? '').trim();
  const numero = t.match(/^\(?([1-9]|1[0-9])\)?[.)]?$/);
  if (!numero) return null;
  return alimenti[Number(numero[1]) - 1] ?? null;
}

export function testoChiediCibo(pasti: { slot: string; piatto: string }[], nome?: string | null, quando = 'oggi'): string {
  if (!pasti.length) {
    return apreFrase(
      nome,
      `Per cambiare un alimento mi serve il menu di ${quando}, e adesso non lo vedo. Prova a riaprire la home: se resta vuoto scrivilo alla tua coach, ci pensiamo noi. 💚`,
    );
  }
  const elenco = pasti.map((p) => `${etichettaSlot(p.slot)}: ${p.piatto}`).join(' · ');
  return (
    `Certo${conNome(nome)}, vediamo insieme. Quale alimento vuoi cambiare?\n\n` +
    `${maiuscola(quando)} hai — ${elenco}.\n\n` +
    'Scrivimi solo il nome dell\'alimento (per esempio «le carote»).'
  );
}

export function testoCiboNonTrovato(cibo: string, ultimoTentativo: boolean, quando = 'oggi'): string {
  if (ultimoTentativo) {
    return `Continuo a non trovare «${cibo}» nel menu di ${quando}, e non voglio farti perdere tempo: ho girato la richiesta alla tua coach, che ti scrive nel vostro thread. 💚`;
  }
  return `Non trovo «${cibo}» tra gli ingredienti di ${quando}. Controlla come si scrive, oppure dimmi il piatto in cui l'hai visto.`;
}

export function testoChiediMotivo(p: PropostaSostituzione): string {
  const elenco = MOTIVI.map((m) => `${m.numero}) ${m.label}`).join('\n');
  return (
    `${maiuscola(nelloSlot(p.slot))} (${p.piatto}) ci sono ${quantitaNelPiatto(p.qtaDa, p.fattore, p.unita)}${p.da}.\n\n` +
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

/**
 * Per quanto vale il cambio.
 *
 * ⚠️ `sempre` dice «da oggi in avanti» anche quando si sta parlando di dopodomani, e non è una
 * svista: «questo cibo non mi piace» è una cosa che vale sul cibo, non su quella giornata — e
 * lasciarglielo nel piatto stasera perché la frase è partita da giovedì sarebbe assurdo.
 */
const testoDurata = (durata: Durata, quando = 'oggi'): string => {
  if (durata !== 'oggi') return 'da oggi in avanti, e non te lo propongo più nei menu nuovi';
  return quando === 'oggi'
    ? 'solo per oggi: domani torna come prima'
    : `solo per ${quando}: gli altri giorni restano come prima`;
};

export function testoConferma(p: PropostaSostituzione, motivo: Motivo, nome?: string | null, quando = 'oggi'): string {
  const daQta = quantitaNelPiatto(p.qtaDa, p.fattore, p.unita);
  const aQta = quantitaNelPiatto(p.qtaA, p.fattore, p.unitaA ?? p.unita);
  return (
    `Allora facciamo così${conNome(nome)}: ${nelloSlot(p.slot)} metti ` +
    `${aQta}${p.a} al posto di ${daQta}${p.da} — ${testoDurata(motivo.durata, quando)}.\n\n` +
    'Confermi? (sì / no)'
  );
}

export function testoAnnullato(nome?: string | null, quando = 'oggi'): string {
  return `Va bene${conNome(nome)}, non cambio niente: il menu di ${quando} resta com'è. Se cambi idea sono qui. 💚`;
}

// ---------- Il «no» alla proposta: indagare, non fermarsi ----------

/**
 * Che cosa c'è dentro un «no».
 * - `sostituto`: non le va **quello che ho proposto** («no, non voglio il burro»). È il caso di
 *   gran lunga più frequente, e l'unico in cui fermarsi è uno spreco: il cambio lo vuole ancora.
 * - `ripensata`: ha cambiato idea sul cambio in sé («no, lascia stare»).
 * - `null`: un «no» secco, che non dice quale delle due cose è. Si chiede.
 */
export type SensoDelNo = 'sostituto' | 'ripensata' | null;

/** «lascia stare», «ho cambiato idea»: il cambio non le serve più. */
const NO_RIPENSATA = /ho cambiato idea|lascia (stare|perdere)|va bene (cosi|com.e)|resta (cosi|com.e)|non importa|niente$|nulla$|non fa niente|meglio (cosi|niente)|tengo (quello|questo)|preferisco (lasciare|tenere)/;

/**
 * Dice se il «no» riguarda il SOSTITUTO proposto o il cambio in sé.
 *
 * Il primo controllo è sul nome del sostituto dentro la frase, ed è quello che conta: «non voglio
 * 70 gr di burro» nomina il burro, quindi è un no a *quel* sostituto. Poi i motivi (`MOTIVI`): se
 * la cliente spiega un perché — non mi piace, non ce l'ho in casa, mi resta sullo stomaco — sta
 * parlando dell'alternativa, non annullando la richiesta.
 */
export function sensoDelNo(testo: string, sostitutoProposto?: string): SensoDelNo {
  const t = normalizza(testo);
  // Solo «no» (o «no.», «no grazie»): non dice niente di più, va chiesto.
  if (/^no+[.! ]*(grazie)?[.!]*$/.test(t)) return null;
  if (NO_RIPENSATA.test(t)) return 'ripensata';
  if (sostitutoProposto) {
    const paroleSostituto = paroleAlimento(sostitutoProposto).map(radice);
    const paroleTesto = new Set(paroleAlimento(t).map(radice));
    if (paroleSostituto.length && paroleSostituto.some((p) => paroleTesto.has(p))) return 'sostituto';
  }
  // Un motivo esplicito («non mi piace», «non ce l'ho in casa») riguarda la proposta.
  if (riconosciMotivo(testo)) return 'sostituto';
  return null;
}

// ---------- La controproposta: quando è lei a dire cosa vuole ----------

/**
 * Segnali che la cliente sta **proponendo** qualcosa, non rispondendo sì/no.
 *
 * Nel collaudo del 9/8 ha scritto «l'olio mi fa peso posso usare il burro vegetale?» e Gaia ha
 * risposto «Non ho capito: confermi il cambio?». Dentro quella frase c'erano due informazioni — un
 * motivo e un **sostituto scelto da lei** — e buttarle via è il modo più rapido di far sentire una
 * persona non ascoltata proprio nel momento in cui si sta fidando.
 */
const PROPONE = /(posso|potrei|si pu[oò]|va bene|andrebbe|preferirei|preferisco|mett(o|iamo|erei)|us(o|are|iamo|erei)|invece|al posto|piuttosto|magari|e se|ci sta)/;

/**
 * I termini con cui la cliente potrebbe aver proposto un alimento suo, o `null` se non sta
 * proponendo niente.
 *
 * `escludi` sono i nomi già in gioco — l'alimento da cambiare e il sostituto proposto da noi: sono
 * quelli che la frase nomina *per rifiutarli* («l'olio mi fa peso»), e prenderli per una
 * controproposta vorrebbe dire riproporle esattamente ciò che ha appena scartato.
 *
 * Due strade per riconoscere l'intenzione, perché nel parlato ci sono entrambe:
 *  - una frase che propone («posso usare il burro vegetale?»);
 *  - un messaggio **corto**, che è solo un nome («burro vegetale»). Alla conferma, due parole che
 *    non sono né sì né no sono quasi sempre un nome di alimento.
 *
 * Chi verifica che quel nome sia un alimento vero — e ammissibile — è il servizio, contro i gruppi
 * di equivalenza approvati: qui non si decide niente, si legge.
 */
export function contropropostaDaTesto(
  testo: string,
  escludi: string[] = [],
): { termini: string[]; esplicita: boolean } | null {
  const t = normalizza(testo);
  // Lo scarto è per PAROLA (`condividonoAlimento`), non per nome intero: la frase del collaudo
  // produce anche la coppia «olio burro», che non è né l'uno né l'altro e non combacia con niente —
  // ma contiene l'alimento appena rifiutato, e portarsela dietro significa proporglielo di nuovo.
  const termini = terminiCandidati(testo).filter(
    (termine) => !escludi.some((x) => x && condividonoAlimento(x, termine)),
  );
  if (!termini.length) return null;
  const parole = t.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const esplicita = PROPONE.test(t);
  // Il messaggio corto vale come tentativo di proposta solo se è corto DAVVERO: fino a tre parole.
  if (!esplicita && parole.length > 3) return null;
  // `esplicita` distingue i due casi, e la distinzione è quella che evita di far girare richieste
  // che nessuno ha fatto: con un verbo di proposta («posso usare X?») un nome che non troviamo in
  // catalogo va comunque **chiesto alla nutrizionista**, perché la cliente ha chiesto qualcosa di
  // preciso. Senza verbo — «boh», «mah» — se il nome non è in catalogo non è un alimento: è
  // un'esitazione, e va trattata come tale.
  return { termini, esplicita };
}

/** La sua proposta si può fare: si conferma con le sue parole, non con le nostre. */
export function testoContropropostaOk(
  p: PropostaSostituzione,
  motivo: Motivo,
  nome?: string | null,
): string {
  const daQta = quantitaNelPiatto(p.qtaDa, p.fattore, p.unita);
  const aQta = quantitaNelPiatto(p.qtaA, p.fattore, p.unitaA ?? p.unita);
  return (
    `Sì${conNome(nome)}, «${p.a}» si può — ${nelloSlot(p.slot)} metti ${aQta}${p.a} al posto di ` +
    `${daQta}${p.da}, ${testoDurata(motivo.durata)}.\n\nConfermo? (sì / no)`
  );
}

/**
 * La sua proposta tocca un allergene dichiarato. Si dice **perché** no: è l'unica risposta che non
 * suona come un rifiuto arbitrario, e su un allergene la spiegazione è anche una cosa che le serve
 * sapere. Il seguito (un'altra alternativa) lo aggiunge il servizio in coda a questa frase.
 */
export function testoContropropostaAllergene(alimento: string, nome?: string | null): string {
  return apreFrase(
    nome,
    `«${alimento}» purtroppo no: rientra fra le cose che hai dichiarato come allergia, e su quelle non passo mai sopra.`,
  );
}

/** La sua proposta è fra le cose che ha escluso lei (intolleranza o non gradito). */
export function testoContropropostaEsclusa(alimento: string, nome?: string | null): string {
  return apreFrase(
    nome,
    `«${alimento}» ce l'hai fra le cose che non vuoi nel piano, quindi non te lo metto io — se hai cambiato idea dimmelo e lo sistemiamo insieme alla tua coach.`,
  );
}

/**
 * La sua proposta è una **variante dello stesso alimento** («yogurt greco» → «yogurt senza
 * lattosio»): non risolve il problema per cui aveva chiesto il cambio. Vedi `condividonoAlimento`.
 */
export function testoContropropostaStessoAlimento(da: string, alimento: string, nome?: string | null): string {
  return apreFrase(
    nome,
    `«${alimento}» è ancora «${da}» con un altro nome, quindi non cambierebbe niente per te. Ti propongo una cosa diversa.`,
  );
}

/**
 * La sua proposta non è fra gli equivalenti approvati per quell'alimento: non si nomina, perché il
 * termine letto dal messaggio potrebbe non essere quello che intendeva, e ripeterglielo storpiato
 * peggiora una risposta già negativa. Non è un vicolo cieco: passa alla nutrizionista, che è la
 * persona che può dire sì a una cosa che il ricettario non prevede.
 */
export function testoContropropostaNonPrevista(da: string, nome?: string | null): string {
  return apreFrase(
    nome,
    `Quello che mi proponi non è fra le alternative che posso decidere io per «${da}»: l'ho girato alla tua nutrizionista, ` +
      'che può valutarlo e dirmi di metterlo. Ti scrive lei. 💚',
  );
}

/** Le tre strade dopo un «no» secco, nell'ordine in cui la cliente le legge. */
export const STRADE_DOPO_IL_NO: { numero: number; label: string; scelta: 'altro_sostituto' | 'altro_piatto' | 'annulla' }[] = [
  { numero: 1, label: 'non mi va bene questo sostituto: proponimene un altro', scelta: 'altro_sostituto' },
  { numero: 2, label: 'preferisco cambiare tutto il piatto', scelta: 'altro_piatto' },
  { numero: 3, label: 'ho cambiato idea, lascia il menu come è', scelta: 'annulla' },
];

/** Riconosce la risposta alla domanda «cosa non ti va?»: numero o parole. */
export function sceltaDopoIlNo(testo: string): 'altro_sostituto' | 'altro_piatto' | 'annulla' | null {
  const t = normalizza(testo);
  const soloNumero = t.match(/^\(?([1-3])\)?[.)]?$/);
  if (soloNumero) return STRADE_DOPO_IL_NO.find((s) => s.numero === Number(soloNumero[1]))?.scelta ?? null;
  if (NO_RIPENSATA.test(t)) return 'annulla';
  if (/altro piatto|un.altra ricetta|cambiare (tutto )?(il )?piatto|piatto diverso|tutta la ricetta/.test(t)) return 'altro_piatto';
  if (/altro sostitut|un.altra (cosa|alternativa)|altra alternativa|qualcos.altro|altro al posto|proponi|proponimi|alternativ/.test(t)) {
    return 'altro_sostituto';
  }
  return null;
}

/**
 * La domanda dopo un «no» secco. Non ripete la proposta rifiutata — l'ha appena letta — e mette
 * per prima la strada più probabile: cambiare il sostituto, non rinunciare al cambio.
 */
export function testoChiediPercheNo(p: PropostaSostituzione, nome?: string | null): string {
  const elenco = STRADE_DOPO_IL_NO.map((s) => `${s.numero}) ${s.label}`).join('\n');
  return (
    // Il nome fra virgolette, senza articolo davanti. Prima era scritto `il ${p.da}` e il ricettario
    // ha alimenti di ogni genere e numero: in schermata, nel collaudo del 9/8, si leggeva «non voglio
    // lasciarti con **il panna fresca** nel piatto». Le virgolette sono la strada già usata nel resto
    // del file (vedi `testoNienteAltroSostituto`) e non richiedono di sapere il genere di ogni voce
    // del ricettario — che nessuna tabella ci dice.
    apreFrase(nome, `Aspetta, non voglio lasciarti «${p.da}» nel piatto se non lo vuoi: dimmi cos'è che non ti va.`) +
    `\n\n${elenco}\n\nRispondi col numero, o a parole tue.`
  );
}

export function testoRifiutoNonCapito(ultimoTentativo: boolean): string {
  if (ultimoTentativo) {
    return 'Non riesco a capire cosa non ti va, e non voglio farti girare a vuoto: ho passato tutto alla tua coach, che ti scrive nel vostro thread. 💚';
  }
  return `Scusa, non ho capito. Rispondi con un numero: ${STRADE_DOPO_IL_NO.map((s) => `${s.numero}) ${s.label}`).join(' · ')}.`;
}

/** Proposta numero due, dopo che la prima è stata rifiutata: si dice perché è cambiata. */
export function testoAltroSostituto(
  p: PropostaSostituzione,
  motivo: Motivo,
  rifiutato: string,
  nome?: string | null,
): string {
  const daQta = quantitaNelPiatto(p.qtaDa, p.fattore, p.unita);
  const aQta = quantitaNelPiatto(p.qtaA, p.fattore, p.unitaA ?? p.unita);
  return (
    `Capito${conNome(nome)}: niente ${rifiutato}. Allora proviamo con un'altra cosa — ` +
    `${nelloSlot(p.slot)} metti ${aQta}${p.a} al posto di ${daQta}${p.da}, ${testoDurata(motivo.durata)}.\n\n` +
    'Ti va meglio? (sì / no)'
  );
}

/**
 * Le alternative sono finite. Non è un vicolo cieco: la richiesta passa alla nutrizionista, che è
 * la persona che può inventare un'alternativa che il ricettario non ha.
 */
export function testoNienteAltroSostituto(da: string, rifiutati: string[], nome?: string | null): string {
  // Gli alimenti si citano fra virgolette anche qui: «per la panna fresca» richiederebbe di sapere
  // il genere di ogni alimento del ricettario, e sbagliarlo si legge subito.
  const elenco = rifiutati.filter(Boolean).map((r) => `«${r}»`);
  const scartati = elenco.length
    ? ` — ${elenco.join(' e ')} non ${elenco.length > 1 ? 'ti vanno' : 'ti va'} —`
    : '';
  return (
    apreFrase(
      nome,
      `Hai ragione a non accontentarti${scartati} ma altre alternative sicure per «${da}» non ne ho, ` +
        'e non voglio inventarle. ',
    ) + 'Ho passato la richiesta alla tua nutrizionista con tutto il contesto: ti risponde lei nel vostro thread. 🩺'
  );
}

export function testoFatto(p: PropostaSostituzione, motivo: Motivo, nome?: string | null, quando = 'oggi'): string {
  const aQta = quantitaNelPiatto(p.qtaA, p.fattore, p.unitaA ?? p.unita);
  let out =
    `Fatto${conNome(nome)}: il menu di ${quando} è aggiornato. ${maiuscola(nelloSlot(p.slot))} ` +
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
  return `Quel cambio c'è già: ${nelloSlot(p.slot)} trovi ${quantitaNelPiatto(p.qtaA, p.fattore, p.unitaA ?? p.unita)}${p.a}. Non ho fatto niente di nuovo. 💚`;
}

export function testoNessunSostituto(cibo: string): string {
  return `Su «${cibo}» preferisco non decidere da sola: non ho un'alternativa che mi convinca del tutto. Ho girato la richiesta alla tua nutrizionista, che ti risponde nel vostro thread. 🩺`;
}

/**
 * ⛔ **DOPO UNA CONVERSIONE COI PESI, L'UNITÀ È IL GRAMMO** — secondo giro di revisione, 25/8.
 *
 * La tabella di Nocanty dice *«i grammi di alimento necessari per ottenere la stessa quantità di
 * lipidi contenuta in 100 g di olio EVO»*: `quantitaEquivalente` rende **grammi**, sempre. Ma
 * `unitaPerSostituto` guarda il tipo di alimento, e l'olio è un liquido: partendo da 70 **ml** di
 * panna la proposta usciva come «25 **ml** di olio».
 *
 * Venticinque millilitri di olio d'oliva sono **22,8 g** (densità ~0,91): −9% sull'ingrediente, e
 * ogni commento del lavoro — questo file, il seed, l'esempio di Nocanty — scrive «25 g». Il numero
 * detto e il numero calcolato erano due cose diverse: un troncamento silenzioso in mezzo a un lavoro
 * che esiste per togliere i troncamenti silenziosi.
 *
 * ⚠️ Vale **solo** quando la quantità viene dalla conversione. Se il cambio è a pari grammatura
 * l'unità resta quella naturale del sostituto, che è la scelta giusta di sempre («70 ml di burro»
 * non esiste, e nemmeno «2 g di uova»).
 */
export function unitaDopoLaConversione(unita: string | undefined, convertita: boolean): string | undefined {
  return convertita ? 'g' : unita;
}

/**
 * ⛔ **IL TESTO DEI GRASSI** — approvato da Nocanty parola per parola, 24/8: *«Il testo del messaggio
 * automatico proposto è perfetto e chiaro.»*
 *
 * ⚠️ Dice **perché**, che è la parte che evita il «ma allora a cosa servi»: cambiare un grasso con un
 * altro cambia le calorie del piatto più di quanto sembri, e la cliente non ha modo di saperlo.
 *
 * ⛔ **E vale solo per il caso in cui è vero** — corretto al secondo giro di revisione, 25/8. La
 * prima stesura dava questa frase a **tre** situazioni diverse: manca il numero (vera), la coppia
 * non regge in cucina (falsa: i numeri tornano benissimo, è la consistenza del piatto a rompersi),
 * e la conversione è fuori dal limite di sicurezza (falsa allo stesso modo). Il lavoro ha appena
 * tolto una ragione falsa — il «il menu è cambiato» che nascondeva i pasti saltati — e ne lasciava
 * in piedi un'altra della stessa famiglia. Alla nutrizionista il motivo vero arrivava; alla cliente
 * no, ed è lei quella che non ha modo di verificarlo.
 */
export function testoGrassoSenzaNumero(cibo: string): string {
  return (
    `Su «${cibo}» preferisco non decidere io: cambiare un grasso con un altro cambia le calorie del `
    + 'piatto più di quanto sembri. L\'ho chiesto alla tua nutrizionista, che ti risponde lei. 💚'
  );
}

/**
 * ⚠️ **Quando il cambio si potrebbe fare sui numeri ma rovina il piatto** (vellutate, salse: regola
 * di Nocanty del 24/8). Non è «non ho il numero»: il numero c'è, ed è giusto. Dirle la frase
 * sbagliata la lascerebbe a credere che manchi un dato quando manca il senso del piatto.
 */
export function testoGrassoInCucina(cibo: string, piatto: string): string {
  return (
    `Su «${cibo}» in un piatto come «${piatto}» preferisco non decidere io: sui numeri il cambio si `
    + 'potrebbe fare, ma in una preparazione così cambia la consistenza e la riuscita del piatto. '
    + 'L\'ho chiesto alla tua nutrizionista, che ti risponde lei. 💚'
  );
}

/**
 * ⚠️ **Quando il numero c'è ma porta troppo lontano dalla quantità del piano.** Terzo caso, terza
 * frase: qui non manca niente e non c'entra la cucina — è la distanza fra le due quantità a essere
 * troppa perché la decida un sistema.
 */
export function testoGrassoTroppoLontano(cibo: string): string {
  return (
    `Su «${cibo}» il conto mi porta a una quantità troppo lontana da quella del tuo piano, e quella `
    + 'differenza non me la sento di deciderla io. L\'ho chiesto alla tua nutrizionista, che ti '
    + 'risponde lei. 💚'
  );
}

/**
 * ⚠️ **Il vecchio nome**, tenuto perché lo chiamano i punti che non sanno distinguere fra i tre casi
 * (la coda di `applica`, dove il motivo può essere più d'uno). ⛔ Non usarlo in un punto nuovo: se
 * sai perché ti stai fermando, dillo con la frase che lo dice.
 */
export const testoGrassoDaDecidere = testoGrassoSenzaNumero;

export function testoAllergene(cibo: string): string {
  return `Non posso proporti un sostituto per «${cibo}» senza rischiare di toccare una cosa a cui sei allergica, e su questo non si media. Ne ho scritto alla tua nutrizionista: decide lei. 🩺`;
}
