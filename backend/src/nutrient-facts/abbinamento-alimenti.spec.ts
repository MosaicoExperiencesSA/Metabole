import { abbina, paroleChe, paroleDi } from './abbinamento-alimenti';

/** Una tabella finta con i nomi veri che il primo giro in produzione ha mostrato. */
const TABELLA = [
  { name: 'olio extravergine di oliva', synonyms: ['olio evo'] },
  { name: 'spinaci', synonyms: [] },
  { name: 'noci', synonyms: [] },
  { name: 'riso', synonyms: [] },
  { name: 'riso integrale', synonyms: [] },
  { name: 'latte intero', synonyms: [] },
  { name: 'latte scremato', synonyms: [] },
];
const nomiDi = (r: { name: string; synonyms: string[] }) => [r.name, ...r.synonyms];
const cerca = (s: string) => abbina(s, TABELLA, nomiDi);

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

  /** Ma se una delle due distingue di più, quella vince: non è un pareggio. */
  it('a parità di regola vince chi distingue di più', () => {
    const due = [{ name: 'olio', synonyms: [] }, { name: 'olio di oliva', synonyms: [] }];
    expect(abbina('olio di oliva extravergine', due, nomiDi)?.riga.name).toBe('olio di oliva');
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
