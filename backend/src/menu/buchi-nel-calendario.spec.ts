/**
 * ⛔ **IL CONTO DEI BUCHI, provato — perché «nessun buco» è la risposta che chiude la domanda.**
 *
 * Serve a cercare all'indietro chi è già rimasto con una giornata vuota per il difetto delle
 * cancellazioni sparse (dal 13/8 al 24/8, voce `giorno-cancellato-che-non-torna`). Se questo conto
 * sbagliasse, lo script di diagnosi direbbe «tutto a posto» — e quella frase, non essendo un errore,
 * non la verificherebbe più nessuno.
 */
import { buchiFra, senzaIlMenuDiOggi, dateDaComporre, giornateDiSeguito } from './buchi-nel-calendario';

const G = 86_400_000;
const giorno = (n: number) => Date.UTC(2026, 7, n); // agosto 2026, mezzanotte UTC
const come = (ms: number[]) => ms.map((t) => new Date(t).toISOString().slice(0, 10));

describe('⛔ i buchi fra il primo e l\'ultimo giorno', () => {
  it('⛔ una giornata mancante in mezzo è un buco', () => {
    expect(come(buchiFra([giorno(24), giorno(26)]))).toEqual(['2026-08-25']);
  });

  it('⛔ due giornate di fila mancanti sono due buchi', () => {
    expect(come(buchiFra([giorno(24), giorno(27)]))).toEqual(['2026-08-25', '2026-08-26']);
  });

  it('giorni consecutivi: nessun buco', () => {
    expect(buchiFra([giorno(24), giorno(25), giorno(26)])).toEqual([]);
  });

  /** ⚠️ L'ordine con cui arrivano dal database non conta: si guarda il primo e l'ultimo, non l'array. */
  it('⚠️ l\'ordine non conta', () => {
    expect(come(buchiFra([giorno(26), giorno(24)]))).toEqual(['2026-08-25']);
  });

  /**
   * ⛔ **Zero o un giorno solo: nessun buco, e nessun ciclo infinito.** `Math.min` di un array vuoto
   * vale `Infinity`, e il ciclo da `Infinity` a `-Infinity` non è un bug sottile — è uno script che
   * non torna più e un database che resta appeso.
   */
  it('⛔ con zero o un giorno non c\'è un «fra»', () => {
    expect(buchiFra([])).toEqual([]);
    expect(buchiFra([giorno(24)])).toEqual([]);
  });

  /** ⚠️ Un giorno duplicato non inventa un buco: è una `Set`, non un conteggio. */
  it('⚠️ due righe per lo stesso giorno non spostano niente', () => {
    expect(buchiFra([giorno(24), giorno(24), giorno(25)])).toEqual([]);
  });

  /** ⚠️ Il buco non può essere il primo o l'ultimo giorno: lì non c'è niente «in mezzo». */
  it('⚠️ gli estremi non sono mai buchi', () => {
    const b = buchiFra([giorno(24), giorno(26), giorno(28)]);
    expect(come(b)).toEqual(['2026-08-25', '2026-08-27']);
  });
});

describe('⛔ una sospensione non è un buco', () => {
  /**
   * ⛔ Durante una vacanza l'erogazione si ferma **di proposito**: quei giorni mancano perché così
   * deve essere. Contarli riempirebbe l'elenco di righe innocenti — e a quel punto le righe vere non
   * le guarderebbe più nessuno.
   */
  it('⛔ i giorni coperti dalla sospensione non compaiono', () => {
    const sospeso = (t: number) => t >= giorno(25) && t <= giorno(27);
    expect(buchiFra([giorno(24), giorno(28)], sospeso)).toEqual([]);
  });

  it('⚠️ ma un buco FUORI dalla sospensione si vede lo stesso', () => {
    const sospeso = (t: number) => t >= giorno(25) && t <= giorno(26);
    expect(come(buchiFra([giorno(24), giorno(29)], sospeso))).toEqual(['2026-08-27', '2026-08-28']);
  });
});

/**
 * ⛔ **IL CASO VERO, quello che si va a cercare.** La regola di dieta cancellava i giorni col piatto
 * vietato, sparsi: il 24 col branzino spariva, il 25 e il 26 restavano. Il motore riparte dal 26 e
 * appende dal 27 — quindi il 24 resta vuoto per sempre.
 */
describe('⛔ la firma del difetto: un giorno cancellato in mezzo', () => {
  it('⛔ si riconosce, e si sa qual è', () => {
    const dopoLaCancellazione = [giorno(23), giorno(25), giorno(26)];
    expect(come(buchiFra(dopoLaCancellazione))).toEqual(['2026-08-24']);
  });

  /**
   * ⚠️ E la variante peggiore — l'ultimo giorno oltre oggi — non la distingue questo conto: la
   * distingue lo script, che sa che giorno è. Qui si tiene fermo solo che il buco lo trova comunque,
   * anche quando il calendario va avanti di una settimana.
   */
  it('⚠️ lo trova anche con una coda lunga davanti', () => {
    const lungo = [giorno(23), ...[26, 27, 28, 29, 30].map(giorno)];
    expect(come(buchiFra(lungo))).toEqual(['2026-08-24', '2026-08-25']);
  });
});

/**
 * ⚠️ **E il passaggio dell'ora legale non inventa buchi.** Le date dei menu sono salvate a mezzanotte
 * **UTC**, quindi il passo di 24 ore è sempre esatto: se un giorno qualcuno le salvasse in locale, la
 * notte del cambio ora sarebbe di 23 o 25 ore e questo conto vedrebbe un buco che non c'è — su tutte
 * le clienti, la stessa notte. Questo test è lì per quel giorno.
 */
describe('⚠️ la notte in cui le lancette si spostano', () => {
  it('⚠️ 24, 25 e 26 ottobre 2026 restano consecutivi', () => {
    const ott = [24, 25, 26].map((n) => Date.UTC(2026, 9, n));
    expect(buchiFra(ott)).toEqual([]);
    expect(ott[1] - ott[0]).toBe(G);
  });
});

/**
 * ⛔ **CHI OGGI NON HA NIENTE IN MANO — e chi invece sta solo aspettando che parta il piano.**
 *
 * È la riga che decide chi finisce in cima all'elenco con la bandiera più grossa. Sbagliarla in un
 * verso vuol dire non vedere la cliente ferma; nell'altro, gridare su ogni cliente nuova per due
 * giorni — e allora l'elenco non lo apre più nessuno.
 */
describe('⛔ senza il menu di oggi', () => {
  const OGGI = giorno(24);
  const partito = { inizioPiano: giorno(20) };

  it('⛔ oggi manca e il calendario va avanti: è ferma, e si vede', () => {
    expect(senzaIlMenuDiOggi([giorno(25), giorno(26)], OGGI, partito)).toBe(true);
  });

  it('oggi c\'è: non c\'è niente da segnalare', () => {
    expect(senzaIlMenuDiOggi([giorno(24), giorno(25)], OGGI, partito)).toBe(false);
  });

  /**
   * ⚠️ **Se l'ultimo giorno è oggi o prima, il motore riparte da solo.** Non è un guasto, è un ciclo
   * da erogare: segnalarlo vorrebbe dire mettere in elenco mezza azienda ogni mattina.
   */
  it('⚠️ calendario finito: il motore riparte da solo, non è un buco', () => {
    expect(senzaIlMenuDiOggi([giorno(22), giorno(23)], OGGI, partito)).toBe(false);
  });

  /**
   * ⛔ **IL FALSO ALLARME CHE HA FATTO NASCERE QUESTA FUNZIONE.** Il menu si sblocca due giorni prima
   * della partenza: per due giorni una cliente ha solo giorni futuri e nessun menu per oggi, ed è
   * giusto così. Dentro la finestra «da oggi in avanti» questo caso e il buco vero sono identici —
   * la differenza la fa solo la data di inizio.
   */
  it('⛔ piano che parte fra due giorni: NON è un buco, è un\'attesa', () => {
    expect(senzaIlMenuDiOggi([giorno(26), giorno(27)], OGGI, { inizioPiano: giorno(26) })).toBe(false);
  });

  it('⚠️ e senza la data di inizio non si indovina: si tace', () => {
    expect(senzaIlMenuDiOggi([giorno(25), giorno(26)], OGGI, {})).toBe(false);
    expect(senzaIlMenuDiOggi([giorno(25), giorno(26)], OGGI, { inizioPiano: null })).toBe(false);
  });

  it('⚠️ in sospensione oggi non deve avere niente: normale', () => {
    const sospeso = (t: number) => t === OGGI;
    expect(senzaIlMenuDiOggi([giorno(25), giorno(26)], OGGI, { ...partito, sospeso })).toBe(false);
  });

  it('nessun giorno in calendario: niente da dire', () => {
    expect(senzaIlMenuDiOggi([], OGGI, partito)).toBe(false);
  });
});

/**
 * ⛔ **I BUCHI SI RIEMPIONO CON LE NUOVE** — richiesta di Simone, 25/8.
 *
 * Fino a oggi l'erogazione appendeva **dopo l'ultimo** giorno e il buffer guardava la **data più
 * alta**: un buco in mezzo non si richiudeva mai, e se dopo il buco restava un giorno oltre oggi
 * l'erogazione si fermava del tutto finché quella data non passava. Una riga in fondo al calendario
 * valeva come «ha il menu».
 */
describe('⛔ le date da comporre: prima i buchi, poi il seguito', () => {
  const G = 86_400_000;
  const g = (iso: string) => new Date(`${iso}T00:00:00.000Z`).getTime();
  const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

  it('⛔ con un buco in mezzo, le nuove giornate ci vanno dentro', () => {
    const fuori = dateDaComporre({
      presenti: [g('2026-08-25'), g('2026-08-28')],
      da: g('2026-08-25'),
      quante: 2,
    });
    expect(fuori.map(iso)).toEqual(['2026-08-26', '2026-08-27']);
  });

  it('⛔ e quando i buchi finiscono si riprende ad accodare', () => {
    const fuori = dateDaComporre({
      presenti: [g('2026-08-25'), g('2026-08-27')],
      da: g('2026-08-25'),
      quante: 3,
    });
    expect(fuori.map(iso)).toEqual(['2026-08-26', '2026-08-28', '2026-08-29']);
  });

  /** ⚠️ Senza buchi si comporta esattamente come prima: accoda e basta. */
  it('⚠️ senza buchi accoda dopo l’ultima, come sempre', () => {
    const fuori = dateDaComporre({
      presenti: [g('2026-08-25'), g('2026-08-26')],
      da: g('2026-08-25'),
      quante: 2,
    });
    expect(fuori.map(iso)).toEqual(['2026-08-27', '2026-08-28']);
  });

  /** ⛔ I giorni in sospensione non sono buchi: riempirli regalerebbe giornate di piano. */
  it('⛔ i giorni sospesi si saltano, non si riempiono', () => {
    const sospeso = (t: number) => t >= g('2026-08-26') && t <= g('2026-08-27');
    const fuori = dateDaComporre({
      presenti: [g('2026-08-25')],
      da: g('2026-08-25'),
      quante: 2,
      sospeso,
    });
    expect(fuori.map(iso)).toEqual(['2026-08-28', '2026-08-29']);
  });

  it('⚠️ e oltre la fine del piano non si compone niente', () => {
    const fuori = dateDaComporre({
      presenti: [],
      da: g('2026-08-25'),
      quante: 5,
      finePiano: g('2026-08-26'),
    });
    expect(fuori.map(iso)).toEqual(['2026-08-25', '2026-08-26']);
  });

  it('⚠️ e con un numero di giornate assurdo non si compone niente, invece di un ciclo infinito', () => {
    expect(dateDaComporre({ presenti: [], da: g('2026-08-25'), quante: 0 })).toEqual([]);
    expect(dateDaComporre({ presenti: [], da: g('2026-08-25'), quante: Number.NaN })).toEqual([]);
  });
});

/**
 * ⛔ **QUANTE GIORNATE HA DAVANTI DI SEGUITO** — la domanda che il buffer faceva male.
 */
describe('⛔ giornateDiSeguito', () => {
  const g = (iso: string) => new Date(`${iso}T00:00:00.000Z`).getTime();

  it('⛔ si ferma al primo buco: due giorni sparsi non sono due giornate davanti', () => {
    expect(giornateDiSeguito([g('2026-08-25'), g('2026-09-15')], g('2026-08-25'))).toBe(1);
  });

  it('⚠️ e di seguito le conta tutte', () => {
    expect(giornateDiSeguito([g('2026-08-25'), g('2026-08-26')], g('2026-08-25'))).toBe(2);
  });

  /**
   * ⛔ **Chi ha solo domani ha ZERO giornate davanti**, perché oggi non ha niente. È il caso che la
   * vecchia regola leggeva come «ha già il menu» e su cui si fermava.
   */
  it('⛔ chi ha solo domani non ha nessuna giornata davanti', () => {
    expect(giornateDiSeguito([g('2026-08-26')], g('2026-08-25'))).toBe(0);
  });

  /** ⚠️ Un giorno sospeso non è una giornata, ma nemmeno un buco: si scavalca. */
  it('⚠️ i giorni sospesi si scavalcano senza contarli e senza fermare il conto', () => {
    const sospeso = (t: number) => t === g('2026-08-25');
    expect(giornateDiSeguito([g('2026-08-26'), g('2026-08-27')], g('2026-08-25'), sospeso)).toBe(2);
  });

  it('⚠️ e un calendario vuoto risponde zero', () => {
    expect(giornateDiSeguito([], g('2026-08-25'))).toBe(0);
  });

  /**
   * ⛔ **UNA SOSPENSIONE CHE NON FINISCE NON DEVE DIVENTARE UN CICLO CHE NON FINISCE** — trovato
   * dalla revisione avversariale del 25/8, misurando: la rete contava le **giornate trovate**, e sui
   * giorni scavalcati quel contatore non cresce mai. Il ciclo passava i duecentomila giri.
   */
  it('⛔ con tutti i giorni in sospensione non gira all\'infinito: torna zero e si ferma', () => {
    const inizio = Date.now();
    expect(giornateDiSeguito([], giorno(25), () => true)).toBe(0);
    // Se la rete non c'è, questo non arriva mai qui: il tetto è dieci anni di giri, non l'eternità.
    expect(Date.now() - inizio).toBeLessThan(2000);
  });

  /**
   * ⚠️ E il caso di mezzo: una vacanza lunghissima con una giornata dopo. Si scavalca la vacanza e
   * la giornata si conta — ma il conto si ferma comunque al tetto, non prova all'infinito.
   */
  it('scavalca una sospensione lunga e conta quello che c\'è dopo', () => {
    const rientro = giorno(25) + 40 * G;
    const inVacanza = (t: number) => t >= giorno(25) && t < rientro;
    expect(giornateDiSeguito([rientro], giorno(25), inVacanza)).toBe(1);
  });
});
