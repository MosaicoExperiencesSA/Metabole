/**
 * QUALI MENU SI RIFANNO. I due casi che contano sono le due metà della decisione di Simone: il
 * giorno già aperto che NON si tocca, e il giorno futuro col piatto vietato che si rifà.
 */
import { clientiColpiti, giorniDaRifare, ricetteDelGiorno } from './menu-da-rifare';

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
