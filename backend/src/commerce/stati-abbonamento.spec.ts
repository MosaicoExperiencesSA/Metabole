import {
  codaInRitardo,
  eInCodaPerStato,
  STATI_CHE_EROGANO,
  STATI_CON_UN_PIANO,
  STATI_GIA_COMPRATO,
  STATI_QUALCOSA_IN_BALLO,
  STATI_VIVI,
  statoPerInizio,
} from './stati-abbonamento';

const OGGI = new Date('2026-08-18T10:00:00Z');
const g = (iso: string) => new Date(iso);

describe('gli elenchi degli stati', () => {
  it('⚠️ chi eroga NON comprende la coda: un piano che parte fra tre settimane non fa menu oggi', () => {
    expect(STATI_CHE_EROGANO).not.toContain('queued');
    expect(STATI_CHE_EROGANO).toEqual(['active']);
  });

  it('⚠️ «ha un piano» comprende la coda: è un contratto, la cliente ha pagato', () => {
    expect(STATI_CON_UN_PIANO).toContain('queued');
    expect(STATI_CON_UN_PIANO).not.toContain('pending'); // in attesa di pagamento non è un piano
  });

  it('«ha già comprato» esclude gli annullati: un rimborso non è un acquisto', () => {
    expect(STATI_GIA_COMPRATO).not.toContain('cancelled');
    expect(STATI_GIA_COMPRATO).toContain('expired');
  });

  it('«qualcosa in ballo» comprende anche chi non ha ancora pagato', () => {
    expect(STATI_QUALCOSA_IN_BALLO).toContain('pending');
    expect(STATI_QUALCOSA_IN_BALLO).toContain('queued');
  });

  it('i vivi sono tutto tranne annullato e scaduto', () => {
    expect([...STATI_VIVI].sort()).toEqual(['active', 'pending', 'queued']);
  });

  it('⚠️ nessun elenco dimentica `queued` tranne quello dell\'erogazione', () => {
    // È il collaudo che vale per tutto il file: la dimenticanza da temere è per omissione, e
    // l'unica omissione VOLUTA è quella dell'erogazione.
    for (const elenco of [STATI_CON_UN_PIANO, STATI_GIA_COMPRATO, STATI_QUALCOSA_IN_BALLO, STATI_VIVI]) {
      expect(elenco).toContain('queued');
    }
  });
});

describe('eInCodaPerStato', () => {
  it('lo stato nuovo basta da solo', () => {
    expect(eInCodaPerStato({ status: 'queued', startDate: g('2026-09-01') }, OGGI)).toBe(true);
    expect(eInCodaPerStato({ status: 'queued', startDate: null }, OGGI)).toBe(true);
  });

  it('⚠️ ma riconosce anche la forma VECCHIA: `active` con la partenza nel futuro', () => {
    // La migrazione è additiva e non riscrive niente: i piani messi in fila prima di oggi sono
    // ancora `active` con `startDate` nel futuro. Leggere solo lo stato nuovo vorrebbe dire
    // chiudere il difetto per i piani nuovi e lasciarlo aperto proprio su quelli dove è successo.
    expect(eInCodaPerStato({ status: 'active', startDate: g('2026-09-01') }, OGGI)).toBe(true);
  });

  it('un attivo già cominciato non è in coda, e nemmeno uno senza data', () => {
    expect(eInCodaPerStato({ status: 'active', startDate: g('2026-08-01') }, OGGI)).toBe(false);
    expect(eInCodaPerStato({ status: 'active', startDate: null }, OGGI)).toBe(false);
  });

  it('il confronto è per GIORNO: chi parte oggi sta erogando, non è in coda', () => {
    expect(eInCodaPerStato({ status: 'active', startDate: g('2026-08-18T23:00:00Z') }, OGGI)).toBe(false);
  });

  it('scaduti e annullati non sono in coda', () => {
    expect(eInCodaPerStato({ status: 'expired', startDate: g('2026-09-01') }, OGGI)).toBe(false);
    expect(eInCodaPerStato({ status: 'cancelled', startDate: g('2026-09-01') }, OGGI)).toBe(false);
  });
});

describe('codaInRitardo', () => {
  it('⚠️ una coda che avrebbe già dovuto partire si vede', () => {
    // È il lavoro giornaliero di promozione che non ha girato. Chi eroga non deve indovinare.
    expect(codaInRitardo({ status: 'queued', startDate: g('2026-08-17') }, OGGI)).toBe(true);
    expect(codaInRitardo({ status: 'queued', startDate: g('2026-08-18T22:00:00Z') }, OGGI)).toBe(true);
  });

  it('una coda che deve ancora partire non è in ritardo, e un attivo nemmeno', () => {
    expect(codaInRitardo({ status: 'queued', startDate: g('2026-09-01') }, OGGI)).toBe(false);
    expect(codaInRitardo({ status: 'active', startDate: g('2026-08-01') }, OGGI)).toBe(false);
  });

  it('una coda senza data d\'inizio non è in ritardo: non si sa da quando', () => {
    expect(codaInRitardo({ status: 'queued', startDate: null }, OGGI)).toBe(false);
  });
});

/**
 * LA RISPOSTA SOLA ALLA DOMANDA «ATTIVO O IN CODA?» — voce 258, 19/8.
 *
 * Cinque punti scrivono lo stato di un abbonamento: l'approvazione del bonifico, la matita della
 * scheda cliente, l'allineamento dal profilo, la data spostata in chat con Gaia e l'attivazione di
 * «Conosciamoci». Prima decidevano ognuno per sé, e scrivevano tutti `active`.
 */
describe('statoPerInizio', () => {
  const ADESSO = new Date('2026-08-19T10:00:00Z');

  it('chi comincia più avanti nasce in coda', () => {
    expect(statoPerInizio(new Date('2026-08-31T00:00:00Z'), ADESSO)).toBe('queued');
  });

  it('chi comincia oggi (data a mezzanotte) è attivo: la giornata è già cominciata', () => {
    expect(statoPerInizio(new Date('2026-08-19T00:00:00Z'), ADESSO)).toBe('active');
  });

  it('chi è cominciato ieri è attivo', () => {
    expect(statoPerInizio(new Date('2026-08-01T00:00:00Z'), ADESSO)).toBe('active');
  });

  /**
   * ⚠️ Il confronto è sull'ISTANTE e non sul giorno: una coda che parte alla scadenza del piano in
   * corso eredita l'ora di quella scadenza, e per quel che resta della giornata il piano vecchio sta
   * ancora erogando. Con un confronto per giorno i due si sovrapporrebbero per qualche ora — che è
   * lo stato che questa voce serve a togliere di mezzo.
   */
  it('⚠️ la coda che parte oggi alle 18 è ancora in coda alle 10', () => {
    expect(statoPerInizio(new Date('2026-08-19T18:00:00Z'), ADESSO)).toBe('queued');
  });

  /** ⚠️ Senza data d'inizio il piano è attivo: `startDate` nulla vuol dire «già cominciato». */
  it('⚠️ senza data d\'inizio è attivo, come per `staErogando`', () => {
    expect(statoPerInizio(null, ADESSO)).toBe('active');
    expect(statoPerInizio(undefined, ADESSO)).toBe('active');
  });
});
