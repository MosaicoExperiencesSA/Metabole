/**
 * LE REGOLE DELLA PAGINA «LAVORI».
 *
 * I due test che contano sono quello sulla **spunta tolta** e quello su `undefined` contro stringa
 * vuota: sono i due modi in cui questa pagina può diventare bugiarda, e una lista bugiarda smette di
 * essere guardata — che è l'unico modo in cui può fallire.
 */
import { CATEGORIA_DEFAULT, dataDiNascita, datiRisposta, datiSpunta, MSG_PRIORITA, normalizzaLavoro, normalizzaPriorita, ordinaLavori, testoPerClaude } from './lavoro';

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

describe('la priorità — la dà Simone, e non è il rosso', () => {
  it('le tre parole, spazi e maiuscole compresi', () => {
    expect(normalizzaPriorita('alta')).toBe('alta');
    expect(normalizzaPriorita(' Bassa ')).toBe('bassa');
    expect(normalizzaPriorita('NEUTRA')).toBe('neutra');
  });

  /**
   * ⚠️ UN VALORE CHE NON CONOSCIAMO È UN ERRORE, NON UNA NEUTRA.
   *
   * Il valore arriva dalla nostra pagina. Se un giorno arrivasse «media» o «Alta » con uno spazio di
   * troppo, tornando in silenzio a «neutra» la voce che Simone aveva messo in cima scivolerebbe in
   * mezzo al mucchio — e lui lo scoprirebbe non trovandola più, che è il modo peggiore.
   */
  it('⚠️ una parola che non è delle tre non diventa «neutra»: è un errore', () => {
    expect(() => normalizzaPriorita('media')).toThrow(MSG_PRIORITA);
    expect(() => normalizzaPriorita('')).toThrow(MSG_PRIORITA);
    expect(() => normalizzaPriorita(undefined)).toThrow(MSG_PRIORITA);
    expect(() => normalizzaPriorita(2)).toThrow(MSG_PRIORITA);
  });

  it('dalla pagina arriva insieme al resto', () => {
    expect(normalizzaLavoro({ priorita: 'alta' }, false)).toEqual({ priorita: 'alta' });
  });

  /** ⚠️ Non mandarla non vuol dire azzerarla: salvare il titolo non deve toccare la priorità. */
  it('⚠️ chi non la manda non la cambia', () => {
    expect(normalizzaLavoro({ titolo: 'Una voce qualsiasi' }, false)).toEqual({ titolo: 'Una voce qualsiasi' });
  });
});

describe('quando è nato il punto — e i due modi di rispondere', () => {
  const NASCITA = new Date('2026-08-19T10:07:00Z');
  const CARICAMENTO = new Date('2026-08-13T18:00:00Z');

  it('se la data di nascita c\'è, è quella, ed è certa', () => {
    expect(dataDiNascita({ nataIl: NASCITA, createdAt: CARICAMENTO })).toEqual({ quando: NASCITA, certa: true });
  });

  /**
   * ⚠️ IL CASO CHE VALE IL CAMPO. Le voci del file entrano tutte insieme al clic su «Aggiorna dal
   * rilascio»: `createdAt` le fa risultare nate nello stesso minuto, anche quelle scritte due
   * settimane prima. Si può ancora mostrare — «in elenco dal» è un fatto vero — ma **non spacciata
   * per la data di nascita**: una data falsa si legge come un fatto e non si può controllare.
   */
  it('⚠️ senza, resta `createdAt` ma dichiarato NON certo', () => {
    expect(dataDiNascita({ createdAt: CARICAMENTO })).toEqual({ quando: CARICAMENTO, certa: false });
  });

  it('e se non c\'è né l\'una né l\'altra non si inventa niente', () => {
    expect(dataDiNascita({})).toBeNull();
    expect(dataDiNascita({ nataIl: null, createdAt: null })).toBeNull();
  });
});

describe('l\'ordine con la priorità', () => {
  const r = (id: string, priorita: string | null, fatto = false) => ({ id, priorita, fatto, fattoIl: null });

  it('alta in cima, bassa in fondo', () => {
    expect(ordinaLavori([r('a', 'bassa'), r('b', 'alta'), r('c', 'neutra')]).map((x) => x.id)).toEqual(['b', 'c', 'a']);
  });

  /** Una voce senza priorità è una voce su cui nessuno si è pronunciato: sta con le neutre. */
  it('chi non ce l\'ha vale neutra', () => {
    expect(ordinaLavori([r('a', 'bassa'), r('b', null), r('c', 'alta')]).map((x) => x.id)).toEqual(['c', 'b', 'a']);
  });

  /**
   * ⚠️ A PARITÀ DI PRIORITÀ L'ORDINE NON SI TOCCA. Un secondo criterio inventato qui farebbe muovere
   * le righe sotto gli occhi di chi le sta guardando, senza che nessuno l'abbia chiesto.
   */
  it('⚠️ a parità di priorità resta l\'ordine che ha mandato il server', () => {
    expect(ordinaLavori([r('a', 'neutra'), r('b', 'neutra'), r('c', 'neutra')]).map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });

  /** ⚠️ E le fatte restano in fondo: la priorità ordina il lavoro, non lo storico. */
  it('⚠️ una fatta con priorità alta non torna in cima', () => {
    const fatta = { id: 'z', priorita: 'alta', fatto: true, fattoIl: new Date('2026-08-13T09:00:00Z') };
    expect(ordinaLavori([fatta, r('a', 'bassa')]).map((x) => x.id)).toEqual(['a', 'z']);
  });
});

describe('la risposta', () => {
  it('scritta, porta chi e quando', () => {
    expect(datiRisposta('  Nocanty: togliere fave e legumi.  ', 's-simone', ADESSO)).toEqual({
      risposta: 'Nocanty: togliere fave e legumi.',
      rispostaIl: ADESSO,
      rispostaDaId: 's-simone',
    });
  });

  it('⚠️ svuotata, azzera anche chi e quando', () => {
    // Una risposta cancellata che lascia dietro «risposto da Simone il 13/8» racconta che qualcuno
    // ha risposto, quando non c'è più niente.
    expect(datiRisposta('   ', 's-simone', ADESSO)).toEqual({ risposta: null, rispostaIl: null, rispostaDaId: null });
    expect(datiRisposta(undefined, 's-simone', ADESSO).risposta).toBeNull();
  });
});

describe('il testo da incollare in chat', () => {
  const righe = [
    { titolo: 'Solfiti', dettaglio: 'Serve l\'elenco', categoria: 'Aspetta Nocanty', blocca: true, fatto: false,
      risposta: 'Vino, aceto, frutta essiccata.', rispostaIl: ADESSO, rispostaDa: { displayName: 'Lucia' } },
    { titolo: 'Scala dei passi', dettaglio: null, categoria: 'Aspetta Nocanty', blocca: false, fatto: false },
    { titolo: 'Una cosa già fatta', dettaglio: null, categoria: 'Manutenzione', blocca: false, fatto: true },
  ];

  it('⚠️ le voci FATTE non ci sono: lo storico annegherebbe quelle che contano', () => {
    const t = testoPerClaude(righe);
    expect(t).not.toContain('Una cosa già fatta');
    expect(t).toContain('2 aperte, 1 con una risposta');
  });

  it('⚠️ i blocchi vengono PRIMA, dentro il loro gruppo', () => {
    const t = testoPerClaude([righe[1], righe[0]]);
    expect(t.indexOf('Solfiti')).toBeLessThan(t.indexOf('Scala dei passi'));
  });

  it('la risposta esce firmata con data e nome', () => {
    // La data è `giornoLocale` (anno-mese-giorno, nel fuso dell'azienda) e non una formattazione
    // nuova: un secondo modo di scrivere le date è come si ricasca nei tre test di stamattina.
    expect(testoPerClaude(righe)).toContain('RISPOSTA (2026-08-13, Lucia): Vino, aceto, frutta essiccata.');
  });

  it('una voce senza risposta non stampa una riga vuota', () => {
    expect(testoPerClaude([righe[1]])).not.toContain('RISPOSTA');
  });
});
