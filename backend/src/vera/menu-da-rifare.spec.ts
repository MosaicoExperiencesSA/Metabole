/**
 * QUALI MENU SI RIFANNO. I due casi che contano sono le due metà della decisione di Simone: il
 * giorno già aperto che NON si tocca, e il giorno futuro col piatto vietato che si rifà.
 */
import { clientiColpiti, daOggiInPoi, giorniColpitiDaiVietati, ricetteDelGiorno, daQuandoSiPuoRifare, siPuoCancellare } from './menu-da-rifare';

const OGGI = new Date('2026-08-13T09:00:00.000Z');
/**
 * ⚠️ **Il giorno di prova ha `apertureTracciate: true`, e va detto** (26/8): dal 26/8 «aperto» lo
 * dichiara l'app della cliente, e su un giorno di cui **non lo sappiamo** la risposta è sempre «non
 * si tocca». Questi test misurano l'altra metà della regola — cosa succede quando lo sappiamo — e
 * la premessa si scrive qui una volta invece di ripeterla in ogni caso. Il caso «non lo sappiamo»
 * ha i suoi test in fondo.
 */
const g = (o: Partial<{ id: string; clientId: string; date: string; aperto: Date | null; tracciate: boolean; meals: unknown }>) => ({
  id: o.id ?? 'g1',
  clientId: o.clientId ?? 'c1',
  date: new Date(o.date ?? '2026-08-15'),
  apertoDallaClienteIl: o.aperto ?? null,
  apertureTracciate: o.tracciate ?? true,
  meals: o.meals ?? [{ slot: 'pranzo', recipeId: 'r-tonno' }],
});

describe('i giorni colpiti da un divieto', () => {
  const vietate = new Set(['r-tonno']);

  it('il giorno futuro col piatto vietato è colpito', () => {
    expect(giorniColpitiDaiVietati([g({})], vietate, OGGI).map((x: { id: string }) => x.id)).toEqual(['g1']);
  });

  /**
   * ⛔ **UN GIORNO GIÀ APERTO È COLPITO LO STESSO** (26/8). Fino a ieri qui si rispondeva `[]`, e
   * quel `[]` diventava, in bocca a Vera, «nei giorni già preparati non ce n'era» — mentre il piatto
   * c'era eccome. Le domande sono due: «è colpito?» (questa) e «lo posso cancellare?»
   * (`codaDaRifare`, che sa dire anche «non lo so»). Confonderle è come è nato il difetto.
   */
  it('⛔ un giorno GIÀ APERTO col piatto vietato è colpito: cancellarlo o no lo decide la coda', () => {
    expect(giorniColpitiDaiVietati([g({ aperto: new Date('2026-08-12') })], vietate, OGGI).map((x: { id: string }) => x.id)).toEqual(['g1']);
  });

  /** ⚠️ Idem per un giorno di cui non sappiamo: sparire dai colpiti vorrebbe dire farlo raccontare come «non c'era». */
  it('⛔ e anche un giorno di cui NON SAPPIAMO è colpito', () => {
    expect(giorniColpitiDaiVietati([g({ tracciate: false })], vietate, OGGI).map((x: { id: string }) => x.id)).toEqual(['g1']);
  });

  it('un giorno passato non è colpito', () => {
    expect(giorniColpitiDaiVietati([g({ date: '2026-08-10' })], vietate, OGGI)).toEqual([]);
  });

  it('oggi è colpito', () => {
    expect(giorniColpitiDaiVietati([g({ date: '2026-08-13' })], vietate, OGGI)).toHaveLength(1);
  });

  it('⚠️ un giorno SENZA il piatto vietato resta com\'è', () => {
    // Buttare via tutti i giorni futuri sarebbe più semplice e molto peggio: si rimescolerebbero
    // menu che non c'entrano niente, per una regola su un solo alimento.
    expect(giorniColpitiDaiVietati([g({ meals: [{ slot: 'cena', recipeId: 'r-pollo' }] })], vietate, OGGI)).toEqual([]);
  });

  it('senza divieti non si rifà niente', () => {
    expect(giorniColpitiDaiVietati([g({})], new Set(), OGGI)).toEqual([]);
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
 * le risposte sono due funzioni e basta — `daOggiInPoi` per il calendario, `siPuoCancellare` per le
 * aperture — e questi test sono il posto dove i due confini sono fissati.
 */
describe('daOggiInPoi e siPuoCancellare', () => {
  const oggi = new Date('2026-08-13T12:00:00Z');
  const g = (date: string, aperto = false) => ({
    date: new Date(date),
    apertoDallaClienteIl: aperto ? new Date(date) : null,
    apertureTracciate: true,
  });

  it('⚠️ la giornata di OGGI si può rifare, anche a mezzogiorno passato', () => {
    expect(daOggiInPoi(g('2026-08-13'), oggi)).toBe(true);
  });

  it('domani sì, ieri no', () => {
    expect(daOggiInPoi(g('2026-08-14'), oggi)).toBe(true);
    expect(daOggiInPoi(g('2026-08-12'), oggi)).toBe(false);
  });

  /** ⚠️ Il calendario non decide da solo: un giorno già aperto resta suo, magari ci ha fatto la spesa. */
  it('⚠️ un giorno già aperto non si cancella mai, nemmeno se è domani', () => {
    expect(siPuoCancellare(g('2026-08-14', true))).toBe(false);
    expect(siPuoCancellare(g('2026-08-13', true))).toBe(false);
  });

  /** ⚠️ Il confine è la MEZZANOTTE di oggi, non «adesso»: `date` è una data senza ora. */
  it('⚠️ il confine è mezzanotte, non l\'istante corrente', () => {
    expect(daQuandoSiPuoRifare(oggi).toISOString()).toBe('2026-08-13T00:00:00.000Z');
  });

  /**
   * ⛔ **«NON RISULTA APERTO» NON È «NON L'HA APERTO»** — 26/8, ed è la metà della regola che
   * protegge le persone.
   *
   * Il segnale lo manda l'app quando la cliente apre **quel** giorno. Finché il suo telefono non
   * l'ha mandato mai, il nulla vuol dire «non lo so»: trattarlo come un no vorrebbe dire cambiare
   * il menu di domani a chi ha una versione vecchia dell'app, l'ha già letto e ci ha fatto la
   * spesa — cioè fare, in nome della correzione, il danno che la regola esisteva per impedire.
   */
  it('⛔ di un giorno che non sappiamo, non si tocca niente — nemmeno domani', () => {
    const nonSappiamo = { apertoDallaClienteIl: null, apertureTracciate: false };
    expect(siPuoCancellare(nonSappiamo)).toBe(false);
    // ⚠️ E il calendario, da solo, direbbe di sì: sono due domande, e servono tutte e due.
    expect(daOggiInPoi(g('2026-08-14'), oggi)).toBe(true);
  });

  /**
   * ⚠️ **E `viewedAt` qui non decide più niente.** Continua a esistere e a voler dire «gliel'abbiamo
   * mostrato nella lista» — che è vero, e che altri leggono. Se tornasse a decidere qui, tornerebbe
   * anche il difetto: `getMenu` lo scrive su trenta giorni alla prima apertura dell'app.
   */
  it('⛔ un giorno «visto» ma non aperto SI rifà: erano due domande diverse', () => {
    const mostratoNonAperto = {
      date: new Date('2026-08-14'),
      viewedAt: new Date('2026-08-13'),
      apertoDallaClienteIl: null,
      apertureTracciate: true,
    };
    expect(siPuoCancellare(mostratoNonAperto)).toBe(true);
  });
});
