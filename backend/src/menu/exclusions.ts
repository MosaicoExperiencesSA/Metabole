/**
 * Regole di esclusione degli alimenti, condivise tra il motore di composizione e la
 * diagnostica. Stanno qui e non dentro `menu.service.ts` per una ragione precisa: la
 * diagnostica deve calcolare le esclusioni ESATTAMENTE come le calcola il motore, altrimenti
 * i suoi conteggi (quante alternative restano davvero a una cliente) sarebbero una stima e
 * non una misura. Il file non dipende da Nest né da Prisma, quindi è importabile anche dagli
 * script `prisma/` eseguiti con ts-node.
 */
import { SEPARATORI_ALIMENTI } from '../common/tag-alimenti';


// Mappa CATEGORIA generica → parole chiave negli ingredienti. Serve sia per allergie/
// intolleranze sia per i cibi "non graditi": una categoria generica ("frutta secca",
// "legumi", "latticini") deve intercettare i singoli alimenti (noci, ceci, formaggio…),
// altrimenti un'esclusione generica non prende i piatti che li contengono.
const DERIVATI_LATTE = [
  'latte', 'yogurt', 'formaggio', 'formaggi', 'burro', 'panna', 'mozzarella', 'ricotta',
  'parmigiano', 'grana', 'mascarpone', 'stracchino', 'scamorza', 'pecorino', 'gorgonzola',
  'caciocavallo', 'cheddar', 'brie', 'feta', 'kefir', 'latticini', 'ghee', 'burrata', 'provola',
];

export const INTOLERANCE_MAP: Record<string, string[]> = {
  /**
   * ⚠️ «latte» MANCAVA da questa mappa, e la conseguenza l'ha vista una cliente vera l'8/8/2026.
   *
   * Giusy ha `allergies: ['latte']`. `expandExclusion('latte')` restituiva la sola parola
   * «latte», e il confronto cerca quella parola nel nome dell'alimento: «burro» non contiene
   * «latte», quindi **il burro passava il filtro degli allergeni** e Gaia gliel'ha proposto come
   * sostituto della panna. L'ha fermata lei, dicendo no.
   *
   * C'era la chiave `lattosio` e c'era `latticini`, ma non `latte` — cioè proprio il termine con
   * cui l'allergene si chiama nell'elenco UE e con cui il questionario lo salva.
   */
  latte: DERIVATI_LATTE,
  lattosio: DERIVATI_LATTE,
  latticini: DERIVATI_LATTE,
  glutine: ['pane', 'pasta', 'farro', 'orzo', 'couscous', 'grano', 'seitan', 'pizza', 'cracker', 'frumento', 'segale', 'bulgur', 'pangrattato'],
  'frutta secca': ['noci', 'noce', 'mandorle', 'nocciole', 'pistacchi', 'anacardi', 'arachidi', 'pinoli', 'macadamia', 'pecan'],
  'frutta a guscio': ['noci', 'noce', 'mandorle', 'nocciole', 'pistacchi', 'anacardi', 'pinoli', 'macadamia', 'pecan'],
  legumi: ['lenticchie', 'ceci', 'fagioli', 'piselli', 'fave', 'lupini', 'borlotti', 'cannellini', 'cicerchie', 'edamame'],
  uova: ['uovo', 'uova', 'frittata', 'maionese', 'albume', 'tuorlo', 'omelette'],
  /**
   * ✅ PESCE — l'elenco arriva dalla tabella delle specie passata da Simone (23/8), non da chi
   * scrive il codice: stessa regola di provenienza dei solfiti.
   *
   * ⛔ Il caso che l'ha fatto allungare è Lorena Polidoro: regola «niente pesce», e le sono
   * arrivati branzino e tonno. Quei due QUI c'erano già — il suo problema era un altro (la regola
   * non era arrivata al profilo) — ma guardando l'elenco con la tabella davanti mancavano
   * trenta specie che nei menu si scrivono col loro nome: un'aringa, un nasello o una spigola
   * passavano il filtro di chiunque avesse escluso «pesce». Da 12 voci a **67**.
   *
   * ⚠️ **Le assenze sono decisioni, non dimenticanze:**
   *  · «cappone» — è anche il pollo di Natale: escluderlo toglierebbe carne a chi ha escluso pesce.
   *    La gallinella/cappone di mare resta coperta da «gallinella»;
   *  · «fragolino» (il pagello) — la radice `fragolin` prenderebbe le **fragoline** di bosco.
   *    Resta coperto da «pagello»;
   *  · «sarda» e «sarde» — la prima sta dentro «alla sarda» (malloreddus, agnello…), la seconda è un
   *    **prefisso di «Sardegna»**: pane della Sardegna, culurgiones di Sardegna. ⚠️ Contro un
   *    prefisso non possono niente né le omonime né l'inizio di parola: resta «sardina/sardine»;
   *  · «razza» — **tolta in revisione**: «razza chianina», «razza piemontese» sono carne, e chi
   *    esclude il pesce ci perderebbe la bistecca. Non è una parola che *contiene* la chiave, è la
   *    chiave con un altro significato — lo stesso caso di «cappone», e senza rimedio possibile.
   *    La razza di mare resta scoperta: è il prezzo, ed è il verso giusto;
   *  · «carpione» — «in carpione» è anche una marinatura di verdure e il pesce di lago non arriva
   *    nei menu; ⚠️ se un giorno arriva, va aggiunto CON la sua omonima;
   *  · «orate» al plurale — sta dentro «decorate»; il singolare c'è;
   *  · «barbo» — mai nei menu, e il rischio di collisioni non paga niente;
   *  · «pesce spada», «pesce gatto», «pesce san pietro», «pesce azzurro» — li prende già «pesce».
   *
   * ⚠️ E una voce è **larga di proposito, e va saputa**: «ricciola» ha radice `ricciol`, che a
   * inizio parola prende anche i «riccioli» (la pasta, i riccioli di burro). Toglie piatti
   * innocenti a chi esclude il pesce — nel verso sicuro, mai il contrario — e la ricciola è fra i
   * pesci più comuni nei menu: tenerla fuori sarebbe il buco più probabile. Se il catalogo vero ha
   * tanti «riccioli» (si misura con `npm run diag:esclusioni`), la strada è insegnare le omonime
   * anche alla radice — non togliere la ricciola.
   */
  pesce: [
    'pesce', 'tonno', 'salmone', 'branzino', 'orata', 'merluzzo', 'sgombro', 'acciughe', 'alici',
    'trota', 'trote', 'sogliola', 'baccal',
    // ⚠️ I singolari che la RADICE non recupera: `acciughe` → `acciugh`, e «acciuga» non comincia
    // per «acciugh» (la *h* è del plurale); `alici` è troppo corta per avere una radice. Sono la
    // stessa lezione di «mandorla/mandorle», su due parole che nei menu si scrivono al singolare
    // («burro all'acciuga», «salsa d'acciuga»).
    'acciuga', 'alice',
    // Mare, dalla tabella del 23/8.
    'aguglia', 'aringa', 'aringhe', 'cefalo', 'muggine', 'barracuda', 'palamita', 'ricciola',
    'sardina', 'sardine', 'alalunga', 'spada',
    // Fondale e scoglio.
    'cernia', 'dentice', 'gallinella', 'nasello', 'mormora', 'pagello', 'rombo', 'sarago',
    'scorfano', 'spigola', 'triglia',
    // Cartilaginei.
    'gattuccio', 'palombo', 'smeriglio', 'verdesca',
    // Acqua dolce.
    'anguilla', 'capitone', 'carpa', 'coregone', 'lavarello', 'luccio', 'persico', 'salmerino',
    'siluro', 'storione', 'tinca',
    // Il banco del supermercato: nella tabella non ci sono, nei piatti sì («e simili», Simone 23/8).
    'platessa', 'halibut', 'pangasio', 'tilapia',
    // Derivati e conserve: il pesce che non si chiama pesce.
    'stoccafisso', 'bottarga', 'surimi', 'colatura', 'caviale', 'paranza',
    // ⚠️ Il pesce dentro un piatto che non lo nomina: «vitello tonnato» è vitello, e la salsa è
    // tonno. Chi esclude il pesce e si vede arrivare un tonnato ha ragione lui.
    'tonnato', 'tonnata',
    // ⚠️ Il crudo giapponese: quasi sempre pesce, e nel nome del piatto il pesce non compare.
    'sushi', 'sashimi',
  ],
  crostacei: ['gambero', 'gamberi', 'scampi', 'aragosta', 'granchio', 'mazzancolle', 'astice'],
  molluschi: ['calamari', 'cozze', 'vongole', 'polpo', 'seppia', 'ostriche', 'capesante', 'totano'],
  soia: ['soia', 'tofu', 'edamame', 'tempeh', 'miso'],
  sesamo: ['sesamo', 'tahini'],
  arachidi: ['arachidi', 'burro di arachidi'],
  /**
   * ⚠️ I QUATTRO ALLERGENI UE CHE NON C'ERANO (aggiunti il 12/8).
   *
   * `sedano`, `senape`, `solfiti` e `lupini` sono opzioni del questionario
   * (`onboarding.questions.ts`) e non comparivano né qui né fra gli alias: sulla strada testuale
   * valevano solo come parola letterale.
   *
   * Per sedano e senape la parola letterale funziona quasi sempre — negli ingredienti si scrivono
   * col loro nome — ma i **lupini** stanno già dentro la chiave `legumi`, quindi chi dichiarava
   * l'allergia ai lupini non li escludeva se il piatto li elencava come «lupini» in un contesto
   * diverso, e soprattutto non aveva nessuna espansione propria.
   */
  sedano: ['sedano', 'sedano rapa'],
  senape: ['senape', 'mostarda'],
  lupini: ['lupini', 'lupino', 'farina di lupino'],
  /**
   * ✅ SOLFITI — l'elenco arriva dalla nutrizionista (13/8), non da chi scrive il codice.
   *
   * Fino a oggi qui c'era solo la parola letterale, ed era voluto: i solfiti non si scrivono negli
   * ingredienti, quindi «solfiti» non compare in nessun piatto e quell'allergia non toglieva niente.
   * Scrivere l'elenco a mano vuol dire decidere cosa sparisce dal piatto di una persona, e in
   * eccesso si sbaglia facilissimo.
   *
   * Le parole qui sotto vengono dalla tabella che ha passato Simone il 13/8 — «I solfiti negli
   * alimenti», Reg. UE 1129/2011 e 1169/2011 — categoria per categoria: frutta essiccata (2000
   * mg/kg), vino (150-235), aceto di vino e di mele (170), ortaggi sott'olio e in salamoia
   * (100-500), crostacei freschi e congelati (150-300), pesce essiccato e salato (200), patate
   * disidratate (400), succhi concentrati (350), senape (250-500).
   *
   * ✅ **LE DUE VOCI LARGHE, chiuse da Simone il 24/8 — e le due risposte sono diverse.**
   *
   * · **`biscotti` è uscita.** La tabella la dà a 50 mg/kg, il limite più basso di tutti, e toglieva
   *   l'intera colazione dolce. ⚠️ E soprattutto: nei biscotti i solfiti dipendono dal **produttore**,
   *   non dal biscotto — un divieto che non si può nemmeno verificare in etichetta è un divieto che
   *   fa smettere di fidarsi dell'elenco.
   * · **`aceto` è RIMASTA qui, e non è una mezza risposta.** Simone ha deciso che l'aceto non deve
   *   più far sparire il piatto — ma perché arrivi il **succo di limone** al posto suo, l'aceto va
   *   prima riconosciuto: è questa riga che lo riconosce. A cambiare è cosa succede dopo, in
   *   `menu/solfiti.ts`: c'è un sostituto, quindi il piatto si serve col limone invece di essere
   *   scartato. Togliere la parola da qui avrebbe fatto arrivare l'aceto **così com'è** a una persona
   *   allergica: il contrario di quello che chiedeva.
   *
   * ⚠️ Vale per tutte e quattro le righe che `solfiti.ts` sa sostituire — aceto, vino, dado, frutta
   * essiccata: **restano in questo elenco**, e il divieto diventa una sostituzione. Le due che non si
   * sostituiscono (crostacei, insaccati) restano divieti veri, ed è la decisione del 24/8.
   *
   * ⚠️ Restano fuori i termini generici che prenderebbero anche l'alimento fresco: «uva» (l'uva
   * fresca non ha solfiti, l'uvetta sì), «patate», «pomodoro», «limone». Un divieto che toglie
   * l'insalata di pomodoro a chi è sensibile ai pomodori SECCHI non protegge nessuno: fa solo
   * smettere di fidarsi dell'elenco.
   */
  solfiti: [
    'solfiti', 'solfito', 'anidride solforosa',
    // Vini e derivati alcolici (150-400 mg/l a seconda del tipo).
    'vino', 'spumante', 'prosecco', 'sidro', 'marsala',
    // Frutta essiccata: la categoria col limite più alto di tutte (2000 mg/kg).
    'uvetta', 'uva passa', 'uva sultanina', 'albicocche secche', 'albicocche disidratate',
    'prugne secche', 'fichi secchi', 'datteri', 'frutta disidratata', 'frutta essiccata',
    'banane essiccate', 'mele essiccate',
    // Ortaggi e funghi conservati (100-500 mg/kg).
    'pomodori secchi', 'pomodori essiccati', 'funghi secchi', 'sottaceti', 'giardiniera',
    'peperoni sott', 'cipolline sott',
    // Prodotti della pesca: crostacei freschi/congelati (150-300) e pesce essiccato o salato (200).
    'gamberi', 'gamberetti', 'mazzancolle', 'scampi', 'baccal', 'stoccafisso',
    // Patate trasformate (400 mg/kg) e succhi concentrati (350 mg/l).
    'purè di patate', 'patate disidratate',
    /**
     * ⚠️ **CONCENTRATI, non spremuti** — corretto il 24/8. Qui c'erano `succo di limone` e
     * `succo di lime` secchi, e la tabella parla dei **succhi concentrati** (350 mg/l). Il limone
     * spremuto non è un portatore — ed è il sostituto che `solfiti.ts` propone al posto dell'aceto:
     * lo stesso prodotto dichiarava vietato ciò che proponeva come rimedio.
     */
    'succo concentrato', 'succo da concentrato', 'succo di limone concentrato', 'succo di lime concentrato',
    // Senape (250-500 mg/kg): c'è già la sua chiave, ma chi dichiara i solfiti non dichiara la senape.
    'senape', 'mostarda',
    // ⚠️ `aceto` RESTA, e serve a farlo riconoscere: il sostituto è in `solfiti.ts`. Vedi sopra.
    'aceto', 'balsamico',
    /**
     * ⛔ **I SINGOLARI, e non è pedanteria.** Le chiavi di più parole **non hanno radice**
     * (`radiceChiave` torna `null` appena c'è uno spazio), quindi il salvagente che prende
     * «mandorla» da «mandorle» qui non esiste: `albicocca secca` al singolare passava intatta.
     * Trovato in revisione il 24/8, sulla categoria col limite più alto della tabella (2000 mg/kg).
     */
    'albicocca secca', 'albicocca disidratata', 'prugna secca', 'fico secco',
    'pomodoro secco', 'fungo secco', 'frutta secca disidratata',
    // Insaccati e macinato confezionato: NON si sostituiscono, il piatto esce (Simone, 24/8).
    'salsiccia', 'salsicce', 'wurstel', 'würstel', 'salame', 'mortadella', 'insaccati',
    'macinato confezionato', 'carne macinata confezionata',
    // Crostacei: il resto della famiglia, che `solfiti.ts` sapeva escludere e non veniva mai chiamata.
    'astice', 'aragosta', 'granchio',
    // Conserve di pesce.
    'tonno in scatola', 'sgombro in scatola',
    /**
     * ⚠️ `dado` **da solo**: `dado da brodo` e `dado vegetale` non prendono «dado granulare» né
     * «brodo di dado», e le chiavi con lo spazio non hanno radice. La sostituzione c'era e non
     * scattava su nessuna scrittura realistica. Le omonime stanno in `PAROLE_CHE_NON_SONO`.
     */
    'dado', 'dado da brodo', 'dado vegetale',
    // Salse pronte.
    'maionese', 'ketchup',
    // ⛔ `biscotti` TOLTA il 24/8: vedi il commento qui sopra.
  ],
};

/**
 * Alias con cui lo stesso allergene arriva scritto diversamente: dal questionario in italiano,
 * dagli import in inglese, o come plurale.
 *
 * Non è pignoleria: Giusy ha `intolerances: ['lactose']`, non «lattosio». Una chiave che la mappa
 * non riconosce si comporta esattamente come un'esclusione che non c'è — e non produce nessun
 * errore, quindi nessuno se ne accorge finché non lo racconta una cliente.
 */
/**
 * ⚠️ **Esportato il 24/8**: la regola dei solfiti deve riconoscere `sulphites` e `sulfites` con la
 * STESSA tabella, non con un secondo elenco. Un alias che una porta conosce e l'altra no è il modo
 * in cui una consegna resta spenta proprio per le clienti arrivate da un import.
 */
export const ALIAS: Record<string, string> = {
  lactose: 'lattosio',
  milk: 'latte',
  dairy: 'latticini',
  'latte e derivati': 'latte',
  gluten: 'glutine',
  eggs: 'uova',
  egg: 'uova',
  fish: 'pesce',
  pesci: 'pesce',
  'pesce azzurro': 'pesce',
  'pesce bianco': 'pesce',
  soy: 'soia',
  soya: 'soia',
  shellfish: 'crostacei',
  crustaceans: 'crostacei',
  molluscs: 'molluschi',
  mollusks: 'molluschi',
  nuts: 'frutta a guscio',
  'tree nuts': 'frutta a guscio',
  peanuts: 'arachidi',
  peanut: 'arachidi',
  sesame: 'sesamo',
  'frutta con guscio': 'frutta a guscio',
  latticini_: 'latticini',
  mustard: 'senape',
  celery: 'sedano',
  sulphites: 'solfiti',
  sulfites: 'solfiti',
  lupin: 'lupini',
};

/**
 * Espande un termine escluso (intolleranza o cibo non gradito) nelle sue parole chiave:
 * se è una categoria nota (es. "frutta secca", "legumi") restituisce categoria + membri
 * (noci, mandorle, …), altrimenti solo il termine stesso. Usato per intolleranze E dislikedFoods.
 */
/**
 * ⚠️ GLI UNDERSCORE DEL QUESTIONARIO (12/8).
 *
 * Il questionario salva `frutta_a_guscio` — con gli underscore — e la mappa conosce
 * `'frutta a guscio'` con gli spazi. `expandExclusion('frutta_a_guscio')` restituiva quindi
 * `['frutta_a_guscio']`: una stringa che non compare in nessun nome di piatto e in nessun
 * ingrediente. **Sulla strada testuale quell'allergia non escludeva niente.**
 *
 * È lo stesso difetto che l'8/8 ha fatto proporre il burro a una cliente allergica al latte, ed è
 * la lezione già scritta sopra: una chiave che la mappa non riconosce si comporta come
 * un'esclusione che non c'è, e non produce nessun errore.
 *
 * Si normalizza qui invece di aggiungere l'alias `frutta_a_guscio` a mano, così il difetto **non
 * si ripresenta con la prossima opzione che nasce con l'underscore**: aggiungerne una al
 * questionario non richiede di ricordarsi anche di questo file.
 */
function senzaUnderscore(t: string): string {
  return t.replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function expandExclusion(term: string): string[] {
  const grezzo = (term ?? '').toLowerCase().trim();
  if (!grezzo) return [];

  /**
   * DUE ALIMENTI DENTRO UN TAG SOLO — caso Jolanda Todde, 17/8.
   *
   * In scheda aveva un'unica voce, `"Carne .ceci"`, scritta di getto nel campo a tag del
   * questionario. Non essendo una chiave della mappa tornava intera, e il motore andava a cercare
   * la stringa `carne .ceci` dentro il nome e gli ingredienti dei piatti — dove non compare mai.
   * Né la carne né i ceci sono stati esclusi, e il giorno dopo le è arrivata un'insalata di ceci.
   *
   * ⚠️ Terza volta per la stessa riga: `latte` che non espandeva i derivati (8/8),
   * `frutta_a_guscio` con l'underscore (12/8), e adesso questo. Il difetto è quello scritto in
   * testa al file — **una chiave che la mappa non riconosce si comporta come un'esclusione che non
   * c'è, e non produce nessun errore** — e le prime due volte si è chiusa la forma singola. Questa
   * volta si chiude la forma generale: se non ti riconosco, prima di arrendermi provo a spezzarti.
   *
   * ⚠️ Il taglio si prova **dopo** aver guardato se il termine intero è già una chiave conosciuta:
   * «latte e derivati» e «frutta a guscio» sono voci vere della mappa, e spezzarle vorrebbe dire
   * perdere proprio l'espansione che serve. La strada nota vince sempre sul ripiego.
   */
  const conSpaziPrima = senzaUnderscore(grezzo);
  const giaNota = !!(
    ALIAS[grezzo] || ALIAS[conSpaziPrima] || INTOLERANCE_MAP[conSpaziPrima] || INTOLERANCE_MAP[grezzo]
  );
  if (!giaNota) {
    const pezzi = grezzo.split(SEPARATORI_ALIMENTI).map((p) => p.trim()).filter((p) => p.length >= 2);
    if (pezzi.length > 1) {
      const out = new Set<string>();
      // Ogni pezzo si riespande per conto suo: spezzare senza riespandere sarebbe mezza
      // correzione, e «latte» vale solo se si porta dietro burro e panna (la lezione dell'8/8).
      for (const p of pezzi) for (const k of expandExclusion(p)) out.add(k);
      return [...out];
    }
  }

  // Prima l'alias (`lactose` → `lattosio`), poi la mappa. Il termine originale resta sempre fra
  // le parole chiave: se la mappa non lo conosce, almeno la parola scritta dalla cliente vale.
  // ⚠️ `latticini_` è un alias vero con l'underscore in fondo: si guarda la forma grezza PRIMA di
  // normalizzare, o quella chiave smetterebbe di funzionare.
  const conSpazi = senzaUnderscore(grezzo);
  const t = ALIAS[grezzo] ?? ALIAS[conSpazi] ?? (INTOLERANCE_MAP[conSpazi] ? conSpazi : grezzo);
  const members = INTOLERANCE_MAP[t];
  return members ? [...new Set([grezzo, t, ...members])] : [grezzo];
}

/** Tutte le parole chiave escluse a partire dai termini grezzi del profilo. */
export function exclusionKeys(terms: (string | null | undefined)[]): Set<string> {
  const out = new Set<string>();
  for (const t of terms) for (const kw of expandExclusion(t ?? '')) if (kw) out.add(kw);
  return out;
}

/**
 * Testo su cui si applica il confronto: nome del piatto + nomi degli ingredienti. Il motore
 * cerca le parole chiave qui dentro, quindi la diagnostica deve costruirlo allo stesso modo.
 */
export function recipeHaystack(name: string | null | undefined, ingredients: unknown): string {
  const ing = ((ingredients as { name?: string }[]) ?? []).map((i) => i?.name ?? '').join(' ');
  return `${name ?? ''} ${ing}`.toLowerCase();
}

/**
 * ⚠️ **LA RADICE, perché «mandorla» non contiene «mandorle».**
 *
 * Il confronto è sempre stato «la parola chiave dentro il testo del piatto», e le parole chiave
 * sono scritte in **una forma sola**: `mandorle`, `nocciole`, `gamberi`, `frittata`. Una ricetta
 * che scrive l'altra forma — e il catalogo le scrive tutte e due — **passa il filtro**. Misurato il
 * 20/8 sul catalogo keto del repo (118 ricette, `npm run diag:esclusioni`), con l'allergia
 * dichiarata e il piatto proposto lo stesso:
 *
 *   · «Smoothie verde (**mandorla**, avocado, spinaci, lime)» → frutta a guscio
 *   · «Gelato keto **nocciola**» → frutta a guscio
 *   · «**Gamberetti** saltati con zucchine» → crostacei *(un diminutivo, non un plurale)*
 *   · «**Frittatine** al forno» → uova
 *
 * ⚠️ È la **quarta volta** che questa riga morde nello stesso modo: `latte` che non espandeva i
 * derivati (8/8, il burro a Giusy), `frutta_a_guscio` con l'underscore (12/8), «Carne .ceci» in un
 * tag solo (17/8), e adesso la forma singolare. Il difetto è sempre quello scritto in testa al
 * file — *una chiave che non combacia si comporta come un'esclusione che non c'è, e non produce
 * nessun errore*.
 *
 * ## Perché la radice ha una lunghezza minima, e non è pignoleria
 *
 * Tagliare la vocale finale e cercare il moncone funziona su `mandorl`, `nocciol`, `gamber`,
 * `frittat`. ⛔ Ma `polpo` diventa `polp`, e `polp` sta dentro **polpette**: chi è allergico ai
 * molluschi si vedrebbe sparire le polpette di carne. L'ho scoperto misurando, non ragionando —
 * era una delle due ricette che la prima versione della regola toglieva.
 *
 * Con la soglia a {@link RADICE_MINIMA} caratteri, sulle 118 ricette vere del catalogo del repo le
 * righe in più erano **quattro e contenevano tutte l'allergene davvero**: zero falsi positivi.
 *
 * ## ⛔ E SUL CATALOGO VERO NON ERA VERO — misurato il 20/8 sera
 *
 * `npm run diag:esclusioni` in produzione: su «frutta secca» la radice toglieva **721 ricette in
 * più**, e a leggerle una per una la stessa parola tornava decine di volte:
 *
 *     ⚠️  Filetto di sgombro fresco al forno con limone e olive   ← radice nocciol
 *
 * Uno sgombro con le olive tolto a chi è allergico alle nocciole. La colpevole è **«olive
 * denocciolate»**, che contiene `nocciol`. Non era pericoloso — toglie piatti, non ne lascia
 * passare uno sbagliato — ma a una cliente allergica alla frutta secca spariva **ogni piatto con le
 * olive**, e un pool che si svuota così è un piano che non si riesce più a comporre.
 *
 * ⛔ **E la nota che stava scritta qui diceva la cosa sbagliata**: «se togliesse roba che non
 * c'entra, la cosa da girare è questa costante». Non funziona. `nocciol` è già **sette** caratteri:
 * alzare `RADICE_MINIMA` spegnerebbe la radice proprio sulle nocciole, cioè butterebbe via anche
 * tutti i casi veri per cui la radice esiste. Avevo indicato la leva sbagliata perché avevo in
 * mente `polp`/`polpette`, dove il problema era davvero la lunghezza.
 *
 * ⚠️ **Il difetto non è quanto è lunga la radice: è DOVE combacia.** `mandorl` dentro «latte di
 * mandorla» comincia una parola, ed è giusto. `nocciol` dentro «denocciolate» sta **in mezzo**, e
 * non lo è. Da qui {@link iniziaUnaParola}: la radice deve cominciare una parola. La lunghezza
 * minima resta, perché serve ancora — `polp` all'inizio di «polpette» comincia una parola eccome.
 */
export const RADICE_MINIMA = 6;

/**
 * La radice combacia solo se **comincia una parola** del testo.
 *
 * ⚠️ Vale per la radice e **non** per la parola chiave intera, di proposito. La chiave esatta si
 * cerca com'è da sempre: cambiare anche quel giro vorrebbe dire toccare il comportamento che regge
 * le esclusioni da mesi, per un difetto che non è quello. Se anche lì ci fosse la stessa cosa
 * — `uovo` dentro `nuovo` è il candidato — è una misura a parte, non un colpo di mano dentro questa.
 */
export function iniziaUnaParola(testo: string, radice: string): boolean {
  let i = testo.indexOf(radice);
  while (i !== -1) {
    if (i === 0 || !/[a-z0-9]/.test(testo[i - 1])) return true;
    i = testo.indexOf(radice, i + 1);
  }
  return false;
}

/** La radice di una parola chiave, o `null` se è troppo corta o composta per fidarsi. */
export function radiceChiave(k: string): string | null {
  if (!k || k.includes(' ')) return null;
  const r = /[aeio]$/.test(k) ? k.slice(0, -1) : k;
  return r.length >= RADICE_MINIMA ? r : null;
}

/**
 * ⚠️ **CHI CHIEDE «QUESTO PIATTO CONTIENE UNA COSA ESCLUSA?» PASSA DA QUI.**
 *
 * Questa funzione esisteva già, con questo commento, e **non la chiamava nessuno**: motore dei menu
 * e sostituzioni in chat avevano ognuno il proprio `[...chiavi].some((k) => testo.includes(k))` —
 * sette copie, più un'ottava dentro il test, con scritto accanto «come lo verifica il codice vero».
 * ⛔ Che è il motivo per cui la radice qui sopra non si poteva aggiungere in un posto solo: si
 * sarebbe corretta la funzione che nessuno usa. La tiene ferma `una-porta-per-le-esclusioni.spec.ts`.
 *
 * Torna la **chiave** che ha fatto scartare (non la radice): serve a dire *perché*, e «mandorl» in
 * un messaggio a una cliente non si può leggere.
 */
/**
 * ⛔ **LE PAROLE CHE CONTENGONO UNA CHIAVE SENZA ESSERLA.**
 *
 * `npm run diag:esclusioni` in produzione (20/8 sera) ha contato **212** casi in cui la parola
 * chiave **intera** combacia dentro una parola più lunga. E le prime due che si vedono dicono
 * perché qui **non** si può mettere un confine di parola come si è fatto per la radice:
 *
 *   · «aceto» dentro «**sottaceto**» → **giusto**. Il sottaceto l'aceto ce l'ha davvero, e un
 *     confine di parola **toglierebbe** protezione a chi è sensibile ai solfiti.
 *   · «vino» dentro «**bovino**» → **sbagliato**. Uno stracetto di bovino magro non c'entra niente.
 *
 * ⚠️ La stessa regola darebbe la risposta giusta a una e sbagliata all'altra. Quindi non è una
 * regola: è una **lista corta**, e si allunga solo quando la diagnostica nomina una parola nuova —
 * mai per analogia. ⛔ Ogni riga qui **toglie** un'esclusione: si scrive solo dopo aver letto la
 * parola in un esito vero, perché sbagliare qui vuol dire lasciar passare qualcosa.
 */
export const PAROLE_CHE_NON_SONO: Readonly<Record<string, readonly string[]>> = {
  // «bovino» contiene «vino» e non ha niente a che fare con i solfiti del vino.
  vino: ['bovino', 'bovina', 'bovini', 'bovine'],
  // «dadolata di verdure» comincia con «dado» e non è un dado da brodo (24/8, insieme alla chiave).
  dado: ['dadolata', 'dadolate', 'dadolato'],
  /**
   * ⚠️ Le tre righe sotto NASCONO insieme alle loro chiavi (l'elenco del pesce, 23/8) e non dalla
   * diagnostica — ed è una deroga dichiarata alla regola qui sopra, con una differenza che la
   * giustifica: la regola vieta di TOGLIERE per analogia un'esclusione che già lavora; qui la
   * chiave e la sua omonima entrano nello stesso momento, quindi non si toglie niente — si evita
   * di creare un falso che il primo giro di diagnostica avrebbe nominato comunque.
   * ⚠️ E il carpaccio DI PESCE resta escluso lo stesso: si chiama sempre col nome del pesce
   * («carpaccio di branzino», «di spada»), e quella parola lo prende.
   */
  // ⚠️ «scarpaccia» è la torta di zucchine viareggina: contiene «carpa» e non è pesce.
  // ⚠️ `carpa` è anche in `SOLO_A_INIZIO_PAROLA`: le due cose lavorano insieme — l'inizio di parola
  // scarta «scarpaccia», le omonime scartano «carpaccio», che invece comincia una parola.
  carpa: ['carpaccio', 'carpacci'],
  // ⚠️ Le omonime della RADICE (`palomb`, `trigli`, `ricciol`, `gallinell`): da oggi si possono
  // dichiarare, e queste sono quelle che la revisione ha nominato leggendo piatti veri.
  palombo: ['palombaccio', 'palombacci', 'palomba', 'palombella', 'palombelle'],
  triglia: ['trigliceridi', 'trigliceride'],
  gallinella: ['gallinelle'], // il songino/valerianella, che in alcune regioni si chiama così
  smeriglio: ['smerigliato', 'smerigliata', 'smerigliate'],
  persico: ['persica', 'persiche'], // «pesca persica»
  rombo: ['stromboli'],
  colatura: ['scolatura', 'scolature'],
  luccio: ['lucciole', 'lucciola'],
};

/**
 * ⛔ **LE CHIAVI CHE VALGONO SOLO A INIZIO DI PAROLA.**
 *
 * `PAROLE_CHE_NON_SONO` è un elenco chiuso: si scrive una parola alla volta, e va bene finché le
 * omonime sono poche e note («bovino» per «vino»). ⛔ Su **«orata» non funziona**, e la prima
 * stesura del 23/8 fingeva di sì: ogni participio femminile in «-orata» la contiene — decorata,
 * dorata, colorata, **insaporata**, marinata e insaporata, odorata, ristorata… È una famiglia
 * **aperta**, e un elenco chiuso contro una famiglia aperta è un elenco che sarà sempre incompleto.
 * Ne avevo scritte otto e dichiarato il caso chiuso: l'ha smontato la revisione con «insaporata»,
 * che in cucina si scrive davvero.
 *
 * La regola giusta è un'altra: **questi nomi cominciano una parola**. «Orata alla griglia» sì,
 * «insaporata» no. È la stessa regola che dal 20/8 vale per la radice (`iniziaUnaParola`), portata
 * dove serve anche sulla chiave intera.
 *
 * ⚠️ **Non si applica a tutte le chiavi**, ed è scritto in `PAROLE_CHE_NON_SONO` perché: «aceto»
 * dentro «sottaceto» è **giusto** — il sottaceto l'aceto ce l'ha — e un confine di parola
 * toglierebbe protezione a chi è sensibile ai solfiti. La stessa regola dà la risposta giusta a una
 * e sbagliata all'altra: quindi è una scelta per chiave, non una legge.
 *
 * ⚠️ Si dichiara qui **solo** una chiave che, dentro una parola più lunga, non c'entra mai niente.
 * Nel dubbio si lascia fuori: restare larghi toglie un piatto di troppo, restringere lascia passare
 * l'alimento — e i due errori non costano uguale.
 */
export const SOLO_A_INIZIO_PAROLA: ReadonlySet<string> = new Set([
  // I pesci il cui nome è anche un pezzo di parola comune.
  'orata', 'spada', 'carpa', 'rombo', 'alice', 'alici', 'trota', 'trote', 'sarago', 'tinca',
  // «cefalo» sta dentro «cefalopode» — che è un mollusco, non un pesce, e ha la sua chiave.
  'cefalo',
]);

/**
 * ⛔ **QUESTA COPPIA (chiave, parola) È GIÀ STATA DECISA?**
 *
 * Serve a `npm run diag:esclusioni`, che elenca le chiavi che combaciano **dentro** una parola più
 * lunga perché una persona le legga una per una. ⚠️ Senza questa funzione la diagnostica rifaceva
 * il conto **grezzo** e riproponeva anche le coppie già chiuse — «vino» dentro «bovino» è in
 * `PAROLE_CHE_NON_SONO` dal 20/8, e sarebbe tornata in cima all'elenco da leggere. *Un elenco di
 * lavoro che contiene lavoro già fatto è un elenco che si smette di leggere.*
 *
 * Sta qui e non nella diagnostica di proposito: *se due punti rispondono alla stessa domanda, uno
 * deve chiamare l'altro*. Le due liste le legge il motore, e chi le racconta legge le stesse.
 *
 * ⚠️ Vale per una occorrenza **dentro** una parola più lunga (`parola` è la parola intera del
 * piatto): è l'unico caso che la diagnostica raccoglie, ed è il motivo per cui
 * `SOLO_A_INIZIO_PAROLA` da solo basta a dire «già decisa».
 */
export function coppiaGiaDecisa(chiave: string, parola: string): boolean {
  if (SOLO_A_INIZIO_PAROLA.has(chiave)) return true;
  return (PAROLE_CHE_NON_SONO[chiave] ?? []).includes(parola);
}

/**
 * La chiave combacia dentro il testo? Due filtri, e **si applicano insieme**.
 *
 * ⛔ La prima stesura del 23/8 li teneva alternativi (`if (inizioParola) return …` prima delle
 * omonime), e su «carpa» le due regole servivano tutte e due: «scarpaccia» la scarta l'inizio di
 * parola, «carpaccio» — che una parola la comincia eccome — la scartano le omonime. Con il ritorno
 * anticipato il carpaccio di manzo tornava a sparire dal piatto di chi esclude il pesce, cioè il
 * falso che le omonime erano state scritte per chiudere.
 */
function chiaveVale(haystack: string, k: string): boolean {
  // ⚠️ `SOLO_A_INIZIO_PAROLA` è la risposta alle famiglie APERTE («-orata»), dove un elenco di
  // omonime non basterebbe mai; le omonime restano la risposta ai casi singoli e noti.
  const soloInizio = SOLO_A_INIZIO_PAROLA.has(k);
  const escluse = PAROLE_CHE_NON_SONO[k];
  if (!soloInizio && !escluse) return haystack.includes(k);
  let i = haystack.indexOf(k);
  while (i !== -1) {
    const inizioParola = i === 0 || !/[a-z0-9]/.test(haystack[i - 1]);
    if (!soloInizio || inizioParola) {
      let a = i; while (a > 0 && /[a-z0-9]/.test(haystack[a - 1])) a -= 1;
      let b = i + k.length; while (b < haystack.length && /[a-z0-9]/.test(haystack[b])) b += 1;
      if (!escluse || !escluse.includes(haystack.slice(a, b))) return true;
    }
    i = haystack.indexOf(k, i + 1);
  }
  return false;
}

export function hitsExclusion(haystack: string, keys: Iterable<string>): string | null {
  const elenco = [...keys].filter(Boolean);
  // Primo giro: la parola esatta. Se combacia così, è quella che si riporta.
  for (const k of elenco) if (chiaveVale(haystack, k)) return k;
  // Secondo giro: la radice, per le altre forme della stessa parola — ma solo a inizio di parola.
  for (const k of elenco) {
    const r = radiceChiave(k);
    if (r && iniziaUnaParola(haystack, r) && radiceVale(haystack, k, r)) return k;
  }
  return null;
}

/**
 * ⛔ **ANCHE LA RADICE CONSULTA LE OMONIME** — trovato in revisione, 23/8.
 *
 * Questo giro le ignorava del tutto: per ogni chiave la cui radice sopravvive, le omonime erano
 * **strutturalmente impossibili** — nessuno avrebbe mai potuto insegnare a `trigli`, `palomb`,
 * `gallinell`, `ricciol`. ⚠️ E in un commento avevo indicato proprio quella come la via d'uscita
 * per il costo noto dei «riccioli»: era una via che **non esisteva**, cioè un'istruzione che manda
 * a sbattere chi la segue.
 *
 * Le omonime si dichiarano sulla **chiave** e valgono per tutte le sue forme: chi scrive
 * `palombo: ['palombaccio']` non deve anche sapere che la radice è `palomb`.
 */
function radiceVale(haystack: string, chiave: string, radice: string): boolean {
  const escluse = PAROLE_CHE_NON_SONO[chiave];
  if (!escluse) return true;
  let i = haystack.indexOf(radice);
  while (i !== -1) {
    if (i === 0 || !/[a-z0-9]/.test(haystack[i - 1])) {
      let b = i + radice.length;
      while (b < haystack.length && /[a-z0-9]/.test(haystack[b])) b += 1;
      if (!escluse.includes(haystack.slice(i, b))) return true;
    }
    i = haystack.indexOf(radice, i + 1);
  }
  return false;
}
