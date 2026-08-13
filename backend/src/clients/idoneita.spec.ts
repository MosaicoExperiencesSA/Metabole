/**
 * IL VIA LIBERA CLINICO — domanda di Simone (13/8): «la nutrizionista come fa a dirci ok può
 * proseguire?».
 *
 * I due test che contano sono quello sulla **nota obbligatoria** e quello su `serve_visita`:
 *
 *  - la nota è la sola cosa che, fra un mese, dirà a un'altra persona *perché* ha deciso così. Senza
 *    un minimo, «ok» e «.» passerebbero, e una decisione clinica diventerebbe indistinguibile da un
 *    clic per sbaglio;
 *  - `serve_visita` **non** è «da valutare»: qualcuno l'ha guardata. Confonderli farebbe ricomparire
 *    per sempre nella coda una cliente che è già stata vista — che è il difetto da cui nasce tutto
 *    questo lavoro.
 */
import { NOTA_MIN, daValutare, testoNota, validaDecisione } from './idoneita';

describe('la nota è obbligatoria', () => {
  it('⚠️ senza nota non si decide, e il messaggio dice PERCHÉ serve', () => {
    // Non «campo nota mancante»: chi lo legge è una nutrizionista davanti a una scheda.
    expect(() => validaDecisione('idonea', '')).toThrow(/leggerà anche la coach/);
    expect(() => validaDecisione('idonea', undefined)).toThrow();
  });

  it('⚠️ e nemmeno con «ok»: sotto il minimo non è una spiegazione', () => {
    expect(() => validaDecisione('idonea', 'ok')).toThrow();
    expect(() => validaDecisione('idonea', '.'.repeat(NOTA_MIN - 1))).toThrow();
  });

  it('gli spazi non contano come nota', () => {
    expect(() => validaDecisione('idonea', '          ')).toThrow();
  });

  it('con una nota vera passa, ripulita', () => {
    expect(validaDecisione('idonea', '  Valutata in visita il 12/8, nessuna controindicazione.  ')).toEqual({
      esito: 'idonea',
      nota: 'Valutata in visita il 12/8, nessuna controindicazione.',
    });
  });

  it('un esito inventato non passa', () => {
    expect(() => validaDecisione('forse', 'una nota lunga abbastanza')).toThrow(/può proseguire o se serve una visita/);
    expect(() => validaDecisione(undefined, 'una nota lunga abbastanza')).toThrow();
  });
});

describe('il testo che finisce nella lista note', () => {
  it('dice cosa è stato deciso, non solo la nota', () => {
    // La coach apre le note e deve capire cos'è quella riga senza chiedere.
    expect(testoNota('idonea', 'Nessuna controindicazione.')).toBe(
      'Valutazione clinica — Può proseguire: Nessuna controindicazione.',
    );
    expect(testoNota('serve_visita', 'Allergia grave, la vedo giovedì.')).toBe(
      'Valutazione clinica — Serve una visita: Allergia grave, la vedo giovedì.',
    );
  });
});

describe('chi è ancora DA VALUTARE', () => {
  it('con allergie dichiarate e nessuna decisione, sì', () => {
    expect(daValutare({ allergies: ['latte'] })).toBe(true);
  });

  it('anche col solo screening del questionario (patologie o farmaci)', () => {
    // Era la seconda metà della domanda di Simone: «questo succede per tutte le persone in
    // percorso». Un via libera che risponde solo alle allergie lascerebbe l'altra metà com'era.
    expect(daValutare({ allergies: [], screeningFlag: true })).toBe(true);
  });

  it('⚠️ una volta decisa NON ricompare: è tutta la differenza con la segnalazione', () => {
    // La segnalazione, dopo quattordici giorni di tregua, tornava. Una valutazione clinica no:
    // vale finché non arriva un fatto nuovo.
    expect(daValutare({ allergies: ['latte'], idoneita: 'idonea' })).toBe(false);
  });

  it('⚠️ e «serve_visita» NON è «da valutare»: qualcuno l\'ha guardata', () => {
    // Sta nell'elenco di quelle da visitare, non in quello di chi nessuno ha ancora aperto.
    // Contarla fra le seconde vorrebbe dire riproporla per sempre a chi l'ha già vista.
    expect(daValutare({ allergies: ['latte'], idoneita: 'serve_visita' })).toBe(false);
  });

  it('chi non ha né allergie né screening non si valuta', () => {
    expect(daValutare({ allergies: [], screeningFlag: false })).toBe(false);
    expect(daValutare({})).toBe(false);
  });
});

/**
 * LA CODA: la stessa regola vista dall'elenco, non una seconda.
 *
 * §8 dell'handoff: «la cliente in coda nella lista della nutrizionista, con il motivo». Senza,
 * il via libera clinico è una porta senza campanello — la decisione si può prendere, ma non si sa
 * su chi, se non aprendo le schede una per una.
 */
describe('l\'elenco e la scheda devono dire la stessa cosa', () => {
  it('⚠️ una cliente segnata «da valutare» in elenco deve esserlo anche nella scheda', () => {
    // Se le due contassero in modo diverso, la nutrizionista aprirebbe una cliente segnata «da
    // valutare» e ci troverebbe scritto «non serve» — e a quel punto smetterebbe di fidarsi
    // dell'elenco, che è il modo in cui un elenco muore.
    const casi = [
      { allergies: ['latte'], idoneita: null, screeningFlag: false },
      { allergies: [], idoneita: null, screeningFlag: true },
      { allergies: ['latte'], idoneita: 'idonea', screeningFlag: true },
      { allergies: ['latte'], idoneita: 'serve_visita', screeningFlag: false },
      { allergies: [], idoneita: null, screeningFlag: false },
    ];
    // Una funzione sola: è il punto. Il test tiene fermo che ci sia UNA risposta per caso.
    for (const c of casi) expect(daValutare(c)).toBe(daValutare({ ...c }));
    expect(casi.map((c) => daValutare(c))).toEqual([true, true, false, false, false]);
  });
});
