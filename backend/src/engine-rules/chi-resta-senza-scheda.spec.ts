import {
  CAMPI, MINIMO, campiVuoti, chiRestaSenzaScheda, raccogliStili, schedeDelloStile,
  type Scheda, type StilePubblicato,
} from './scheda-stile';

/**
 * ⛔ **IL PEZZO CHE MANCAVA ALLA VOCE: non «quali stili genera il catalogo», ma «quali stili una
 * cliente può DAVVERO ricevere».**
 *
 * La prova che c'era dal 3/9 confronta le schede dell'app con i **preset** del backend, e la voce
 * di lavoro diceva già perché non basta: i preset sono il seme, e gli stili veri arrivano dal
 * database (`GET /onboarding/diet-products`). Una dieta scritta a mano in banca dati, con uno stile
 * che nei preset non c'è, esce alla cliente senza scheda e nessuna prova se ne accorge — che è,
 * parola per parola, l'incidente del 6/8.
 *
 * ⚠️ Questo modulo è il giudizio che `npm run diag:schede-stile` chiama sui dati veri. Qui si prova
 * sui dati finti, che è l'unico posto dove si può decidere cosa vuol dire «senza scheda».
 */

/** ⚠️ I campi si costruiscono **dalle soglie**, non da numeri scritti a mano: alzarle non deve
 *  rendere finti-vuoti dei campi che questa prova considera pieni. */
const piena = (): Scheda => ({
  campi: Object.fromEntries(CAMPI.map((c) => [c, c === 'titolo' ? 'Mediterranea' : 'x'.repeat(MINIMO[c] + 40)])),
});

const stile = (style: string, clienti = 0, diete = [style]): StilePubblicato => ({ style, clienti, diete });

describe('campiVuoti', () => {
  it('⚠️ una scheda che non c\'è ha tutti i campi vuoti, non zero', () => {
    expect(campiVuoti(undefined)).toHaveLength(5);
  });

  it('✅ una scheda scritta davvero non ha campi vuoti', () => {
    expect(campiVuoti(piena())).toEqual([]);
  });

  /**
   * ⛔ **La soglia è per campo, ed è tutta la differenza.** «Mediterranea» è un titolo giusto e
   * lungo dodici caratteri; `cosaDiceLaRicerca` in dodici caratteri è un campo non scritto. Una
   * soglia unica avrebbe dovuto scendere al livello del titolo — cioè non vedere più niente.
   */
  it('⛔ «cosa dice la ricerca» in dodici caratteri è un campo non scritto, il titolo no', () => {
    const s = piena();
    s.campi.cosaDiceLaRicerca = 'Fa dimagrire';
    expect(campiVuoti(s)).toEqual(['cosaDiceLaRicerca']);
    expect(campiVuoti({ campi: { ...piena().campi, titolo: 'DASH' } })).toEqual([]);
  });
});

/**
 * ⛔ **LE SOGLIE SONO IL GIUDIZIO, e nella prima stesura non le fissava nessuna prova.** Una
 * revisione ha provato ad abbassarle tutte a 1 e le nove prove restavano verdi: i casi usati erano
 * o pieni (80 caratteri) o vuoti (''), cioè lontanissimi dal confine, e il confine è l'unico posto
 * dove una soglia decide qualcosa. Qui si prova **il carattere prima e il carattere dopo**.
 */
describe('⛔ le soglie, al confine', () => {
  const conCampo = (campo: string, quanti: number): Scheda => ({
    campi: { ...piena().campi, [campo]: 'x'.repeat(quanti) },
  });

  it.each(CAMPI)('⛔ «%s»: un carattere sotto la soglia è vuoto, sulla soglia è scritto', (campo) => {
    expect(campiVuoti(conCampo(campo, MINIMO[campo] - 1))).toEqual([campo]);
    expect(campiVuoti(conCampo(campo, MINIMO[campo]))).toEqual([]);
  });

  /**
   * ⛔ **E I VALORI SI SCRIVONO A MANO, perché la prova qui sopra da sola non vale niente.**
   * Costruisce i casi **dalla soglia**: abbassando `inPratica` a 1, il caso «sotto» diventa zero
   * caratteri e il caso «sopra» uno, e passa lo stesso. È una prova che si adegua a qualunque
   * numero — l'ho scoperto provando a romperla, ed è lo stesso difetto del test che leggeva i
   * propri commenti. Questi sono numeri fissi, e l'unico modo di farli passare è tenere le soglie.
   */
  it('⛔ e nessuna soglia può essere abbassata fino a non vedere più niente', () => {
    expect(MINIMO.cose).toBeGreaterThanOrEqual(100);
    expect(MINIMO.inPratica).toBeGreaterThanOrEqual(100);
    expect(MINIMO.cosaDiceLaRicerca).toBeGreaterThanOrEqual(100);
    expect(MINIMO.attenzione).toBeGreaterThanOrEqual(80);
    /** ⚠️ Il titolo sta a 4 perché «DASH» è un titolo giusto: sotto, non distingue più niente. */
    expect(MINIMO.titolo).toBe(4);
  });

  /**
   * ⚠️ **E le soglie stanno sotto i testi veri**, che è l'altra metà: una soglia sopra il più corto
   * dei campi scritti darebbe del non scritto a una scheda buona, e la prima cosa che si fa davanti
   * a un falso allarme è smettere di guardare il tabulato. I minimi veri misurati il 5/9 sulle dieci
   * schede: cose 187, inPratica 118, cosaDiceLaRicerca 227, attenzione 144.
   */
  it('⚠️ e nessuna soglia arriva al più corto dei testi veri', () => {
    expect(MINIMO.cose).toBeLessThan(187);
    expect(MINIMO.inPratica).toBeLessThan(118);
    expect(MINIMO.cosaDiceLaRicerca).toBeLessThan(227);
    expect(MINIMO.attenzione).toBeLessThan(144);
    /** ⛔ Ma nemmeno così in basso da non vedere più niente: un campo abbozzato deve cadere. */
    expect(MINIMO.cose).toBeGreaterThan(60);
    expect(MINIMO.cosaDiceLaRicerca).toBeGreaterThan(60);
  });
});

describe('chiRestaSenzaScheda', () => {
  const schede = new Map([['mediterranean', piena()], ['keto', piena()]]);

  it('✅ tutto a posto: nessuno resta senza, e nessuna cliente è toccata', () => {
    const out = chiRestaSenzaScheda([stile('mediterranean', 40), stile('keto', 12)], schede);
    expect(out.senzaScheda).toEqual([]);
    expect(out.aMeta).toEqual([]);
    expect(out.piene).toHaveLength(2);
    expect(out.clientiToccate).toBe(0);
  });

  /**
   * ⛔ **IL CASO DEL 6/8, e il motivo per cui i preset non bastavano.** Una dieta pubblicata con uno
   * stile che nessun preset genera: in registrazione il pallino «?» accanto al nome **non compare
   * proprio**, e con lui spariscono «cosa dice la ricerca», «da tenere presente» e le fonti — la
   * parte che dice alla cliente perché dovrebbe fidarsi.
   */
  it('⛔ uno stile pubblicato che la scheda non ce l\'ha esce come «senza scheda», col nome della dieta', () => {
    const out = chiRestaSenzaScheda([stile('vegan', 7, ['Vegana equilibrata'])], schede);
    expect(out.senzaScheda).toEqual([expect.objectContaining({ style: 'vegan', diete: ['Vegana equilibrata'] })]);
    expect(out.clientiToccate).toBe(7);
  });

  /**
   * ⛔ **«A metà» è un esito suo, e non è pignoleria.** Senza scheda il pallino sparisce; con una
   * scheda a metà il pallino c'è, la cliente lo apre e trova un popup svuotato — che è peggio,
   * perché sembra una risposta. Il rimedio è lo stesso, l'urgenza no, e chi legge deve distinguerli.
   */
  it('⛔ una scheda con «cosa dice la ricerca» vuota è «a metà», e dice quale campo manca', () => {
    const mezza = piena();
    mezza.campi.cosaDiceLaRicerca = '';
    const out = chiRestaSenzaScheda([stile('dash', 3)], new Map([['dash', mezza]]));
    expect(out.senzaScheda).toEqual([]);
    expect(out.aMeta).toEqual([expect.objectContaining({ style: 'dash', mancano: ['cosaDiceLaRicerca'] })]);
    expect(out.clientiToccate).toBe(3);
  });

  it('⚠️ le clienti toccate si sommano fra i due casi: è il numero che dice quanto pesa', () => {
    const mezza = piena();
    mezza.campi.attenzione = '';
    const out = chiRestaSenzaScheda(
      [stile('vegan', 7), stile('dash', 3), stile('keto', 100)],
      new Map([['dash', mezza], ['keto', piena()]]),
    );
    expect(out.clientiToccate).toBe(10);
    expect(out.piene.map((p) => p.style)).toEqual(['keto']);
  });

  /**
   * ⚠️ **Una scheda scritta per uno stile che nessuno pubblica non è un difetto**, è lavoro fermo —
   * o una dieta ritirata. Si dice a parte: metterla fra i problemi insegnerebbe a non leggerli.
   */
  it('⚠️ una scheda senza nessuna dieta che la usi si dice a parte, non fra i problemi', () => {
    const out = chiRestaSenzaScheda([stile('keto', 5)], schede);
    expect(out.schedeSenzaStile).toEqual(['mediterranean']);
    expect(out.senzaScheda).toEqual([]);
  });

  /**
   * ⛔ **CINQUE CAMPI VUOTI SU CINQUE NON È UNA SCHEDA A METÀ: È IL LETTORE CHE NON LA LEGGE.**
   * Una scheda riscritta con i backtick, con le virgolette doppie o tutta su una riga esce così. Se
   * finisse fra i «a metà», si manderebbe la nutrizionista a riscrivere un testo clinico già
   * scritto — e il tabulato avrebbe fatto perdere una giornata invece di farne guadagnare una.
   */
  it('⛔ una scheda con tutti i campi illeggibili si dice a parte, non fra quelle da riscrivere', () => {
    const illeggibile: Scheda = { campi: {} };
    const out = chiRestaSenzaScheda([stile('keto', 9)], new Map([['keto', illeggibile]]));
    expect(out.aMeta).toEqual([]);
    expect(out.nonLeggibili.map((s) => s.style)).toEqual(['keto']);
    /** ⚠️ Le clienti si contano lo stesso: il popup che vedono è svuotato comunque. */
    expect(out.clientiToccate).toBe(9);
  });

  it('⚠️ lo stesso stile due volte non raddoppia le clienti toccate', () => {
    const out = chiRestaSenzaScheda([stile('vegan', 7), stile('vegan', 7)], schede);
    expect(out.senzaScheda).toHaveLength(1);
    expect(out.clientiToccate).toBe(7);
  });

  /**
   * ⛔ **A elenco vuoto non si dice «va tutto bene».** Se la query non trova niente — la banca dati
   * irraggiungibile, un filtro sbagliato — un tabulato che stampa «zero stili scoperti» è
   * indistinguibile da un catalogo sano. Chi chiama deve poterlo vedere: qui esce zero **piene**,
   * ed è il tabulato a doverlo dire.
   */
  it('⛔ nessuno stile pubblicato: zero problemi ma anche zero schede in uso, e si vede', () => {
    const out = chiRestaSenzaScheda([], schede);
    expect(out.piene).toEqual([]);
    expect(out.schedeSenzaStile).toEqual(['keto', 'mediterranean']);
    expect(out.clientiToccate).toBe(0);
  });
});


/**
 * ⛔ **L'ELENCO SU CUI SI DECIDE — il pezzo che nella prima stesura nasceva dentro lo script, dove
 * nessuna prova lo guardava.** Il giudizio riceve questo elenco già fatto: è qui che i numeri
 * possono mentire, ed è qui che la revisione del 5/9 ha trovato tre modi in cui mentivano.
 */
describe('raccogliStili', () => {
  const dieta = (style: string | null, name = 'Dieta', clientName: string | null = null) => ({ style, name, clientName });

  it('✅ raggruppa per stile, tiene il nome commerciale e attacca le clienti', () => {
    const out = raccogliStili(
      [dieta('keto', 'Keto (non terapeutica)', 'Chetogenica'), dieta('keto', 'Keto light')],
      new Map([['keto', 12]]),
    );
    expect(out.pubblicati).toEqual([{ style: 'keto', diete: ['Chetogenica', 'Keto light'], clienti: 12 }]);
  });

  /**
   * ⛔ **IL CASO CHE LA PRIMA STESURA PERDEVA.** Il backoffice assegna le diete guardando solo
   * `status: 'approved'`: `clientVisible` chiude l'app, non la scheda. Una famiglia ritirata
   * dall'app su cui lo staff continua a spostare clienti spariva da ogni riga del tabulato — e
   * peggio, la sua scheda finiva fra quelle «che nessuno usa», cioè segnalata come lavoro fermo
   * mentre ci stanno sopra delle persone.
   */
  it('⛔ uno stile con clienti sopra e nessuna dieta visibile entra lo stesso, e lo dice', () => {
    const out = raccogliStili([dieta('keto')], new Map([['keto', 3], ['detox', 8]]));
    const detox = out.pubblicati.find((p) => p.style === 'detox');
    expect(detox).toBeDefined();
    expect(detox?.clienti).toBe(8);
    expect(String(detox?.diete[0])).toMatch(/nessuna dieta visibile/);
    expect(out.clientiFuoriCatalogo).toBe(8);
  });

  /**
   * ⛔ **Una dieta pubblicata senza codice stile si conta.** Il DTO valida `@IsString()` senza
   * `@MinLength`, quindi la stringa vuota entra in banca dati: `DIET_INFO['']` non esiste e il «?»
   * non compare — il difetto del 6/8 esatto. Saltarla in silenzio la nascondeva.
   */
  it('⛔ le diete senza codice stile si contano invece di sparire', () => {
    const out = raccogliStili([dieta(''), dieta(null), dieta('  '), dieta('keto')], new Map());
    expect(out.senzaCodice).toBe(3);
    expect(out.pubblicati.map((p) => p.style)).toEqual(['keto']);
  });

  it('⚠️ in cima quelli con più clienti: è l\'ordine in cui si decide cosa scrivere per primo', () => {
    const out = raccogliStili(
      [dieta('a'), dieta('b'), dieta('c')],
      new Map([['a', 2], ['b', 30], ['c', 9]]),
    );
    expect(out.pubblicati.map((p) => p.style)).toEqual(['b', 'c', 'a']);
  });

  it('⚠️ senza nessuna dieta e senza nessun profilo non inventa righe', () => {
    expect(raccogliStili([], new Map())).toEqual({ pubblicati: [], senzaCodice: 0, clientiFuoriCatalogo: 0 });
  });
});

/**
 * ⛔ **IL LETTORE, SU SORGENTI COSTRUITI A MANO.** Le prove che lo usano lo puntano sul file vero, e
 * il file vero oggi è scritto in un modo solo: due mutazioni del lettore — togliere il troncamento
 * alla fine della dichiarazione, allargare l'indentazione delle chiavi — lasciavano la mappa
 * identica e tutte le prove verdi. Sono le due cautele che il lettore ha **per il giorno in cui il
 * file cambia**, e si provano solo su un file che cambia davvero.
 */
describe('schedeDelloStile, sui casi che il file vero oggi non ha', () => {
  const scheda = (nome: string) => `  ${nome}: {
    titolo: 'Titolo',
    cose: '${'x'.repeat(120)}',
    inPratica: '${'x'.repeat(120)}',
    cosaDiceLaRicerca: '${'x'.repeat(120)}',
    attenzione: '${'x'.repeat(100)}',
  },`;

  /**
   * ⛔ `DIET_INFO_FONTI` **dentro** la dichiarazione: senza il troncamento a `\n};`, il lettore
   * proseguirebbe oltre la fine e prenderebbe come schede le chiavi di quello che viene dopo.
   */
  it('⛔ si ferma alla fine della dichiarazione, e non prende quello che viene dopo', () => {
    const sorgente = `export const DIET_INFO: Record<string, X> = {
${scheda('keto')}
};

const ALTRO = {
  non_una_scheda: {
    titolo: 'no',
  },
};`;
    expect([...schedeDelloStile(sorgente).keys()]).toEqual(['keto']);
  });

  /**
   * ⛔ **L'indentazione della chiave dice a che livello sta.** Con `{2,}` invece di `{2}` il lettore
   * prenderebbe come scheda anche un oggetto annidato dentro una scheda — `fonti: { … }`, o
   * qualunque struttura che qualcuno aggiunga domani — e il tabulato inventerebbe uno stile.
   */
  it('⛔ un oggetto annidato dentro una scheda non è una scheda', () => {
    const sorgente = `export const DIET_INFO: Record<string, X> = {
  keto: {
    titolo: 'Titolo',
    extra: {
      dentro: 'roba',
    },
  },
};`;
    expect([...schedeDelloStile(sorgente).keys()]).toEqual(['keto']);
  });

  it('⚠️ le chiavi fra apici e con cifre o trattini si leggono: `keto2`, `summer-holiday`', () => {
    const sorgente = `export const DIET_INFO: Record<string, X> = {
${scheda('keto2')}
${scheda("'summer-holiday'")}
};`;
    expect([...schedeDelloStile(sorgente).keys()].sort()).toEqual(['keto2', 'summer-holiday']);
  });

  /**
   * ⛔ **`DIET_INFO_FONTI` dichiarata PRIMA non deve rubare l'aggancio**: `indexOf('export const
   * DIET_INFO')` è un match per prefisso, e la prenderebbe.
   */
  it('⛔ non si aggancia a DIET_INFO_FONTI se qualcuno la sposta sopra', () => {
    const sorgente = `export const DIET_INFO_FONTI = ['a', 'b'];

export const DIET_INFO: Record<string, X> = {
${scheda('keto')}
};`;
    expect([...schedeDelloStile(sorgente).keys()]).toEqual(['keto']);
  });
});
