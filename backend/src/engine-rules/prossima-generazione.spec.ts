import {
  prossimaDaGenerare,
  quantoManca,
  settimanaDaFare,
  type VarianteDaRiempire,
} from './prossima-generazione';

/**
 * L'ORDINE IN CUI SI GENERANO I CATALOGHI — richiesta della nutrizionista girata da Simone il 17/8.
 *
 * ⚠️ Le due regole che questo file esiste per difendere, e che costano soldi veri se cadono:
 *
 * 1. **prima chi ha clienti sopra.** Su 306 diete in catalogo quelle con qualcuno sopra sono 16.
 *    Sbagliare l'ordine vuol dire pagare ricette nuove per diete su cui non mangia nessuno mentre
 *    chi c'è continua a vedere la stessa colazione cinque volte al mese.
 * 2. **dentro un gruppo, prima la 5 pasti.** Le tre strutture condividono le ricette: generare
 *    prima la 3 pasti fa pagare all'AI dei piatti che la 5 pasti avrebbe regalato — lo stesso
 *    lavoro, al triplo del prezzo.
 */

const v = (over: Partial<VarianteDaRiempire>): VarianteDaRiempire => ({
  presetId: 'p1',
  etichetta: 'Dieta · omnivore · dimagrimento · 5 pasti',
  gruppo: 'Dieta|omnivore|dimagrimento',
  struttura: '5',
  settimaneFatte: 0,
  primaSettimanaMagra: null,
  clientiGruppo: 0,
  ...over,
});

describe('settimanaDaFare', () => {
  it('da zero si parte dalla 1', () => {
    expect(settimanaDaFare(v({ settimaneFatte: 0 }))).toBe(1);
  });

  it('con quattro fatte tocca la 5', () => {
    expect(settimanaDaFare(v({ settimaneFatte: 4 }))).toBe(5);
  });

  it('a dodici non c\'è più niente da fare', () => {
    expect(settimanaDaFare(v({ settimaneFatte: 12 }))).toBeNull();
  });

  it('⚠️ una settimana MAGRA viene prima di una settimana nuova', () => {
    // Le varianti con clienti hanno 28 giornate ma 19 piatti per pasto invece di 28: il conto delle
    // settimane dice «quattro fatte» e la cliente vede la stessa colazione cinque volte al mese.
    // Quella settimana la sta mangiando qualcuno adesso; la quinta non la vede ancora nessuno.
    expect(settimanaDaFare(v({ settimaneFatte: 4, primaSettimanaMagra: 2 }))).toBe(2);
    expect(settimanaDaFare(v({ settimaneFatte: 12, primaSettimanaMagra: 3 }))).toBe(3);
  });

  it('tutte piene e tutte fatte: non c\'è più niente', () => {
    expect(settimanaDaFare(v({ settimaneFatte: 12, primaSettimanaMagra: null }))).toBeNull();
  });

  it('l\'obiettivo si può abbassare (per provare, o per fermarsi prima)', () => {
    expect(settimanaDaFare(v({ settimaneFatte: 4 }), 4)).toBeNull();
    expect(settimanaDaFare(v({ settimaneFatte: 3 }), 4)).toBe(4);
  });
});

describe('prossimaDaGenerare', () => {
  it('niente da fare: null, e il cron non chiama l\'AI', () => {
    expect(prossimaDaGenerare([v({ settimaneFatte: 12 })])).toBeNull();
    expect(prossimaDaGenerare([])).toBeNull();
  });

  it('⚠️ prima la famiglia con più clienti, anche se un\'altra è più indietro', () => {
    // Essere più indietro non è un titolo di precedenza: il beneficio deve arrivare a qualcuno.
    const scelta = prossimaDaGenerare([
      v({ etichetta: 'Nessuno', gruppo: 'A', settimaneFatte: 0, clientiGruppo: 0 }),
      v({ etichetta: 'Flexitariana', gruppo: 'B', settimaneFatte: 8, clientiGruppo: 11 }),
    ]);
    expect(scelta?.variante.etichetta).toBe('Flexitariana');
    expect(scelta?.settimana).toBe(9);
    expect(scelta?.motivo).toContain('11 clienti');
  });

  it('⚠️ dentro lo stesso gruppo la 5 pasti viene PRIMA, sempre', () => {
    // ⚠️ Le etichette sono scelte perché l'ordine alfabetico darebbe la risposta SBAGLIATA: senza
    // il peso della struttura questo test passerebbe per caso, e un test che passa per caso non
    // difende niente.
    const scelta = prossimaDaGenerare([
      v({ etichetta: 'aaa tre', struttura: '3', settimaneFatte: 0, clientiGruppo: 5 }),
      v({ etichetta: 'bbb digiuno', struttura: 'fasting', settimaneFatte: 0, clientiGruppo: 5 }),
      v({ etichetta: 'zzz cinque', struttura: '5', settimaneFatte: 0, clientiGruppo: 5 }),
    ]);
    expect(scelta?.variante.etichetta).toBe('zzz cinque');
    expect(scelta?.motivo).toContain('le sorelle riuseranno');
  });

  it('⚠️ e la 5 pasti si finisce TUTTA prima di passare alle sorelle', () => {
    // Se si andasse settimana per settimana fra le tre strutture, la 3 pasti pagherebbe all'AI le
    // settimane che la 5 pasti non ha ancora generato. L'ordine è: 5 fino in fondo, poi le altre.
    const scelta = prossimaDaGenerare([
      v({ etichetta: 'tre', struttura: '3', settimaneFatte: 0, clientiGruppo: 5 }),
      v({ etichetta: 'cinque', struttura: '5', settimaneFatte: 11, clientiGruppo: 5 }),
    ]);
    expect(scelta?.variante.etichetta).toBe('cinque');
    expect(scelta?.settimana).toBe(12);
  });

  it('finita la 5 pasti, tocca alla 3 (che non costa niente)', () => {
    const scelta = prossimaDaGenerare([
      v({ etichetta: 'tre', struttura: '3', settimaneFatte: 0, clientiGruppo: 5 }),
      v({ etichetta: 'digiuno', struttura: 'fasting', settimaneFatte: 0, clientiGruppo: 5 }),
      v({ etichetta: 'cinque', struttura: '5', settimaneFatte: 12, clientiGruppo: 5 }),
    ]);
    expect(scelta?.variante.etichetta).toBe('tre');
  });

  it('le settimane si chiedono in ordine: mai un buco', () => {
    // Il generatore rifiuta la 3 senza la 2, e ha ragione: un ciclo con giornate mancanti in mezzo
    // il motore non lo sa colmare.
    expect(prossimaDaGenerare([v({ settimaneFatte: 1 })])?.settimana).toBe(2);
    expect(prossimaDaGenerare([v({ settimaneFatte: 6 })])?.settimana).toBe(7);
  });

  it('quando non resta nessuno con clienti si lavora al catalogo di riserva, e lo dice', () => {
    const scelta = prossimaDaGenerare([v({ etichetta: 'DASH', clientiGruppo: 0, settimaneFatte: 2 })]);
    expect(scelta?.variante.etichetta).toBe('DASH');
    expect(scelta?.motivo).toContain('nessun cliente');
  });

  it('⚠️ a parità di tutto la scelta è deterministica: il cron deve avanzare, non ballare', () => {
    const uguali = [
      v({ etichetta: 'Zeta', presetId: 'z', clientiGruppo: 3 }),
      v({ etichetta: 'Alfa', presetId: 'a', clientiGruppo: 3 }),
    ];
    expect(prossimaDaGenerare(uguali)?.variante.presetId).toBe('a');
    expect(prossimaDaGenerare([...uguali].reverse())?.variante.presetId).toBe('a');
  });

  it('si genera sempre in modalità «completa»: non si cancella mai il lavoro fatto a mano', () => {
    expect(prossimaDaGenerare([v({})])?.modalita).toBe('completa');
  });
});

describe('quantoManca', () => {
  it('somma le settimane che restano, variante per variante', () => {
    expect(quantoManca([v({ settimaneFatte: 4 }), v({ settimaneFatte: 12 })])).toBe(8);
  });

  it('una variante completa ma magra vale un passaggio in più', () => {
    expect(quantoManca([v({ settimaneFatte: 12, primaSettimanaMagra: 3 })])).toBe(1);
  });

  it('niente da fare: zero', () => {
    expect(quantoManca([v({ settimaneFatte: 12 })])).toBe(0);
    expect(quantoManca([])).toBe(0);
  });
});
