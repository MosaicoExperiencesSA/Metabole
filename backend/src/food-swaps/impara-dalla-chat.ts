/**
 * IMPARARE LE SOSTITUZIONI DALLE CHAT DEL NUTRIZIONISTA — solo il riconoscimento del testo.
 *
 * Richiesta di Simone (12/8): «Gaia dovrebbe leggere anche le chat del nutrizionista ed apprendere
 * anche da lì le sostituzioni».
 *
 * ## Perché è la fonte migliore che abbiamo, e perché è anche la più pericolosa
 *
 * Le sostituzioni della tabella §16.9 nascono quasi tutte da una cliente che chiede e da Gaia che
 * concede: sono richieste, e infatti nascono `da_verificare`. Quelle che il nutrizionista scrive in
 * chat sono di un'altra natura — sono **decisioni cliniche già prese**, dette da chi ha la
 * responsabilità di prenderle. Buttarle via è esattamente quello che facevamo: restavano dentro una
 * conversazione che nessun altro pezzo del sistema legge, e la settimana dopo Gaia rispondeva «devo
 * chiedere alla tua nutrizionista» su una cosa che la nutrizionista aveva già concesso per iscritto.
 *
 * Il pericolo però non è nel contenuto, è **in chi lo legge**: quella frase è stata scritta per una
 * persona, non per un programma. Chi può sbagliare qui non è il nutrizionista, è questo file.
 *
 * ## ⚠️ Le due direzioni, che in italiano sono invertite
 *
 * - «sostituisci **il pollo** con **il tacchino**» → pollo diventa tacchino.
 * - «**il tacchino** al posto **del pollo**» → *sempre* pollo diventa tacchino.
 *
 * La seconda forma dice prima l'arrivo e poi la partenza. Capirla al contrario non produce un
 * errore: produce una regola **perfettamente formata e rovesciata**, che nessuno legge come
 * sbagliata finché non arriva nel piatto di qualcuno. È il primo test del file, ed è il motivo per
 * cui le due famiglie di frasi sono due funzioni separate e non una espressione regolare furba.
 *
 * ## ⚠️ Nel dubbio non si impara
 *
 * Qui la regola del «nel dubbio si concede» (vedi `prenotazioni.ts`) vale **al contrario**, perché
 * al contrario è il costo dell'errore: una sostituzione mancata è un lavoro in più per il
 * nutrizionista — che comunque scriverà la riga a mano — mentre una sostituzione inventata è cibo
 * sbagliato proposto a una persona con l'autorevolezza di chi la segue. Quindi ogni forma
 * ambigua si scarta:
 *
 * - le **domande** («posso sostituire il pane con le gallette?») non sono istruzioni, e la stessa
 *   frase con o senza punto di domanda vuol dire due cose opposte;
 * - le **negazioni** («non sostituire X con Y») sono l'inversione totale del significato;
 * - i **pronomi** («al posto di quello») non dicono niente a chi legge dopo;
 * - i **pasti e i giorni** («al posto della cena», «al posto di domani») non sono alimenti: chi
 *   li scrive sta parlando di come organizzare la giornata, non di che cosa mettere nel piatto;
 * - le frasi **lunghe** non sono nomi di alimento: si tagliano a poche parole e alla prima
 *   congiunzione, e se restano lunghe si scartano.
 *
 * Le alternative multiple («con le gallette **oppure** i cracker») si fermano alla prima di
 * proposito. Estrarle tutte e due vorrebbe dire indovinare dove finisce la seconda; perderne una è
 * una riga che il nutrizionista aggiunge in un secondo dalla tabella, inventarla è un alimento che
 * non ha mai nominato.
 */
import { chiaveAlimento, normalizza } from '../common/nomi-alimento';

export interface SostituzioneLetta {
  /** L'alimento che esce dal piatto. */
  from: string;
  /** Quello che ci entra. */
  to: string;
  /** La frase da cui è stata letta, per come è stata scritta: serve a chi deve confermare. */
  frase: string;
}

/** Parole che aprono un'altra proposizione: il nome dell'alimento finisce lì. */
const FINE_FRASE = new Set([
  'e', 'ma', 'pero', 'però', 'poi', 'quindi', 'perche', 'perché', 'mentre', 'oppure', 'o',
  'se', 'cosi', 'così', 'che', 'quando', 'anche', 'sempre', 'ogni', 'mi', 'ti', 'ci', 'si',
  'va', 'vanno', 'sono', 'e\'', 'puoi', 'devi', 'deve', 'possiamo', 'facciamo',
]);

/** Articoli e preposizioni articolate all'inizio del nome: si tolgono. */
const ARTICOLI = new Set([
  'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una', "un'", "l'", "dell'", "all'",
  'del', 'dello', 'della', 'dei', 'degli', 'delle', 'al', 'allo', 'alla', 'ai', 'agli', 'alle',
  'di', 'da', 'dal', 'dallo', 'dalla', 'dai', 'dagli', 'dalle', 'per', 'con', 'su', 'tuo', 'tua',
  'suo', 'sua', 'quel', 'quella', 'quello', 'questo', 'questa',
]);

/**
 * Parole che non sono alimenti e che compaiono spesso in queste stesse frasi. Un nome che si
 * riduce a una di queste non è una sostituzione: è un'altra conversazione.
 */
const NON_ALIMENTI = new Set([
  // pronomi e vaghezze
  'quello', 'quella', 'questo', 'questa', 'quelli', 'quelle', 'esso', 'essa', 'lui', 'lei',
  'cio', 'ciò', 'altro', 'altra', 'altri', 'altre', 'tutto', 'tutta', 'niente', 'nulla',
  'qualcosa', 'roba', 'cosa', 'cose', 'te', 'me', 'noi', 'voi', 'loro', 'solito',
  // pasti, giorni, tempo: chi li nomina sta organizzando la giornata, non il piatto
  'colazione', 'pranzo', 'cena', 'spuntino', 'spuntini', 'merenda', 'merende', 'snack',
  'pasto', 'pasti', 'dieta', 'menu', 'menù', 'piano', 'giorno', 'giorni', 'settimana',
  'settimane', 'oggi', 'domani', 'ieri', 'dopodomani', 'sera', 'serata', 'mattina', 'mattino',
  'pomeriggio', 'notte', 'weekend', 'sabato', 'domenica', 'lunedi', 'lunedì', 'martedi',
  'martedì', 'mercoledi', 'mercoledì', 'giovedi', 'giovedì', 'venerdi', 'venerdì',
  // quantità e misure
  'grammi', 'grammo', 'porzione', 'porzioni', 'quantita', 'quantità', 'peso', 'volta', 'volte',
  'meta', 'metà', 'poco', 'poca', 'tanto', 'tanta', 'meno', 'piu', 'più',
]);

/** Al massimo quante parole può avere il nome di un alimento prima di non essere più un nome. */
const PAROLE_MAX = 4;

/**
 * ⚠️ L'articolo elidato è **attaccato** al nome: «l'olio» è una parola sola, e senza questa riga il
 * nome imparato sarebbe «l'olio» — che non combacia con «olio» in nessuna delle due tabelle.
 */
const senzaArticoloAttaccato = (parola: string): string =>
  parola.replace(/^(?:l|un|dell|all|nell|dall|sull|quell)['’]\s*/i, '');

/**
 * ⛔ **LE PAROLE CHE `nomeAlimento` SCARTA DI PROPOSITO, contate a parte.**
 *
 * Serve a chi deve sapere se una lettura ha **perso** qualcosa. `nomeAlimento` toglie l'articolo
 * iniziale — è il suo mestiere, non un troncamento — ma chi confronta «quante parole sono entrate»
 * con «quante ce n'erano» vede un articolo mancante e conclude che il nome è stato letto a metà.
 *
 * ⚠️ È successo davvero, ed è costato caro: dal 31/8 `leggiElenco` rifiutava **ogni** alimento
 * scritto con l'articolo — «il merluzzo», «le zucchine, le melanzane», «la ricotta o lo
 * stracchino» — cioè il modo normale di scrivere di una persona. La nutrizionista si sentiva
 * rispondere «non ci arrivo» su cinque frasi normali su sette, e il controllo che rifiutava tutto
 * era **quello nato per impedire i troncamenti silenziosi**: giusto nell'intenzione, cieco su cosa
 * fosse davvero perso.
 */
export function paroleDaLeggere(pezzo: string): number {
  const grezzo = (pezzo ?? '').replace(/[.,;:!?()"«»]/g, ' ').trim();
  if (!grezzo) return 0;
  let quante = 0;
  for (const grezza of grezzo.split(/\s+/)) {
    const p = quante === 0 ? senzaArticoloAttaccato(grezza) : grezza;
    const n = normalizza(p);
    if (!n) continue;
    /**
     * ⛔ **SOLO l'articolo iniziale**, e nient'altro. La prima stesura copiava da `nomeAlimento`
     * anche il `break` su `FINE_FRASE` — e così spegneva il controllo che doveva servire: su «sale
     * e pepe» tutte e due le funzioni si fermavano a «sale», i conti tornavano, e passava un nome
     * letto a metà. ⚠️ Trovato da `elenco-alimenti.spec.ts`, che quel caso lo teneva fermo da
     * ieri: fermarsi a una congiunzione **è** il troncamento da segnalare, non una parola scartata
     * di proposito.
     */
    if (quante === 0 && ARTICOLI.has(n)) continue;
    quante += 1;
  }
  return quante;
}

/**
 * Ripulisce il pezzo di frase catturato: toglie l'articolo, si ferma alla prima congiunzione o
 * punteggiatura, e non va oltre poche parole. Ritorna `null` se quello che resta non è un nome.
 */
export function nomeAlimento(pezzo: string): string | null {
  const grezzo = (pezzo ?? '').replace(/[.,;:!?()"«»]/g, ' ').trim();
  if (!grezzo) return null;

  const parole: string[] = [];
  for (const grezza of grezzo.split(/\s+/)) {
    const p = parole.length === 0 ? senzaArticoloAttaccato(grezza) : grezza;
    const n = normalizza(p);
    if (!n) continue;
    // L'articolo si scarta solo finché siamo all'inizio: «olio di oliva» tiene il suo «di».
    if (parole.length === 0 && ARTICOLI.has(n)) continue;
    if (FINE_FRASE.has(n)) break;
    parole.push(p.trim());
    if (parole.length >= PAROLE_MAX) break;
  }
  if (!parole.length) return null;

  const nome = parole.join(' ');
  const chiave = chiaveAlimento(nome);
  if (!chiave) return null;
  // Un nome fatto solo di parole che non sono alimenti non è un alimento.
  if (parole.every((p) => NON_ALIMENTI.has(normalizza(p)))) return null;
  // Nemmeno un nome di due lettere: sono resti di parsing, non cibo.
  if (normalizza(nome).replace(/[^a-z0-9]/g, '').length < 3) return null;
  return nome;
}

/**
 * Le frasi in cui questa proposizione va scartata comunque, qualunque cosa contenga.
 *
 * ⚠️ La domanda si controlla **sull'intera frase** e non sul pezzo catturato: «posso sostituire il
 * pane con le gallette?» ha il punto di domanda in fondo, dopo tutto quello che ci interessa.
 */
export function daScartare(frase: string): boolean {
  const f = normalizza(frase);
  if (!f) return true;
  if (f.includes('?')) return true;
  // Negazioni e divieti. `\b` per non prendere «non» dentro un'altra parola.
  if (/\b(non|senza|mai|evita|evitare|eviti|niente|nessun[ao]?|smetti|basta)\b/.test(f)) return true;
  // Ipotesi e domande indirette: «se volessi», «si potrebbe», «magari».
  if (/\b(vorresti|volessi|potresti|potrebbe|potrebbero|magari|forse|dubbio|chiedi)\b/.test(f)) return true;
  return false;
}

/** Spezza il messaggio in proposizioni: ogni frase si giudica da sola. */
const proposizioni = (testo: string): string[] =>
  (testo ?? '')
    .split(/(?<=[.!?;\n])/)
    .map((f) => f.trim())
    .filter(Boolean);

/**
 * «sostituisci X con Y», «cambia X con Y», «X lo sostituisci con Y» → X esce, Y entra.
 * L'ordine è quello naturale: prima chi parte, poi chi arriva.
 */
const IN_AVANTI = [
  /**
   * ⚠️ LA RADICE TOLLERA I REFUSI, MA SI FERMA PRIMA DI «SOSTITUZIONE» (Simone, 17/8).
   *
   * «a jolanda **sostitusci** ceci con fagioli» tornava `null`, e Vera rispondeva «non ci arrivo»:
   * con la parola scritta giusta la stessa frase veniva capita, a farla cadere era **una lettera**.
   * Chi detta a un assistente scrive di corsa, e un riconoscitore che pretende l'ortografia perfetta
   * del verbo insegna alla persona che «non funziona» invece che «ho sbattuto un tasto».
   *
   * Le desinenze ammesse — `isc`, `sc`, `is`, `ir`, `ic` — coprono l'imperativo, l'infinito e le due
   * lettere che si mangiano più spesso. **Non** coprono `sostituzione`: «la sostituzione di X con Y
   * è andata bene» è un RESOCONTO, e leggerlo come ordine vorrebbe dire scrivere nel piatto di
   * qualcuno una cosa che nessuno ha chiesto adesso.
   */
  /\bsostitu(?:isc|sc|is|ir|ic)\w*\s+(.+?)\s+con\s+(.+)/i,
  /\bsostituire\s+(.+?)\s+con\s+(.+)/i,
  /\bcambi[aei]\w*\s+(.+?)\s+con\s+(.+)/i,
  /\brimpiazz\w+\s+(.+?)\s+con\s+(.+)/i,
];

/**
 * «Y al posto di X», «Y invece di X», «Y in sostituzione di X» → **X esce, Y entra**.
 *
 * ⚠️ Qui i due pezzi arrivano al contrario, e la trappola è tutta in questa riga.
 */
const ALL_INDIETRO = [
  /(.+?)\s+al\s+posto\s+d(?:i|el|ello|ella|elle|egli|ei)\s+(.+)/i,
  /(.+?)\s+invece\s+d(?:i|el|ello|ella|elle|egli|ei)\s+(.+)/i,
  /(.+?)\s+in\s+sostituzione\s+d(?:i|el|ello|ella|elle|egli|ei)\s+(.+)/i,
  /(.+?)\s+in\s+alternativa\s+a[il]?\s*(?:l[oa]|gli|le)?\s+(.+)/i,
];

/**
 * ⚠️ Nella forma rovesciata il pezzo di SINISTRA è la coda della frase che precede: «ti consiglio
 * il tacchino al posto del pollo» cattura «ti consiglio il tacchino». Il nome vero è in fondo, non
 * in testa: si tengono le ultime parole, non le prime.
 */
function codaDellaFrase(pezzo: string): string {
  // ⚠️ I due punti e la virgola chiudono quello che c'era prima: in «Ricorda: tacchino al posto
  // del pollo» il nome è «tacchino», non «Ricorda tacchino». Senza questa riga la sostituzione
  // imparata porta dentro il verbo di chi la scriveva.
  const ultimaProposizione = (pezzo ?? '').split(/[:,;]/).pop() ?? '';
  const parole = ultimaProposizione.replace(/[.!()"«»]/g, ' ').trim().split(/\s+/).filter(Boolean);
  // Si risale finché le parole sembrano far parte del nome, al massimo PAROLE_MAX.
  const tenute: string[] = [];
  for (let i = parole.length - 1; i >= 0 && tenute.length < PAROLE_MAX; i -= 1) {
    const n = normalizza(parole[i]);
    if (FINE_FRASE.has(n)) break;
    tenute.unshift(parole[i]);
    // L'articolo apre il nome: quello che c'è prima è un'altra cosa.
    if (ARTICOLI.has(n)) break;
  }
  return tenute.join(' ');
}

/**
 * Le sostituzioni contenute in un messaggio del nutrizionista.
 *
 * Ritorna una lista vuota molto spesso, ed è il comportamento voluto: la stragrande maggioranza dei
 * messaggi non contiene istruzioni di sostituzione, e questo file deve accorgersene senza inventare.
 */
export function sostituzioniNelMessaggio(testo: string): SostituzioneLetta[] {
  const trovate: SostituzioneLetta[] = [];
  const viste = new Set<string>();

  for (const frase of proposizioni(testo)) {
    if (daScartare(frase)) continue;

    let letta: { from: string | null; to: string | null } | null = null;

    for (const re of IN_AVANTI) {
      const m = frase.match(re);
      if (m) {
        letta = { from: nomeAlimento(m[1]), to: nomeAlimento(m[2]) };
        break;
      }
    }
    if (!letta) {
      for (const re of ALL_INDIETRO) {
        const m = frase.match(re);
        if (m) {
          // ⚠️ Invertiti: il primo pezzo è quello che ENTRA.
          letta = { from: nomeAlimento(m[2]), to: nomeAlimento(codaDellaFrase(m[1])) };
          break;
        }
      }
    }
    if (!letta?.from || !letta.to) continue;

    // Stesso alimento da tutte e due le parti: non è una sostituzione, è una ripetizione.
    const chiave = `${chiaveAlimento(letta.from)}|${chiaveAlimento(letta.to)}`;
    if (chiaveAlimento(letta.from) === chiaveAlimento(letta.to)) continue;
    if (viste.has(chiave)) continue;
    viste.add(chiave);

    trovate.push({ from: letta.from, to: letta.to, frase: frase.trim() });
  }

  return trovate;
}
