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
 * ⛔ **IL NOME SI È FERMATO SU UNA CONGIUNZIONE, E DOPO C'ERA ANCORA ROBA?** — 2/9, voce
 * `la-e-nel-nome-tronca-in-silenzio`.
 *
 * Il caso, misurato il 31/8 su una frase vera:
 *
 *     «a patrizia sostituisci Biscotti d'Avena e Banana con Gallette di riso»
 *       → { da: ["Biscotti d'Avena"], a: ["Gallette di riso"] }
 *
 * ⛔ «e Banana» spariva **senza una parola**. La regola scritta non vietava quel piatto: vietava
 * **tutti** i «Biscotti d'Avena». E l'anteprima mostrava una frase plausibile, quindi bastava un
 * «confermo».
 *
 * ⚠️ **Non basta spezzare su «e»**, ed è scritto nel cappello di `vera/elenco-alimenti.ts`: «e»
 * dentro un nome è comunissimo — «sale **e** pepe», «erbe **e** spezie». Spezzare sempre
 * trasformerebbe il nome di un piatto in due alimenti inventati, cioè lo stesso errore al
 * contrario. La strada scelta è l'altra: **dire di no**, e far chiedere a Vera.
 *
 * ⚠️ **`PAROLE_MAX` non è un troncamento da segnalare**: fermarsi dopo quattro parole è una regola
 * dichiarata, non una congiunzione che mangia mezzo nome. Qui si guarda **solo** il primo caso.
 */
export function nomeTroncatoSuCongiunzione(pezzo: string): boolean {
  const grezzo = (pezzo ?? '').replace(/[.,;:!?()"«»]/g, ' ').trim();
  if (!grezzo) return false;
  /**
   * ⛔ **Si contano le PAROLE, non si cerca la stringa.** La prima stesura faceva
   * `grezzo.indexOf(congiunzione)` per sapere se dopo restava qualcosa, e su «il pane e» trovava
   * la «e» **dentro «pane»**: la funzione rispondeva «troncato» a una frase che finisce lì.
   * Trovato dalla prova che teneva fermo proprio quel caso.
   */
  const parole = grezzo.split(/\s+/).filter(Boolean);
  let quante = 0;
  for (let i = 0; i < parole.length; i += 1) {
    const p = quante === 0 ? senzaArticoloAttaccato(parole[i]) : parole[i];
    const n = normalizza(p);
    if (!n) continue;
    if (quante === 0 && ARTICOLI.has(n)) continue;
    /**
     * ⚠️ **La congiunzione conta solo se dopo c'è ancora una parola.** «sostituisci il pane con le
     * gallette **e**» finisce lì: non è un nome tagliato a metà, è una frase che finisce con una
     * parola di troppo. Segnalarla vorrebbe dire chiedere su frasi che si capiscono benissimo.
     */
    if (FINE_FRASE.has(n)) {
      if (quante === 0) return false;
      return parole.slice(i + 1).some((x) => normalizza(x).length > 0);
    }
    quante += 1;
    if (quante >= PAROLE_MAX) return false;
  }
  return false;
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
 * I VERBI CHE, DOPO «SENZA», NEGANO DAVVERO L'ISTRUZIONE.
 *
 * ⛔ **Elenco chiuso, e la prima stesura ne aveva metà** — trovato dalla revisione del 31/8, che ha
 * misurato il caso peggiore che questo prodotto possa produrre:
 *
 *     «per la celiaca senza mettere il pane normale al posto del pane senza glutine»
 *       → { da: ["pane senza glutine"], a: ["pane normale"] }
 *
 * cioè, nel piatto di una celiaca, il pane senza glutine sostituito **con pane normale**, scritto
 * come regola e con un'anteprima plausibile da confermare. ⚠️ La lista copriva i verbi del
 * *cambiare* (`sostituir`, `cambiar`, `toglier`…) e non quelli del **mettere**, che sono quelli
 * della forma rovesciata «Y al posto di X» — la forma che il cappello di questo file dichiara come
 * la trappola numero uno. Il commento diceva «senza + verbo dell'azione nega»: `mettere`, `dare` e
 * `usare` sono verbi dell'azione, e la riga non li conosceva. Il codice non faceva quello che il
 * suo commento dichiarava.
 *
 * ⚠️ **Radici, non parole intere**, per coprire infinito e forme con i pronomi («metterlo»,
 * «darglielo»). ⚠️ E `che\b` con il confine: senza, «una pizza senza **che**ddar» e «pane senza
 * **che**to» tornerebbero a essere negazioni — cioè il difetto del 31/8, con un'altra parola.
 *
 * ⛔ Chi allunga questo elenco controlli prima i nomi del catalogo: una radice che combacia con un
 * alimento vero rimette in piedi il difetto che l'elenco esiste per chiudere. Le 914 verificate il
 * 31/8 non ne toccano nessuna.
 */
const VERBI_CHE_NEGANO = [
  // i verbi del CAMBIARE
  'sostituir', 'cambiar', 'toglier', 'rimpiazzar', 'eliminar', 'modificar', 'scriver', 'scrivere',
  // ⛔ i verbi del METTERE: sono quelli della forma rovesciata, e mancavano tutti
  'metter', 'dar', 'usar', 'aggiunger', 'inserir', 'prender', 'lev', 'mescolar', 'sommininistrar',
] as const;

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
  if (/\b(non|mai|evita|evitare|eviti|niente|nessun[ao]?|smetti|basta)\b/.test(f)) return true;
  /**
   * ⛔ **«SENZA» NON È SEMPRE UNA NEGAZIONE, E TRATTARLO COSÌ SPEGNEVA MEZZO PRODOTTO** — 31/8.
   *
   * Stava nell'elenco qui sopra come parola secca, e quindi *«a patrizia sostituisci i biscotti con
   * biscotti **senza glutine**»* usciva da qui come «è una negazione, non si esegue»: la
   * nutrizionista si sentiva rispondere «Non ci arrivo». ⚠️ E non è un caso di confine — «senza
   * glutine», «senza lattosio», «senza zucchero», «senza sale» sono il modo normale di nominare
   * mezzo scaffale, e questo prodotto ha una funzione che si chiama proprio `senza-glutine.ts`.
   * Una guardia che blocca il caso normale non è prudente: è rotta, e sembra prudente.
   *
   * ⚠️ La differenza non sta nella parola, sta in **cosa la segue**: «senza + verbo dell'azione»
   * nega l'istruzione, «senza + nome» qualifica un alimento.
   *
   * ⛔ **E l'elenco dei verbi è CHIUSO**, non una forma furba tipo «qualunque parola che finisce in
   * -are/-ere/-ire o in -r + pronome». Quella l'avevo scritta per prima, e su «senza **mandorle**»
   * scattava (`mando` + `r` + `le`): cioè per coprire «senza dirglielo» avrei ributtato via una
   * frase perfettamente normale sul cibo — lo stesso difetto di prima, con un'altra parola. È la
   * stessa lezione dei qualificatori innocui in `abbinamento-alimenti.ts`: un elenco chiuso si
   * legge, «tutto quello che somiglia a un verbo» sbaglia in silenzio.
   *
   * ⚠️ E copre poco apposta: «sostituisci il pane con le gallette **senza dirglielo**» resta una
   * sostituzione valida, perché il «senza» lì non nega il cambio — dice come farlo.
   */
  if (new RegExp(`\\bsenza\\s+(?:che\\b|${VERBI_CHE_NEGANO.join('|')})`).test(f)) return true;
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
 * ⛔ **CHI SCRIVE, davanti al nome: le radici dei verbi con cui una persona detta una sostituzione.**
 *
 * Nella forma rovesciata («Y al posto di X») il nome sta **prima** del verbo, quindi la risalita
 * deve sapere dove finisce il piatto e comincia chi parla. ⚠️ **Radici, non parole intere**, come
 * già fa `VERBI_CHE_NEGANO` venti righe più su: «metti», «mettiamo», «mettici» sono la stessa cosa,
 * e un elenco di forme coniugate invecchia alla prima persona che scrive diversamente.
 *
 * ⛔ **E un verbo che manca non rompe niente**: la risalita continua e il nome esce come usciva
 * prima — «metti l'orzo perlato» — cioè il comportamento di oggi. È la differenza fra questa lista
 * e quella che avevo scritto il 2/9 sera: là un verbo mancante **spegneva** la frase, qui la lascia
 * dov'era. Una lista incompleta che degrada al comportamento vecchio si può allungare con calma;
 * una che rifiuta va allungata subito, e nessuno sa quando.
 */
/**
 * ⛔ **CHI SCRIVE, davanti al nome: le forme INTERE dei verbi con cui si detta una sostituzione.**
 *
 * Nella forma rovesciata («Y al posto di X») il nome sta **prima** del verbo, quindi la risalita
 * deve sapere dove finisce il piatto e comincia chi parla.
 *
 * ⛔ **PAROLE INTERE, NON RADICI, e questa è la seconda lezione della stessa settimana.** La prima
 * stesura del 3/9 confrontava per prefisso, come fa `VERBI_CHE_NEGANO` venti righe più su. Ma là il
 * prefisso *restringe* un rifiuto, qui *butta fuori* una parola dal nome — e la regola che quel
 * blocco si è dato, testualmente, è: *«chi allunga questo elenco controlli prima i nomi del
 * catalogo: una radice che combacia con un alimento vero rimette in piedi il difetto che l'elenco
 * esiste per chiudere»*. Non l'avevo fatto, e la revisione avversariale ha trovato il conto:
 *
 *     «metti la **provola** al posto della mozzarella»      → prov  → non si impara più niente
 *     «metti le **puntarelle** al posto della rucola»        → punt  → niente
 *     «usa la **passata** di pomodoro al posto del sugo»     → passa → niente
 *     «metti il **levistico** al posto del sedano»           → lev   → niente
 *     «metti il **daikon** al posto del ravanello»           → dai   → niente
 *     «metti la **provola affumicata** al posto della scamorza» → impara «affumicata»
 *
 * ⚠️ E **«passata di pomodoro» è un ingrediente di questo catalogo** (`prisma/data/
 * simple_italian_catalog.json`): non un caso di scuola.
 *
 * ⛔ **E il silenzio non è innocuo.** Su `capisci` diventa un «non ci arrivo»; su
 * `impara-dal-nutrizionista.ts` è un `return 0` **senza notifica**. È lo stesso costo asimmetrico
 * per cui il 2/9 sera era stata tolta una guardia intera.
 *
 * ⚠️ **Un verbo che MANCA non rompe niente**: la risalita continua e il nome esce come usciva prima
 * — «metti l'orzo perlato» — cioè il comportamento vecchio, e l'elenco si allunga con calma. ⛔ **Il
 * verso pericoloso è la parola di TROPPO**, che non degrada a niente: cancella il risultato. Per
 * questo si aggiungono forme coniugate vere, non pezzi di parola.
 */
const PAROLE_DI_CHI_SCRIVE = new Set([
  'metti', 'mettici', 'mettiamo', 'metto', 'mettere', 'metterei', 'mettila', 'mettilo',
  'ricorda', 'ricordati', 'ricordale', 'ricordo',
  'usa', 'usiamo', 'usare', 'userei', 'usala', 'usalo',
  'dai', 'dagli', 'dalle', 'dare', 'darei', 'diamo', 'diamole',
  'prendi', 'prendiamo', 'prendere', 'prenderei',
  'aggiungi', 'aggiungiamo', 'aggiungere',
  'inserisci', 'inseriamo', 'inserire',
  'sostituisci', 'sostituiamo', 'sostituire', 'sostituirei', 'sostituiscila', 'sostituiscilo',
  'cambia', 'cambiamo', 'cambiare', 'cambierei', 'cambiala', 'cambialo',
  'rimpiazza', 'rimpiazzare',
  'proponi', 'proponiamo', 'proporrei', 'propongo',
  'servi', 'serviamo', 'servire', 'servile', 'servigli',
  'consiglio', 'consiglia', 'consigliamo', 'consiglierei', 'consigliare',
  'prova', 'proviamo', 'provare', 'proverei', 'provala', 'provalo',
  'facciamo', 'fai', 'fare', 'farei', 'faccia',
  'lascia', 'lasciamo', 'lasciare', 'lascerei',
  'tieni', 'teniamo', 'tenere', 'terrei',
  'scegli', 'scegliamo', 'scegliere', 'sceglierei',
  'alterna', 'alterniamo', 'alternare',
  'togli', 'togliamo', 'togliere', 'toglierei',
  'leva', 'leviamo', 'levare',
  'preferisci', 'preferiamo', 'preferire', 'preferirei', 'preferisco',
  'passa', 'passiamo', 'passare',
  'punta', 'puntiamo', 'puntare',
]);

/**
 * ⛔ **Confronto per parola intera.** Con `startsWith`, «provola» era «prov», «puntarelle» era
 * «punt», «passata» era «passa»: alimenti veri scambiati per verbi e buttati fuori dal nome.
 */
const eDiChiScrive = (normalizzata: string): boolean => PAROLE_DI_CHI_SCRIVE.has(normalizzata);

/**
 * ⛔ **GLI ARTICOLI CHE APRONO IL NOME, separati dalle preposizioni che ci stanno DENTRO.**
 *
 * `ARTICOLI` li tiene insieme — a `nomeAlimento` serve così, perché lì si tratta di togliere quello
 * che c'è **in testa** — ma nella risalita si comportano al contrario:
 *
 *     «per Anna **il** tacchino»   → l'articolo APRE il nome: prima c'è altro, e va lasciato fuori
 *     «la crema **di** mandorle»   → la preposizione sta DENTRO: prima c'è ancora il nome
 *     «il gelato **alla** crema»   → idem, ed è articolata: non basta guardare la forma
 *
 * ⚠️ È la separazione che la voce `la-e-nel-nome-tronca-in-silenzio` diceva servisse, e senza la
 * quale il 2/9 sera ero finito a scrivere una guardia che spegneva le frasi normali.
 */
const ARTICOLI_CHE_APRONO = new Set([
  'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una', "un'", "l'",
  /**
   * ⛔ **I PARTITIVI SONO ARTICOLI, e aprono il nome esattamente come «la».** «metti **della**
   * ricotta», «per Anna **del** pane integrale»: la prima stesura del 3/9 li aveva lasciati fuori
   * — perché sembrano preposizioni — e il nome della cliente entrava nel piatto («Anna della
   * ricotta»). ⚠️ Non è la forma della parola a decidere: `di` sta dentro il nome («crema **di**
   * mandorle»), `della` lo apre.
   */
  'del', 'dello', 'della', 'dei', 'degli', 'delle', "dell'",
  'tuo', 'tua', 'suo', 'sua', 'quel', 'quella', 'quello', 'questo', 'questa',
]);

/**
 * ⚠️ Nella forma rovesciata il pezzo di SINISTRA è la coda della frase che precede: «ti consiglio
 * il tacchino al posto del pollo» cattura «ti consiglio il tacchino». Il nome vero è in fondo, non
 * in testa: si tengono le ultime parole, non le prime.
 *
 * ⛔ **E L'ARTICOLO NON CHIUDE PIÙ DA SOLO** — 3/9, difetto misurato la notte prima su un corpus di
 * frasi vere. `ARTICOLI` mette insieme due cose che nella risalita si comportano al contrario:
 *
 *     «metti **le** gallette»          → l'articolo APRE il nome, e prima c'è chi scrive
 *     «la crema **di** mandorle»       → il «di» sta DENTRO, e prima c'è ancora il nome
 *
 * Fermandosi su tutti e due, di «crema di mandorle» restava **«mandorle»**, di «petto di tacchino»
 * **«tacchino»**, di «cracker ai cereali» **«cereali»**: in italiano quei nomi sono ovunque, e la
 * cliente riceveva l'ultima parola del piatto.
 *
 * ✅ Adesso l'articolo chiude **solo quando prima c'è chi scrive** (o la frase finisce): altrimenti
 * la risalita continua, perché quel «di» era dentro al nome.
 *
 * ⛔ **E non è una guardia.** Il 2/9 sera avevo provato a chiudere lo stesso difetto rifiutando le
 * frasi sospette: spegneva **ventuno frasi normali su trentasette**
 * (`frasi-normali-che-devono-passare.spec.ts`). La differenza è che lì il dubbio diventava un
 * silenzio, qui diventa una lettura migliore — e dove il verbo non si riconosce resta esattamente
 * quella di prima.
 */
function codaDellaFrase(pezzo: string): string {
  // ⚠️ I due punti e la virgola chiudono quello che c'era prima: in «Ricorda: tacchino al posto
  // del pollo» il nome è «tacchino», non «Ricorda tacchino». Senza questa riga la sostituzione
  // imparata porta dentro il verbo di chi la scriveva.
  const ultimaProposizione = (pezzo ?? '').split(/[:,;]/).pop() ?? '';
  const parole = ultimaProposizione.replace(/[.!()"«»]/g, ' ').trim().split(/\s+/).filter(Boolean);
  /**
   * Si risale finché le parole sembrano far parte del nome, al massimo `PAROLE_MAX`.
   *
   * ⚠️ **Nessuna prova lo può uccidere, e il perché va detto giusto.** `nomeAlimento` taglia alla
   * stessa lunghezza, ma **conta in modo diverso** — lui scarta l'articolo prima di contare, qui no
   * — quindi togliere questo limite *cambia* dei risultati («un piatto di crema di mandorle» passa
   * da «crema di mandorle» a «piatto di crema di»). Semplicemente non li cambia in nessuna frase
   * che qualcuno abbia scritto in una prova: la prima stesura del commento diceva «non cambia
   * nessun risultato», ed era falso.
   */
  const tenute: string[] = [];
  for (let i = parole.length - 1; i >= 0 && tenute.length < PAROLE_MAX; i -= 1) {
    const n = normalizza(parole[i]);
    if (FINE_FRASE.has(n)) break;
    /** ⛔ Chi scrive non entra nel nome, qualunque cosa venga dopo. */
    if (eDiChiScrive(n)) break;
    tenute.unshift(parole[i]);
    /**
     * ⛔ **L'articolo VERO chiude il nome**: «per Anna **il** tacchino» è il tacchino, non «Anna il
     * tacchino» — e quel nome è di una cliente, non di un piatto.
     *
     * ⚠️ Le **preposizioni** (`di`, `del`, `ai`, `alla`…) non chiudono niente: stanno dentro al
     * nome, e la risalita continua finché non trova un articolo vero, chi scrive, o la fine.
     */
    if (ARTICOLI_CHE_APRONO.has(n)) break;
    /**
     * ⛔ **E l'articolo ELIDATO è attaccato al nome**, quindi non combacia con nessuna voce
     * dell'elenco: «per Anna **un'**insalata di farro» leggeva «Anna un'insalata di farro», col
     * nome della cliente dentro al piatto. ⚠️ Stessa regex di `senzaArticoloAttaccato`, che copre
     * anche l'apostrofo tipografico — chi scrive dal telefono lo prende senza accorgersene.
     */
    if (parole[i] !== senzaArticoloAttaccato(parole[i])) break;
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
        /**
         * ⛔ **SE IL NOME DI PARTENZA È TAGLIATO A METÀ, NON SI RISPONDE** — 2/9, strada ⭐ della
         * voce `la-e-nel-nome-tronca-in-silenzio`. «sostituisci Biscotti d'Avena e Banana con
         * Gallette di riso» scriveva una regola su **tutti** i «Biscotti d'Avena», con
         * un'anteprima plausibile da confermare. Meglio una domanda in più che una regola scritta
         * su un piatto che nessuno ha nominato.
         *
         * ⚠️ **Solo su `m[1]`, e la ragione è la forma del pattern.** Quel pezzo è delimitato da
         * «con» (`(.+?)\s+con`), quindi contiene il nome e nient'altro. `m[2]` invece prende
         * **tutta la coda** — «...con le gallette **a colazione**» — e lì il confronto «quanto ho
         * letto contro quanto c'era» direbbe «non ci arrivo» a metà delle frasi normali. ⛔ E non
         * basta passare da `senzaCodaDiAmbito`: misurato in revisione il 31/8, su quella frase
         * restituisce la frase **identica**. Serve un modo di separare la coda dal nome, e oggi non
         * c'è: chi lo scriverà potrà estendere il controllo anche di là.
         */
        if (nomeTroncatoSuCongiunzione(m[1])) break;
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
