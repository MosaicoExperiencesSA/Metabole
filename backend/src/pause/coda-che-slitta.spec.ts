import { codaCheSlitta } from './coda-che-slitta';

const g = (s: string) => new Date(`${s}T00:00:00.000Z`);
const riga = (id: string, inizio: string | null, fine: string | null, status = 'queued') => ({
  id, status, startDate: inizio ? g(inizio) : null, endDate: fine ? g(fine) : null,
});
const giorno = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

describe('la coda che slitta quando una pausa allunga il piano in corso', () => {
  /**
   * ⚠️ IL CASO LORENA, DAL VERSO IN CUI NASCE. Piano #1 fino al 25/08, coda #2 dal 25/08. Sette
   * giorni di pausa portano il #1 al 01/09: senza questa regola il #2 comincerebbe **dentro** il
   * #1, e i suoi primi sette giorni scorrerebbero senza che la cliente riceva niente.
   */
  it('⚠️ la coda che parte il giorno della vecchia fine scorre anche lei', () => {
    const righe = [riga('uno', '2026-06-01', '2026-08-25', 'active'), riga('due', '2026-08-25', '2026-11-25')];
    const spostati = codaCheSlitta(righe, 'uno', g('2026-08-25'), 7);
    expect(spostati).toHaveLength(1);
    expect(spostati[0].id).toBe('due');
    expect(giorno(spostati[0].startDate)).toBe('2026-09-01');
    // ⚠️ E la FINE con lei: spostare solo l'inizio le accorcerebbe il piano di sette giorni.
    expect(giorno(spostati[0].endDate)).toBe('2026-12-02');
  });

  it('la riga allungata dalla pausa non si sposta: si è già mossa lei', () => {
    const righe = [riga('uno', '2026-06-01', '2026-08-25', 'active')];
    expect(codaCheSlitta(righe, 'uno', g('2026-08-25'), 7)).toEqual([]);
  });

  /**
   * ⚠️ TUTTA LA FILA, NON SOLO LA PRIMA. Spostandone una sola, quella finirebbe addosso alla
   * seconda: il difetto chiuso qui e riaperto un metro più in là. Spostandole tutte dello stesso
   * numero di giorni, le distanze fra loro restano quelle di prima.
   */
  it('⚠️ due code una dietro l\'altra scorrono tutte e due, e restano alla stessa distanza', () => {
    const righe = [
      riga('uno', '2026-06-01', '2026-08-25', 'active'),
      riga('due', '2026-08-25', '2026-11-25'),
      riga('tre', '2026-11-25', '2027-02-25'),
    ];
    const spostati = codaCheSlitta(righe, 'uno', g('2026-08-25'), 7);
    expect(spostati.map((x) => x.id)).toEqual(['due', 'tre']);
    expect(giorno(spostati[0].endDate)).toBe('2026-12-02');
    expect(giorno(spostati[1].startDate)).toBe('2026-12-02'); // il testimone resta un testimone
  });

  /**
   * ⚠️ LE RIGHE CHE COMINCIANO PRIMA DELLA VECCHIA FINE NON SI TOCCANO. Si sovrappongono già, e una
   * sovrapposizione che esiste oggi l'ha autorizzata **una persona** — la matita chiede conferma e
   * la registra, ed è una decisione di Simone tenerla così. Spostarla vorrebbe dire disfare in
   * automatico quello che qualcuno ha deciso a mano.
   */
  it('⚠️ una sovrapposizione già esistente non si disfa da sola', () => {
    const righe = [riga('uno', '2026-06-01', '2026-08-25', 'active'), riga('due', '2026-08-10', '2026-11-10', 'active')];
    expect(codaCheSlitta(righe, 'uno', g('2026-08-25'), 7)).toEqual([]);
  });

  it('un piano già finito e uno annullato non sono la fila', () => {
    const righe = [
      riga('scaduto', '2026-09-01', '2026-12-01', 'expired'),
      riga('annullato', '2026-09-01', '2026-12-01', 'cancelled'),
      riga('carrello', '2026-09-01', '2026-12-01', 'pending'),
    ];
    expect(codaCheSlitta(righe, 'uno', g('2026-08-25'), 7)).toEqual([]);
  });

  /** ⚠️ Fine assente = piano aperto: resta aperto. Inventargli una fine sarebbe un dato nuovo. */
  it('⚠️ il piano senza fine scorre nell\'inizio e resta senza fine', () => {
    const spostati = codaCheSlitta([riga('due', '2026-08-25', null)], 'uno', g('2026-08-25'), 7);
    expect(giorno(spostati[0].startDate)).toBe('2026-09-01');
    expect(spostati[0].endDate).toBeNull();
  });

  it('senza inizio non si sposta niente: non si sa da dove', () => {
    expect(codaCheSlitta([riga('due', null, '2026-11-25')], 'uno', g('2026-08-25'), 7)).toEqual([]);
  });

  it('zero giorni di pausa non muovono niente', () => {
    const righe = [riga('due', '2026-08-25', '2026-11-25')];
    expect(codaCheSlitta(righe, 'uno', g('2026-08-25'), 0)).toEqual([]);
    expect(codaCheSlitta(righe, 'uno', g('2026-08-25'), -3)).toEqual([]);
  });
});
