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
import { normalizza } from '../common/nomi-alimento';
import { sostituzioniNelMessaggio } from '../food-swaps/impara-dalla-chat';

/** Cosa Vera ha capito di dover fare. `null` = non ho capito, e lo dico. */
export type Intento =
  | IntentoRestrizione
  | IntentoSostituzione
  | IntentoFuoriPortata;

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
 * Ho capito COSA vuole, ma non è una cosa che so ancora fare.
 *
 * ⚠️ Serve, e non è un ripiego. «Nella mediterranea niente tonno» è una regola su un TIPO DI DIETA:
 * senza questo caso il riconoscitore la leggerebbe come una restrizione su una cliente di nome
 * «mediterranea», o peggio la applicherebbe all'ultima cliente nominata. Dire «questo non lo so
 * ancora fare» è una risposta; fare la cosa sbagliata con sicurezza non lo è.
 */
export interface IntentoFuoriPortata {
  tipo: 'fuori_portata';
  cosa: 'regola_dieta' | 'ricetta';
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
  const m = /(?:^|[\s,;.])(?:a|ad|per|alla|al)\s+(?:client[ei]\s+|sig(?:\.|nora)\s+)?([A-ZÀ-Ý][\wÀ-ÿ'’]+(?:\s+[A-ZÀ-Ý][\wÀ-ÿ'’]+)?)/u.exec(testo);
  if (m) return m[1].trim();
  // «… a giulia» tutto minuscolo: si accetta solo con la preposizione attaccata a fine frase, dove
  // l'ambiguità è minima. Una parola maiuscola a caso NON è un nome: sarebbe il modo più rapido
  // per attribuire una regola alla persona sbagliata.
  const m2 = /\b(?:a|ad|per)\s+([a-zà-ÿ][\wà-ÿ'’]{2,})\s*$/u.exec(testo.trim());
  return m2 ? m2[1].trim() : null;
}

/** Vero se la frase è una domanda o una negazione dell'istruzione: non si esegue. */
function daScartare(testo: string): boolean {
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
 * Traduce una frase in un intento, o restituisce `null`.
 *
 * `null` NON è un fallimento del sistema: è la risposta che fa scattare la domanda. Un agente che
 * indovina quando non ha capito è più pericoloso di uno che chiede.
 */
export function capisci(frase: string): Intento | null {
  const testo = (frase ?? '').trim();
  if (!testo || daScartare(testo)) return null;

  // 1) Parla di un tipo di dieta? Allora NON è una regola su una cliente, e non so ancora farla.
  //    Va riconosciuto PRIMA di tutto: «nella mediterranea» contiene una preposizione che il
  //    riconoscitore di persone leggerebbe volentieri come un nome.
  const dieta = parlaDiDieta(testo);
  if (dieta) return { tipo: 'fuori_portata', cosa: 'regola_dieta', dettaglio: dieta };

  // 2) Una ricetta nuova o modificata: idem, non in questa consegna.
  if (/\b(?:crea|inserisci|aggiungi|scrivi|modifica|cambia)\b.{0,20}\bricett/iu.test(testo)) {
    return { tipo: 'fuori_portata', cosa: 'ricetta', dettaglio: testo };
  }

  const cliente = nomePersona(testo);

  // 3) Sostituzione: la delega al riconoscitore che esiste già, con le sue regole sulle due
  //    direzioni invertite. Riscriverlo qui sarebbe la seconda copia, e le seconde copie divergono.
  const sost = sostituzioniNelMessaggio(testo);
  if (sost.length) {
    return { tipo: 'sostituzione', cliente, from: sost[0].from, to: sost[0].to };
  }

  // 4) Divieto, eventualmente con eccezione.
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
