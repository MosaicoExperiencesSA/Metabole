/**
 * DALLA FRASE ALL'INTENTO — il traduttore, e soltanto il riconoscimento del testo.
 *
 * È il cuore di Vera, ed è **deterministico di proposito**. Un modello capirebbe più forme, ma qui
 * la cosa che conta non è capire tanto: è **sapere quando non si è capito**. Una funzione pura si
 * collauda con un elenco di frasi vere (`capisci.spec.ts`), e quell'elenco è la sola difesa contro
 * il guasto che questo progetto teme di più — che un giorno l'agente smetta di capire le frasi che
 * capiva, e nessuno sappia dire quando è iniziato.
 *
 * ⚠️ Dove il modello entra, se un giorno entrerà: **dopo** questo file e **mai al posto** suo. Il
 * servizio prova prima qui; se esce `null` può chiedere a un LLM una PROPOSTA — che resta una
 * proposta, mostrata e confermata dalla nutrizionista come tutte le altre. La scrittura non cambia
 * mai strada: passa sempre dall'anteprima e dal suo sì.
 *
 * ## ⚠️ Le regole ereditate da `impara-dalla-chat.ts`, che valgono identiche qui
 *
 * Quel file legge le stesse frasi in un altro contesto e ha già pagato le lezioni:
 *
 * - **le due direzioni dell'italiano sono invertite**: «sostituisci il pollo col tacchino» e «il
 *   tacchino al posto del pollo» dicono la stessa cosa scrivendo prima cose diverse. Capirla al
 *   contrario non produce un errore: produce una regola **perfettamente formata e rovesciata**;
 * - **nel dubbio non si capisce**: una domanda («posso togliere il tonno?») non è un'istruzione, e
 *   una negazione ribalta il senso. Una frase non capita costa alla nutrizionista dieci secondi per
 *   riformularla; una frase capita male costa cibo sbagliato nel piatto di una persona.
 */
import { leggiEquivalenza } from './equivalenza-dettata';
import { normalizza } from '../common/nomi-alimento';
import { sostituzioniNelMessaggio } from '../food-swaps/impara-dalla-chat';

/**
 * SEPARA quello che ha scritto lei da quello che ha incollato.
 *
 * ⚠️ È il cancello del §9.1 della specifica, e non è una finezza da manuale: l'agente ha il potere
 * di scrivere regole su clienti vere, e il testo che gli arriva davanti è spessissimo scritto da
 * qualcun altro — «guarda cosa mi ha scritto Simone», con dentro «togli tutto tranne il cioccolato».
 * Quel testo si **legge**, non si esegue.
 *
 * Si riconosce come citazione: le righe che cominciano con `>` (la convenzione che conoscono tutti)
 * e i blocchi delimitati da virgolette triple o da tre apici inversi.
 *
 * ⚠️ Il ripiego, quando non si capisce dove finisce la citazione, è **considerare tutto citazione**:
 * al massimo le si chiede di ripetere con parole sue, che costa dieci secondi. Il contrario costa una
 * regola scritta su una persona da una frase che non ha detto lei.
 */
import { LetturaPasti, Spuntino, leggiPasti } from './togli-spuntino';
import { leggiGiornataDettata } from './giornata-dettata';

export function separaCitazione(testo: string): { suo: string; citato: string } {
  const righe = (testo ?? '').split('\n');
  const citate: string[] = [];
  const sue: string[] = [];
  let dentroBlocco = false;
  for (const riga of righe) {
    const t = riga.trim();
    if (/^("""|```)/.test(t)) { dentroBlocco = !dentroBlocco; continue; }
    if (dentroBlocco || t.startsWith('>')) citate.push(t.replace(/^>\s?/, ''));
    else sue.push(riga);
  }
  return { suo: sue.join('\n').trim(), citato: citate.join('\n').trim() };
}

/** Cosa Vera ha capito di dover fare. `null` = non ho capito, e lo dico. */
export type Intento =
  | IntentoRestrizione
  | IntentoSostituzione
  | IntentoRicetta
  | IntentoFuoriPortata
  | IntentoPasti
  | IntentoFamiglia
  | IntentoSegnalazioni
  | IntentoSostituzioniDaVerificare
  | IntentoApprovazioni
  | IntentoCambioDieta
  | IntentoCorrezioneKcal
  | IntentoProteine
  | IntentoGiornata
  | IntentoEquivalenza
  | IntentoLista;

/** «A Simone niente formaggi molli» — eventualmente con un'eccezione: «…ma solo il grana». */
export interface IntentoRestrizione {
  tipo: 'restrizione';
  /** Il nome della persona come l'ha scritto lei. Va disambiguato: qui non si cerca nessuno. */
  cliente: string | null;
  /** Cosa non deve più comparire. Può essere una FAMIGLIA che il catalogo non conosce. */
  vietati: string[];
  /** L'eccezione: «…ma solo il grana». Vuoto se non l'ha detta. */
  tenuti: string[];
}

/** «Per Anna sostituisci il pollo con il tacchino». */
export interface IntentoSostituzione {
  tipo: 'sostituzione';
  cliente: string | null;
  from: string;
  to: string;
}

/**
 * «Inseriamo una ricetta per il menu keto» · «voglio cambiare la ricetta tonno alle olive».
 *
 * ⚠️ Qui si riconosce **soltanto che si parla di una ricetta**, e se è nuova o da cambiare. Il
 * contenuto — nome, ingredienti, pesi — non sta in questa frase: arriva dopo, in un messaggio a
 * parte, e lo legge `ricetta-dettata.ts`. Tenerli separati è ciò che permette di rileggere la
 * ricetta scritta senza rileggere la frase che l'ha chiesta.
 */
/** «Hai la lista dei formaggi molli?» / «crea la lista dei formaggi molli» (13/8, Nocanty). */
export interface IntentoFamiglia {
  tipo: 'famiglia';
  azione: 'mostra' | 'crea';
  nome: string;
}

/**
 * «Hai segnalazioni per me?» / «cosa mi aspetta oggi?» — la guida della giornata (Simone, 14/8).
 *
 * Non è un'istruzione: è la domanda sulla giornata, e merita risposta anche quando la risposta è
 * «niente». Prima cadeva nel «non ci arrivo» (screenshot del 14/8, 08:35), che era vero e
 * fuorviante.
 */
export interface IntentoSegnalazioni {
  tipo: 'segnalazioni';
}

/**
 * «Verifichiamo i cambi» / «ci sono sostituzioni da verificare?» — la coda dei cambi concordati in
 * chat (voce 245, decisione **A** di Simone del 14/8; foglio
 * `progetto/DECISIONE_Verificare_Cambi_A_Voce.md`).
 *
 * Come `segnalazioni`, è una domanda e non un'istruzione: aprire una coda non esegue niente. Il
 * quadro della giornata le conta già; questo intento serve a chi vuole andarci dritta.
 */
export interface IntentoSostituzioniDaVerificare {
  tipo: 'sostituzioni';
}

/**
 * «COSA C'È DA APPROVARE?» — le tre code del catalogo (Simone, 18/8: «se ci sono ricette da
 * approvare, combinazioni da approvare, allergeni da approvare, vanno tutti inviati a vera che
 * aiuta il nutrizionista a verificare uno per uno»).
 *
 * Come `segnalazioni` e `sostituzioni`: è una domanda, non un'istruzione. Aprire la coda non
 * approva niente — ogni riga si conferma da sola, una per volta.
 */
export interface IntentoApprovazioni {
  tipo: 'approvazioni';
}

/**
 * «Sposta Giulia sulla keto» — il cambio di DIETA per una cliente (azione 3, Simone 14/8).
 *
 * ⚠️ Non è la regola su un tipo di dieta («nella mediterranea niente tonno», che resta
 * `fuori_portata`): qui si sposta UNA persona su un altro prodotto, per la stessa strada della
 * scheda cliente (permesso `change_diet_type`). `dieta: null` = «cambia la dieta a Giulia» senza
 * dire quale: si chiede, non si indovina.
 */
/**
 * «Riduci le kcal del 10% a Giulia per 7 giorni» (Nocanty, 13/8; decisione 14/8).
 *
 * `pct` è **firmato**: negativo toglie, positivo aggiunge — la stessa convenzione di
 * `ClientProfile.kcalAdjustPct`, così il numero non cambia significato per strada.
 * `giorni: null` = non l'ha detto: si chiede, non si indovina («per 7 giorni» e «finché non te lo
 * dico io» sono due prescrizioni diverse).
 */
export interface IntentoCorrezioneKcal {
  tipo: 'correzione_kcal';
  cliente: string | null;
  pct: number;
  giorni: number | null;
}

/**
 * «Rifai con più proteine a Giulia» — la terza frase dell'azione 3 (decisione A di Simone, 14/8).
 * `pct` è la quota minima come FRAZIONE (0,35), oppure `null` = «più» senza un numero: lo scatto
 * di scorta (+10 punti sul minimo che ha adesso) lo mette il servizio, che sa qual è quel minimo.
 */
/**
 * «Per Giulia domani: colazione… pranzo… cena…» — la giornata dettata (voce 241, lettura B).
 * Qui si riconosce SOLO che sta dettando una giornata e per chi: le righe le legge
 * `giornata-dettata.ts`, che è il posto dove quella lettura si prova per tabella.
 */
export interface IntentoGiornata {
  tipo: 'giornata';
  cliente: string | null;
  /** Il testo con i pasti, già separato dalla riga di apertura. */
  testo: string;
}

export interface IntentoProteine {
  tipo: 'proteine';
  cliente: string | null;
  pct: number | null;
}

export interface IntentoCambioDieta {
  tipo: 'cambio_dieta';
  cliente: string | null;
  dieta: string | null;
}

export interface IntentoPasti {
  tipo: 'pasti';
  cliente: string | null;
  azione: 'togli' | 'rimetti';
  /** `null` = «lo spuntino» secco: si chiede quale, non si indovina. */
  slots: Spuntino[] | null;
}

export interface IntentoRicetta {
  tipo: 'ricetta';
  modo: 'nuova' | 'modifica';
  /** Il nome del piatto da cambiare, quando l'ha detto nella stessa frase. */
  nome: string | null;
  /** Lo stile nominato («per il menu keto»): diventa un tag, mai il regime. */
  stile: string | null;
}

/**
 * Ho capito COSA vuole, ma non è una cosa che so ancora fare.
 *
 * ⚠️ Dal 13/8 ne è rimasto **uno solo**: la regola su un tipo di dieta. Le ricette c'erano insieme a
 * lei e adesso si sanno scrivere — quando ne resterà zero, questo tipo va tolto e non lasciato lì a
 * fare da parcheggio.
 *
 * ⚠️ Serve, e non è un ripiego. «Nella mediterranea niente tonno» è una regola su un TIPO DI DIETA:
 * senza questo caso il riconoscitore la leggerebbe come una restrizione su una cliente di nome
 * «mediterranea», o peggio la applicherebbe all'ultima cliente nominata. Dire «questo non lo so
 * ancora fare» è una risposta; fare la cosa sbagliata con sicurezza non lo è.
 */
/**
 * «AGGIUNGI UN'EQUIVALENZA» — il gruppo che dice al motore quali alimenti può scambiare (19/8).
 *
 * ⚠️ Non è la **lista del dizionario**, che si chiama quasi uguale: quella dà un nome a un insieme e
 * serve a scrivere i divieti («niente formaggi molli»). Questo dice al motore che nel piatto di una
 * cliente può mettere il tacchino al posto del pollo — è una regola che cambia cosa mangia la gente,
 * e infatti nasce come proposta e la approva il capo.
 *
 * ⚠️ `alimenti` può essere **vuoto**: «aggiungi equivalenza» secco è una richiesta capita, e la
 * risposta giusta è chiedere quali alimenti — non «non ci arrivo». Era il caso dello screenshot del
 * 19/8, in cui Vera rispondeva due volte «non ci arrivo nemmeno adesso» a una frase chiarissima.
 */
/** «Fammi la lista»: le cose da fare numerate. ⚠️ Diverso dal quadro in conteggi. */
export interface IntentoLista {
  tipo: 'lista';
}

export interface IntentoEquivalenza {
  tipo: 'equivalenza';
  alimenti: string[];
  nome: string | null;
}

export interface IntentoFuoriPortata {
  tipo: 'fuori_portata';
  cosa: 'regola_dieta';
  dettaglio: string;
}

// ─────────────────────────────────────────────────────────────────────────────

/** Preposizioni e articoli che precedono un nome di persona o di alimento. */
const ARTICOLI = ['il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una', "l'", "un'", 'del', 'dello', 'della', 'dei', 'degli', 'delle'];

/**
 * Parole che chiudono il pezzo utile di una frase: dopo, comincia il motivo o un'altra cosa.
 *
 * ⚠️ Le parole accentate stanno in un ramo separato SENZA `\b`. In JavaScript il confine di parola è
 * ASCII: dopo la «é» di «perché» non c'è nessun confine, quindi `perché\b` non combacia mai — e il
 * motivo clinico («…perché ha il colesterolo alto») finirebbe dentro l'elenco degli alimenti da
 * vietare. Le parole senza accento invece il `\b` ce l'hanno per forza, o «ma» prenderebbe
 * «mattina».
 */
const FINE = /\s+(?:ma|invece|quindi|inoltre|e\s+poi|pero|perche)\b|\s+(?:però|perché)(?=\s|$)/iu;

/**
 * Un elenco scritto a parole: «formaggi molli, mozzarella e stracchino».
 * Si separa su virgole e sulla «e» — che in italiano regge l'elenco anche senza virgola.
 */
function elenco(pezzo: string): string[] {
  return pezzo
    .split(/\s*,\s*|\s+e\s+|\s+ed\s+/i)
    .map((x) => pulisci(x))
    .filter(Boolean);
}

/** Toglie articoli iniziali, punteggiatura ai bordi e spazi doppi. */
function pulisci(pezzo: string): string {
  let t = (pezzo ?? '').trim().replace(/^[\s,;:.]+|[\s,;:.!?]+$/g, '').replace(/\s+/g, ' ');
  for (;;) {
    const parole = t.split(' ');
    if (parole.length > 1 && ARTICOLI.includes(normalizza(parole[0]))) t = parole.slice(1).join(' ');
    else break;
  }
  // «l'insalata» → «insalata»: l'apostrofo attaccato non è un articolo separato.
  t = t.replace(/^(l|un|dell|nell|all)['’]\s*/i, '');
  return t.trim();
}

/**
 * Il nome della persona, se la frase lo dichiara.
 *
 * ⚠️ Qui NON si cerca nessuno in banca dati: si estrae soltanto la stringa. La ricerca — e la
 * domanda «quale Simone? ne ho 93» — sta nel servizio, dove ci sono le clienti vere. Tenere separate
 * «cosa ha scritto» e «chi è» è ciò che permette di collaudare questo file senza un database.
 */
function nomePersona(testo: string): string | null {
  // «a Simone …», «per Anna Rossi …», «alla cliente Giulia …»
  // ⚠️ Le preposizioni si scrivono nelle due forme a mano invece di mettere il flag `i`: `i`
  // renderebbe insensibile anche la maiuscola del NOME, che qui è il solo segnale che distingue
  // «per Giulia» da «per domani». Senza la forma maiuscola, «Per Giulia Rossi domani» — cioè una
  // frase che comincia con la preposizione, com'è normale — non veniva riconosciuta da questa riga.
  const m = /(?:^|[\s,;.])(?:[Aa]|[Aa]d|[Pp]er|[Aa]lla|[Aa]l)\s+(?:client[ei]\s+|sig(?:\.|nora)\s+)?([A-ZÀ-Ý][\wÀ-ÿ'’]+(?:\s+[A-ZÀ-Ý][\wÀ-ÿ'’]+)?)/u.exec(testo);
  if (m) return m[1].trim();
  // «… a giulia» tutto minuscolo: si accetta solo con la preposizione attaccata a fine frase, dove
  // l'ambiguità è minima. Una parola maiuscola a caso NON è un nome: sarebbe il modo più rapido
  // per attribuire una regola alla persona sbagliata.
  const m2 = /\b(?:a|ad|per)\s+([a-zà-ÿ][\wà-ÿ'’]{2,})\s*$/u.exec(testo.trim());
  if (m2) return m2[1].trim();
  return nomeInTesta(testo);
}

/**
 * IL NOME CHE APRE LA FRASE, senza preposizione: «Jolanda Todde non darle più i ceci».
 *
 * Segnalato da Simone il 17/8 collaudando Vera. Il divieto veniva capito benissimo — è la prima
 * forma dei `DIVIETI` — ma il nome no, perché sopra si cerca soltanto dopo «a / ad / per / alla /
 * al». Il segnaposto dell'interfaccia mostra la forma che il codice sa leggere («a Giulia Rossi non
 * dare più…»), non quella che scrive chi ha in mente la cliente e comincia da lei.
 *
 * ## ⚠️ Due parole maiuscole, non una
 *
 * Ogni frase comincia con la maiuscola. Con una parola sola «Togli i ceci a Jolanda» darebbe la
 * cliente «Togli»: la regola finirebbe addosso a chiunque si chiami così, e la domanda «su quale
 * cliente?» sparirebbe proprio nel caso in cui serviva. Due nomi propri di fila in apertura sono un
 * segnale che nessun verbo italiano produce per caso.
 *
 * ⚠️ Si prova **per ultimo**: la forma con la preposizione è dichiarata, e dove c'è vince sempre.
 * E la rete sotto resta — il nome estratto qui viene cercato fra le clienti vere
 * (`risolviCliente`), quindi un'estrazione sbagliata produce «non trovo nessuna cliente che si
 * chiami…», non una regola scritta sulla persona sbagliata.
 */
/**
 * ⚠️ Le parole che aprono la frase e NON sono un nome, per quanto maiuscole. Una frase comincia
 * con la maiuscola sempre, quindi «Per Giulia Rossi domani» ha due parole maiuscole di fila come
 * «Jolanda Todde»: senza questo elenco il ripiego prenderebbe «Per Giulia» e sposterebbe la regola
 * su una persona che non esiste. Le frasi con la preposizione hanno già la loro riga, sopra.
 */
const APERTURE_NON_NOME = new Set([
  'a', 'ad', 'al', 'alla', 'allo', 'ai', 'agli', 'alle', 'per', 'con', 'di', 'da', 'del', 'della',
  'dello', 'dei', 'delle', 'in', 'su', 'sul', 'sulla', 'e', 'ma', 'poi', 'oggi', 'domani', 'ieri',
]);

function nomeInTesta(testo: string): string | null {
  const m = /^([A-ZÀ-Ý][\wÀ-ÿ'’]+)\s+([A-ZÀ-Ý][\wÀ-ÿ'’]+)\b/u.exec((testo ?? '').trim());
  if (!m) return null;
  if (APERTURE_NON_NOME.has(m[1].toLowerCase())) return null;
  return `${m[1]} ${m[2]}`.trim();
}

/**
 * Vero se la frase è una domanda o una negazione dell'istruzione: non si esegue.
 *
 * ⚠️ **Esportata dal 17/8** perché la seconda lettura (`seconda-lettura.ts`) deve poterla chiamare
 * PRIMA di passare la frase al modello: «posso togliere il pesce a Giulia?» non deve diventare
 * «togli il pesce a Giulia» passando da un traduttore. È la più insidiosa delle tre cose che possono
 * andare storte, e si ferma qui — in un posto solo, non in due.
 */
export function daScartare(testo: string): boolean {
  const t = normalizza(testo);
  if (t.includes('?')) return true;
  if (/^(posso|potrei|si puo|si può|va bene se|che ne dici)/.test(t)) return true;
  // «non togliere», «non sostituire»: l'inversione totale del significato.
  if (/\bnon\s+(togliere|sostituire|cambiare|eliminare|vietare)\b/.test(t)) return true;
  return false;
}

/** Riconosce se la frase parla di un TIPO DI DIETA invece che di una persona. */
function parlaDiDieta(testo: string): string | null {
  const m = /\b(?:nella|nel|per la|alla|della)\s+dieta\s+([\wà-ÿ]+)/iu.exec(testo);
  if (m) return m[1];
  const m2 = /\bnella\s+(mediterranea|keto|chetogenica|vegana|vegetariana|proteica|flessibile)\b/iu.exec(testo);
  return m2 ? m2[1] : null;
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Le forme di divieto che si riconoscono. In ordine: la più specifica per prima.
 *
 * ⚠️ Ogni gruppo `(...)` è il pezzo che contiene gli alimenti. Le forme sono separate e non una
 * espressione regolare furba: quando una smetterà di funzionare si vedrà QUALE, e il test dirà
 * quale frase non passa più.
 */
/**
 * ⚠️ «più» si scrive anche «piu» e «piu'»: tutte e tre arrivano da una tastiera vera. La forma
 * accentata è quella giusta ed è quella che mancava — con `piu'?` la frase più naturale di tutte
 * («non dare più il tonno») non veniva capita, e l'agente rispondeva «non ho capito» alla dettatura
 * più ovvia che esista.
 */
const PIU = "pi[u\u00f9]'?";

const DIVIETI: RegExp[] = [
  // «non dare più i formaggi molli», «non dargli più il tonno»
  new RegExp(`\\bnon\\s+d(?:are|argli|arle|iamo)\\s+${PIU}\\s+(.+)`, 'iu'),
  // «niente formaggi molli», «basta tonno»
  /\b(?:niente|basta|no)\s+(.+)/iu,
  // «togli il tonno», «elimina i formaggi molli», «vieta il tonno»
  /\b(?:togli(?:amo)?|elimina|leva|vieta|escludi)\s+(.+)/iu,
  // «non deve comparire più il tonno», «non deve più mangiare il tonno»
  new RegExp(`\\bnon\\s+deve\\s+(?:${PIU}\\s+)?(?:comparire|mangiare|avere|vedere)\\s*(?:${PIU}\\s+)?(.+)`, 'iu'),
];

/** L'eccezione: «…ma solo il grana», «…tranne il parmigiano». */
const ECCEZIONE = /\b(?:ma\s+)?(?:solo|soltanto|tranne|eccetto|a parte)\s+(.+)/iu;

/**
 * ⚠️ «Cambia» e «crea» non sono la stessa cosa, e distinguerle qui costa una parola.
 *
 * Sbagliarle costa molto di più: una modifica letta come ricetta nuova lascia in catalogo la
 * vecchia — che continua ad andare nei piatti — accanto a una copia corretta che non sostituisce
 * niente. Nel dubbio (nessun verbo riconosciuto) non si sceglie: si torna `null` e si chiede.
 */
const VERBI_NUOVA = /\b(?:crea|creare|inserisci|inserire|inseriamo|aggiungi|aggiungere|aggiungiamo|nuova|scrivi(?:amo)?)\b/iu;
const VERBI_MODIFICA = /\b(?:modific\w+|cambi\w+|corregg\w+|aggiorn\w+|sistem\w+)\b/iu;
const STILE_NOMINATO = /\b(?:menu|dieta|diete)\s+(\w+)/iu;
/** «la ricetta tonno alle olive» → il nome viene dopo la parola «ricetta». */
const NOME_DOPO_RICETTA = /\bricett[ae]\s+(?:dell?[ao']\s+|di\s+|del\s+)?([^,.;]{3,80})/iu;

function parlaDiRicetta(testo: string): IntentoRicetta | null {
  if (!/\bricett/iu.test(testo)) return null;
  const modifica = VERBI_MODIFICA.test(testo);
  const nuova = VERBI_NUOVA.test(testo);
  if (!modifica && !nuova) return null;

  // ⚠️ La modifica vince quando ci sono tutti e due i verbi: «cambia la ricetta e scrivine una
  // nuova» parla comunque di una ricetta che esiste, e trattarla come nuova la lascerebbe viva.
  const modo = modifica ? 'modifica' : 'nuova';
  const nome = modo === 'modifica' ? (NOME_DOPO_RICETTA.exec(testo)?.[1] ?? null) : null;
  const stile = STILE_NOMINATO.exec(testo)?.[1] ?? null;
  return { tipo: 'ricetta', modo, nome: nome ? nome.trim() : null, stile: stile ? stile.toLowerCase() : null };
}

/**
 * Traduce una frase in un intento, o restituisce `null`.
 *
 * `null` NON è un fallimento del sistema: è la risposta che fa scattare la domanda. Un agente che
 * indovina quando non ha capito è più pericoloso di uno che chiede.
 */
/** «Hai la lista dei…?» — sola lettura: è l'unica frase che può essere una domanda. */
const MOSTRA_FAMIGLIA = /^(?:hai|mostrami|fammi vedere|vedi|dammi|qual è|com'è|cosa c'è (?:in|nella|nei))\b.*?\b(?:lista|elenco|famiglia)\s+(?:dei|delle|degli|di|del)\s+(.{2,60}?)[?.!]*$/i;
const CREA_FAMIGLIA = /^(?:crea(?:mi)?|fai|facciamo|prepara|costruisci|impara|rifai|aggiorna)\b.*?\b(?:lista|elenco|famiglia)\s+(?:dei|delle|degli|di|del)\s+(.{2,60}?)[?.!]*$/i;

export function capisci(frase: string): Intento | null {
  /**
   * ⚠️ IL SALUTO DAVANTI NON SPIAZZA (Nocanty, 13/8 18:05: «Ciao Vera, hai la lista…?» cadeva su
   * «non ci arrivo»). La dottoressa parla, non programma: saluto e vocativo si tolgono PRIMA di
   * leggere. Il vocativo (la parola dopo il saluto) si mangia SOLO se c'è la virgola — «Senti,
   * a Giulia niente tonno» deve tenersi la sua Giulia.
   */
  const testo = (frase ?? '')
    .trim()
    .replace(/^(?:ciao|buongiorno|buonasera|salve|ehi|senti|scusa|ok|allora)[\s,!]+(?:[\wà-ÿ]{2,20},\s*)?/iu, '');
  if (!testo) return null;
  /**
   * ⚠️ LA CONSULTAZIONE PRIMA DEL FILTRO DELLE DOMANDE. `daScartare` butta via ogni «?» — e per
   * le AZIONI è sacrosanto: una domanda non si esegue. Ma «hai la lista dei formaggi molli?» è
   * una domanda che MERITA risposta (Nocanty, 13/8): mostrare una lista non esegue niente.
   */
  /**
   * ⚠️ LA CODA DEI CAMBI PRIMA DELLA LISTA (voce 245). `MOSTRA_FAMIGLIA` prende «hai la lista dei
   * X?» e catturerebbe «sostituzioni» come nome di famiglia: una lista di dizionario che non
   * esiste, mostrata al posto di una coda che esiste.
   */
  if (chiedeSostituzioni(testo)) return { tipo: 'sostituzioni' };
  /**
   * ⚠️ LE APPROVAZIONI PRIMA DELLA LISTA, per la stessa ragione della riga sopra: «hai ricette da
   * approvare?» finirebbe in `MOSTRA_FAMIGLIA` come richiesta della famiglia «ricette», che non
   * esiste — una lista vuota mostrata al posto di una coda piena.
   */
  if (chiedeApprovazioni(testo)) return { tipo: 'approvazioni' };
  /**
   * ⚠️ LA LISTA DELLE COSE DA FARE NON È UNA FAMIGLIA DEL DIZIONARIO (19/8 sera, dalla revisione).
   *
   * `MOSTRA_FAMIGLIA` prende «dammi la lista dei X» e catturava «cose da fare» come **nome di
   * famiglia**: Vera rispondeva «non conosco "cose da fare", dimmi quali alimenti ne fanno parte» e
   * alla risposta scriveva nel dizionario una famiglia inventata con dentro «chiamare Giulia».
   * ⚠️ Quel dizionario serve a scrivere i **divieti**: sporcarlo è peggio di non capire la frase.
   */
  const mostraF = MOSTRA_FAMIGLIA.exec(testo);
  if (mostraF && !/^(?:cose|attivita|lavori|roba)\b/i.test(mostraF[1].trim())) {
    return { tipo: 'famiglia', azione: 'mostra', nome: mostraF[1].trim().toLowerCase() };
  }
  // «Hai segnalazioni per me?» — come la lista: una domanda che merita risposta, PRIMA di
  // `daScartare` che butta via ogni «?». Rispondere non esegue niente.
  /**
   * ⚠️ La lista PRIMA del quadro: sono due domande diverse e la seconda è più larga. Messa dopo,
   * «cosa devo fare oggi» finirebbe nel quadro dei conteggi — che risponde a «quanto lavoro c'è»,
   * non a «quale».
   */
  if (chiedeLista(testo)) return { tipo: 'lista' };
  if (chiedeSegnalazioni(testo)) return { tipo: 'segnalazioni' };
  /**
   * L'EQUIVALENZA (19/8, dallo screenshot in cui Vera rispondeva due volte «non ci arrivo»).
   *
   * ⚠️ **La causa era semplicemente che nessun caso la prendeva**: la frase attraversava tutto il
   * riconoscitore e usciva `null`. Avevo scritto qui che il colpevole era `daScartare` — la funzione
   * che butta via le frasi senza una cliente — e **non è vero**: provata, quella lascia passare
   * «aggiungi equivalenza». La mutazione che sposta questa riga dopo di lei non fa fallire nessun
   * test, ed è così che me ne sono accorto. Una ragione falsa è peggio di un ordine sbagliato,
   * perché sembra aver già risolto il problema (lezione del 19/8 mattina sull'ordine del cron).
   *
   * ⚠️ Sta comunque **prima** della riga che chiede «di chi stiamo parlando?», e quello sì conta: un
   * gruppo di equivalenza non ha una cliente — vale per tutte.
   */
  const equi = leggiEquivalenza(testo);
  if (equi) return { tipo: 'equivalenza', alimenti: equi.alimenti, nome: equi.nome };
  if (daScartare(testo)) return null;

  // 0-quinquies) LA GIORNATA DETTATA: si riconosce da DUE pasti nominati con i due punti. Prima
  //              di tutto il resto, perché dentro ci sono nomi di piatti che gli altri
  //              riconoscitori leggerebbero volentieri come alimenti da vietare.
  const giornata = leggiIntentoGiornata(testo);
  if (giornata) return giornata;

  // 0-quater) LE PROTEINE: prima delle calorie e dei divieti — «più proteine» contiene «più», e
  //           «niente proteine in polvere» deve restare un divieto.
  const prot = leggiProteine(testo);
  if (prot) return prot;

  // 0-ter) LE CALORIE: «riduci le kcal del 10% a Giulia per 7 giorni». Prima dei divieti, perché
  //        «riduci/togli» sono le stesse parole con cui si vieta un alimento — e «togli il 10% di
  //        formaggio» deve restare un divieto.
  const kcal = leggiCorrezioneKcal(testo);
  if (kcal) return kcal;

  // 0-bis) Il CAMBIO di dieta per una persona («sposta Giulia sulla keto») va letto PRIMA della
  //         regola di dieta: contiene le stesse parole («sulla keto») e senza quest'ordine
  //         finirebbe in `fuori_portata` — capito, e capito male.
  const cambio = leggiCambioDieta(testo);
  if (cambio) return cambio;

  // 1) Parla di un tipo di dieta? Allora NON è una regola su una cliente, e non so ancora farla.
  //    Va riconosciuto PRIMA di tutto: «nella mediterranea» contiene una preposizione che il
  //    riconoscitore di persone leggerebbe volentieri come un nome.
  const dieta = parlaDiDieta(testo);
  if (dieta) return { tipo: 'fuori_portata', cosa: 'regola_dieta', dettaglio: dieta };

  // 2) Una ricetta: nuova o da cambiare.
  const ricetta = parlaDiRicetta(testo);
  if (ricetta) return ricetta;

  const cliente = nomePersona(testo);

  // 3) Sostituzione: la delega al riconoscitore che esiste già, con le sue regole sulle due
  //    direzioni invertite. Riscriverlo qui sarebbe la seconda copia, e le seconde copie divergono.
  const sost = sostituzioniNelMessaggio(testo);
  if (sost.length) {
    return { tipo: 'sostituzione', cliente, from: sost[0].from, to: sost[0].to };
  }

  // 3-bis) LA FAMIGLIA A SECCO (Nocanty, 13/8): «hai la lista dei formaggi molli?»,
  //        «crea la lista dei formaggi molli». Prima esisteva solo DENTRO una regola: chiederla
  //        fuori faceva «non ci arrivo», che per una lista che il dizionario ha è una bugia.
  const creaF = CREA_FAMIGLIA.exec(testo);
  if (creaF) return { tipo: 'famiglia', azione: 'crea', nome: creaF[1].trim().toLowerCase() };

  // 4) I PASTI: «togli lo spuntino», «rimetti la merenda» (azione 3, Decisioni 13/8 §14).
  //    ⚠️ PRIMA dei divieti: altrimenti «togli lo spuntino» diventerebbe il divieto dell'alimento
  //    «spuntino» — perfettamente formato, e completamente sbagliato. Il riconoscitore è stretto
  //    apposta: «togli lo yogurt dallo spuntino» parla del contenuto e resta un divieto.
  const pasti: LetturaPasti | null = leggiPasti(testo);
  if (pasti) return { tipo: 'pasti', cliente, azione: pasti.azione, slots: pasti.slots };

  // 4bis) Divieto, eventualmente con eccezione.

  for (const forma of DIVIETI) {
    const m = forma.exec(testo);
    if (!m) continue;
    let coda = m[1];

    // L'eccezione si stacca PRIMA di leggere l'elenco dei vietati, altrimenti «ma solo il grana»
    // finirebbe fra le cose da vietare — cioè l'esatto contrario di quello che ha detto.
    let tenuti: string[] = [];
    const ecc = ECCEZIONE.exec(coda);
    if (ecc) {
      tenuti = elenco(ecc[1]);
      coda = coda.slice(0, ecc.index);
    } else {
      const fine = FINE.exec(coda);
      if (fine) coda = coda.slice(0, fine.index);
    }

    // Se il nome della persona è finito dentro la coda («togli il tonno a Giulia») va tolto: è una
    // persona, non un alimento, e vietare «giulia» non toglierebbe niente ma sporcherebbe il profilo.
    if (cliente) {
      coda = coda.replace(new RegExp(`\\s*\\b(?:a|ad|per|alla|al)\\s+${escapeRe(cliente)}\\b`, 'iu'), '');
    }

    const vietati = elenco(coda);
    if (!vietati.length) return null;
    return { tipo: 'restrizione', cliente, vietati, tenuti };
  }

  return null;
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * «HAI SEGNALAZIONI PER ME?» — le forme della domanda sulla giornata (Simone, 14/8).
 *
 * ⚠️ Tutte ANCORATE all'intera frase: «avvisi Giulia che salta il controllo» CONTIENE «avvisi» ma è
 * un'istruzione, e deve restare non capita — non diventare la domanda. Meglio un «non ci arrivo»
 * che un quadro della giornata al posto di un'azione.
 *
 * ⚠️ Niente `\b` sulle parole accentate (`\b` in JavaScript è ASCII, trappola già pagata): prima si
 * normalizzano accenti e apostrofi («novità» → «novita», «c'è» → «c e»), poi si confronta.
 */
const FORME_SEGNALAZIONI: RegExp[] = [
  /^(?:hai|ci sono|che|quali|dammi|dimmi|leggimi|vedi)?\s*(?:le\s+|delle\s+|degli\s+|gli\s+)?(?:segnalazioni|avvisi|notifiche|novita)(?:\s+(?:nuove|nuovi|per me|da vedere|da leggere|da gestire|oggi))*\s*$/,
  /^cosa (?:mi aspetta|aspetta me)(?:\s+oggi)?\s*$/,
  /^(?:cosa|che cosa|che) c e (?:da (?:fare|vedere|gestire)|per me|di nuovo)(?:\s+oggi)?\s*$/,
  /^cosa devo fare(?:\s+oggi)?\s*$/,
  /^da dove (?:comincio|inizio|parto)(?:\s+oggi)?\s*$/,
  /^guidami\s*$/,
];

/**
 * «VERIFICHIAMO I CAMBI» — le forme della coda delle sostituzioni (voce 245).
 *
 * ⚠️ Ancorate all'intera frase, come quelle delle segnalazioni e per lo stesso motivo: una frase
 * che CONTIENE «sostituzioni» («a Giulia sostituisci la panna col latte») è un'istruzione da
 * eseguire, non una coda da aprire. Aprire la coda al posto di eseguire sarebbe capire male con
 * l'aria di aver capito, che è il modo peggiore.
 */
const FORME_SOSTITUZIONI: RegExp[] = [
  // «verifichiamo i cambi» — l'imperativo
  /^(?:verifichiamo|verifica|verificare|vediamo|guardiamo|controlliamo|riguardiamo)\s+(?:i |le |gli |dei |delle )?(?:cambi|sostituzioni)(?:\s+(?:concordati|concordate|da verificare|in chat|delle clienti|aperti|aperte))*$/,
  // «ci sono cambi da verificare?» / «fammi vedere la lista delle sostituzioni»
  /^(?:ci sono|hai|ce ne sono|quali sono|quante sono|dammi|dimmi|leggimi|mostrami|fammi vedere|vedi)\s+(?:la |le |i |gli |dei |delle )?(?:lista (?:dei|delle|di) )?(?:cambi|sostituzioni)(?:\s+(?:da verificare|da guardare|da controllare|concordati|concordate|in chat|aperti|aperte|in sospeso|in coda))*$/,
  // «sostituzioni da verificare» / «i cambi concordati in chat» — il titolo secco
  /^(?:i |le |gli )?(?:cambi|sostituzioni)\s+(?:da verificare|da guardare|da controllare|concordati|concordate|in chat|aperti|aperte|in sospeso|in coda)(?:\s+(?:in chat|da verificare))*$/,
  /**
   * ⚠️ «QUALE sostituzione devo verificare?» — la domanda che fa la PASTIGLIA (Simone, 17/8).
   *
   * In cima alla chat c'è scritto «1 sostituzioni da verificare». Lui ha chiesto esattamente quello
   * che quella riga invita a chiedere, e Vera ha risposto «non trovo nessuna cliente che si chiami
   * "quale sostituzione devo verificare?"».
   *
   * Un'interfaccia che annuncia una cosa e poi non sa rispondere quando gliela chiedi è peggio di
   * una che non l'annuncia: chi legge la pastiglia impara che l'assistente non c'entra niente con
   * quello che la pastiglia dice. La pastiglia È la domanda, e va riconosciuta.
   */
  /^(?:quale|quali|qual e|che|che cosa)\s+(?:e |sono )?(?:la |le |il |i |lo |gli )?(?:cambio|cambi|sostituzione|sostituzioni)\s+(?:devo|dobbiamo|posso|possiamo|c e da|ci sono da|da)\s+(?:verificare|guardare|controllare|vedere)$/,
];

/**
 * «COSA C'È DA APPROVARE?» — le forme delle tre code del catalogo (18/8).
 *
 * ⚠️ Ancorate all'intera frase, per lo stesso motivo delle altre due: «approva il gruppo dei
 * formaggi» CONTIENE «approva» ed è un'istruzione su una cosa precisa, non una coda da aprire.
 *
 * ⚠️ E «la ricetta X va approvata» non deve finire qui: la parola da sola non basta, ci vuole la
 * forma della domanda. Meglio un «non ho capito» che aprire sessanta piatti quando ne intendevi uno.
 */
const FORME_APPROVAZIONI: RegExp[] = [
  // il titolo secco, e la parola che le pastiglie scrivono
  /^(?:le )?approvazioni(?:\s+(?:in sospeso|aperte|del catalogo|da fare))?$/,
  /^(?:cosa|che cosa|che|quanto) c e da approvare(?:\s+(?:oggi|in catalogo))?$/,
  /^(?:ci sono|hai|ce ne sono|quali sono|quante sono|dammi|dimmi|mostrami|fammi vedere|vedi)\s+(?:delle |le |dei |i |gli )?(?:cose|ricette|combinazioni|allergeni|voci|approvazioni)?\s*(?:da approvare|da confermare|da validare|da verificare in catalogo)(?:\s+(?:in catalogo|in sospeso|aperte))?$/,
  // l'imperativo: «approviamo», «riprendiamo le approvazioni», «continuiamo con le approvazioni»
  /^(?:approviamo|riprendiamo|riprendi|continuiamo|continua|andiamo avanti con|ricominciamo)(?:\s+(?:con|le|la|i|gli))*\s*(?:approvazioni|coda|revisione|catalogo)?$/,
  /^(?:approviamo|validiamo|revisioniamo|guardiamo|vediamo)\s+(?:le |i |gli )?(?:ricette|combinazioni|allergeni|cose)\s+(?:da approvare|da confermare|in bozza|nuove)$/,
  /^(?:quale|quali|cosa)\s+(?:ricetta|ricette|combinazione|combinazioni)\s+(?:devo|dobbiamo|posso|c e da|ci sono da|da)\s+approvare$/,
];

function chiedeApprovazioni(testo: string): boolean {
  return FORME_APPROVAZIONI.some((f) => f.test(pulisciDomanda(testo)));
}

function chiedeSostituzioni(testo: string): boolean {
  return FORME_SOSTITUZIONI.some((f) => f.test(pulisciDomanda(testo)));
}

/**
 * «FAMMI LA LISTA» — le cose da fare **numerate**, non contate (Simone, 19/8).
 *
 * ⚠️ È una domanda diversa da «hai segnalazioni per me?», che porta il **quadro** in conteggi. Qui si
 * chiede l'elenco: si può dire «faccio la 3», si vede il nome di chi aspetta, e si depenna. Chi
 * legge un conteggio sa solo che è indietro.
 */
const FORME_LISTA = [
  /^(?:fammi|dammi|mostrami|fai|vediamo|voglio)\s+(?:vedere\s+)?(?:la\s+)?lista(?:\s+(?:delle|di|dei)\s+(?:cose|attivita|lavori).*)?$/,
  /^(?:cosa|che cosa|che)\s+(?:devo|dobbiamo|c e da|ho da)\s+fare(?:\s+(?:oggi|adesso|stamattina|stamane))?$/,
  /^(?:lista|elenco)(?:\s+(?:delle|di|dei)\s+(?:cose|attivita|lavori).*)?$/,
  /^(?:le\s+)?cose\s+da\s+fare$/,
];

function chiedeLista(testo: string): boolean {
  return FORME_LISTA.some((f) => f.test(pulisciDomanda(testo)));
}

function chiedeSegnalazioni(testo: string): boolean {
  return FORME_SEGNALAZIONI.some((f) => f.test(pulisciDomanda(testo)));
}

/** Minuscolo, senza accenti, senza apostrofi, senza il punto di domanda in coda. */
function pulisciDomanda(testo: string): string {
  return testo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’`]/g, ' ')
    .replace(/[?!.]+\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * «SPOSTA GIULIA SULLA KETO» — le forme del cambio dieta. Ancorate alla FINE della frase: il nome
 * della dieta è l'ultima parola, e una coda qualsiasi («sposta Giulia sulla keto perché…») passa
 * comunque dal taglio di `FINE` fatto a monte? No: qui non c'è un elenco da leggere, quindi la
 * frase deve finire con la dieta — una coda libera farebbe capire male, e capire male è peggio.
 */
const CAMBI_DIETA: RegExp[] = [
  // «sposta/metti/porta Giulia (Rossi) sulla (dieta) keto»
  /\b(?:sposta|spostiamo|spostala|metti|mettila|mettiamo|porta|portala)\s+([a-zà-ÿ' ]+?)?\s*(?:sulla|alla|nella)\s+(?:dieta\s+)?([\wà-ÿ]+)\s*$/iu,
  // «Giulia passa alla (dieta) vegetariana»
  /^([a-zà-ÿ' ]+?)\s+passa\s+(?:alla|sulla)\s+(?:dieta\s+)?([\wà-ÿ]+)\s*$/iu,
];

/** «cambia la dieta a Giulia», senza dire quale: la dieta si chiede dopo. */
const CAMBIA_DIETA_SECCO = /\bcambia(?:re|mo)?\s+(?:la\s+)?dieta\s+(?:a|ad|di|alla|della)\s+([a-zà-ÿ' ]+?)\s*$/iu;

/** Il nome catturato, ripulito: articoli e pronomi non sono una persona. */
function personaPulita(grezzo: string | undefined): string | null {
  const p = (grezzo ?? '').replace(/\b(?:la|lo|le|li|il|signora|signor)\b/giu, ' ').replace(/\s+/g, ' ').trim();
  return p.length >= 2 ? p : null;
}

function leggiCambioDieta(testo: string): IntentoCambioDieta | null {
  for (const forma of CAMBI_DIETA) {
    const m = forma.exec(testo);
    if (m) return { tipo: 'cambio_dieta', cliente: personaPulita(m[1]), dieta: m[2].trim().toLowerCase() };
  }
  const secco = CAMBIA_DIETA_SECCO.exec(testo);
  if (secco) return { tipo: 'cambio_dieta', cliente: personaPulita(secco[1]), dieta: null };
  return null;
}

/**
 * «RIDUCI LE KCAL DEL 10% A GIULIA PER 7 GIORNI» — la correzione calorica dettata.
 *
 * ⚠️ Pretende la parola **kcal/calorie**: senza, «riduci del 10% a Giulia» potrebbe essere
 * qualunque cosa, e «togli il 10% di formaggio» è un divieto. La percentuale e il verbo da soli non
 * bastano mai — è la parola che dice DI COSA si sta parlando.
 */
const CORREZIONE_KCAL =
  /\b(riduci|riduciamo|abbassa|abbassiamo|taglia|togli|diminuisci|aumenta|aumentiamo|alza|alziamo)\b[^.]{0,40}?\b(kcal|calorie|apporto calorico)\b[^.]{0,60}?(\d{1,2})\s*%/iu;
const CORREZIONE_KCAL_INVERSA =
  /\b(kcal|calorie|apporto calorico)\b[^.]{0,20}?\b(riduci|abbassa|taglia|togli|diminuisci|aumenta|alza)\w*\b[^.]{0,40}?(\d{1,2})\s*%/iu;

/** «per 7 giorni», «per una settimana», «per due settimane». `null` = non l'ha detto. */
function leggiGiorni(testo: string): number | null {
  const settimane = /\bper\s+(una|due|tre|quattro|\d{1,2})\s+settiman[ae]\b/iu.exec(testo);
  if (settimane) {
    const parole: Record<string, number> = { una: 1, due: 2, tre: 3, quattro: 4 };
    const n = parole[settimane[1].toLowerCase()] ?? Number(settimane[1]);
    return Number.isFinite(n) && n > 0 ? n * 7 : null;
  }
  const giorni = /\bper\s+(\d{1,3})\s+giorn[oi]\b/iu.exec(testo);
  if (giorni) {
    const n = Number(giorni[1]);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

function leggiCorrezioneKcal(testo: string): IntentoCorrezioneKcal | null {
  const m = CORREZIONE_KCAL.exec(testo) ?? CORREZIONE_KCAL_INVERSA.exec(testo);
  if (!m) return null;
  const verbo = (CORREZIONE_KCAL.exec(testo) ? m[1] : m[2]).toLowerCase();
  const numero = Number(CORREZIONE_KCAL.exec(testo) ? m[3] : m[3]);
  if (!Number.isFinite(numero) || numero <= 0) return null;
  // Il segno viene dal VERBO: «riduci» toglie, «aumenta» aggiunge. Scriverlo qui una volta evita
  // che a valle qualcuno debba indovinare cosa voleva dire un 10 senza segno.
  const inAumento = /^(aumenta|aumentiamo|alza|alziamo)/.test(verbo);
  return {
    tipo: 'correzione_kcal',
    cliente: nomePersona(testo),
    pct: inAumento ? numero : -numero,
    giorni: leggiGiorni(testo),
  };
}

/**
 * «RIFAI CON PIÙ PROTEINE» / «PORTA GIULIA AL 35% DI PROTEINE».
 *
 * ⚠️ Pretende la parola **proteine** insieme a un aumento o a una percentuale: «niente proteine in
 * polvere» è un divieto e deve restare tale, e la parola da sola non chiede niente.
 */
const PIU_PROTEINE = /\b(piu|più)\s+proteic\w*|\b(piu|più)\s+proteine\b|\bproteine\s+(piu|più)\s+alt/iu;
const PROTEINE_AL_PCT = /\b(?:porta\w*|metti\w*|alza\w*|imposta\w*)\b[^.]{0,40}?(\d{1,2})\s*%[^.]{0,20}?\bprotein/iu;
const PROTEINE_PCT_AL = /\bprotein\w*[^.]{0,25}?\bal\s+(\d{1,2})\s*%/iu;

/**
 * «Porta **Giulia Rossi** al 35%»: qui il nome sta subito dopo il verbo, senza la preposizione che
 * `nomePersona` cerca. Si riconosce dalla maiuscola — un nome proprio ce l'ha, «le calorie» no — e
 * si prova SOLO come ripiego: la strada normale resta `nomePersona`.
 */
const NOME_DOPO_IL_VERBO =
  /\b(?:porta|portala|portiamo|metti|mettila|alza|alziamo|imposta|impostiamo)\s+([A-ZÀ-Ý][a-zà-ÿ']{1,20}(?:\s+[A-ZÀ-Ý][a-zà-ÿ']{1,20})?)\s+(?:al|a|alla)\b/u;

function chiPortaAl(testo: string): string | null {
  const m = NOME_DOPO_IL_VERBO.exec(testo);
  return m ? m[1].trim() : null;
}

function leggiProteine(testo: string): IntentoProteine | null {
  const conNumero = PROTEINE_AL_PCT.exec(testo) ?? PROTEINE_PCT_AL.exec(testo);
  if (conNumero) {
    const n = Number(conNumero[1]);
    if (Number.isFinite(n) && n > 0 && n <= 99) {
      return { tipo: 'proteine', cliente: nomePersona(testo) ?? chiPortaAl(testo), pct: Math.round(n) / 100 };
    }
  }
  if (PIU_PROTEINE.test(testo)) {
    return { tipo: 'proteine', cliente: nomePersona(testo) ?? chiPortaAl(testo), pct: null };
  }
  return null;
}

/**
 * ⚠️ Una giornata dettata si riconosce da **almeno due pasti** nominati con i due punti.
 *
 * Con uno solo («Cena: orata») la frase somiglia troppo a mille altre cose, e sbagliare qui vuol
 * dire prendere per un menu quello che era un appunto. Due pasti in due righe non capitano per caso.
 */
function leggiIntentoGiornata(testo: string): IntentoGiornata | null {
  const righe = leggiGiornataDettata(testo);
  if (righe.length < 2) return null;
  /**
   * ⚠️ Il nome si cerca nella RIGA DI APERTURA, non in tutto il testo: sotto ci sono i nomi dei
   * piatti, e «Orata» con la maiuscola a inizio riga somiglia troppo a un nome di persona. La
   * riga di apertura è quella che dice per chi è la giornata.
   */
  const apertura = (testo ?? '').split('\n')[0] ?? '';
  // ⚠️ Niente flag `i`: renderebbe insensibile anche la maiuscola del NOME, che è il solo segnale
  // che distingue «per Giulia» da «per domani». Le due forme del verbo si scrivono a mano.
  const dallApertura = /\b(?:[Pp]er|[Aa]d?)\s+([A-ZÀ-Ý][a-zà-ÿ']{1,20}(?:\s+[A-ZÀ-Ý][a-zà-ÿ']{1,20})?)/u.exec(apertura);
  return { tipo: 'giornata', cliente: nomePersona(apertura) ?? (dallApertura ? dallApertura[1].trim() : null), testo };
}
