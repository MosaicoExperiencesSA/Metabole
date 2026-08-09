/**
 * FATTURATO E NUOVE CLIENTI PER GIORNATA (richiesta di Simone dell'8/8).
 *
 * Tre cose che si sbagliano in silenzio, e che questi test tengono ferme:
 *
 *  1. **il giorno è quello di Europe/Rome**, non quello UTC. Un incasso delle 00:30 del 1° agosto è
 *     di luglio per UTC: finirebbe nel mese sbagliato, e il guaio è che il totale del mese resta
 *     giusto — solo i due grafici non tornano, e nessuno sa perché;
 *  2. **i giorni vuoti ci sono**. Un grafico che salta i giorni senza incassi mente sulla pendenza:
 *     due incassi a una settimana di distanza sembrano due giorni consecutivi;
 *  3. **il confronto è alla stessa giornata**. Il totale di un mese finito contro un mese a metà non
 *     dice niente e sembra sempre un crollo: è esattamente il numero che Simone ha chiesto di poter
 *     leggere («aggiornato alla giornata col mese precedente»).
 */

import {
  confrontoAllaGiornata,
  finestraDelMese,
  giorniDelMese,
  leggiMese,
  meseAParole,
  meseDi,
  meseSpostato,
  serieDelMese,
} from './serie-giornaliera';

const euro = (n: number) => n * 100;
/** Un istante in ora italiana (d'estate UTC+2), scritto come lo scriverebbe una persona. */
const italiana = (giorno: string, ora = '12:00') => new Date(`${giorno}T${ora}:00.000+02:00`);

describe('leggere e scorrere i mesi', () => {
  it('accetta solo `YYYY-MM` sensati', () => {
    expect(leggiMese('2026-08')).toEqual({ anno: 2026, mese: 8 });
    expect(leggiMese('2026-13')).toBeNull();
    expect(leggiMese('2026-00')).toBeNull();
    expect(leggiMese('agosto')).toBeNull();
    expect(leggiMese(undefined)).toBeNull();
  });

  it('scorre indietro e avanti, anche a cavallo dell\'anno', () => {
    expect(meseSpostato('2026-08', -1)).toBe('2026-07');
    expect(meseSpostato('2026-01', -1)).toBe('2025-12');
    expect(meseSpostato('2026-12', 1)).toBe('2027-01');
  });

  it('sa quanti giorni hanno i mesi, febbraio bisestile compreso', () => {
    expect(giorniDelMese('2026-02')).toBe(28);
    expect(giorniDelMese('2028-02')).toBe(29);
    expect(giorniDelMese('2026-04')).toBe(30);
    expect(giorniDelMese('2026-08')).toBe(31);
  });

  it('l\'etichetta è quella che legge una persona', () => {
    expect(meseAParole('2026-08')).toBe('agosto 2026');
  });

  /**
   * `meseDi` legge il fuso dell'azienda. Mezzanotte e mezza del 1° agosto in Italia è ancora il 31
   * luglio in UTC: se il mese lo decidesse UTC, quell'incasso comparirebbe nel grafico di luglio.
   */
  it('il mese di un istante è quello italiano, non quello UTC', () => {
    expect(meseDi(new Date('2026-08-01T00:30:00.000+02:00'))).toBe('2026-08');
    expect(meseDi(new Date('2026-07-31T23:30:00.000+02:00'))).toBe('2026-07');
  });

  /** La finestra chiesta al database è larga un giorno per lato, proprio per il caso qui sopra. */
  it('la finestra del mese abbraccia i bordi', () => {
    const { da, a } = finestraDelMese('2026-08');
    expect(da.toISOString().slice(0, 10)).toBe('2026-07-31');
    expect(a.toISOString().slice(0, 10)).toBe('2026-09-02');
  });
});

describe('serieDelMese', () => {
  const dati = {
    pagamenti: [
      { createdAt: italiana('2026-08-03'), amountCents: euro(100) },
      { createdAt: italiana('2026-08-03'), amountCents: euro(50) },
      { createdAt: italiana('2026-08-10'), amountCents: euro(200) },
      // Il caso del fuso: mezzanotte e mezza del 1° agosto in Italia. Per UTC è il 31 luglio.
      { createdAt: italiana('2026-08-01', '00:30'), amountCents: euro(10) },
      // Fuori mese: non deve entrare, anche se la query lo porta dentro la finestra larga.
      { createdAt: italiana('2026-07-31', '23:30'), amountCents: euro(999) },
    ],
    clienti: [
      { createdAt: italiana('2026-08-03') },
      { createdAt: italiana('2026-08-03') },
      { createdAt: italiana('2026-08-20') },
    ],
  };

  it('ha un punto per OGNI giorno del mese, anche quelli senza niente', () => {
    const serie = serieDelMese('2026-08', dati);
    expect(serie).toHaveLength(31);
    expect(serie[0].giorno).toBe(1);
    expect(serie[30].giorno).toBe(31);
    // Il 2 agosto non è successo niente, ma il punto c'è: è quello che tiene onesta la pendenza.
    expect(serie[1]).toEqual(expect.objectContaining({ giorno: 2, ricaviCents: 0 }));
  });

  it('somma gli incassi dello stesso giorno', () => {
    const serie = serieDelMese('2026-08', dati);
    expect(serie[2].ricaviCents).toBe(euro(150));
  });

  it('il cumulato cresce e si azzera col mese', () => {
    const serie = serieDelMese('2026-08', dati);
    expect(serie[0].ricaviCumulatiCents).toBe(euro(10));
    expect(serie[2].ricaviCumulatiCents).toBe(euro(160));
    expect(serie[9].ricaviCumulatiCents).toBe(euro(360));
    // L'ultimo giorno vale il totale del mese: niente si porta dietro il mese prima.
    expect(serie[30].ricaviCumulatiCents).toBe(euro(360));
  });

  /** L'incasso di mezzanotte e mezza del 1° agosto è di AGOSTO: il resto è il difetto del fuso. */
  it('l\'incasso di mezzanotte finisce nel giorno italiano', () => {
    expect(serieDelMese('2026-08', dati)[0].ricaviCents).toBe(euro(10));
    // E quello delle 23:30 del 31 luglio resta a luglio, dove l'ha messo lei.
    expect(serieDelMese('2026-07', dati)[30].ricaviCents).toBe(euro(999));
  });

  it('le nuove clienti si contano per giorno, e in cumulata', () => {
    const serie = serieDelMese('2026-08', dati);
    expect(serie[2].nuoveClienti).toBe(2);
    expect(serie[19].nuoveClienti).toBe(1);
    expect(serie[30].nuoveClientiCumulate).toBe(3);
  });

  it('un mese senza niente resta una serie piena di zeri, non una serie vuota', () => {
    const serie = serieDelMese('2026-06', dati);
    expect(serie).toHaveLength(30);
    expect(serie.every((p) => p.ricaviCents === 0)).toBe(true);
  });
});

describe('confrontoAllaGiornata', () => {
  const agosto = serieDelMese('2026-08', {
    pagamenti: [
      { createdAt: italiana('2026-08-02'), amountCents: euro(100) },
      { createdAt: italiana('2026-08-07'), amountCents: euro(100) },
      { createdAt: italiana('2026-08-25'), amountCents: euro(500) },
    ],
    clienti: [{ createdAt: italiana('2026-08-02') }],
  });
  const luglio = serieDelMese('2026-07', {
    pagamenti: [
      { createdAt: italiana('2026-07-05'), amountCents: euro(100) },
      { createdAt: italiana('2026-07-28'), amountCents: euro(900) },
    ],
    clienti: [{ createdAt: italiana('2026-07-05') }, { createdAt: italiana('2026-07-06') }],
  });

  /**
   * IL NUMERO CHE SERVE. All'8 agosto abbiamo 200 €, e a luglio allo stesso giorno erano 100:
   * stiamo andando meglio. Confrontando i TOTALI (200 contro 1000) sembrerebbe un disastro — ed è
   * il confronto che la pagina faceva prima, un mese a metà contro un mese intero.
   */
  it('confronta il cumulato allo stesso giorno, non i totali', () => {
    const c = confrontoAllaGiornata(agosto, luglio, 8);
    expect(c.ricaviCents).toBe(euro(200));
    expect(c.ricaviPrecedenteCents).toBe(euro(100));
    expect(c.variazionePct).toBe(100);
    expect(c.nuoveClienti).toBe(1);
    expect(c.nuoveClientiPrecedente).toBe(2);
  });

  it('a mese finito si confrontano i mesi interi', () => {
    const c = confrontoAllaGiornata(agosto, luglio, 31);
    expect(c.ricaviCents).toBe(euro(700));
    expect(c.ricaviPrecedenteCents).toBe(euro(1000));
    expect(c.variazionePct).toBe(-30);
  });

  /** Il 31 marzo non esiste ad aprile: si prende l'ultimo giorno che il mese prima ha. */
  it('un mese più corto non fa sparire il confronto', () => {
    const marzo = serieDelMese('2026-03', { pagamenti: [{ createdAt: italiana('2026-03-15'), amountCents: euro(80) }], clienti: [] });
    const febbraio = serieDelMese('2026-02', { pagamenti: [{ createdAt: italiana('2026-02-20'), amountCents: euro(40) }], clienti: [] });
    const c = confrontoAllaGiornata(marzo, febbraio, 31);
    expect(c.ricaviCents).toBe(euro(80));
    expect(c.ricaviPrecedenteCents).toBe(euro(40));
  });

  /** Zero non si divide: la percentuale è `null` e la pagina scrive «primo mese», non «+∞%». */
  it('col mese prima a zero la variazione non si inventa', () => {
    const vuoto = serieDelMese('2026-07', { pagamenti: [], clienti: [] });
    expect(confrontoAllaGiornata(agosto, vuoto, 10).variazionePct).toBeNull();
  });
});
