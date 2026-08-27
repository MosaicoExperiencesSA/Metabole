/**
 * «Togli lo spuntino» — l'azione 3 di Vera sui pasti (Decisioni 13/8 §14).
 *
 * I blocchi che contano: «lo spuntino» secco NON si indovina (si chiede quale), «togli il tonno»
 * resta un divieto alimentare e non un pasto, e il rifacimento tocca solo i giorni futuri non
 * ancora aperti — con il criterio ribaltato per il «rimetti».
 */
import {
  etichettaSpuntino,
  giorniColpitiDaiPasti,
  leggiPasti,
  leggiQualeSpuntino,
  pastiDopo,
} from './togli-spuntino';

describe('leggiPasti', () => {
  it('«lo spuntino» secco: azione chiara, slot da chiedere', () => {
    expect(leggiPasti('togli lo spuntino')).toEqual({ azione: 'togli', slots: null });
    expect(leggiPasti('a Giulia Rossi togli lo spuntino')).toEqual({ azione: 'togli', slots: null });
  });

  it('quando lo dice, lo slot è quello', () => {
    expect(leggiPasti('togli lo spuntino del pomeriggio')).toEqual({ azione: 'togli', slots: ['afternoon_snack'] });
    expect(leggiPasti('niente spuntino di metà mattina per Giulia')).toEqual({ azione: 'togli', slots: ['morning_snack'] });
    expect(leggiPasti('togli la merenda a Giulia')).toEqual({ azione: 'togli', slots: ['afternoon_snack'] });
  });

  it('il plurale vale per tutti e due', () => {
    expect(leggiPasti('togli gli spuntini')).toEqual({ azione: 'togli', slots: ['morning_snack', 'afternoon_snack'] });
    expect(leggiPasti('senza spuntini')).toEqual({ azione: 'togli', slots: ['morning_snack', 'afternoon_snack'] });
  });

  it('«rimetti» fa il percorso inverso', () => {
    expect(leggiPasti('rimetti lo spuntino del mattino a Giulia')).toEqual({ azione: 'rimetti', slots: ['morning_snack'] });
    expect(leggiPasti('rimetti la merenda')).toEqual({ azione: 'rimetti', slots: ['afternoon_snack'] });
  });

  it('un alimento resta un alimento: niente falsi pasti', () => {
    expect(leggiPasti('togli il tonno a Giulia')).toBeNull();
    expect(leggiPasti('a Giulia niente formaggi molli')).toBeNull();
    expect(leggiPasti('togli lo yogurt dallo spuntino')).toBeNull(); // parla del contenuto, non dello slot
  });
});

describe('leggiQualeSpuntino', () => {
  it('capisce la risposta alla domanda «quale?»', () => {
    expect(leggiQualeSpuntino('quello del pomeriggio')).toEqual(['afternoon_snack']);
    expect(leggiQualeSpuntino('la mattina')).toEqual(['morning_snack']);
    expect(leggiQualeSpuntino('la merenda')).toEqual(['afternoon_snack']);
    expect(leggiQualeSpuntino('tutti e due')).toEqual(['morning_snack', 'afternoon_snack']);
    expect(leggiQualeSpuntino('entrambi')).toEqual(['morning_snack', 'afternoon_snack']);
  });

  it('e sul resto non indovina', () => {
    expect(leggiQualeSpuntino('boh')).toBeNull();
    expect(leggiQualeSpuntino('')).toBeNull();
  });
});

describe('pastiDopo', () => {
  it('togli aggiunge senza doppioni, rimetti toglie e basta', () => {
    expect(pastiDopo([], { azione: 'togli', slots: ['afternoon_snack'] })).toEqual(['afternoon_snack']);
    expect(pastiDopo(['afternoon_snack'], { azione: 'togli', slots: ['afternoon_snack'] })).toEqual(['afternoon_snack']);
    expect(pastiDopo(['afternoon_snack', 'morning_snack'], { azione: 'rimetti', slots: ['afternoon_snack'] })).toEqual(['morning_snack']);
  });
});

describe('etichettaSpuntino', () => {
  it('parla come una persona', () => {
    expect(etichettaSpuntino('morning_snack')).toBe('lo spuntino del mattino');
    expect(etichettaSpuntino('afternoon_snack')).toBe('la merenda del pomeriggio');
  });
});

describe('giorniColpitiDaiPasti', () => {
  const oggi = new Date('2026-08-13T12:00:00Z');
  /**
   * ⚠️ **`apertureTracciate: true` è la premessa, e va detta** (26/8): dal 26/8 «aperto» lo dichiara
   * l'app della cliente, e su un giorno di cui non lo sappiamo la risposta è sempre «non si tocca».
   * Qui si misura cosa succede **quando lo sappiamo**; l'altro caso ha i suoi test in
   * `menu-da-rifare.spec.ts`.
   */
  const giorno = (id: string, date: string, slots: string[], aperto = false) => ({
    id,
    clientId: 'c1',
    date: new Date(date),
    apertoDallaClienteIl: aperto ? new Date(date) : null,
    apertureTracciate: true,
    meals: slots.map((slot) => ({ slot, recipeId: `r-${slot}` })),
  });

  /**
   * ⚠️ IL CASO CHE VALE LA CORREZIONE DEL 19/8 — «meglio rifare la giornata di oggi» (Simone).
   *
   * Fino a quel giorno questa funzione partiva da **domani** mentre le altre due che rispondono alla
   * stessa domanda partivano da **oggi**: su una cliente che non aveva ancora aperto il menu di
   * oggi, toglierle lo spuntino non glielo toglieva oggi, ma vietarle un alimento sì. Due
   * comportamenti diversi, nessuno dei due scritto come scelta.
   */
  it('⚠️ la giornata di OGGI, se non l\'ha ancora aperta, si rifà', () => {
    const giorni = [giorno('oggi', '2026-08-13', ['breakfast', 'afternoon_snack'])];
    expect(giorniColpitiDaiPasti(giorni, ['afternoon_snack'], oggi, 'togli').map((g) => g.id)).toEqual(['oggi']);
  });

  /**
   * ⛔ **UNA GIORNATA GIÀ APERTA È COLPITA LO STESSO** (26/8). Fino a ieri qui la risposta era `[]`,
   * e quel vuoto arrivava alla nutrizionista come «nessuna giornata già preparata da rifare» —
   * mentre la merenda in quel giorno c'era. «È colpita?» e «la posso cancellare?» sono due domande:
   * la seconda la risponde `codaDaRifare`, che sulla giornata già aperta dice «bloccata» e lo
   * spiega. Mescolarle è come è nato il difetto che questa modifica chiude.
   */
  it('⛔ la giornata di oggi GIÀ APERTA è colpita: a non toccarla ci pensa la coda', () => {
    const giorni = [giorno('oggi', '2026-08-13', ['breakfast', 'afternoon_snack'], true)];
    expect(giorniColpitiDaiPasti(giorni, ['afternoon_snack'], oggi, 'togli').map((g) => g.id)).toEqual(['oggi']);
  });

  it('togli: i giorni da oggi in poi che CONTENGONO lo spuntino', () => {
    const giorni = [
      giorno('ieri', '2026-08-12', ['breakfast', 'afternoon_snack']),          // passato: no
      giorno('visto', '2026-08-14', ['breakfast', 'afternoon_snack'], true),   // colpito: lo decide la coda
      giorno('si', '2026-08-15', ['breakfast', 'afternoon_snack']),            // sì
      giorno('senza', '2026-08-16', ['breakfast', 'lunch']),                   // non lo contiene: no
    ];
    expect(giorniColpitiDaiPasti(giorni, ['afternoon_snack'], oggi, 'togli').map((g) => g.id)).toEqual(['visto', 'si']);
  });

  it('rimetti: il criterio si ribalta — i giorni a cui MANCA', () => {
    const giorni = [
      giorno('manca', '2026-08-15', ['breakfast', 'lunch']),
      giorno('ce-l-ha', '2026-08-16', ['breakfast', 'afternoon_snack']),
    ];
    expect(giorniColpitiDaiPasti(giorni, ['afternoon_snack'], oggi, 'rimetti').map((g) => g.id)).toEqual(['manca']);
  });
});
