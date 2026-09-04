import { exclusionKeys, hitsExclusion } from '../menu/exclusions';

/**
 * DI COSA È QUESTO PIATTO — carne, pesce, verdura, o altro.
 *
 * ⛔ **Richiesta di Simone, 31/8: «carne, pesce e verdure evitiamole nelle colazioni, merende e
 * spuntini».** E la lettura è quella che ha scelto lui: **il PIATTO** non dev'essere di carne,
 * pesce o verdura — non «nessuna verdura fra gli ingredienti».
 *
 * ⚠️ La differenza vale il catalogo. Con la lettura stretta uscirebbero la frittata con gli
 * spinaci, il pane coi pomodorini, l'avocado toast: colazioni normali, e il paniere delle colazioni
 * si svuoterebbe. Con questa escono «Petto di pollo alla piastra», «Tonno con olive», «Insalata
 * mista», «Vellutata di broccoli» — cioè i piatti che a colazione non ci vanno.
 *
 * ## Come si decide «di cosa è»
 *
 * Dall'**ingrediente principale**, cioè quello che pesa di più. ⚠️ Non dal nome: «Vellutata di
 * broccoli e patate» e «Purè di patate con broccoli» si chiamano quasi uguale e sono due piatti
 * diversi, e il nome mette davanti quello che suona meglio, non quello che c'è di più.
 *
 * ⛔ **E se le grammature non ci sono, non si indovina**: si risponde `null`, che vuol dire «non lo
 * so» e non «va bene». Chi legge decide cosa farne — l'elenco di quelle che non si sanno è la coda
 * da guardare, non un via libera silenzioso.
 *
 * ⚠️ Il vocabolario del pesce è quello delle esclusioni (67 termini) e il confronto passa da
 * `hitsExclusion`: è un'altra domanda — «questo piatto è di pesce» invece di «questo piatto
 * contiene una cosa esclusa» — ma il vocabolario è lo stesso, e scriverne un secondo vorrebbe dire
 * che un giorno uno dei due impara «gallinella» e l'altro no.
 */

/**
 * ⛔ **I termini della CARNE, elenco chiuso e nuovo.** Non ce n'era nessuno in casa: i regimi
 * sanno dire «vegetariano = niente carne né pesce» a parole, ma nessuna lista lo mette per iscritto.
 *
 * ⚠️ Ci vanno i **tagli e gli animali**, non i piatti: «polpette» non è qui, perché esistono le
 * polpette di ceci e di melanzane. ⛔ E niente radici corte: `pol` prenderebbe polpa e polenta.
 *
 * ⛔ **RISCRITTO L'1/9, PERCHÉ LA PRIMA STESURA ROMPEVA LA SUA STESSA REGOLA.** Diceva «non i
 * piatti» e poi conteneva `cotoletta`, `tagliata`, `arrosto di`, `hamburger di`, `spezzatino`,
 * `straccetti`, `scaloppin`, `macinato di` — che sono preparazioni, e in cucina italiana si fanno
 * di ceci, di melanzane e di seitan come di vitello. Su venti nomi plausibili ne sbagliava
 * **quindici**, e nessuno se n'era accorto perché il confronto è per sottostringa e non lascia
 * traccia: «Hamburger di ceci», «Cotoletta di melanzane», «Tagliata di verdure» erano carne.
 *
 * ⚠️ E dove faceva danno non era dove si guardava: la **derivazione dei panieri pescetariani**
 * (1355 ricette scartate come carne nella Fase 5) e la **regola flexitariana** — un hamburger di
 * ceci bruciava una delle due volte a settimana.
 *
 * ## Due livelli, e la ragione del secondo
 *
 * `CARNE_SEMPRE` sono animali, salumi e tagli che non hanno un gemello vegetale: se il nome li
 * contiene, è carne e basta. `CARNE_SE_NON_VEGETALE` sono le **preparazioni**: valgono solo se nel
 * testo non compare un segno vegetale. ⛔ L'ordine conta ed è il primo a vincere — «Spezzatino di
 * manzo con patate» ha `patate` (vegetale) **e** `manzo`: resta carne, perché il primo livello non
 * si lascia smontare dal secondo.
 *
 * ⚠️ **Sbagliare qui non è simmetrico.** Un falso positivo toglie un piatto buono da un paniere; un
 * falso negativo mette carne nel piatto di una pescetariana. Per questo le preparazioni si
 * ammorbidiscono e gli animali no, e per questo `seitan` e `soia` sono segni vegetali ma `patate` e
 * `verdure` — che stanno anche accanto alla carne — non bastano da sole a smontare un animale.
 */
export const CARNE_SEMPRE: readonly string[] = [
  // Animali e carni bianche
  'pollo', 'tacchino', 'coniglio', 'anatra', 'faraona',
  // Carni rosse
  'manzo', 'bovino', 'vitello', 'vitellone', 'bresaola', 'maiale', 'suino', 'agnello', 'capretto',
  'cavallo', 'cinghiale', 'cervo',
  // Tagli che non hanno gemelli vegetali
  'fesa', 'petto di pollo', 'petto di tacchino', 'lombata', 'controfiletto', 'filetto di manzo',
  'ossobuco',
  // Salumi e trasformati
  'prosciutto', 'speck', 'bacon', 'pancetta', 'salsiccia', 'mortadella', 'wurstel',
  'guanciale', 'porchetta',
  // Frattaglie
  'fegato', 'trippa',
];

/**
 * ⛔ **Le PREPARAZIONI: carne solo se il piatto non è fatto di qualcos'altro.**
 *
 * `spezzatino`, `cotoletta`, `hamburger di`, `tagliata`… sono modi di cucinare, non animali. In
 * cucina italiana si fanno di ceci, di melanzane e di seitan tanto quanto di vitello.
 */
export const CARNE_SE_NON_VEGETALE: readonly string[] = [
  'spezzatino', 'straccetti', 'scaloppin', 'cotoletta', 'arrosto di', 'brasato',
  'macinato di', 'hamburger di', 'tagliata',
];

/**
 * ⛔ **I segni vegetali che smontano una preparazione** — e solo quella.
 *
 * ⚠️ Elenco **stretto apposta**: ci stanno le cose di cui un piatto è *fatto al posto della carne*,
 * non i contorni e non i compagni di piatto. ⛔ `patate` e `zucchine` non ci sono: accompagnano lo
 * spezzatino di manzo tanto quanto quello di soia. ⛔ E **`formaggio` e `uova` nemmeno**, per il
 * caso che mi ha fatto riscrivere questo elenco mentre lo scrivevo: con `formaggio` qui dentro,
 * «Salame e formaggio» sarebbe diventato un piatto vegetariano — cioè un falso negativo, salume
 * nel piatto di chi non lo mangia, che è l'unico errore che qui non si può fare.
 */
export const SEGNI_VEGETALI: readonly string[] = [
  // Le proteine vegetali: sono ciò di cui il piatto è fatto al posto della carne.
  'ceci', 'lenticchi', 'fagiol', 'piselli', 'soia', 'seitan', 'tofu', 'tempeh', 'edamame',
  'quinoa', 'farro', 'cereali', 'legumi', 'avena',
  /**
   * ⛔ **Le verdure che si brasano e si arrostiscono** — aggiunte l'1/9 dopo la produzione:
   * «Radicchio Rosso Brasato con Noci Pecan» e «Cavolrapa Brasato al Forno» risultavano carne,
   * perché `brasato` è una preparazione e nel piatto non c'era **nessuna** parola del mio elenco.
   * ⚠️ Un elenco di verdure non sarà mai completo, e non deve esserlo: qui bastano quelle che
   * finiscono davvero accanto a una preparazione. Le altre le trova `diag:carne-fuori-posto`, che
   * da oggi è lo strumento con cui questo elenco si allunga — una parola alla volta, coi nomi
   * davanti, invece che a indovinare.
   */
  'melanzan', 'verdur', 'zucchin', 'zucca', 'cavol', 'broccol', 'funghi', 'radicchio', 'carciof',
  'finocchi', 'asparag', 'peperon', 'cicoria', 'indivia', 'scarola', 'bietol', 'spinaci', 'porro',
  'rapa', 'topinambur', 'sedano', 'ravanell', 'germogli', 'alga', 'alghe', 'nori', 'wakame', 'miso',
];

/**
 * ⛔ **I NOMI A DOPPIO SENSO, e ognuno col SUO antidoto** — non con l'elenco vegetale generico.
 *
 * Sono tre parole che in italiano indicano una carne *e* qualcos'altro di molto più comune in un
 * elenco di piatti: la coppa di yogurt, il salame di cioccolato, le uova di gallina. ⚠️ Con
 * l'elenco vecchio erano carne sempre, e «uova di gallina» — che è come si scrive in mezzo
 * catalogo — bastava a tenere una colazione fuori dalla colazione.
 *
 * ⛔ **L'antidoto è specifico apposta.** Smontarle col vegetale generico sarebbe stato comodo e
 * sbagliato: `salame` cade solo davanti al cioccolato, non davanti a un formaggio. Una parola per
 * volta, col motivo scritto accanto.
 */
export const DOPPIO_SENSO: Readonly<Record<string, readonly string[]>> = {
  /** Le uova, che nelle ricette si scrivono spessissimo «uova di gallina». */
  gallina: ['uova', 'uovo'],
  quaglia: ['uova', 'uovo'],
  /** Il salame di cioccolato, che è un dolce. */
  salame: ['cioccolat', 'cacao'],
  /** La coppa di yogurt, di gelato, di frutta: il salume perde tre a uno. */
  coppa: ['yogurt', 'gelato', 'frutt', 'macedonia', 'skyr', 'ricotta'],
};

/** ⚠️ Tenuto per chi lo importava: tutti i termini, senza le regole che li distinguono. */
export const CARNE: readonly string[] = [
  ...CARNE_SEMPRE, ...CARNE_SE_NON_VEGETALE, ...Object.keys(DOPPIO_SENSO),
];

export type DiCosa = 'carne' | 'pesce' | 'verdura' | 'altro';

export interface IngredientePesato {
  name: string;
  /** Grammi. ⚠️ Senza, quell'ingrediente non può essere il principale: non si indovina. */
  grammi: number | null;
}

/** Le categorie della tabella alimenti che contano come verdura. */
const CATEGORIE_VERDURA = new Set(['verdura', 'verdure', 'ortaggi']);

const normale = (s: string) => (s ?? '').toLowerCase().trim();

/**
 * Vero se il nome contiene un termine della carne.
 *
 * ⚠️ **Una regex compilata una volta, non un `some(...includes(...))`**: quella forma la pesca
 * `una-porta-per-le-esclusioni.spec.ts` in ogni file che importa dalle esclusioni, e a ragione — è
 * la firma di chi si riscrive il confronto invece di passare dalla porta. Qui la domanda è un'altra
 * («questo piatto È di carne», e la carne non è un'esclusione), ma la strada comoda era dichiarare
 * l'eccezione, e un guardiano si consuma un'eccezione ragionevole alla volta.
 */
/**
 * ⛔ **IL CONFINE DI PAROLA DAVANTI, E LA RAGIONE HA UN NOME: «cipollotto».**
 *
 * Trovato in produzione l'1/9 con `diag:carne-fuori-posto`: «Zuppa Miso con Edamame e Funghi
 * Shiitake» risultava **carne**, e il termine che scattava era `pollo` — dentro «ci·POLLO·tto».
 * Lo stesso su «Brodo Miso Edamame e Alga Wakame», «Riso Venere con Germogli di Ravanello» e una
 * decina d'altri: il cipollotto è in mezzo mezzo catalogo.
 *
 * ⚠️ E il commento dell'elenco lo sfiorava senza vederlo — «niente radici corte: `pol`
 * prenderebbe polpa e polenta» — mentre `pollo` per intero era già dentro una parola comune.
 * ⛔ Peggio: `pollo` sta nel livello che **vince sempre**, quindi nemmeno un segno vegetale lo
 * fermava. Una zuppa di miso contava come giornata di carne nella regola flexitariana.
 *
 * ⚠️ **Il confine sta solo DAVANTI, mai in fondo**, ed è voluto: `scaloppin` deve prendere
 * scaloppine e scaloppina, `lenticchi` le lenticchie. Un confine in coda spegnerebbe metà elenco.
 */
const perRegex = (elenco: readonly string[]) =>
  new RegExp(elenco.map((t) => `\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).join('|'));
const RE_CARNE_SEMPRE = perRegex(CARNE_SEMPRE);
const RE_CARNE_FORSE = perRegex(CARNE_SE_NON_VEGETALE);
const RE_VEGETALE = perRegex(SEGNI_VEGETALI);
const DOPPI = Object.entries(DOPPIO_SENSO).map(([t, antidoti]) => ({
  termine: perRegex([t]),
  antidoto: perRegex(antidoti),
}));

/**
 * ⛔ **LA CARNE FINTA E IL PESCE FINTO — misurati in produzione il 4/9 con `diag:carne-fuori-posto`.**
 *
 * Otto piatti segnalati, **otto falsi**, e nessuno era un errore di catalogo: il regime della
 * ricetta era compatibile in tutti e otto. Erano nomi.
 *
 *     Prosciutto vegetale        → prosciutto   (×2, in un paniere vegetariano)
 *     Pollo di Tempeh            → pollo
 *     Polpo di ceci              → polpo
 *     Polpo d'Alghe Nori         → polpo
 *     Branzino di melanzane      → branzino
 *     Branzino di Ceci al Forno  → branzino
 *
 * ⚠️ È la stessa forma sei volte su sei: **il nome dell'animale seguito da come è fatto davvero.**
 * Non è un elenco di casi singoli, è una famiglia aperta — domani sarà «tonno di ceci» o «bresaola
 * vegana» — e le famiglie aperte non si rincorrono con un elenco.
 *
 * ⛔ **E il conto vero non sono gli otto**: lo stesso riconoscitore ha scartato **1342 piatti come
 * carne** derivando i panieri pescetariani. Se sbaglia su «prosciutto vegetale» davanti a noi,
 * sbaglia anche là dentro, dove nessuno sta guardando.
 *
 * ## Perché è STRETTA, e dove finisce
 *
 * ⚠️ Sbagliare qui non è simmetrico — è la regola scritta in cima a questo file: un falso positivo
 * toglie un piatto buono, un falso negativo mette carne nel piatto di una pescetariana. Quindi il
 * segno vegetale deve stare **attaccato** all'animale, e solo in due forme: «X vegetale/vegano» e
 * «X di \<vegetale\>». Basta una parola in mezzo e la regola non vale più:
 *
 *     Pollo di tempeh          → finto      Pollo con ceci              → CARNE
 *     Prosciutto vegetale      → finto      Prosciutto e melone         → CARNE
 *     Branzino di melanzane    → finto      Branzino con verdure        → PESCE
 *     Polpo d'alghe            → finto      Spezzatino di manzo e ceci  → CARNE
 *
 * ⛔ **«con» non vale, e non è pignoleria**: «pollo con ceci» è pollo vero con dei ceci accanto, e
 * leggerlo come finto è esattamente il falso negativo che non ci si può permettere.
 *
 * ⚠️ **Quello che questa regola NON prende, dichiarato**: l'ottavo falso di quel riquadro è
 * «Polenta ai Funghi Misti», che scatta su «champignon, **ostriche**» dentro gli **ingredienti** —
 * sono i funghi ostrica, e le due parole non sono attaccate. Resta aperto: è un caso singolo, e
 * allargare la regola per prenderlo vorrebbe dire staccare il segno vegetale dall'animale, cioè
 * togliere la sola cosa che la tiene stretta.
 */
const RE_IMITAZIONE = new RegExp(
  `\\b([a-zà-ù]+)(?=\\s+(?:vegetal[ei]|vegan[oaei]?|fint[oa])\\b`
  + `|\\s+(?:di|d['’])\\s*(?:${SEGNI_VEGETALI.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}))`,
  'g',
);

/**
 * Il testo senza i nomi di animale che una parola dopo si dichiarano finti.
 *
 * ⚠️ Si cancella **solo la parola**, non il segno vegetale che la smonta: quello serve ancora agli
 * altri controlli («hamburger di ceci» deve continuare a vedere `ceci`). E si sostituisce con
 * spazi della stessa lunghezza, così le posizioni nel testo non si spostano.
 */
export function senzaImitazioni(testo: string): string {
  return testo.replace(RE_IMITAZIONE, (parola) => ' '.repeat(parola.length));
}

/**
 * ⛔ **LE UOVA DI UN ANIMALE NON SONO QUELL'ANIMALE — e l'antidoto è ATTACCATO, come per la carne
 * finta.**
 *
 * Trovato in produzione il 4/9 con `diag:colazioni-con-carne`: l'ingrediente
 * «tuorlo/uova di anatra, quaglia, oca» — che è **il modo in cui il catalogo scrive le uova non di
 * gallina** — risultava carne, perché `anatra` sta fra gli animali che vincono sempre. Tre piatti
 * sarebbero usciti da colazione per delle uova.
 *
 * ⛔ **E la prima correzione era peggio del difetto.** Avevo spostato `anatra` fra i nomi a doppio
 * senso, il cui antidoto si cerca in **tutto il testo**: bastava la parola *uovo* in un punto
 * qualsiasi. «Tagliatelle all'uovo al ragù di anatra» smetteva di essere carne, e «Uova strapazzate
 * con petto d'anatra» pure. In un catalogo italiano «all'uovo» è ovunque — l'antidoto largo va bene
 * per `salame`/`cioccolato`, che è raro, non per questo. L'ha trovata una revisione avversariale
 * prima della consegna, ed era **il** falso negativo che questo file dichiara in cima di non potersi
 * permettere: carne nel piatto di chi non la mangia, per riparare tre colazioni.
 *
 * ⚠️ Perciò vale la stessa forma stretta di `RE_IMITAZIONE`: la parola dell'uovo dev'essere
 * **subito prima** del «di \<animale\>», con al più un elenco puntato in mezzo — che è come il
 * catalogo scrive davvero questa riga. Basta una parola di troppo e la regola non vale più.
 *
 *     tuorlo/uova di anatra, quaglia, oca   → uova     Tagliatelle all'uovo al ragù di anatra → CARNE
 *     Uova di quaglia sode                  → uova     Uova strapazzate con petto d'anatra    → CARNE
 *     Albume d'anatra                       → uova     Anatra all'arancia con uova sode       → CARNE
 */
const UCCELLI_DA_UOVO = ['gallina', 'quaglia', 'anatra', 'oca', 'faraona'] as const;
const RE_UOVA_DI = new RegExp(
  `\\b(?:uov[ao]|tuorl[oi]|album[ei])\\b(?:\\s*[/,]\\s*(?:uov[ao]|tuorl[oi]|album[ei]))*`
  + `\\s+d(?:i|['’])\\s*(${UCCELLI_DA_UOVO.join('|')})\\b`
  + `((?:\\s*,\\s*(?:${UCCELLI_DA_UOVO.join('|')}))*)`,
  'g',
);

/**
 * Il testo senza i nomi degli uccelli di cui si stanno nominando **le uova**.
 *
 * ⚠️ Come `senzaImitazioni`: si cancellano solo quei nomi, sostituiti da spazi della stessa
 * lunghezza, così le posizioni nel testo non si spostano e nessun altro controllo si sfasa. La coda
 * dell'elenco («, quaglia, oca») si cancella insieme, perché è lo stesso soggetto.
 */
export function senzaUovaDi(testo: string): string {
  return testo.replace(RE_UOVA_DI, (tutto) =>
    tutto.replace(new RegExp(`\\b(?:${UCCELLI_DA_UOVO.join('|')})\\b`, 'g'), (u) => ' '.repeat(u.length)));
}

export function eCarne(nome: string): boolean {
  const n = senzaUovaDi(senzaImitazioni(normale(nome)));
  if (eCarneIngrediente(n)) return true;
  /** ⚠️ La preparazione vale solo se non c'è un segno vegetale: «hamburger di ceci» non è carne. */
  return RE_CARNE_FORSE.test(n) && !RE_VEGETALE.test(n);
}

/**
 * LO STESSO GIUDIZIO SU UN **INGREDIENTE**, e senza le preparazioni.
 *
 * ⛔ **Nato da un falso positivo in produzione, 1/9**: «Buddha Bowl di Lenticchie Nere e Germogli su
 * Base di Quinoa» stava per diventare **onnivoro** perché fra i suoi ingredienti c'è «Carota
 * tagliata sottile» — `tagliata`, e nella stringa nessun segno vegetale del mio elenco. Sarebbe
 * passato dentro un blocco di 549 correzioni automatiche, senza che nessuno lo vedesse.
 *
 * ⚠️ **E il difetto era nel ragionamento, non nell'elenco.** Avevo detto: gli ingredienti sono
 * affidabili, i nomi no. Non è vero così — un ingrediente è **una cosa**, non un modo di cucinarla.
 * `tagliata`, `arrosto di`, `spezzatino` dentro un elenco di ingredienti non aggiungono niente: se
 * un piatto ha davvero della carne, l'ingrediente **la nomina** («petto di tacchino», «filetto di
 * salmone»), e ci pensa il primo livello. Le preparazioni lì portano solo falsi positivi.
 *
 * ⛔ Aggiungere `carota` ai segni vegetali sarebbe stato il rimedio sbagliato: avrei continuato a
 * rincorrere un elenco che non finisce, e il prossimo «sedano tagliato a julienne» sarebbe passato
 * lo stesso.
 */
export function eCarneIngrediente(nome: string): boolean {
  const n = senzaUovaDi(senzaImitazioni(normale(nome)));
  /** ⛔ Il primo livello vince e non si discute: un animale resta carne anche accanto alle patate. */
  if (RE_CARNE_SEMPRE.test(n)) return true;
  /** ⚠️ Un nome a doppio senso è carne finché non compare il SUO antidoto, non uno qualsiasi. */
  return DOPPI.some((d) => d.termine.test(n) && !d.antidoto.test(n));
}

/** Vero se il nome contiene un termine del pesce, dal vocabolario delle esclusioni. */
export function ePesce(nome: string): boolean {
  const n = senzaImitazioni(normale(nome));
  return hitsExclusion(n, exclusionKeys(['pesce'])) !== null
    || hitsExclusion(n, exclusionKeys(['crostacei'])) !== null
    || hitsExclusion(n, exclusionKeys(['molluschi'])) !== null;
}

/**
 * L'ingrediente che pesa di più, o `null` se le grammature non ci sono.
 *
 * ⚠️ A parità di grammi vince il **primo scritto**: chi scrive una ricetta mette per primo quello
 * che considera il protagonista, ed è l'unico segnale che resta quando i numeri non decidono.
 */
export function ingredientePrincipale(ingredienti: readonly IngredientePesato[]): string | null {
  let miglioreNome: string | null = null;
  let migliori = -1;
  for (const i of ingredienti ?? []) {
    const g = typeof i?.grammi === 'number' && Number.isFinite(i.grammi) ? i.grammi : null;
    if (g === null || g <= 0 || !normale(i.name)) continue;
    if (g > migliori) { migliori = g; miglioreNome = i.name; }
  }
  return miglioreNome;
}

/**
 * Di cosa è il piatto. `null` = **non si sa**, e non vuol dire «va bene».
 *
 * `categoriaDi` è la categoria della tabella alimenti per un nome di ingrediente, quando c'è: serve
 * alle verdure, che a differenza di carne e pesce non hanno un elenco di parole ma una colonna
 * scritta da una nutrizionista.
 */
export function diCosaE(
  ingredienti: readonly IngredientePesato[],
  categoriaDi: (nome: string) => string | null,
): DiCosa | null {
  const principale = ingredientePrincipale(ingredienti);
  if (!principale) return null;
  if (ePesce(principale)) return 'pesce';
  if (eCarne(principale)) return 'carne';
  const cat = normale(categoriaDi(principale) ?? '');
  if (cat && CATEGORIE_VERDURA.has(cat)) return 'verdura';
  /**
   * ⚠️ Categoria sconosciuta ≠ «altro». Se la tabella non conosce l'ingrediente principale non
   * sappiamo se è una verdura, e dirlo «altro» lo farebbe passare a colazione senza che nessuno
   * l'abbia guardato. Si torna `null`: la coda da guardare.
   */
  if (!cat) return null;
  return 'altro';
}

/** I pasti in cui la regola vale (Simone, 31/8). */
export const PASTI_SENZA_CARNE_PESCE_VERDURA = ['breakfast', 'morning_snack', 'afternoon_snack'] as const;

/** ⛔ `null` (non lo so) **non** entra: entra solo quello che sappiamo essere «altro». */
export function vaBeneAColazione(di: DiCosa | null): boolean {
  return di === 'altro';
}
