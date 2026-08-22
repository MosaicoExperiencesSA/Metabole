import {
  codaInRitardo,
  eInCodaPerStato,
  STATI_CHE_EROGANO,
  STATI_CON_UN_PIANO,
  STATI_GIA_COMPRATO,
  STATI_QUALCOSA_IN_BALLO,
  STATI_VIVI,
  statoPerGiornoDiInizio,
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

/**
 * ⛔ **QUANDO LA DATA D'INIZIO È UN GIORNO E NON UN ISTANTE** — 23/8.
 *
 * `statoPerInizio` confronta istanti, ed è giusto così (vedi il gruppo qui sopra). Ma quattro dei
 * cinque punti che scrivono non le passavano un istante: le passavano un **giorno**, nella forma in
 * cui questo progetto scrive i giorni — `toDateOnly`, cioè la mezzanotte **UTC** del giorno di Roma.
 * Che è **le 02:00 italiane**.
 *
 * ⛔ Fra la mezzanotte e le due, «comincio oggi» risultava «nel futuro» e il piano nasceva `queued`:
 * la cliente non riceveva i menu fino alla passata notturna successiva, cioè **un giorno intero**
 * dopo. È il difetto che la voce 258 dichiarava chiuso, sopravvissuto nelle due ore in cui il giorno
 * di Roma e quello UTC non coincidono — la porta era una sola, ma le si passava la cosa sbagliata.
 *
 * ⚠️ Le prove qui sotto **fermano l'ora scrivendola**: passano `oggi` per argomento. Un test che
 * dipende dall'ora in cui gira è verde 22 ore su 24 — ed è esattamente il modo in cui questo difetto
 * è vissuto per giorni senza che nessuno lo vedesse.
 */
describe('statoPerGiornoDiInizio — il giorno, non l\'istante', () => {
  /** 00:30 del 23 agosto a Roma. Per UTC è ancora il 22. */
  const NOTTE = new Date('2026-08-22T22:30:00.000Z');
  /** Come lo scrive `toDateOnly`: il giorno di Roma, salvato a mezzanotte UTC. */
  const giornoDi = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

  it('⛔ alle 00:30, «comincio OGGI» fa partire il piano ADESSO', () => {
    expect(statoPerGiornoDiInizio(giornoDi('2026-08-23'), NOTTE)).toBe('active');
    // ⚠️ E la prova che il difetto era proprio qui: la vecchia porta risponde ancora «in coda».
    expect(statoPerInizio(giornoDi('2026-08-23'), NOTTE)).toBe('queued');
  });

  it('⛔ mentre «comincio DOMANI» resta in coda, alla stessa ora', () => {
    expect(statoPerGiornoDiInizio(giornoDi('2026-08-24'), NOTTE)).toBe('queued');
  });

  it('⚠️ e di giorno le due porte dicono la stessa cosa (era il motivo per cui non si vedeva)', () => {
    const MEZZOGIORNO = new Date('2026-08-23T10:00:00.000Z');
    for (const g of ['2026-08-22', '2026-08-23', '2026-08-24']) {
      expect(statoPerGiornoDiInizio(giornoDi(g), MEZZOGIORNO)).toBe(statoPerInizio(giornoDi(g), MEZZOGIORNO));
    }
  });

  it('⚠️ un giorno passato è attivo', () => {
    expect(statoPerGiornoDiInizio(giornoDi('2026-08-01'), NOTTE)).toBe('active');
  });

  /** ⚠️ Stessa regola dell'altra porta: nessuna data vuol dire «già cominciato». */
  it('⚠️ senza data d\'inizio è attivo', () => {
    expect(statoPerGiornoDiInizio(null, NOTTE)).toBe('active');
    expect(statoPerGiornoDiInizio(undefined, NOTTE)).toBe('active');
  });

  /**
   * ⛔ **E d'inverno lo scarto è di UN'ORA, non di due: il conto NON è una sottrazione fissa.**
   * `istanteDiPartenza` chiede al fuso, quindi attraversa il cambio dell'ora legale senza saperlo.
   *
   * ⚠️ **Le 22:30 UTC del 14 gennaio sono il caso che discrimina**, e la prima stesura di questo
   * test non le usava: prendeva le 23:30, che stanno oltre **tutte e due** le soglie (−1h = 23:00Z,
   * −2h = 22:00Z) e quindi non distinguono niente. ⛔ Verificato: con una costante `−2h` scritta a
   * mano al posto della domanda al fuso, quella versione restava verde — cioè il test che dichiara
   * di vietare la scorciatoia la lasciava passare. L'ha trovato la revisione, non la suite.
   *
   * A 22:30Z a Roma sono le **23:30 del 14**: il 15 non è ancora cominciato, e chi sottrae due ore
   * risponderebbe di sì.
   */
  it('⛔ in ora solare il 15 comincia alle 23:00Z del 14, non alle 22:00Z', () => {
    expect(statoPerGiornoDiInizio(giornoDi('2027-01-15'), new Date('2027-01-14T22:30:00.000Z'))).toBe('queued');
    expect(statoPerGiornoDiInizio(giornoDi('2027-01-15'), new Date('2027-01-14T23:30:00.000Z'))).toBe('active');
  });

  /** ⚠️ E d'estate il confine è alle 22:00Z, un'ora prima: le due stagioni non si somigliano. */
  it('⚠️ mentre d\'estate il 23 comincia alle 22:00Z del 22', () => {
    expect(statoPerGiornoDiInizio(giornoDi('2026-08-23'), new Date('2026-08-22T21:30:00.000Z'))).toBe('queued');
    expect(statoPerGiornoDiInizio(giornoDi('2026-08-23'), new Date('2026-08-22T22:30:00.000Z'))).toBe('active');
  });

  /**
   * ⛔ **UN VALORE CON DENTRO UN'ORA NON È UN GIORNO, E NON SI FINGE CHE LO SIA.**
   *
   * Due dei quattro chiamanti prendono la data da un DTO `@IsDateString`, che accetta anche un ISO
   * con l'orario; un terzo la legge da `planStartDate`, che nel cammino della coda contiene la
   * **scadenza del piano in corso**, ora compresa. ⛔ La prima stesura traduceva tutto come se fosse
   * un giorno, e su un valore così anticipava **fino a 24 ore**: un piano scritto `active` con la
   * partenza nel futuro — la forma ambigua che la voce 258 esiste per togliere di mezzo — e, nel
   * giorno del passaggio di consegne, due piani che erogano insieme.
   *
   * ⚠️ Su un istante la risposta giusta è quella di sempre, e infatti qui le due porte coincidono.
   */
  it('⛔ un valore con l\'ora dentro si confronta come un ISTANTE, non come un giorno', () => {
    const conOra = new Date('2026-08-23T15:00:00.000Z');
    const mezzogiorno = new Date('2026-08-23T10:00:00.000Z');
    expect(statoPerGiornoDiInizio(conOra, mezzogiorno)).toBe('queued');
    expect(statoPerGiornoDiInizio(conOra, mezzogiorno)).toBe(statoPerInizio(conOra, mezzogiorno));
  });

  it('⚠️ e passata quell\'ora è attivo, come per `statoPerInizio`', () => {
    const conOra = new Date('2026-08-23T15:00:00.000Z');
    const sera = new Date('2026-08-23T18:00:00.000Z');
    expect(statoPerGiornoDiInizio(conOra, sera)).toBe('active');
  });

  /**
   * ⚠️ **Una data illeggibile non fa cadere il servizio.** `Intl` lancia su un `Invalid Date`: la
   * prima stesura passava di lì e trasformava in un 500 un caso che prima rendeva `'active'`. Oggi
   * nessun chiamante ci arriva — validano tutti prima — ma un chiamante nuovo non deve scoprirlo
   * in produzione.
   */
  it('⚠️ una data non valida non lancia: si comporta come prima', () => {
    expect(statoPerGiornoDiInizio(new Date('non-una-data'), NOTTE)).toBe('active');
  });
});
