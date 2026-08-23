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
  viewedAt: o.viewedAt ?? null,
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
 * ⛔ **LA PREMESSA STA IN UN ALTRO FILE, QUINDI SI CONTROLLA.**
 *
 * Tutto questo ha senso solo finché `deliverIfEligible` si comporta come misurato: guarda l'ultimo
 * giorno, esce se è oltre oggi, e compone da lì in avanti. Se un giorno qualcuno insegnasse al
 * motore a **riempire i buchi**, la regola della coda diventerebbe una prudenza inutile che rimescola
 * menu per niente — e nessuno collegherebbe le due cose.
 *
 * ⚠️ Questo test non prova il motore (lo provano i suoi): tiene ferma **la ragione**. Se il motore
 * cambia, qui diventa rosso e qualcuno rilegge questo file invece di scoprirlo fra sei mesi.
 */
describe('⚠️ la ragione per cui la coda serve è ancora vera', () => {
  const MOTORE = readFileSync(join(__dirname, '..', 'menu', 'menu.service.ts'), 'utf8');

  it('⚠️ il motore guarda l\'ULTIMO giorno, non i buchi', () => {
    // `findFirst` sui giorni della cliente ordinati per data decrescente: è «l'ultimo in calendario».
    expect(MOTORE).toMatch(/const last = await this\.prisma\.menuDay\.findFirst\(\{[\s\S]{0,120}orderBy: \{ date: 'desc' \}/);
  });

  it('⛔ e se l\'ultimo è oltre oggi non eroga niente: il buffer che rende il buco permanente', () => {
    expect(MOTORE).toMatch(/if \(last\.date\.getTime\(\) > today\.getTime\(\)\) \{\s*\n\s*return \[\];/);
  });

  it('⛔ e i giorni nuovi li appende DOPO l\'ultimo', () => {
    expect(MOTORE).toMatch(/const nextDate = new Date\(last\.date\.getTime\(\) \+ 86_400_000\)/);
  });
});
