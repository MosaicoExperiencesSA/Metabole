import { confrontaLePoole, perchePersa, quantePerse } from './confronto-dei-pool';

const app = (slot: string, ...ids: string[]) => ids.map((recipeId) => ({ slot, recipeId }));
const tutteVive = () => true;

describe('⛔ le due sponde si costruiscono dalla STESSA porta', () => {
  /**
   * ⛔ **IL FALSO ALLARME DEL 2/9, in una prova.**
   *
   * `panieri:confronta` diceva «119 varianti perderebbero almeno una ricetta, NON spostare
   * l'interruttore», con le perdite tutte su `morning_snack` e `afternoon_snack`. Il paniere le
   * aveva: dall'1/9 spuntino e merenda sono **un paniere solo**, e il lato giornate passava da
   * `poolPerSlot` (che allarga ai gemelli) mentre il lato paniere no.
   */
  it('⛔ una ricetta di spuntino nel paniere copre la merenda delle giornate', () => {
    const giornate = [...app('morning_snack', 'a'), ...app('afternoon_snack', 'b')];
    /** ⚠️ Nel paniere stanno sotto la loro chiave sola: è come sono scritte in tabella. */
    const paniere = [...app('morning_snack', 'a'), ...app('afternoon_snack', 'b')];
    expect(confrontaLePoole(giornate, paniere, tutteVive).perse).toEqual([]);
  });

  /**
   * ⛔ **MA L'ALLARGAMENTO NON INVENTA CHIAVI, e questo è il limite da conoscere.**
   *
   * `allargaAiGemelli` arricchisce i pasti che il pool **ha già**; non ne crea. Se il paniere non
   * contiene **nessuna** ricetta con `mealSlot = afternoon_snack`, nel pool quella chiave non
   * esiste, e una cliente che nella sua giornata ha la merenda non ha da dove pescarla. ⚠️ Questa
   * è una perdita **vera**, e il confronto deve continuare a dirla: è la differenza fra «il
   * misuratore non sapeva dei gemelli» e «il paniere è davvero incompleto».
   */
  it('⛔ ma se nel paniere quella chiave non esiste proprio, la perdita è vera', () => {
    const giornate = app('afternoon_snack', 'x');
    const paniere = app('morning_snack', 'x');
    const e = confrontaLePoole(giornate, paniere, tutteVive);
    expect(e.perse).toEqual([{ slot: 'afternoon_snack', mancanti: ['x'] }]);
  });

  /**
   * ⚠️ **Il caso della produzione**, e quello che spiega il tabulato del 2/9: tutte e due le chiavi
   * esistono da tutte e due le parti, con dentro insiemi diversi. Allargate, diventano lo stesso
   * insieme per tutti e due i pasti — e non manca niente.
   */
  it('⚠️ con tutte e due le chiavi presenti da tutte e due le parti, non manca niente', () => {
    const giornate = [...app('morning_snack', 'a', 'b'), ...app('afternoon_snack', 'c')];
    const paniere = [...app('morning_snack', 'a', 'c'), ...app('afternoon_snack', 'b')];
    expect(confrontaLePoole(giornate, paniere, tutteVive).perse).toEqual([]);
  });
});

describe('quello che il confronto deve continuare a vedere', () => {
  /**
   * ⛔ **IL CRITERIO CHE DICE CHE LA CORREZIONE NON HA SPENTO IL MISURATORE.** Una perdita vera su
   * un pasto **senza gemelli** deve restare visibile: il 2/9 nel tabulato c'era anche «2 su dinner
   * — DASH vegetarian», che i gemelli non spiegano, e quella deve sopravvivere alla correzione.
   */
  it('⛔ una ricetta che manca su un pasto senza gemelli è una perdita, e si vede', () => {
    const e = confrontaLePoole(app('dinner', 'a', 'b'), app('dinner', 'a'), tutteVive);
    expect(e.perse).toEqual([{ slot: 'dinner', mancanti: ['b'] }]);
    expect(quantePerse(e)).toBe(1);
  });

  /**
   * ⛔ **E i gemelli non sono un condono.** Se una ricetta di spuntino non sta nel paniere né sotto
   * una chiave né sotto l'altra, è persa davvero.
   */
  it('⛔ una ricetta di spuntino che nel paniere non c\'è proprio resta persa', () => {
    const giornate = [...app('morning_snack', 'a', 'b'), ...app('afternoon_snack', 'a')];
    const paniere = [...app('morning_snack', 'a'), ...app('afternoon_snack', 'a')];
    const e = confrontaLePoole(giornate, paniere, tutteVive);
    expect(quantePerse(e)).toBe(2);
    expect(e.perse.every((p) => p.mancanti.includes('b'))).toBe(true);
  });

  /**
   * ⚠️ Una ricetta **cancellata dal catalogo** non è una perdita: la chiave esterna del paniere la
   * rifiuta di proposito, e contarla farebbe sembrare rotta la migrazione per la cosa che è venuta
   * a chiudere.
   */
  it('⚠️ una ricetta che non esiste più non conta come persa', () => {
    const e = confrontaLePoole(app('dinner', 'viva', 'morta'), app('dinner', 'viva'), (id) => id !== 'morta');
    expect(e.perse).toEqual([]);
  });

  it('⚠️ e i nomi delle perse si portano dietro, non solo il conto', () => {
    const e = confrontaLePoole(app('lunch', 'a', 'b', 'c'), app('lunch', 'a'), tutteVive);
    expect(e.perse[0].mancanti.sort()).toEqual(['b', 'c']);
  });
});

describe('il guadagno', () => {
  /** ⚠️ Il paniere che aggiunge non allarma: è il senso della riforma. Si guarda solo se è zero. */
  it('conta le ricette che il paniere aggiunge', () => {
    const e = confrontaLePoole(app('lunch', 'a'), app('lunch', 'a', 'b', 'c'), tutteVive);
    expect(e.perse).toEqual([]);
    expect(e.guadagnate).toBe(2);
  });

  /**
   * ⛔ **Un pasto che le giornate non hanno non diventa un guadagno da servire.** `allargaAiGemelli`
   * non inventa chiavi, e questo confronto non deve far sembrare che il paniere porti una merenda a
   * chi non ce l'ha: sarebbero kcal aggiunte perché il catalogo aveva una chiave.
   */
  it('⛔ un pasto che le giornate non prevedono non compare fra le perse', () => {
    const e = confrontaLePoole(app('lunch', 'a'), [...app('lunch', 'a'), ...app('breakfast', 'z')], tutteVive);
    expect(e.perse).toEqual([]);
  });
});

/**
 * ⛔ **«625 piatti spariscono» e «625 piatti smettono di arrivare a chi non doveva riceverli» sono
 * la stessa riga con due significati opposti.** Senza il perché, il verdetto manda a cercare.
 */
describe('perchePersa', () => {
  it('⛔ una ricetta il cui regime non è quello del paniere sparisce APPOSTA', () => {
    expect(perchePersa({ regime: 'pescetarian', active: true }, 'vegan')).toBe('regime diverso');
  });

  it('⛔ se il regime combacia, manca davvero: da guardare', () => {
    expect(perchePersa({ regime: 'vegan', active: true }, 'vegan')).toBe('da guardare');
  });

  it('⚠️ una spenta del regime giusto si distingue lo stesso', () => {
    expect(perchePersa({ regime: 'vegan', active: false }, 'vegan')).toBe('spenta');
  });

  /**
   * ⛔ **Il regime vince sullo spento**: una ricetta di pesce spenta e riclassificata sparisce
   * dal paniere vegano per il regime, e dirlo «spenta» manderebbe a riaccenderla.
   */
  it('⛔ e il regime diverso vince sullo spento', () => {
    expect(perchePersa({ regime: 'omnivore', active: false }, 'vegetarian')).toBe('regime diverso');
  });

  /** ⚠️ Una ricetta che non si trova più non è «spenta»: è sparita, ed è un'altra cosa. */
  it('⚠️ una ricetta che non c\'è più è da guardare, non «spenta»', () => {
    expect(perchePersa(undefined, 'vegan')).toBe('da guardare');
  });
});
