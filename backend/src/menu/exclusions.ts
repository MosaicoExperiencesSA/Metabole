/**
 * Regole di esclusione degli alimenti, condivise tra il motore di composizione e la
 * diagnostica. Stanno qui e non dentro `menu.service.ts` per una ragione precisa: la
 * diagnostica deve calcolare le esclusioni ESATTAMENTE come le calcola il motore, altrimenti
 * i suoi conteggi (quante alternative restano davvero a una cliente) sarebbero una stima e
 * non una misura. Il file non dipende da Nest né da Prisma, quindi è importabile anche dagli
 * script `prisma/` eseguiti con ts-node.
 */

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
  pesce: ['pesce', 'tonno', 'salmone', 'branzino', 'orata', 'merluzzo', 'sgombro', 'acciughe', 'alici', 'trota', 'sogliola', 'baccal'],
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
   * ⚠️ **DUE VOCI SONO LARGHE, e vanno sapute.** `aceto` toglie quasi ogni insalata condita e buona
   * parte dei sughi; `biscotti` — che la tabella dà a 50 mg/kg, il limite più basso di tutti — toglie
   * l'intera colazione dolce. Sono nella tabella e quindi ci sono, ma se Lucia dice che sono
   * eccessive **si tolgono queste due righe e basta**: sono scritte a parte apposta.
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
    'purè di patate', 'patate disidratate', 'succo di limone', 'succo di lime',
    // Senape (250-500 mg/kg): c'è già la sua chiave, ma chi dichiara i solfiti non dichiara la senape.
    'senape', 'mostarda',
    // ⚠️ LE DUE LARGHE — vedi il commento qui sopra: si tolgono da qui se Lucia dice che è troppo.
    'aceto',
    'biscotti',
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
const ALIAS: Record<string, string> = {
  lactose: 'lattosio',
  milk: 'latte',
  dairy: 'latticini',
  'latte e derivati': 'latte',
  gluten: 'glutine',
  eggs: 'uova',
  egg: 'uova',
  fish: 'pesce',
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

/**
 * I SEGNI CON CUI UNA PERSONA SEPARA DUE ALIMENTI in un campo che ne aspettava uno.
 *
 * ⚠️ **Non lo spazio.** «Frutta a guscio», «insalata russa», «latte di mandorla» sono un alimento
 * solo: spezzarli sugli spazi trasformerebbe un'esclusione dichiarata in una molto più larga —
 * «frutta a guscio» diventerebbe «frutta», e toglierebbe alla cliente tutta la frutta. Qui stanno
 * soltanto i segni che separano e basta, più la «e» come parola intera.
 */
const SEPARATORI_ALIMENTI = /\s*(?:[,;./|+&\n]|\s\be\b\s)\s*/;

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

/** Vero se il piatto contiene almeno una delle parole chiave escluse. */
export function hitsExclusion(haystack: string, keys: Iterable<string>): string | null {
  for (const k of keys) if (k && haystack.includes(k)) return k;
  return null;
}
