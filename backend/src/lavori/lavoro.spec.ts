/**
 * LE REGOLE DELLA PAGINA «LAVORI».
 *
 * I due test che contano sono quello sulla **spunta tolta** e quello su `undefined` contro stringa
 * vuota: sono i due modi in cui questa pagina può diventare bugiarda, e una lista bugiarda smette di
 * essere guardata — che è l'unico modo in cui può fallire.
 */
import { CATEGORIA_DEFAULT, datiSpunta, normalizzaLavoro, ordinaLavori } from './lavoro';

const ADESSO = new Date('2026-08-13T18:30:00.000Z');

describe('la spunta', () => {
  it('mettendola scrive chi e quando', () => {
    expect(datiSpunta(true, 's-simone', ADESSO)).toEqual({ fatto: true, fattoIl: ADESSO, fattoDaId: 's-simone' });
  });

  it('⚠️ togliendola AZZERA chi e quando', () => {
    // Una voce riaperta che dice ancora «fatta da Simone il 13 agosto» è la riga che fa perdere
    // fiducia in tutta la lista.
    expect(datiSpunta(false, 's-simone', ADESSO)).toEqual({ fatto: false, fattoIl: null, fattoDaId: null });
  });

  it('chi spunta senza scheda staff resta senza nome, ma la spunta vale', () => {
    // Meglio una spunta senza nome che una spunta rifiutata: la data c'è comunque.
    expect(datiSpunta(true, undefined, ADESSO)).toEqual({ fatto: true, fattoIl: ADESSO, fattoDaId: null });
  });
});

describe('cosa arriva dalla pagina', () => {
  it('un titolo vuoto o di due lettere non passa, e il messaggio dice cosa fare', () => {
    expect(() => normalizzaLavoro({ titolo: '  ' }, true)).toThrow(/Scrivi cosa c'è da fare/);
    expect(() => normalizzaLavoro({ titolo: 'ok' }, true)).toThrow();
    expect(() => normalizzaLavoro({}, true)).toThrow();
  });

  it('⚠️ in modifica, un campo NON mandato non si tocca', () => {
    // È la lezione di `common/non-perdere.ts`: un aggiornamento parziale che azzera i campi assenti
    // è il modo in cui il questionario ha perso tre volte un dato diverso.
    const campi = normalizzaLavoro({ dettaglio: 'due righe di contesto' }, false);
    expect(campi).toEqual({ dettaglio: 'due righe di contesto' });
    expect('titolo' in campi).toBe(false);
    expect('categoria' in campi).toBe(false);
  });

  it('⚠️ ma un dettaglio SVUOTATO si svuota: «non te l\'ho mandato» e «l\'ho cancellato» sono cose diverse', () => {
    expect(normalizzaLavoro({ dettaglio: '   ' }, false)).toEqual({ dettaglio: null });
  });

  it('la categoria vuota ricade su quella predefinita, e il titolo si ripulisce', () => {
    expect(normalizzaLavoro({ titolo: '  Filtro da valutare  ', categoria: '' }, true)).toEqual({
      titolo: 'Filtro da valutare',
      categoria: CATEGORIA_DEFAULT,
    });
  });

  it('⚠️ «blocca» è un sì o un no, e non si accende per sbaglio', () => {
    // Il rosso vuol dire «dietro c'è una fila ferma»: una stringa qualsiasi che lo accendesse
    // renderebbe rossa mezza pagina, e il colore smetterebbe di dire qualcosa.
    expect(normalizzaLavoro({ blocca: true }, false)).toEqual({ blocca: true });
    expect(normalizzaLavoro({ blocca: 'true' }, false)).toEqual({ blocca: true });
    expect(normalizzaLavoro({ blocca: 'forse' }, false)).toEqual({ blocca: false });
    expect(normalizzaLavoro({ blocca: false }, false)).toEqual({ blocca: false });
    expect('blocca' in normalizzaLavoro({ titolo: 'una voce qualsiasi' }, true)).toBe(false);
  });

  it('un ordine non numerico non fa saltare il salvataggio', () => {
    expect(normalizzaLavoro({ ordine: 'terzo' }, false)).toEqual({ ordine: 0 });
    expect(normalizzaLavoro({ ordine: '2' }, false)).toEqual({ ordine: 2 });
  });
});

describe('l\'ordine dell\'elenco', () => {
  const righe = [
    { id: 'a', fatto: true, fattoIl: new Date('2026-08-10T09:00:00Z') },
    { id: 'b', fatto: false, fattoIl: null },
    { id: 'c', fatto: true, fattoIl: new Date('2026-08-13T09:00:00Z') },
    { id: 'd', fatto: false, fattoIl: null },
  ];

  it('da fare in cima, fatte in fondo con le ultime chiuse per prime', () => {
    expect(ordinaLavori(righe).map((r) => r.id)).toEqual(['b', 'd', 'c', 'a']);
  });

  it('⚠️ le fatte NON spariscono: è metà del motivo per cui la pagina esiste', () => {
    // «Così è tutto registrato ed evidente» (Simone): una lista in cui il fatto sparisce risponde a
    // «cosa resta» e non a «cosa è stato fatto».
    expect(ordinaLavori(righe)).toHaveLength(4);
  });
});
