import {
  diCosaE, eCarne, eCarneIngrediente, ePesce, ingredientePrincipale, vaBeneAColazione,
} from './piatto-di-cosa';

/** La tabella alimenti finta: solo quello che serve a distinguere una verdura. */
const CAT: Record<string, string> = {
  'zucchine': 'verdura', 'broccoli': 'verdura', 'spinaci': 'verdura', 'pomodori': 'verdura',
  'insalata mista': 'verdura', 'patate': 'legumi e tuberi',
  'uova': 'proteici', 'ricotta': 'latticini', 'pane integrale': 'cereali', 'avena': 'cereali',
  'mela': 'frutta', 'avocado': 'grassi', 'yogurt greco': 'latticini', 'ceci': 'legumi',
};
const cat = (n: string) => CAT[n.toLowerCase()] ?? null;
const ing = (...coppie: [string, number | null][]) => coppie.map(([name, grammi]) => ({ name, grammi }));

describe('di cosa è questo piatto', () => {
  describe('l\'ingrediente principale', () => {
    it('è quello che pesa di più, non il primo scritto', () => {
      expect(ingredientePrincipale(ing(['spinaci', 40], ['uova', 120]))).toBe('uova');
    });

    it('⚠️ a parità di grammi vince il primo scritto: è l\'unico segnale che resta', () => {
      expect(ingredientePrincipale(ing(['uova', 100], ['zucchine', 100]))).toBe('uova');
    });

    /**
     * ⛔ Senza grammature non si indovina. Rispondere «il primo» qui vorrebbe dire far decidere a
     * chi ha scritto la ricetta in che ordine ha battuto i tasti.
     */
    it.each([[ing(['uova', null], ['zucchine', null])], [ing()], [ing(['uova', 0])], [ing(['', 100])]])(
      '⛔ senza grammature valide (%p) non c\'è nessun principale', (i) => {
        expect(ingredientePrincipale(i)).toBeNull();
      },
    );
  });

  describe('i vocabolari', () => {
    it.each(['petto di pollo', 'bresaola', 'macinato di manzo', 'prosciutto crudo', 'ossobuco di tacchino'])(
      '«%s» è carne', (n) => expect(eCarne(n)).toBe(true),
    );

    it.each(['merluzzo', 'gamberi', 'cozze', 'tonno al naturale', 'baccalà'])(
      '«%s» è pesce', (n) => expect(ePesce(n)).toBe(true),
    );

    /**
     * ⚠️ Le parole che **sembrano** carne e non lo sono: l'elenco è di tagli e animali, non di
     * piatti, e le radici corte sono tenute fuori apposta.
     */
    it.each(['polenta', 'polpa di pomodoro', 'ceci', 'tofu', 'seitan', 'polpettone di lenticchie'])(
      '⛔ «%s» NON è carne', (n) => expect(eCarne(n)).toBe(false),
    );
  });

  describe('il verdetto sul piatto', () => {
    it.each([
      ['Frittata con spinaci', ing(['uova', 120], ['spinaci', 60]), 'altro'],
      ['Yogurt con avena e mela', ing(['yogurt greco', 150], ['avena', 40], ['mela', 100]), 'altro'],
      ['Pane e ricotta con pomodorini', ing(['pane integrale', 80], ['ricotta', 60], ['pomodori', 40]), 'altro'],
      ['Pollo alla piastra con zucchine', ing(['petto di pollo', 150], ['zucchine', 100]), 'carne'],
      ['Tonno con insalata', ing(['tonno al naturale', 120], ['insalata mista', 80]), 'pesce'],
      ['Vellutata di broccoli e patate', ing(['broccoli', 200], ['patate', 100]), 'verdura'],
    ])('«%s» → %s', (_, ingredienti, atteso) => {
      expect(diCosaE(ingredienti, cat)).toBe(atteso);
    });

    /**
     * ⛔ **La prova che dice perché la lettura stretta è stata scartata**: questi sono piatti da
     * colazione normali che contengono una verdura, e devono restare.
     */
    it.each([
      ['Frittata con spinaci', ing(['uova', 120], ['spinaci', 60])],
      ['Pane e pomodorini', ing(['pane integrale', 80], ['pomodori', 50])],
      ['Avocado toast', ing(['pane integrale', 70], ['avocado', 60])],
    ])('⛔ «%s» resta a colazione: la verdura c\'è ma il piatto non è di verdura', (_, i) => {
      expect(vaBeneAColazione(diCosaE(i, cat))).toBe(true);
    });

    /**
     * ⛔ «Non lo so» non è «va bene». Se la tabella alimenti non conosce l'ingrediente principale
     * non sappiamo se è una verdura, e farlo passare vorrebbe dire mettere a colazione un piatto
     * che nessuno ha guardato — su una tabella che oggi ha 373 righe contro 8012 nomi.
     */
    it('⛔ ingrediente principale sconosciuto → non lo so, e NON va bene a colazione', () => {
      const e = diCosaE(ing(['trancio misto', 200], ['pane integrale', 50]), cat);
      expect(e).toBeNull();
      expect(vaBeneAColazione(e)).toBe(false);
    });

    it('⛔ e senza grammature idem: non lo so', () => {
      expect(diCosaE(ing(['uova', null]), cat)).toBeNull();
      expect(vaBeneAColazione(null)).toBe(false);
    });
  });
});

/**
 * ⛔ IL RICONOSCITORE DELLA CARNE, RISCRITTO L'1/9 — e queste prove sono il motivo.
 *
 * La prima stesura dichiarava «ci vanno i tagli e gli animali, non i piatti» e poi conteneva
 * `cotoletta`, `tagliata`, `arrosto di`, `hamburger di`, `spezzatino`, `straccetti`, `scaloppin`,
 * `macinato di` — che sono preparazioni, e in cucina italiana si fanno di ceci e di seitan come di
 * vitello. Su venti nomi plausibili ne sbagliava quindici, in silenzio: il confronto è per
 * sottostringa e non lascia traccia.
 *
 * ⛔ **E i due elenchi qui sotto non sono simmetrici, come non lo è l'errore.** Un falso positivo
 * toglie un piatto buono da un paniere; un falso negativo mette carne nel piatto di una
 * pescetariana. Il secondo elenco è quello che conta, e va tenuto più lungo del primo.
 */
describe('eCarne — le preparazioni non sono animali', () => {
  /** ⚠️ Erano tutti «carne» fino all'1/9. Sono i quindici che hanno fatto riscrivere l'elenco. */
  it.each([
    ['Coppa di yogurt greco con frutti di bosco'],
    ['Coppa di gelato alla vaniglia'],
    ['Salame di cioccolato'],
    ['Uova di gallina in camicia'],
    ['Uovo di gallina'],
    ['Uova di quaglia sode con asparagi'],
    /**
     * ⛔ **Il falso positivo del 4/9, preso con `diag:colazioni-con-carne` in produzione.** Non è
     * un nome di piatto: è **l'ingrediente** con cui il catalogo scrive le uova non di gallina, e
     * scattava su `anatra`, che sta fra gli animali che vincono sempre. Tre piatti sarebbero
     * usciti da colazione per delle uova.
     */
    ['tuorlo/uova di anatra, quaglia, oca'],
    ['Tuorlo di anatra'],
    ['Albume di quaglia'],
    ['Uova di anatra sode'],
    ['Hamburger di ceci e curcuma'],
    ['Hamburger di lenticchie'],
    ['Cotoletta di melanzane al forno'],
    ['Cotoletta di seitan'],
    ['Tagliata di verdure grigliate'],
    ['Arrosto di verdure miste'],
    ['Spezzatino di soia con piselli'],
    ['Straccetti di seitan e rucola'],
    ['Scaloppine di seitan al limone'],
    ['Macinato di ceci speziato'],
  ])('non è carne: %s', (nome) => {
    expect(eCarne(nome)).toBe(false);
  });

  /**
   * ⛔ L'elenco che protegge. Un solo `false` qui è carne servita a chi non la mangia — e le due
   * righe che contano davvero sono «Salame e formaggio» e «Spezzatino di manzo con patate»: sono
   * i due modi in cui la correzione poteva sbagliare, e li ho scritti mentre la scrivevo.
   */
  it.each([
    ['Petto di pollo alla piastra'],
    ['Bresaola con rucola e grana'],
    /** ⚠️ Il primo livello vince: l'animale non si lascia smontare da un contorno vegetale. */
    ['Spezzatino di manzo con patate'],
    ['Tagliata di manzo con rucola'],
    ['Straccetti di pollo con zucchine'],
    ['Macinato di manzo al ragù'],
    ['Hamburger di manzo'],
    ['Arrosto di vitello'],
    ['Scaloppine di vitello'],
    /** ⚠️ Nessun segno vegetale: la preparazione resta carne, ed è il caso più comune. */
    ['Cotoletta alla milanese'],
    ['Brasato al Barolo'],
    /** ⛔ L'antidoto è SUO: `salame` cade davanti al cioccolato, non davanti a un formaggio. */
    ['Salame e formaggio'],
    ['Salame Milano'],
    ['Coppa piacentina'],
    ['Coppa di suino stagionata'],
    ['Uova strapazzate con speck'],
    ['Prosciutto crudo e melone'],
    ['Wurstel di pollo'],
    ['Fegato alla veneziana'],
    ['Trippa alla romana'],
    /**
     * ⛔ **LE SEI RIGHE CHE VALGONO LA CORREZIONE DELLA CORREZIONE** — trovate da una revisione
     * avversariale il 4/9, prima della consegna.
     *
     * La prima stesura aveva spostato `anatra` fra i nomi a doppio senso, il cui antidoto si cerca
     * in **tutto il testo**: bastava la parola *uovo* in un punto qualsiasi. In un catalogo
     * italiano «all'uovo» è ovunque, e queste sei righe smettevano tutte di essere carne — cioè
     * carne nel piatto di una pescetariana, per riparare tre colazioni.
     *
     * ⚠️ Ora l'uovo smonta l'animale solo se gli sta **attaccato** («uova di anatra»), come il
     * segno vegetale in `senzaImitazioni`. Queste sei sono la prova che la parola in mezzo basta.
     */
    ['Tagliatelle all\'uovo al ragù di anatra'],
    ['Ravioli all\'uovo ripieni di anatra'],
    ['Uova strapazzate con petto d\'anatra affumicato'],
    ['Anatra all\'arancia con uova sode'],
    ['Uova, petto di anatra a fette'],
    ['Petto d\'anatra con uova di quaglia'],
    /** ⚠️ E senza nessuna parola dell'uovo l'anatra non è mai stata in discussione. */
    ['Petto d\'anatra all\'arancia'],
    ['Ragù di anatra'],
  ])('resta carne: %s', (nome) => {
    expect(eCarne(nome)).toBe(true);
  });

  /**
   * ⛔ **I NOMI VERI, PRESI DA `diag:carne-fuori-posto` IN PRODUZIONE L'1/9** — e non sono
   * varianti di quelli qui sopra: sono un difetto diverso, che le prove inventate non avevano
   * preso. `pollo` sta dentro «ci·POLLO·tto», e il cipollotto è in mezzo mezzo catalogo.
   *
   * ⚠️ Peggio: `pollo` è nel livello che **vince sempre**, quindi nemmeno un segno vegetale lo
   * fermava. Una zuppa di miso contava come giornata di carne nella regola flexitariana.
   */
  it.each([
    ['cipollotto fresco'],
    ['Cipollotto'],
    ['Cipollottini'],
    ['Zuppa Miso con Edamame e Funghi Shiitake Grigliati'],
    ['Brodo Miso Edamame Tostati e Alga Wakame'],
    ['Riso Venere Integrale con Edamame e Germogli di Ravanello'],
    ['Brodo Proteico Tofu Silken con Noodle Soba e Miso'],
    ['Uova affogate in salsa di pomodori e lenticchie nere'],
    ['Frittata Fredda di Uova, Asparagi Arrosto e Formaggio di Capra'],
    /** ⚠️ `brasato` su una verdura: l'elenco dei segni vegetali era troppo corto. */
    ['Radicchio Rosso Brasato con Noci Pecan Croccanti e Olio MCT'],
    ['Cavolrapa Brasato al Forno con Crema di Macadamia e Nori Croccante'],
  ])('produzione 1/9 — non è carne: %s', (nome) => {
    expect(eCarne(nome)).toBe(false);
  });

  /** ⚠️ E il confine di parola non deve aver spento niente: il pollo vero resta pollo. */
  it.each([
    ['Pollo alle erbe'],
    ['Pollo al curry con verdure'],
    ['Spezzatino di agnello con carciofi'],
    ['Petto di pollo con cipollotto'],
  ])('produzione 1/9 — resta carne: %s', (nome) => {
    expect(eCarne(nome)).toBe(true);
  });

  /**
   * ⛔ **LA CLASSE DI TRAPPOLA, non i singoli casi** — ed è quella in cui sono caduto due volte
   * nello stesso giorno: una parola che ne CONTIENE un'altra.
   *
   * `pollo` dentro «cipollotto» è costato mezza giornata e una riga sbagliata nella regola
   * flexitariana. Il commento dell'elenco ne aveva già previsti tre — polpa, polenta, pollice — e
   * quelli non scattavano solo perché la radice `pol` non c'era; la parola intera dentro un'altra
   * parola non l'aveva pensata nessuno.
   *
   * ⚠️ Metà di queste prove sono sul **pesce**, che passa da un'altra porta — il vocabolario delle
   * esclusioni, quello che tiene al sicuro chi è allergico. Là il confine di parola c'è da sempre
   * (`chiaveVale` → `inizioParola`), e «insalata decorata» non è mai stata un'orata. Sono qui
   * perché il giorno che qualcuno tocca una delle due porte, questa riga dice cosa non deve
   * rompere.
   */
  it.each([
    ['Polpa di pomodoro'],
    ['Polenta taragna'],
    ['Pollice verde'],
    ['Insalata decorata con semi'],
    ['Zuppa colorata di verdure'],
    ['Torta decorata al cioccolato'],
    ['Riso alla cantonese'],
    ['Sformato di patate'],
  ])('⛔ contiene un termine ma non lo è: %s', (nome) => {
    expect(eCarne(nome)).toBe(false);
    expect(ePesce(nome)).toBe(false);
  });

  /** ⚠️ E al contrario: il pesce vero resta pesce, o la prova sopra non direbbe niente. */
  it.each([['Orata al forno'], ['Sogliola al limone'], ['Merluzzo al vapore'], ['Tonno fresco']])(
    'resta pesce: %s', (nome) => { expect(ePesce(nome)).toBe(true); },
  );

  it('⚠️ e un piatto senza niente di tutto questo non è carne', () => {
    expect(eCarne('Pasta al pomodoro')).toBe(false);
    expect(eCarne('Insalata di farro e zucchine')).toBe(false);
  });
});

/**
 * ⛔ SU UN INGREDIENTE LE PREPARAZIONI NON SERVONO — e il difetto era nel ragionamento.
 *
 * L'1/9, in produzione: «Buddha Bowl di Lenticchie Nere e Germogli su Base di Quinoa» stava per
 * diventare **onnivoro** dentro un blocco di 549 correzioni automatiche, perché fra i suoi
 * ingredienti c'è «Carota **tagliata** sottile».
 *
 * ⚠️ Avevo scritto che gli ingredienti sono affidabili e i nomi no. Non è vero così: un ingrediente
 * è **una cosa**, non un modo di cucinarla. Se un piatto ha davvero della carne, l'ingrediente la
 * nomina — «petto di tacchino», «filetto di salmone» — e ci pensa il primo livello.
 */
describe('eCarneIngrediente', () => {
  it.each([
    ['Carota tagliata sottile'],
    ['sedano tagliato a julienne'],
    ['zucchine arrostite'],
    ['ceci lessati'],
    ['melanzane grigliate'],
  ])('⛔ un ingrediente vegetale con una parola di preparazione non è carne: %s', (i) => {
    expect(eCarneIngrediente(i)).toBe(false);
  });

  it.each([
    ['petto di tacchino'],
    ['prosciutto crudo'],
    ['fesa di tacchino'],
    ['guanciale a cubetti'],
    ['macinato di manzo'],
  ])('⚠️ ma la carne nominata resta carne: %s', (i) => {
    expect(eCarneIngrediente(i)).toBe(true);
  });

  /**
   * ⛔ **L'INGREDIENTE VERO, e sull'INGREDIENTE va provato.** «tuorlo/uova di anatra, quaglia, oca»
   * arriva a `fuoriPostoAColazione` come **elemento dell'elenco ingredienti**, non come nome del
   * piatto: è quella la porta che decide se il piatto esce da colazione.
   *
   * ⚠️ Provarlo solo su `eCarne` non basta e non è teoria: la prova di mutazione del 4/9 ha visto
   * sopravvivere «`senzaUovaDi` tolto da `eCarneIngrediente`», perché `eCarne` lo applicava già
   * prima di chiamarlo. Verde qui, rotto in produzione.
   */
  it.each([
    ['tuorlo/uova di anatra, quaglia, oca'],
    ['uova di quaglia'],
    ['albume di anatra'],
  ])('⛔ le uova di un uccello non sono quell\'uccello: %s', (i) => {
    expect(eCarneIngrediente(i)).toBe(false);
  });

  it.each([
    ['petto di anatra'],
    ['uova, petto di anatra a fette'],
    ['ragù di anatra'],
  ])('⚠️ ma l\'animale nominato resta carne anche accanto alle uova: %s', (i) => {
    expect(eCarneIngrediente(i)).toBe(true);
  });

  /** ⛔ E sui NOMI le preparazioni continuano a valere: sono due domande diverse. */
  it('⚠️ sul NOME del piatto la preparazione conta ancora', () => {
    expect(eCarne('Cotoletta alla milanese')).toBe(true);
    expect(eCarneIngrediente('Cotoletta alla milanese')).toBe(false);
  });
});
