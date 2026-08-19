/**
 * QUALI MENU SI RIFANNO. I due casi che contano sono le due metà della decisione di Simone: il
 * giorno già aperto che NON si tocca, e il giorno futuro col piatto vietato che si rifà.
 */
import { clientiColpiti, giorniDaRifare, ricetteDelGiorno, daQuandoSiPuoRifare, siPuoRifare } from './menu-da-rifare';

const OGGI = new Date('2026-08-13T09:00:00.000Z');
const g = (o: Partial<{ id: string; clientId: string; date: string; viewedAt: Date | null; meals: unknown }>) => ({
  id: o.id ?? 'g1',
  clientId: o.clientId ?? 'c1',
  date: new Date(o.date ?? '2026-08-15'),
  viewedAt: o.viewedAt ?? null,
  meals: o.meals ?? [{ slot: 'pranzo', recipeId: 'r-tonno' }],
});

describe('i giorni da rifare', () => {
  const vietate = new Set(['r-tonno']);

  it('il giorno futuro col piatto vietato si rifà', () => {
    expect(giorniDaRifare([g({})], vietate, OGGI).map((x) => x.id)).toEqual(['g1']);
  });

  it('⚠️ un giorno GIÀ APERTO non si tocca, anche se ha il piatto vietato', () => {
    // Rifare un menu che una cliente ha già letto, magari dopo la spesa, è la cosa che fa scrivere
    // «l'app è impazzita».
    expect(giorniDaRifare([g({ viewedAt: new Date('2026-08-12') })], vietate, OGGI)).toEqual([]);
  });

  it('un giorno passato non si tocca', () => {
    expect(giorniDaRifare([g({ date: '2026-08-10' })], vietate, OGGI)).toEqual([]);
  });

  it('oggi si tocca, se non l\'ha ancora aperto', () => {
    expect(giorniDaRifare([g({ date: '2026-08-13' })], vietate, OGGI)).toHaveLength(1);
  });

  it('⚠️ un giorno SENZA il piatto vietato resta com\'è', () => {
    // Buttare via tutti i giorni futuri sarebbe più semplice e molto peggio: si rimescolerebbero
    // menu che non c'entrano niente, per una regola su un solo alimento.
    expect(giorniDaRifare([g({ meals: [{ slot: 'cena', recipeId: 'r-pollo' }] })], vietate, OGGI)).toEqual([]);
  });

  it('senza divieti non si rifà niente', () => {
    expect(giorniDaRifare([g({})], new Set(), OGGI)).toEqual([]);
  });

  it('uno snapshot storto non fa saltare niente', () => {
    expect(ricetteDelGiorno(null)).toEqual([]);
    expect(ricetteDelGiorno([{ slot: 'x' }, 'boh'])).toEqual([]);
  });
});

describe('quante persone tocca', () => {
  it('conta le PERSONE, non i giorni: è quello il numero da confrontare col tetto', () => {
    const giorni = [g({ id: 'a', clientId: 'c1' }), g({ id: 'b', clientId: 'c1' }), g({ id: 'c', clientId: 'c2' })];
    expect(clientiColpiti(giorni)).toEqual(['c1', 'c2']);
  });
});

/**
 * ⚠️ «SI PUÒ ANCORA RIFARE?» — UNA RISPOSTA SOLA (19/8, decisione di Simone: «meglio rifare la
 * giornata di oggi»).
 *
 * La stessa domanda era scritta in tre posti e in uno dei tre il confine partiva da domani. Adesso
 * `siPuoRifare` è l'unica risposta, e questi test sono il posto dove il confine è fissato.
 */
describe('siPuoRifare', () => {
  const oggi = new Date('2026-08-13T12:00:00Z');
  const g = (date: string, visto = false) => ({ date: new Date(date), viewedAt: visto ? new Date(date) : null });

  it('⚠️ la giornata di OGGI si può rifare, anche a mezzogiorno passato', () => {
    expect(siPuoRifare(g('2026-08-13'), oggi)).toBe(true);
  });

  it('domani sì, ieri no', () => {
    expect(siPuoRifare(g('2026-08-14'), oggi)).toBe(true);
    expect(siPuoRifare(g('2026-08-12'), oggi)).toBe(false);
  });

  /** ⚠️ Il calendario non decide da solo: un giorno già aperto resta suo, magari ci ha fatto la spesa. */
  it('⚠️ un giorno già aperto non si rifà mai, nemmeno se è domani', () => {
    expect(siPuoRifare(g('2026-08-14', true), oggi)).toBe(false);
    expect(siPuoRifare(g('2026-08-13', true), oggi)).toBe(false);
  });

  /** ⚠️ Il confine è la MEZZANOTTE di oggi, non «adesso»: `date` è una data senza ora. */
  it('⚠️ il confine è mezzanotte, non l\'istante corrente', () => {
    expect(daQuandoSiPuoRifare(oggi).toISOString()).toBe('2026-08-13T00:00:00.000Z');
  });
});
