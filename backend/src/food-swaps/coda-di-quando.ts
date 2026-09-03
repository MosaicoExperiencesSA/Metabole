import { normalizza } from '../common/nomi-alimento';

/**
 * ⛔ **DOVE FINISCE IL PIATTO E COMINCIA IL QUANDO** — l'ultimo pezzo aperto della voce
 * `la-e-nel-nome-tronca-in-silenzio`.
 *
 * ```
 * sostituisci il pane con le gallette a colazione
 *   → { da: ["pane"], a: ["gallette a colazione"] }
 * ```
 *
 * «gallette a colazione» non è un alimento: è un alimento **più un orario**. La regola imparata
 * finisce in banca dati con quel nome, non combacia con nessuna ricetta, e la sostituzione che la
 * nutrizionista credeva di aver scritto non succede mai — dietro un'anteprima plausibile.
 *
 * ## ⛔ La cosa che rende questo file difficile: la preposizione decide il significato
 *
 * «**a** colazione» è un orario. «**da** colazione» è una **categoria merceologica**: «biscotti da
 * colazione», «cereali da colazione», «fette biscottate da colazione» sono nomi di prodotto, e in
 * quei nomi «colazione» è parte del piatto. Lo stesso per «zuppa **del** giorno», «pesce **del**
 * giorno», «arrosto **della** domenica».
 *
 * ⛔ **La prima stesura di questo file trattava tutte le preposizioni come ponti**, e quindi tagliava
 * anche quelle: «togli i biscotti da colazione» diventava una regola che toglie **tutti i
 * biscotti**, merenda compresa. ⚠️ Non era un silenzio — era **cibo tolto dal piatto di qualcuno**
 * senza che nessuno l'avesse chiesto, cioè l'errore che il cappello di `impara-dalla-chat.ts`
 * dichiara essere il più caro. L'ha trovato una revisione avversariale eseguendo il riconoscitore
 * prima e dopo su novanta frasi; le mie prove, costruite sui casi da tagliare, erano verdi.
 *
 * Perciò qui **non esiste una regola generale**: esiste un elenco **chiuso di code intere**
 * (preposizione compresa), e quello che non è nell'elenco non si tocca. `da colazione`,
 * `del giorno`, `della domenica` non ci sono, e non devono ricomparire.
 *
 * ## E per la stessa ragione non si taglia mai a una preposizione
 *
 * In italiano «X di Y» è il modo normale di chiamare mezzo scaffale — «crema di mandorle», «gelato
 * alla crema», «cracker ai cereali», «pasta al pomodoro». Fermarsi su una preposizione ridurrebbe
 * quei nomi all'ultima parola: è il difetto che `codaDellaFrase` ha dovuto correggere il 3/9, e
 * questo file lo rifarebbe al contrario.
 *
 * ## Cosa resta fuori, e va detto invece che scoperto dopo
 *
 * ⚠️ L'elenco copre le forme che una nutrizionista scrive davvero, e **non** copre l'italiano
 * intero. Quello che non riconosce resta dentro al nome, cioè si comporta **esattamente come prima
 * di questo file**: il difetto rimane dov'era, non ne nasce uno nuovo. È il verso giusto in cui
 * sbagliare, perché l'altro — tagliare quello che non si è capito — scrive regole più larghe di
 * quanto è stato chiesto.
 *
 * ## ⛔ E LA COSA PIÙ IMPORTANTE: dove va a finire la restrizione
 *
 * «sostituisci il pane **a colazione** con le gallette» chiede una regola **ristretta a un pasto**.
 * Togliendo la coda, quello che viene imparato è `pane → gallette` **senza orario**: una regola più
 * larga di quella che è stata scritta.
 *
 * ⚠️ Questo va detto per intero, perché la prima stesura di questo file scriveva il **contrario** —
 * sosteneva che togliere la coda dal lato che esce servisse a *non* allargare — e l'ha smontato una
 * revisione eseguendo il riconoscitore prima e dopo. Prima il nome restava «pane a colazione», che
 * non combacia con nessun alimento: la riga nasceva **inerte**. Adesso combacia, e vale a ogni
 * pasto.
 *
 * **Perché lo si fa lo stesso, e cosa lo tiene a bada:**
 * · la riga nasce `stato: 'da_verificare'` (`impara-dal-nutrizionista.ts`), cioè è una **proposta**
 *   che una persona guarda prima che diventi una regola: non tocca nessun menu da sola;
 * · la `nota` di quella riga contiene la **frase intera** — «Letto dalla chat del …: "sostituisci
 *   il pane a colazione con le gallette"» — quindi chi decide vede l'orario che noi non sappiamo
 *   scrivere;
 * · e una proposta con un nome che non combacia con niente non è prudente: è **inservibile**, e
 *   chi la guarda non può nemmeno approvarla.
 *
 * ⛔ **Quello che NON si fa è scrivere `FoodSwap.mealSlot`.** La colonna esiste, ⚠️ ma oggi non la
 * legge nessuno quando le sostituzioni si applicano: riempirla darebbe a una riga l'aria di essere
 * ristretta a un pasto mentre vale su tutti — *un interruttore che non accende niente*, ed è già
 * successo in questo progetto con `assignments`. La restrizione vera si chiude quando qualcuno la
 * leggerà; fino ad allora sta nella nota, dove una persona la vede.
 *
 * ⚠️ **E resta fuori il caso in cui il taglio fa combaciare i due lati**: «sostituisci le gallette
 * con le gallette a colazione» chiede una cosa che questo riconoscitore non sa esprimere (lo stesso
 * piatto a un altro orario). Prima imparava una regola con un nome che non combaciava con niente —
 * innocua e inutile; adesso non impara niente. ⛔ È un **silenzio**, che su
 * `impara-dal-nutrizionista.ts` vuol dire «nessuna notifica a nessuno»: sta come sentinella nel
 * corpus, non nascosto qui.
 *
 * Modulo **puro**: una stringa dentro, il nome e la sua coda fuori.
 */

/** I pasti. */
const PASTI = 'colazione|colazioni|pranzo|pranzi|cena|cene|spuntino|spuntini|merenda|merende|brunch';
/** I momenti della giornata. */
const MOMENTI = 'mattina|mattino|mattinata|pomeriggio|sera|serata|notte';
/** I giorni. Senza accenti: si confronta sempre la forma normalizzata. */
const GIORNI = 'lunedi|martedi|mercoledi|giovedi|venerdi|sabato|sabati|domenica|domeniche';
/** I numeri scritti in lettere che compaiono in una prescrizione. */
const QUANTI = '\\d+|un|uno|una|due|tre|quattro|cinque|sei|sette|dieci|quindici|venti|trenta';

/**
 * ⛔ **L'ELENCO CHIUSO DELLE CODE.** Ogni riga è una coda **intera**, preposizione compresa: si
 * confronta con le ultime parole del pezzo, normalizzate e unite da uno spazio singolo.
 *
 * ⛔ **Chi allunga questo elenco esegue prima le due prove che gli stanno accanto** — il corpus
 * delle frasi normali e il confronto coi nomi di catalogo — e ci aggiunge una riga per la forma che
 * sta aggiungendo. È la stessa regola che `VERBI_CHE_NEGANO` si è scritta in testa dopo essersi
 * mangiata «provola» e «passata di pomodoro»: una riga che combacia con la fine di un piatto vero
 * rimette in piedi il difetto che l'elenco esiste per chiudere.
 *
 * ⛔ **E non si aggiungono `da <pasto>`, `del giorno`, `della domenica`**: sono nomi di prodotto,
 * vedi il cappello.
 */
const CODE: RegExp[] = [
  // — i pasti: «a colazione», «per pranzo», «come spuntino», «allo spuntino della mattina» —
  /**
   * ⛔ **SENZA ARTICOLO, e l'articolo è la differenza fra un orario e un prodotto** (trovato dalla
   * seconda revisione). «biscotti **per la** colazione», «cereali **per la** colazione», «barretta
   * **per lo** spuntino», «snack **per la** merenda» sono nomi di prodotto esattamente come
   * «biscotti **da** colazione» — e la prima stesura di questa riga li tagliava, cioè rifaceva con
   * un'altra preposizione lo stesso danno che il cappello dichiara di aver chiuso.
   *
   * ⚠️ Le forme articolate contratte («**allo** spuntino», «**alla** merenda») restano: lì
   * l'articolo è dentro la preposizione e la costruzione è temporale, non merceologica.
   */
  new RegExp(`^(?:a|ad|per|allo|alla|al|nello|nella|come|durante|dopo|prima) (?:${PASTI})$`),
  new RegExp(`^(?:a|ad|per|allo|alla|al|nello|nella|come) (?:${PASTI}) (?:del|della|di) (?:${MOMENTI})$`),
  new RegExp(`^a meta (${MOMENTI})$`),
  new RegExp(`^(?:a|ad|per|al|allo|alla|nel|nello|nella) (?:primo|secondo|ultimo) (?:${PASTI})$`),

  // — i momenti della giornata: «la mattina», «al mattino presto», «di sera» —
  // ⛔ NIENTE `del|della`: «brioche del mattino» e «zuppa della sera» sono nomi, non orari.
  new RegExp(`^(la|il|al|alla|nel|nella|di|verso) (${MOMENTI})( presto| tardi)?$`),

  // — i giorni: «il sabato», «ogni domenica», «da lunedi» —
  // ⛔ NIENTE `del|della`: «arrosto della domenica» è un piatto.
  new RegExp(`^(il|la|al|ogni|da|entro|fino a|per) (${GIORNI})$`),
  new RegExp(`^(il|la) (${GIORNI}) (mattina|pomeriggio|sera)$`),
  new RegExp(`^(nei|i) giorni (feriali|festivi)$`),
  new RegExp(`^(nel|il|nei|per il) (weekend|fine settimana)$`),

  // — il quando, in assoluto —
  new RegExp('^(da|a partire da|entro|per|fino a) (oggi|domani|dopodomani|adesso|ora|subito)$'),
  new RegExp('^(oggi|domani|dopodomani|subito|adesso|sempre)$'),
  new RegExp('^per (ora|adesso|il momento|iniziare|cominciare)$'),
  new RegExp('^(all inizio|per inizio|da subito|d ora in poi|da qui in avanti)$'),
  new RegExp('^(ogni tanto|di tanto in tanto|qualche volta|spesso|raramente|saltuariamente)$'),

  // — le durate e le frequenze: sono il modo in cui si scrive una prescrizione —
  new RegExp('^(tutti i|tutte le) (giorni|settimane|mattine|sere)$'),
  new RegExp('^ogni (giorno|settimana|mattina|sera|pasto)$'),
  new RegExp('^(questa|la prossima|la|per una|per la) settimana$'),
  new RegExp('^la settimana (prossima|scorsa)$'),
  new RegExp(`^(per|nei|nelle|nei prossimi|nelle prossime) (${QUANTI}) (giorni|settimane|mesi)$`),
  new RegExp('^(nei prossimi giorni|nelle prossime settimane|per un mese|per un po)$'),
  new RegExp(`^(${QUANTI}) volt[ae] (a|al|alla|ogni) (settimana|giorno|mese)$`),
  new RegExp(`^(${QUANTI}) volt[ae]$`),

  // — il per chi —
  new RegExp('^(per|a) (tutte|tutti)( le clienti| i clienti| loro)?$'),
];

/**
 * Parole che stanno **davanti** a una coda e restano appese quando la coda se ne va: «le gallette
 * **solo** a colazione», «le gallette a colazione **e** a merenda».
 *
 * ⛔ Si tolgono **solo dopo** che una coda è stata tolta davvero (vedi `giaTagliato`). Senza quella
 * condizione, «con le gallette **e** fammi sapere» perderebbe la «e» — che è la congiunzione su cui
 * `nomeAlimento` si ferma da sé — e più in generale una di queste parole verrebbe mangiata in fondo
 * a un nome che questo file non ha capito.
 */
/**
 * ⛔ **PAROLE CHE NON POSSONO RESTARE ULTIME DOPO UN TAGLIO** (seconda revisione).
 *
 * L'elenco delle code è chiuso e non copre l'italiano intero: «le gallette **durante** la
 * settimana», «l'insalata **di** tutti i giorni», «la tisana **per** la sera» hanno una coda
 * riconosciuta e **una parola in più** davanti, che il taglio lasciava appesa. Due danni distinti:
 *
 * · **la `coda` dichiarata diventa falsa** — si diceva di aver tolto «la settimana» avendo lasciato
 *   «durante», e quel campo è pensato per essere mostrato a chi ha scritto;
 * · ⛔ **peggio, il nome collassa sul cibo nudo**: `chiaveAlimento('insalata di')` è la stessa di
 *   `chiaveAlimento('insalata')` (il `di` è una parola neutra), quindi «l'insalata **di** tutti i
 *   giorni» diventava una regola su **tutta** l'insalata. È l'errore caro, per incidente.
 *
 * ⚠️ La cura non è allungare l'elenco delle code all'infinito: è **rinunciare al taglio** quando
 * quello che resta finisce con una di queste parole. Un taglio rifiutato riporta la frase a com'era
 * prima di questo file, cioè al difetto vecchio; un taglio a metà ne fabbrica uno nuovo e più caro.
 */
const NON_PUO_RESTARE_ULTIMA = new Set([
  'a', 'ad', 'al', 'allo', 'alla', 'ai', 'agli', 'alle', 'in', 'nel', 'nello', 'nella', 'nei',
  'negli', 'nelle', 'di', 'del', 'dello', 'della', 'dei', 'degli', 'delle', 'da', 'dal', 'dallo',
  'dalla', 'dai', 'dagli', 'dalle', 'per', 'con', 'su', 'sul', 'sulla', 'tra', 'fra', 'durante',
  'dopo', 'prima', 'entro', 'verso', 'fino', 'gia', 'solo', 'soltanto', 'anche', 'partire',
  'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una', 'ogni', 'questa', 'questo',
]);

const MODIFICATORI = new Set([
  'solo', 'soltanto', 'solamente', 'sempre', 'magari', 'preferibilmente', 'possibilmente',
  'almeno', 'circa', 'e', 'ed', 'o', 'oppure', 'anche', 'poi',
]);

/**
 * ⚠️ **Quattro, che è la coda più lunga dell'elenco** — «per tutte le clienti», «a colazione del
 * mattino», «nelle prossime due settimane». Sei era un **intervallo morto**: una prova di mutazione
 * l'ha abbassato a quattro senza far diventare rosso niente, cioè il numero non descriveva il
 * codice. Chi allunga l'elenco con una coda più lunga alza anche questo, e la prova che tiene fermi
 * i due numeri insieme sta nel `.spec`.
 */
const MAX_PAROLE_CODA = 4;

/** Minuscolo, senza accenti, senza punteggiatura: la forma su cui si confronta l'elenco. */
const perIlConfronto = (p: string): string => normalizza(p.replace(/[.,;:!?()"«»'’]/g, ' ')).trim();

/** Quante parole in fondo sono una coda riconosciuta, o `0` se non lo è nessuna. */
function quantePartiDiCoda(norm: readonly string[]): number {
  for (let k = Math.min(MAX_PAROLE_CODA, norm.length); k >= 1; k -= 1) {
    const tail = norm.slice(norm.length - k).join(' ').trim();
    if (!tail) continue;
    if (CODE.some((re) => re.test(tail))) return k;
  }
  return 0;
}

/** Il nome ripulito e la coda che gli è stata tolta (vuota se non c'era niente da togliere). */
export interface NomeSenzaQuando {
  nome: string;
  coda: string;
}

/**
 * Separa dal nome la coda che dice **quando**, **quanto spesso** o **per chi**.
 *
 * ⚠️ **Non taglia mai fino a lasciare il vuoto.** Se il pezzo è fatto solo di coda — «a colazione»,
 * «tutti i giorni» — non c'è nessun nome da salvare: si restituisce com'era, e sarà `nomeAlimento`
 * a rispondere `null` come faceva già (quelle parole stanno tutte anche in `NON_ALIMENTI`).
 * ⛔ Rispondere il vuoto qui sposterebbe **dentro questa funzione** una decisione che è di là, e la
 * stessa frase verrebbe scartata da due punti diversi per due ragioni diverse.
 */
export function separaIlQuando(pezzo: string): NomeSenzaQuando {
  const grezzo = (pezzo ?? '').trim();
  if (!grezzo) return { nome: grezzo, coda: '' };

  const parole = grezzo.split(/\s+/).filter(Boolean);
  const norm = parole.map(perIlConfronto);

  let fine = parole.length;
  let giaTagliato = false;
  for (;;) {
    const quante = quantePartiDiCoda(norm.slice(0, fine));
    if (quante > 0) {
      fine -= quante;
      giaTagliato = true;
      continue;
    }
    /**
     * ⛔ **Un modificatore si porta via SOLO se una coda è già stata tolta.** «le gallette **solo** a
     * colazione»: tolta «a colazione», «solo» resta appeso e va tolto anche lui. ⚠️ Ma «con le
     * gallette **e** fammi sapere» non ha nessuna coda, e lì la «e» **non si tocca**: è la
     * congiunzione su cui `nomeAlimento` si ferma da sé, e mangiarla vorrebbe dire cambiare una
     * frase che questo file non ha capito — il verso in cui non si deve sbagliare.
     */
    if (giaTagliato && fine > 1 && MODIFICATORI.has(norm[fine - 1])) {
      fine -= 1;
      continue;
    }
    break;
  }

  if (fine === parole.length || fine <= 0) return { nome: grezzo, coda: '' };
  /**
   * ⛔ **Un taglio che lascia una preposizione appesa non si fa affatto.** Vedi
   * `NON_PUO_RESTARE_ULTIMA`: qui si sceglie fra il difetto vecchio (la coda dentro al nome) e uno
   * nuovo e più caro (un nome monco che combacia con l'alimento nudo, cioè una regola più larga di
   * quanto è stato chiesto). Si tiene il vecchio.
   */
  if (NON_PUO_RESTARE_ULTIMA.has(norm[fine - 1])) return { nome: grezzo, coda: '' };
  return { nome: parole.slice(0, fine).join(' '), coda: parole.slice(fine).join(' ') };
}

/** Comodità per chi vuole solo il nome. */
export function senzaIlQuando(pezzo: string): string {
  return separaIlQuando(pezzo).nome;
}
