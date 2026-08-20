import { abbina, abbinaPerRicetta, paroleChe, paroleDi } from './abbinamento-alimenti';

/** Una tabella finta con i nomi veri che il primo giro in produzione ha mostrato. */
const TABELLA = [
  { name: 'olio extravergine di oliva', synonyms: ['olio evo'], state: null },
  // ⚠️ Gli spinaci in tabella sono a CRUDO: è ciò che rende «freschi» innocuo su di loro.
  { name: 'spinaci', synonyms: [], state: 'crudo' },
  { name: 'noci', synonyms: [], state: null },
  { name: 'riso', synonyms: [], state: null },
  { name: 'riso integrale', synonyms: [], state: null },
  { name: 'latte intero', synonyms: [], state: null },
  { name: 'latte scremato', synonyms: [], state: null },
];
type Riga = { name: string; synonyms: string[]; state?: string | null };
const nomiDi = (r: Riga) => [r.name, ...r.synonyms];
const statoDi = (r: Riga) => r.state ?? null;
const cerca = (s: string) => abbina(s, TABELLA, nomiDi, statoDi);

describe('le parole di un nome', () => {
  it('toglie accenti e punteggiatura', () => {
    expect(paroleDi("olio extravergine d'oliva")).toEqual(['olio', 'extravergine', 'd', 'oliva']);
  });

  it('«paroleChe» tiene solo quelle che distinguono', () => {
    expect(paroleChe("olio extravergine d'oliva")).toEqual(['olio', 'extravergine', 'oliva']);
    expect(paroleChe('riso integrale')).toEqual(['riso', 'integrale']);
  });
});

describe('abbina — regola 1: la ricetta è più specifica della tabella', () => {
  /** ⚠️ 1350 ricette scrivono «spinaci freschi», e in tabella c'è «spinaci». */
  it('⚠️ un aggettivo in più non cambia l\'alimento', () => {
    expect(cerca('spinaci freschi')?.riga.name).toBe('spinaci');
    expect(cerca('spinaci freschi')?.regola).toBe('ricetta_piu_specifica');
    expect(cerca('noci sgusciate')?.riga.name).toBe('noci');
  });

  /** ⚠️ Fra due righe che vanno bene, vince quella che DISTINGUE di più: la più specifica. */
  it('⚠️ «riso integrale bio» prende «riso integrale», non «riso»', () => {
    expect(cerca('riso integrale bio')?.riga.name).toBe('riso integrale');
  });
});

describe('abbina — le paroline non contano', () => {
  /** ⚠️ Il caso più grosso: l'olio scritto in tre modi. Due dei tre si chiudono qui. */
  it('⚠️ «d oliva» e «oliva» finiscono sulla riga di «di oliva»', () => {
    for (const scritto of ['olio extravergine di oliva', 'olio extravergine d oliva', 'olio extravergine oliva']) {
      expect(cerca(scritto)?.riga.name).toBe('olio extravergine di oliva');
    }
  });

  /**
   * ⚠️ IL CASO CHE TIENE STRETTA LA REGOLA. «Riso» **non** deve diventare «riso integrale»:
   * «integrale» non è una parolina, è la parola che distingue due alimenti — e scambiarli è
   * esattamente il difetto da cui è nata tutta questa storia (voce 228).
   */
  it('⚠️ «riso» resta «riso»: «integrale» non è una parolina', () => {
    expect(cerca('riso')?.riga.name).toBe('riso');
  });

  /**
   * ⚠️ IL CASO CHE HA BOCCIATO UNA REGOLA PRIMA CHE LA SCRIVESSI — e vale la pena tenerlo scritto.
   *
   * Avevo proposto una terza regola: «la ricetta è più corta, ma quello che manca sono solo
   * paroline». Non può esistere: se al nome della ricetta manca una parola della tabella, quella
   * parola **distingue**. «Olio extravergine» senza «oliva» potrebbe essere di girasole.
   *
   * ⛔ Questi casi si chiudono con **un sinonimo aggiunto a mano** — una riga, decisa da una
   * persona — non con una regola che indovina. In produzione sono 2771 ricette: una riga sola.
   */
  it('⚠️ «olio extravergine» da solo NON si abbina: «oliva» è una parola che distingue', () => {
    expect(cerca('olio extravergine')).toBeNull();
  });
});

/**
 * ⚠️ I CASI VERI CHE IL PRIMO GIRO IN PRODUZIONE HA MOSTRATO (19/8) — e che la prima versione della
 * regola abbinava tutti, sbagliando.
 *
 * La regola diceva «tutte le parole della riga compaiono nel nome dell'ingrediente», e su una riga
 * che si chiama «zucca» — o che ha un sinonimo corto come «olio» — ci cascava dentro qualunque cosa.
 * Le parole in più non sono sempre aggettivi: «semi di», «olio di» fanno **un altro alimento**.
 */
describe('abbina — le parole in più che cambiano l\'alimento', () => {
  const tabella = [
    { name: 'zucca', synonyms: [], state: 'crudo' },
    { name: 'olio extravergine di oliva', synonyms: ['olio'], state: null },
    { name: 'lenticchie', synonyms: [], state: 'bollito' },
    { name: 'nocciole', synonyms: [], state: null },
    { name: 'spinaci', synonyms: [], state: 'crudo' },
  ];
  const c = (s: string) => abbina(s, tabella, nomiDi, statoDi);

  /** ⚠️ 531 ricette. Semi di zucca ~550 kcal/100 g, zucca 26: **venti volte**. */
  it('⚠️ «semi di zucca» NON è «zucca»', () => {
    expect(c('semi di zucca')).toBeNull();
  });

  /** ⚠️ 400 e 282 ricette: due oli diversi finivano sull'olio d'oliva per via del sinonimo «olio». */
  it('⚠️ «olio di cocco» e «olio di sesamo» NON sono l\'olio d\'oliva', () => {
    expect(c('olio di cocco')).toBeNull();
    expect(c('olio di sesamo')).toBeNull();
  });

  /**
   * ⚠️ E le parole di **stato** non sono qualificatori: «secche» e «tostate» cambiano i numeri, e la
   * loro casa è `scegliPerRicetta` con la convenzione del crudo. In tabella le lenticchie sono
   * bollite: chiamare «lenticchie» le lenticchie secche sbaglia di tre volte.
   */
  it('⚠️ «lenticchie rosse secche» e «nocciole tostate» non si abbinano', () => {
    expect(c('lenticchie rosse secche')).toBeNull();
    expect(c('nocciole tostate')).toBeNull();
  });

  /** Ma i qualificatori veri continuano a funzionare: è il caso per cui la regola esiste. */
  it('«spinaci freschi» resta abbinato quando la riga è a crudo', () => {
    expect(abbina('spinaci freschi', [{ name: 'spinaci', synonyms: [], state: 'crudo' }], nomiDi, statoDi)?.riga.name).toBe('spinaci');
  });
});

describe('abbina — quando non si sceglie', () => {
  /**
   * ⚠️ DUE RIGHE CHE VANNO BENE UGUALE = NON LO SO. Indovinare fra «latte intero» e «latte
   * scremato» perché la ricetta dice «latte» vuol dire scrivere calorie decise a caso, e nessuno se
   * ne accorgerebbe perché il numero è plausibile.
   */
  it('⚠️ «latte» non diventa né intero né scremato', () => {
    expect(cerca('latte')).toBeNull();
  });

  /**
   * ⚠️ IL CASO CHE COPRE DAVVERO IL CONTROLLO — trovato con una mutazione, il 19/8: togliendo la
   * riga «due righe pari = non lo so» non falliva **nessun** test, perché «latte» non si abbinava a
   * niente per un'altra ragione (nessuna delle due righe è contenuta in «latte»). Serviva un caso in
   * cui due righe vanno bene **uguale**.
   *
   * Qui «olio di oliva» e «olio di girasole» sono tutte e due dentro «olio oliva girasole», con lo
   * stesso peso: sceglierne una vorrebbe dire scrivere le calorie di un olio al posto di un altro.
   */
  it('⚠️ due righe che vanno bene uguale: non si sceglie', () => {
    const due = [{ name: 'olio di oliva', synonyms: [] }, { name: 'olio di girasole', synonyms: [] }];
    expect(abbina('olio oliva girasole', due, nomiDi)).toBeNull();
  });

  /**
   * ⚠️ «Extravergine» non è un qualificatore innocuo: distingue un olio da un altro. Quindi non si
   * abbina né a «olio» né a «olio di oliva» — e va bene così, perché è la stessa prudenza che
   * impedisce a «olio di cocco» di diventare olio d'oliva.
   */
  it('⚠️ una parola in più che NON è un qualificatore non abbina, nemmeno alla riga più specifica', () => {
    const due = [{ name: 'olio', synonyms: [] }, { name: 'olio di oliva', synonyms: [] }];
    expect(abbina('olio di oliva extravergine', due, nomiDi)).toBeNull();
  });

  /** A parità di regola vince chi distingue di più: «mandorle pelate» ha due righe possibili. */
  it('a parità di regola vince la riga che distingue di più', () => {
    const due = [{ name: 'mandorle', synonyms: [] }, { name: 'mandorle dolci', synonyms: [] }];
    expect(abbina('mandorle dolci pelate', due, nomiDi)?.riga.name).toBe('mandorle dolci');
  });

  it('quello che non c\'entra niente non si abbina', () => {
    expect(cerca('grano saraceno')).toBeNull();
    expect(cerca('')).toBeNull();
    expect(cerca('di')).toBeNull();
  });

  it('i sinonimi contano come nomi', () => {
    expect(cerca('olio evo')?.riga.name).toBe('olio extravergine di oliva');
  });
});

/**
 * ⚠️ LA PAROLA DI STATO IN PIÙ: SI ACCETTA SOLO SE COMBACIA CON LA RIGA — e questo blocco esiste
 * perché **una mutazione ha mostrato che non era coperto** (19/8 sera).
 *
 * La revisione avversariale aveva tolto «fresco» dai qualificatori innocui e messo al suo posto la
 * regola «è uno stato e combacia con la riga». Poi la mutazione — far accettare *qualunque* parola
 * di stato, senza guardare la riga — ha lasciato **tutti i 786 test verdi**: la correzione c'era, e
 * niente la teneva ferma. Il caso che mancava è questo, e sono due facce della stessa moneta:
 *
 *     «spinaci freschi» → «spinaci»   la riga è a CRUDO, «freschi» vuol dire crudo: combacia
 *     «pasta fresca»    → niente      la riga è SECCA (~350 kcal), la fresca ne fa ~290
 *
 * ⚠️ Senza il secondo caso, il primo da solo passa anche con la regola sbagliata: entrambe le
 * versioni accettano «freschi» sugli spinaci. È **il rifiuto** che distingue le due regole.
 */
describe('abbina — una parola di stato in più vale solo se combacia con lo stato della riga', () => {
  const tabella = [
    { name: 'spinaci', synonyms: [], state: 'crudo' },
    { name: 'pasta', synonyms: [], state: 'secco' },
    { name: 'ceci', synonyms: [], state: 'bollito' },
    { name: 'pane', synonyms: [], state: null },
  ];
  const c = (s: string) => abbina(s, tabella, nomiDi, statoDi);

  it('⚠️ «pasta fresca» NON è la pasta secca della tabella: 290 contro 350 kcal', () => {
    expect(c('pasta fresca')).toBeNull();
  });

  it('«spinaci freschi» sì: la riga è a crudo e «freschi» vuol dire crudo', () => {
    expect(c('spinaci freschi')?.riga.name).toBe('spinaci');
  });

  /** ⚠️ L'altro verso: la riga è bollita, e la ricetta parla dei ceci secchi. Sono tre volte. */
  it('⚠️ «ceci secchi» NON sono i «ceci» bolliti della tabella', () => {
    expect(c('ceci secchi')).toBeNull();
  });

  /** E quando combacia davvero passa anche qui: «ceci bolliti» è la riga dei ceci. */
  it('«ceci bolliti» è la riga bollita', () => {
    expect(c('ceci bolliti')?.riga.name).toBe('ceci');
  });

  /**
   * ⚠️ TERZO STATO: **non lo so**. Se la riga non dichiara lo stato non c'è niente con cui far
   * combaciare la parola, e si rifiuta — non si tira a indovinare che «pane fresco» sia «pane».
   */
  it('⚠️ se la riga non dichiara lo stato, la parola di stato non basta', () => {
    expect(c('pane fresco')).toBeNull();
  });

  /** ⚠️ E lo stesso se il chiamante non passa affatto lo stato: non si sa, quindi non si abbina. */
  it('⚠️ senza «statoDi» nessuna parola di stato viene accettata', () => {
    expect(abbina('spinaci freschi', tabella, nomiDi)).toBeNull();
  });

  /** I qualificatori innocui invece non c'entrano con lo stato e continuano a passare. */
  it('i qualificatori innocui passano anche su una riga secca', () => {
    expect(c('pasta bio')?.riga.name).toBe('pasta');
  });
});

/**
 * ⚠️ **UNA PORTA SOLA** — e questo blocco nasce da un difetto trovato il 20/8 in produzione.
 *
 * `abbina` prende `nomiDi` e `statoDi` come parametri, ed è giusto: è una funzione pura. ⛔ Ma i
 * chiamanti possono passarli **diversi**, e l'hanno fatto: `cercaPerIngrediente` passava lo stato,
 * `diag:crudo-cotto` **no**. Dalla sera del 19/8 una parola di stato («freschi») si accetta solo se
 * combacia con lo stato della riga: senza `statoDi` lo stato è sempre vuoto, quindi non combacia
 * mai, e la diagnostica rispondeva «spinaci freschi NON si abbina» su un nome che in produzione si
 * abbina — 1350 ricette.
 *
 * ⚠️ E quella diagnostica è il foglio da cui la nutrizionista decide **quali righe aggiungere a
 * mano**: la stava mandando a scrivere righe che non servono. La stessa specie di errore di un test
 * double che si comporta diversamente dall'originale — solo che qui la copia sbagliata non faceva
 * passare un test: faceva fare a una persona un lavoro inutile.
 */
describe('abbinaPerRicetta — la porta che usano tutti', () => {
  const righe = [
    { name: 'spinaci', synonyms: [], state: 'crudo' },
    { name: 'pasta', synonyms: [], state: 'secco' },
  ];

  it('⚠️ passa lo STATO della riga: «spinaci freschi» si abbina agli spinaci a crudo', () => {
    expect(abbinaPerRicetta('spinaci freschi', righe)?.riga.name).toBe('spinaci');
  });

  /** ⚠️ E continua a rifiutare quello che deve: la porta unica non allarga la regola. */
  it('⚠️ «pasta fresca» resta fuori: la riga è secca', () => {
    expect(abbinaPerRicetta('pasta fresca', righe)).toBeNull();
  });

  /** ⚠️ Con lo stato VUOTO non si abbina: è il caso che la diagnostica vedeva sempre. */
  it('⚠️ se la riga non dichiara lo stato, «freschi» non basta', () => {
    expect(abbinaPerRicetta('spinaci freschi', [{ name: 'spinaci', synonyms: [], state: null }])).toBeNull();
  });

  it('i sinonimi passano come nomi, senza che il chiamante li componga', () => {
    expect(abbinaPerRicetta('evo', [{ name: 'olio', synonyms: ['evo'], state: null }])?.riga.name).toBe('olio');
  });
});
