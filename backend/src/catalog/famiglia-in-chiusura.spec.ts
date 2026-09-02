import { famigliaDaChiudereDi, famigliaDaChiudereIn, famigliaInChiusura } from './appartenenza-panieri';

describe('⛔ famigliaDaChiudereDi: quale famiglia in chiusura porta questo nome', () => {
  it('riconosce il nome nudo della famiglia', () => {
    expect(famigliaDaChiudereDi('Mediterranea senza glutine')).toBe('Mediterranea senza glutine');
    expect(famigliaDaChiudereDi('Pescetariana')).toBe('Pescetariana');
  });

  /** ⚠️ In banca dati le varianti si chiamano «Famiglia — regime N pasti». */
  it('⚠️ e lo riconosce dentro il nome di una variante', () => {
    expect(famigliaDaChiudereDi('Mediterranea senza glutine — vegana 5 pasti')).toBe('Mediterranea senza glutine');
    expect(famigliaDaChiudereDi('Vegana 3 pasti')).toBe('Vegana');
  });

  /**
   * ⛔ **Il prefisso, non `includes`.** «Mediterranea» dentro «Mediterranea senza glutine»
   * farebbe contare la stessa variante su due famiglie.
   */
  it('⛔ «Mediterranea» non è in chiusura, e non lo diventa per colpa delle sue sorelle', () => {
    expect(famigliaDaChiudereDi('Mediterranea')).toBeNull();
    expect(famigliaDaChiudereDi('Mediterranea — onnivora 5 pasti')).toBeNull();
  });

  /**
   * ⛔ **IL PIÙ LUNGO VINCE — e questa prova esiste solo perché l'elenco è un parametro.**
   *
   * Nell'elenco di oggi nessuna famiglia è prefisso di un'altra, quindi con la costante letta di
   * dentro la regola non era misurabile: il 2/9 la mutazione che invertiva l'ordinamento è
   * sopravvissuta a prove che sembravano piene. Qui il caso pericoloso si costruisce.
   */
  it('⛔ fra due prefissi che combaciano vince il più specifico', () => {
    const elenco = ['Mediterranea', 'Mediterranea senza glutine'];
    expect(famigliaDaChiudereIn('Mediterranea senza glutine — vegana 5 pasti', elenco))
      .toBe('Mediterranea senza glutine');
    /** ⚠️ E il corto continua a rispondere per il nome che è davvero suo. */
    expect(famigliaDaChiudereIn('Mediterranea — onnivora 5 pasti', elenco)).toBe('Mediterranea');
  });

  /**
   * ⛔ **PREFISSO, NON `includes`** — l'altra regola che senza il parametro non si poteva provare.
   * «Pescetariana» dentro «Dieta Pescetariana estiva» non è quella famiglia: è un nome che la
   * nomina. Con `includes` una dieta viva verrebbe marcata come in chiusura e smetterebbe di
   * essere assegnata a chiunque.
   */
  it('⛔ una famiglia NOMINATA in mezzo a un altro nome non conta', () => {
    const elenco = ['Pescetariana'];
    expect(famigliaDaChiudereIn('Dieta Pescetariana estiva', elenco)).toBeNull();
    expect(famigliaDaChiudereIn('La Pescetariana', elenco)).toBeNull();
    /** ⚠️ Mentre in testa sì, con e senza il trattino delle varianti. */
    expect(famigliaDaChiudereIn('Pescetariana', elenco)).toBe('Pescetariana');
    expect(famigliaDaChiudereIn('Pescetariana — 5 pasti', elenco)).toBe('Pescetariana');
    expect(famigliaDaChiudereIn('Pescetariana—5 pasti', elenco)).toBe('Pescetariana');
  });

  it('⚠️ una famiglia che resta risponde null', () => {
    expect(famigliaDaChiudereDi('Flessibile')).toBeNull();
    expect(famigliaDaChiudereDi('DASH (anti-ipertensiva)')).toBeNull();
  });

  /**
   * ⚠️ **Un nome vuoto risponde `null` perché non combacia con niente**, non perché ci sia una
   * riga che lo intercetta: quella riga c'era, il 2/9 la mutazione che la toglieva è sopravvissuta,
   * ed era codice morto. Una guardia che non guarda niente è peggio di nessuna guardia, perché
   * qualcuno un giorno crede che stia proteggendo qualcosa.
   */
  it('⚠️ e un nome vuoto o storto non esplode', () => {
    expect(famigliaDaChiudereDi('')).toBeNull();
    expect(famigliaDaChiudereDi('   ')).toBeNull();
    expect(famigliaDaChiudereDi(undefined as unknown as string)).toBeNull();
  });
});

describe('famigliaInChiusura', () => {
  it('è la domanda secca', () => {
    expect(famigliaInChiusura('Vegana')).toBe(true);
    expect(famigliaInChiusura('Flessibile')).toBe(false);
  });
});
