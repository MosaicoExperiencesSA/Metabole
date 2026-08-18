import { esitoAnnullamento, raccontaAnnullamento, type AbbonamentoLetto } from './annulla-abbonamento';

/**
 * ANNULLARE UN ABBONAMENTO DALLA SCHEDA — caso Lorena, 17/8.
 *
 * ⚠️ La regola che governa questo file: **la conferma si chiede una volta sola, quando serve**.
 * Serve quando dopo l'annullamento la cliente smette di ricevere menu. Chiederla sempre insegna a
 * cliccare «sì» senza leggere, e allora la volta che conta non la legge nessuno — che è il modo più
 * elegante di avere un avviso e non averlo.
 */

const OGGI = new Date('2026-08-17T00:00:00.000Z');
const d = (s: string): Date => new Date(`${s}T00:00:00.000Z`);

const sub = (over: Partial<AbbonamentoLetto>): AbbonamentoLetto => ({
  id: 's1',
  status: 'active',
  startDate: d('2026-08-17'),
  endDate: d('2026-08-25'),
  piano: 'Conosciamoci',
  ...over,
});

describe('esitoAnnullamento', () => {
  it('⚠️ il caso Lorena: due piani in corso, se ne toglie uno e i menu continuano', () => {
    // È il caso per cui questo esiste: due «Conosciamoci» attivi insieme, uno va tolto, e togliere
    // il secondo non deve spaventare nessuno — l'altro sta ancora correndo.
    const uno = sub({ id: 'a' });
    const due = sub({ id: 'b', endDate: d('2026-09-01') });
    expect(esitoAnnullamento(due, [uno, due], OGGI)).toEqual({ tipo: 'procedi', restaSenzaPiano: false });
  });

  it('⚠️ l\'ULTIMO piano in corso chiede conferma, e dice cosa succede alla cliente', () => {
    const solo = sub({ id: 'a' });
    const esito = esitoAnnullamento(solo, [solo], OGGI);
    expect(esito.tipo).toBe('serve_conferma');
    expect((esito as { testo: string }).testo).toContain('senza nessun piano in corso');
    expect((esito as { testo: string }).testo).toContain('già consegnati');
  });

  it('un piano IN CODA si toglie senza domande: non sta erogando niente', () => {
    // Un piano che parte fra una settimana non cambia cosa mangia domani. Chiedere conferma qui
    // sarebbe rumore, e il rumore è quello che rende invisibile l'avviso vero.
    const inCorso = sub({ id: 'a' });
    const coda = sub({ id: 'b', startDate: d('2026-08-25'), endDate: d('2026-09-01') });
    expect(esitoAnnullamento(coda, [inCorso, coda], OGGI)).toEqual({ tipo: 'procedi', restaSenzaPiano: false });
  });

  it('un piano non ancora approvato (`pending`) si toglie senza domande', () => {
    const p = sub({ id: 'a', status: 'pending' });
    expect(esitoAnnullamento(p, [p], OGGI)).toEqual({ tipo: 'procedi', restaSenzaPiano: false });
  });

  it('già annullato: non si fa niente, e lo si dice', () => {
    const p = sub({ status: 'cancelled' });
    const esito = esitoAnnullamento(p, [p], OGGI);
    expect(esito.tipo).toBe('nulla_da_fare');
    expect((esito as { testo: string }).testo).toContain('già annullato');
  });

  it('già scaduto: non c\'è niente da annullare, e la data lo dice', () => {
    const p = sub({ status: 'expired', endDate: d('2026-08-10') });
    const esito = esitoAnnullamento(p, [p], OGGI);
    expect(esito.tipo).toBe('nulla_da_fare');
    expect((esito as { testo: string }).testo).toContain('10/08/2026');
  });

  it('⚠️ un piano attivo ma NON ancora cominciato non tiene in vita nessuno', () => {
    // Se l'unico altro piano comincia fra tre giorni, togliere quello in corso lascia comunque la
    // cliente senza menu da domani: la conferma va chiesta lo stesso.
    const oggiInCorso = sub({ id: 'a' });
    const futuro = sub({ id: 'b', startDate: d('2026-08-20'), endDate: d('2026-08-28') });
    expect(esitoAnnullamento(oggiInCorso, [oggiInCorso, futuro], OGGI).tipo).toBe('serve_conferma');
  });

  it('le date aperte (senza inizio o senza fine) contano come in corso', () => {
    const senzaDate = sub({ id: 'b', startDate: null, endDate: null });
    const bersaglio = sub({ id: 'a' });
    expect(esitoAnnullamento(bersaglio, [bersaglio, senzaDate], OGGI)).toEqual({ tipo: 'procedi', restaSenzaPiano: false });
  });
});

describe('raccontaAnnullamento', () => {
  it('dice cosa è cambiato, non «fatto»', () => {
    const t = raccontaAnnullamento(sub({}), false);
    expect(t).toContain('Conosciamoci');
    expect(t).toContain('17/08/2026');
    expect(t).toContain('i menu continuano');
  });

  it('⚠️ e quando la cliente resta scoperta lo dice per primo', () => {
    expect(raccontaAnnullamento(sub({}), true)).toContain('non riceverà menu nuovi');
  });
});
