/**
 * ⛔ **UN GIORNO CANCELLATO «PER RIFARLO» PUÒ NON TORNARE MAI.**
 *
 * Difetto in produzione **dal 13/8**, trovato in revisione il 23/8 e chiuso qui. Non l'ha segnalato
 * nessuna cliente: è esattamente il tipo di guasto che nessuno segnala, perché chi lo subisce vede
 * «menu in preparazione» e pensa di dover aspettare.
 *
 * ## Il meccanismo, misurato nel motore
 *
 * `MenuService.deliverIfEligible` non cerca i buchi. Prende **l'ultimo** giorno in calendario e:
 * se è oltre oggi esce senza erogare (il buffer anti-cicli-infiniti); altrimenti compone da lì in
 * avanti. Quindi cancellare un giorno che ne lascia uno **più avanti** apre un buco che **nessun
 * giro successivo riempirà**.
 *
 * ## I tre punti che lo facevano
 *
 *  · la **regola di dieta** (`applica-proposta.ts`) — cancellava i giorni che contengono il piatto
 *    vietato, sparsi, su tutte le clienti di quella dieta insieme;
 *  · **«togli lo spuntino»** — cancellava i giorni che contengono lo spuntino, sparsi;
 *  · **«cambia le proteine»** — cancellava i giorni `viewedAt: null`, e un giorno già aperto più
 *    avanti restava lì: buco **più** erogazione ferma finché quella data non passa.
 *
 * ⚠️ E una ragione falsa scritta da me il 23/8: nel percorso per cliente avevo scritto «come già
 * fanno gli altri due percorsi di Vera, le proteine e i pasti». **Non era vero**, e l'ho verificato
 * solo il giorno dopo. Sta qui perché il prossimo che legge quel commento non ci costruisca sopra.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { codaDaRifare, codePerCliente, type GiornoDaValutare } from './menu-da-rifare';

const g = (o: { id: string; date: string; clientId?: string; viewedAt?: Date | null }): GiornoDaValutare => ({
  id: o.id,
  clientId: o.clientId ?? 'c1',
  date: new Date(`${o.date}T00:00:00.000Z`),
  /**
   * ⚠️ **`viewedAt` qui è il nome VECCHIO della domanda** (26/8): l'apparecchio continua a chiamarlo
   * così perché è il nome che questi test raccontano, ma il campo che decide adesso è
   * `apertoDallaClienteIl`, e `apertureTracciate` dice che di questa cliente lo sappiamo. Cambiare
   * solo il dato senza toccare i casi è il modo di tenere ferma la ragione per cui furono scritti.
   */
  apertoDallaClienteIl: o.viewedAt ?? null,
  apertureTracciate: true,
  meals: [],
});

/**
 * ⚠️ «Colpito» arriva come **predicato**, non come secondo elenco: così i colpiti sono per forza un
 * sottoinsieme del calendario passato, e non esiste il modo di sbagliare in cui i due elenchi non
 * c'entrano niente l'uno con l'altro e la coda esce vuota con l'aria di aver funzionato.
 */
const sono = (giorni: readonly GiornoDaValutare[]) => (g: GiornoDaValutare) => giorni.some((x) => x.id === g.id);

describe('⛔ si cancella una CODA, non i giorni sparsi', () => {
  const CALENDARIO = [g({ id: '24', date: '2026-08-24' }), g({ id: '25', date: '2026-08-25' }), g({ id: '26', date: '2026-08-26' })];

  /**
   * ⛔ **IL CASO CHE APRIVA IL BUCO.** Il piatto vietato sta nel 24; il 25 e il 26 non c'entrano
   * niente. Prima si cancellava **solo il 24** — e l'ultimo giorno restava il 26, quindi
   * l'erogazione ripartiva dal 27 e il 24 restava vuoto per sempre.
   */
  it('⛔ colpito il giorno in mezzo: si cancella da lì in avanti, non solo lui', () => {
    const esito = codaDaRifare(CALENDARIO, sono([CALENDARIO[0]]));
    expect(esito.esito).toBe('coda');
    if (esito.esito !== 'coda') return;
    expect(esito.giorni.map((x) => x.id)).toEqual(['24', '25', '26']);
    expect(esito.daQuando.toISOString().slice(0, 10)).toBe('2026-08-24');
  });

  it('⚠️ colpito solo l\'ultimo: la coda è lui e basta, non si rimescola niente di più', () => {
    const esito = codaDaRifare(CALENDARIO, sono([CALENDARIO[2]]));
    expect(esito.esito === 'coda' && esito.giorni.map((x) => x.id)).toEqual(['26']);
  });

  it('⚠️ colpiti in due punti: conta il PRIMO, e la coda parte da lì', () => {
    const esito = codaDaRifare(CALENDARIO, sono([CALENDARIO[2], CALENDARIO[0]]));
    expect(esito.esito === 'coda' && esito.giorni.map((x) => x.id)).toEqual(['24', '25', '26']);
  });

  it('nessun colpito: non si tocca niente', () => {
    expect(codaDaRifare(CALENDARIO, sono([]))).toEqual({ esito: 'niente' });
  });

  /**
   * ⛔ **E I GIORNI PASSATI NON ENTRANO NELLA CODA.** La coda parte dal primo colpito: se in elenco
   * arrivassero anche giornate già consumate, cancellarle vorrebbe dire riscrivere la storia di una
   * cliente — e far ripartire il conteggio dei giorni di piano da un punto sbagliato.
   */
  it('⛔ un giorno PRIMA del colpito resta dov\'è', () => {
    const conPassato = [g({ id: '20', date: '2026-08-20' }), ...CALENDARIO];
    const esito = codaDaRifare(conPassato, sono([CALENDARIO[0]]));
    expect(esito.esito === 'coda' && esito.giorni.map((x) => x.id)).toEqual(['24', '25', '26']);
  });
});

describe('⛔ un giorno GIÀ APERTO dentro la coda ferma tutto, e lo si dice', () => {
  /**
   * ⛔ Il 25 l'ha già aperto — magari ci ha fatto la spesa — quindi non si cancella. Ma se si
   * cancellasse solo il 24, il 25 resterebbe l'ultimo e il buco si riaprirebbe identico. Quindi
   * **non si tocca niente**, e il chiamante lo dice a chi sta guardando.
   */
  it('⛔ aperto DOPO il colpito: `bloccata`, e non si cancella niente', () => {
    const calendario = [
      g({ id: '24', date: '2026-08-24' }),
      g({ id: '25', date: '2026-08-25', viewedAt: new Date('2026-08-23') }),
      g({ id: '26', date: '2026-08-26' }),
    ];
    const esito = codaDaRifare(calendario, sono([calendario[0]]));
    expect(esito.esito).toBe('bloccata');
    expect(esito.esito === 'bloccata' && esito.apertoIl.toISOString().slice(0, 10)).toBe('2026-08-25');
  });

  /** ⚠️ Aperto PRIMA del colpito: non è nella coda, non c'entra, si procede. */
  it('⚠️ un giorno aperto PRIMA del colpito non ferma niente', () => {
    const calendario = [
      g({ id: '23', date: '2026-08-23', viewedAt: new Date('2026-08-23') }),
      g({ id: '24', date: '2026-08-24' }),
      g({ id: '25', date: '2026-08-25' }),
    ];
    const esito = codaDaRifare(calendario, sono([calendario[1]]));
    expect(esito.esito === 'coda' && esito.giorni.map((x) => x.id)).toEqual(['24', '25']);
  });

  /**
   * ⚠️ **La data mostrata è quella del giorno aperto più VICINO**, non del primo che capita
   * nell'array: l'ordine dipende dalla query, e la frase che legge la nutrizionista non può cambiare
   * a seconda di come il database ha restituito le righe.
   */
  it('⚠️ con due giorni aperti si nomina il più vicino, comunque siano ordinati', () => {
    const calendario = [
      g({ id: '27', date: '2026-08-27', viewedAt: new Date('2026-08-23') }),
      g({ id: '24', date: '2026-08-24' }),
      g({ id: '25', date: '2026-08-25', viewedAt: new Date('2026-08-23') }),
    ];
    const esito = codaDaRifare(calendario, sono([calendario[1]]));
    expect(esito.esito === 'bloccata' && esito.apertoIl.toISOString().slice(0, 10)).toBe('2026-08-25');
  });
});

/**
 * ⛔ **IL QUARTO ESITO: «NON LO SO»** — 26/8, voce `visto-non-vuol-dire-aperto`.
 *
 * Un giorno composto prima che la sua app mandasse il segnale non dice «non l'ha aperto»: dice che
 * la domanda non ha risposta. ⛔ Trattarlo come un «già aperto» farebbe raccontare a chi legge un
 * fatto che non c'è («il menu del 25 le è già arrivato in app»); trattarlo come un «mai aperto»
 * cambierebbe un menu che magari ha già in mano. Serve un terzo modo di dirlo, e questo file è dove
 * i tre modi restano distinti.
 */
const nonSaputo = (o: { id: string; date: string; clientId?: string }): GiornoDaValutare => ({
  ...g(o),
  apertureTracciate: false,
});

describe('⛔ «non lo so» non è «no», e non è «già aperto»', () => {
  it('⛔ un giorno non tracciato dentro la coda: `non_lo_so`, e si dice da che giorno', () => {
    const calendario = [
      g({ id: '24', date: '2026-08-24' }),
      nonSaputo({ id: '25', date: '2026-08-25' }),
      g({ id: '26', date: '2026-08-26' }),
    ];
    const esito = codaDaRifare(calendario, sono([calendario[0]]));
    expect(esito.esito).toBe('non_lo_so');
    expect(esito.esito === 'non_lo_so' && esito.dalGiorno.toISOString().slice(0, 10)).toBe('2026-08-25');
  });

  /**
   * ⛔ **IL GIORNO DEL RILASCIO, che è il caso per cui tutto questo esiste**: nessuna riga è
   * tracciata, quindi senza il quarto esito la risposta sarebbe stata `niente` — cioè «nei giorni
   * già preparati non ce n'era», la frase falsa che questa modifica esiste per togliere, identica.
   */
  it('⛔ nessun giorno tracciato: `non_lo_so`, non `niente`', () => {
    const calendario = [nonSaputo({ id: '24', date: '2026-08-24' }), nonSaputo({ id: '25', date: '2026-08-25' })];
    const esito = codaDaRifare(calendario, sono([calendario[0]]));
    expect(esito.esito).toBe('non_lo_so');
  });

  /**
   * ⚠️ **Fra i due «no» vince quello che è un fatto.** «Questo menu ce l'ha già in mano» si può
   * verificare; «non lo so» è l'assenza di un fatto. Chi deve decidere se premere «Rigenera menu»
   * — che rifà anche il giorno già ricevuto — ha bisogno di sapere quale dei due sta leggendo.
   */
  it('⚠️ se in mezzo c\'è anche un giorno aperto davvero, si dice quello', () => {
    const calendario = [
      g({ id: '24', date: '2026-08-24' }),
      nonSaputo({ id: '25', date: '2026-08-25' }),
      g({ id: '26', date: '2026-08-26', viewedAt: new Date('2026-08-24') }),
    ];
    const esito = codaDaRifare(calendario, sono([calendario[0]]));
    expect(esito.esito).toBe('bloccata');
    expect(esito.esito === 'bloccata' && esito.apertoIl.toISOString().slice(0, 10)).toBe('2026-08-26');
  });

  /** ⚠️ Un giorno non tracciato PRIMA del colpito non c'entra: non sta nella coda. */
  it('⚠️ un giorno non tracciato prima del colpito non ferma niente', () => {
    const calendario = [
      nonSaputo({ id: '23', date: '2026-08-23' }),
      g({ id: '24', date: '2026-08-24' }),
      g({ id: '25', date: '2026-08-25' }),
    ];
    const esito = codaDaRifare(calendario, sono([calendario[1]]));
    expect(esito.esito === 'coda' && esito.giorni.map((x) => x.id)).toEqual(['24', '25']);
  });
});

/**
 * ⛔ **I COLPITI CHE RESTANO INDIETRO SI CONTANO, E SI DICONO** — 26/8.
 *
 * Fino al 26/8 non potevano esistere: i colpiti erano già filtrati su «mai aperto», quindi il primo
 * colpito era per forza cancellabile. Adesso i colpiti sono i giorni che **contengono** davvero la
 * cosa decisa — già aperti compresi — e il caso normale è questo: lei ha aperto il menu di oggi che
 * ha il piatto vietato, domani ce l'ha anche. ⚠️ Domani si rifà, oggi no; e se «oggi» sparisse dal
 * conto, chi legge riceverebbe «fatto» con il piatto vietato ancora nel piatto di stasera.
 */
describe('⛔ i colpiti rimasti indietro', () => {
  it('⛔ colpito il giorno già aperto E quello dopo: si rifà da dopo, e il primo si conta', () => {
    const calendario = [
      g({ id: '24', date: '2026-08-24', viewedAt: new Date('2026-08-23') }),
      g({ id: '25', date: '2026-08-25' }),
      g({ id: '26', date: '2026-08-26' }),
    ];
    const esito = codaDaRifare(calendario, sono([calendario[0], calendario[1]]));
    expect(esito.esito).toBe('coda');
    if (esito.esito !== 'coda') return;
    expect(esito.giorni.map((x) => x.id)).toEqual(['25', '26']);
    expect(esito.lasciatiIndietro).toBe(1);
  });

  it('⚠️ senza nessun intoccabile non resta indietro niente', () => {
    const calendario = [g({ id: '24', date: '2026-08-24' }), g({ id: '25', date: '2026-08-25' })];
    const esito = codaDaRifare(calendario, sono([calendario[0]]));
    expect(esito.esito === 'coda' && esito.lasciatiIndietro).toBe(0);
  });
});

describe('⛔ più clienti insieme: la coda è di ognuna, e una bloccata non blocca le altre', () => {
  const CALENDARIO = [
    g({ id: 'a24', clientId: 'anna', date: '2026-08-24' }),
    g({ id: 'a25', clientId: 'anna', date: '2026-08-25' }),
    g({ id: 'b24', clientId: 'bea', date: '2026-08-24' }),
    g({ id: 'b25', clientId: 'bea', date: '2026-08-25' }),
    g({ id: 'b26', clientId: 'bea', date: '2026-08-26' }),
  ];

  /**
   * ⛔ **UNA DATA SOLA PER TUTTE SAREBBE SBAGLIATA**: sarebbe quella della cliente colpita per
   * prima, e alle altre cancellerebbe giornate che nessun divieto tocca. Ad Anna il piatto vietato è
   * nel 24, a Bea nel 26: ad Anna si rifà da 24, a Bea solo il 26.
   */
  it('⛔ ognuna parte dal SUO primo giorno colpito', () => {
    const { daCancellare, bloccate } = codePerCliente(CALENDARIO, sono([CALENDARIO[0], CALENDARIO[4]]));
    expect(daCancellare.map((x) => x.id).sort()).toEqual(['a24', 'a25', 'b26']);
    expect(bloccate).toEqual([]);
  });

  it('⛔ chi ha un giorno già aperto in mezzo resta indietro DA SOLA, e viene contata', () => {
    const calendario = [
      ...CALENDARIO.slice(0, 2),
      g({ id: 'b24', clientId: 'bea', date: '2026-08-24' }),
      g({ id: 'b25', clientId: 'bea', date: '2026-08-25', viewedAt: new Date('2026-08-23') }),
    ];
    const { daCancellare, bloccate } = codePerCliente(calendario, sono([calendario[0], calendario[2]]));
    expect(daCancellare.map((x) => x.id)).toEqual(['a24', 'a25']);
    expect(bloccate).toEqual(['bea']);
  });

  it('⚠️ una cliente non colpita non viene toccata, nemmeno se ha giorni in quelle date', () => {
    const { daCancellare } = codePerCliente(CALENDARIO, sono([CALENDARIO[0]]));
    expect(daCancellare.every((x) => x.clientId === 'anna')).toBe(true);
  });

  /**
   * ⛔ **E CHI NON SAPPIAMO STA IN UN TERZO ELENCO** (26/8). Metterla fra le bloccate direbbe al capo
   * «a questa cliente il menu è già arrivato in app» — un fatto, su una persona di cui non abbiamo
   * nessun fatto. È lo stesso difetto di sempre, un piano più su: una ragione falsa detta con
   * sicurezza.
   */
  it('⛔ chi ha un giorno non tracciato in mezzo finisce fra le «non sapute», non fra le bloccate', () => {
    const calendario = [
      ...CALENDARIO.slice(0, 2),
      g({ id: 'b24', clientId: 'bea', date: '2026-08-24' }),
      nonSaputo({ id: 'b25', clientId: 'bea', date: '2026-08-25' }),
    ];
    const { daCancellare, bloccate, nonSapute } = codePerCliente(calendario, sono([calendario[0], calendario[2]]));
    expect(daCancellare.map((x) => x.id)).toEqual(['a24', 'a25']);
    expect(bloccate).toEqual([]);
    expect(nonSapute).toEqual(['bea']);
  });
});

/**
 * ⛔ **E `codaDaRifare` è di UNA cliente sola: se ne arrivano due, si urla.**
 *
 * La coda si taglia per **data**, non per persona. Con i giorni di due clienti insieme, il primo
 * colpito di Anna fisserebbe la data e nella coda finirebbero i giorni di Bea da lì in poi —
 * cancellati a una che non c'entra niente. È l'errore che costa di più fra quelli possibili qui, e
 * `codePerCliente` si chiama quasi uguale.
 */
describe('⛔ una cliente per volta', () => {
  it('⛔ con giorni di due clienti insieme si ferma, invece di cancellare a quella sbagliata', () => {
    const misti = [g({ id: 'a1', clientId: 'anna', date: '2026-08-24' }), g({ id: 'b1', clientId: 'bea', date: '2026-08-25' })];
    expect(() => codaDaRifare(misti, sono([misti[0]]))).toThrow(/più clienti/);
  });

  /** ⚠️ E `codePerCliente`, che è fatta apposta, li accetta senza fiatare. */
  it('⚠️ `codePerCliente` invece li prende: è il suo mestiere', () => {
    const misti = [g({ id: 'a1', clientId: 'anna', date: '2026-08-24' }), g({ id: 'b1', clientId: 'bea', date: '2026-08-25' })];
    expect(() => codePerCliente(misti, sono([misti[0]]))).not.toThrow();
  });
});

/**
 * ⛔ **LA PREMESSA STA IN UN ALTRO FILE, QUINDI SI CONTROLLA — e il 25/8 è CAMBIATA.**
 *
 * Questo blocco è nato il 24/8 con una promessa scritta a mano: *«se un giorno qualcuno insegnasse
 * al motore a riempire i buchi, questo test diventa rosso e qualcuno rilegge questo file invece di
 * scoprirlo fra sei mesi»*. È successo il giorno dopo, e il test ha fatto esattamente quello.
 *
 * ## Cos'è cambiato
 *
 * Richiesta di Simone, 25/8: *«i buchi si riempiono con le nuove»*. `deliverIfEligible` non appende
 * più dopo l'ultimo giorno: guarda **quante giornate di seguito** ha davanti da oggi, e compone
 * **le date che mancano** (`buchi-nel-calendario.ts`). Un buco quindi si richiude da solo al primo
 * giro utile, senza cancellare né rimescolare niente.
 *
 * ## Cosa vuol dire per la regola della coda
 *
 * ⚠️ **La coda resta**, e il motivo non è più «se no il buco è permanente»: adesso è che cancellare
 * **solo il giorno colpito** e lasciare che il motore lo ricomponga è una cosa che si può fare, ma è
 * una decisione diversa da questa — tocca le tre strade di scrittura di Vera (regola di dieta,
 * spuntini, proteine), e ognuna ha le sue conseguenze su giornate che una cliente può aver già
 * letto. ⛔ **Restringerla è il passo che resta**, ed è misurato: con i buchi che si riempiono, la
 * coda cancella più giorni di quanti servano — giorni che erano a posto. Finché non si decide, si
 * sbaglia dalla parte prudente: la coda tocca **solo i giorni non ancora aperti**, quindi nessuna
 * cliente perde un menu che aveva in mano.
 *
 * ⚠️ Questi test non provano il motore (lo provano i suoi): tengono ferma **la ragione**. Se il
 * motore torna ad appendere e basta, qui diventa rosso.
 */
describe('⚠️ la ragione per cui la coda serve, riscritta il 25/8', () => {
  const MOTORE = readFileSync(join(__dirname, '..', 'menu', 'menu.service.ts'), 'utf8');

  it('⛔ il motore adesso RIEMPIE i buchi: compone le date che mancano', () => {
    expect(MOTORE).toMatch(/const daComporre = dateDaComporre\(\{/);
    expect(MOTORE).toMatch(/for \(const istante of daComporre\)/);
  });

  it('⛔ e il buffer conta le giornate DI SEGUITO, non guarda l\'ultima data', () => {
    expect(MOTORE).toMatch(/const corsa = corsaDiGiornate\(inCalendario, daOggi, sospesoOggi\)/);
    expect(MOTORE).toMatch(/corsa\.quante >= GIORNATE_DAVANTI_CHE_BASTANO/);
    // ⛔ E la vecchia uscita — «l'ultimo è oltre oggi, non erogo niente» — non c'è più.
    expect(MOTORE).not.toContain('if (last.date.getTime() > today.getTime()) {');
  });

  /**
   * ⚠️ La coda continua a toccare **solo i giorni non ancora aperti**: è la parte della regola che
   * non dipende dal motore, e quella che protegge una cliente che ha già fatto la spesa.
   */
  it('⚠️ e la coda resta prudente: un giorno già aperto la ferma', () => {
    const conAperto = [
      g({ id: '24', date: '2026-08-24' }),
      g({ id: '25', date: '2026-08-25', viewedAt: new Date('2026-08-25T08:00:00.000Z') }),
    ];
    expect(codaDaRifare(conAperto, sono([conAperto[0]])).esito).toBe('bloccata');
  });
});

/**
 * ⛔ **LE GIORNATE SCRITTE A MANO ESCONO DALLA CODA** — 3/9, chiudendo un buco dichiarato il giorno
 * prima insieme al menu scritto a mano.
 *
 * La coda è «tutto quello che sta dopo», e dentro ci finiva anche la giornata che la nutrizionista
 * aveva appena composto pasto per pasto: dettava «niente pesce» a Vera e se la cancellava da sola.
 */
describe('la coda non porta via il lavoro scritto a mano', () => {
  const g = (id: string, giorno: string, meals: unknown = []) => ({
    id, clientId: 'c1', date: new Date(`2026-09-${giorno}T00:00:00Z`),
    apertoDallaClienteIl: null, apertureTracciate: true, meals,
  });
  const aMano = [{ slot: 'lunch', recipeId: 'p1', name: 'x', kcal: 700, scrittaAMano: { origine: 'nutrizionista', da: 'Lucia', il: '2026-09-03' } }];

  it('⛔ la giornata a mano resta fuori dai giorni da cancellare', () => {
    const cal = [g('a', '10'), g('b', '11', aMano), g('c', '12')];
    const esito = codaDaRifare(cal, (x) => x.id === 'a');
    expect(esito.esito).toBe('coda');
    if (esito.esito !== 'coda') return;
    expect(esito.giorni.map((x) => x.id)).toEqual(['a', 'c']);
  });

  /**
   * ⚠️ **Non blocca, si salta** — al contrario di un giorno che la cliente ha già aperto. Quello
   * ferma la coda perché la ricomposizione partirebbe da un punto che lei ha in mano; questo resta
   * suo e basta, e il resto si può rifare.
   */
  it('⚠️ e non ferma la coda: quello che viene dopo si rifà lo stesso', () => {
    const cal = [g('a', '10'), g('b', '11', aMano), g('c', '12')];
    const esito = codaDaRifare(cal, (x) => x.id === 'a');
    if (esito.esito !== 'coda') throw new Error('doveva essere una coda');
    expect(esito.giorni.map((x) => x.id)).toContain('c');
  });

  /** ⚠️ E quante ne ha risparmiate si **dice**: una passata che ne salta tre in silenzio non si distingue da una che non ne ha trovate. */
  it('⚠️ dice quante ne ha tenute', () => {
    const cal = [g('a', '10'), g('b', '11', aMano), g('c', '12', aMano)];
    const esito = codaDaRifare(cal, (x) => x.id === 'a');
    if (esito.esito !== 'coda') throw new Error('doveva essere una coda');
    expect(esito.tenuteAMano).toBe(2);
  });

  /** ⚠️ La controprova: senza giornate a mano la coda è tutta, come prima. */
  it('⚠️ senza giornate a mano la coda resta intera', () => {
    const esito = codaDaRifare([g('a', '10'), g('b', '11'), g('c', '12')], (x) => x.id === 'a');
    if (esito.esito !== 'coda') throw new Error('doveva essere una coda');
    expect(esito.giorni.map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expect(esito.tenuteAMano).toBe(0);
  });
});
