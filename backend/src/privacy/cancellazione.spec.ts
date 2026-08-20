/**
 * REVOCA DEL CONSENSO — la parte che si può verificare senza cancellare niente.
 *
 * Qui i test non proteggono un calcolo: proteggono delle **promesse**. Il conto dei giorni è quello
 * che le scriviamo nella mail; la parola di conferma è l'unico attrito prima di un'operazione
 * irreversibile; e i testi sono il posto dove un errore di una parola diventa una persona convinta
 * di aver fermato una cancellazione che invece va avanti.
 */

import {
  COSA_RESTA,
  COSA_SI_CANCELLA,
  GIORNI_ATTESA,
  PAROLA_CONFERMA,
  confermaValida,
  dataCancellazione,
  eIlGiornoPrima,
  eScaduta,
  giorniRimanenti,
  mailFatta,
  mailImmediata,
  mailSospesa,
  mailStaff,
  mailUltimoGiorno,
  testoPopup,
} from './cancellazione';

const g = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('la parola di conferma', () => {
  it('accetta la parola giusta, anche scritta male di maiuscole e spazi', () => {
    // Chi scrive «elimina» ha capito benissimo: rifiutarla per una minuscola è una crudeltà
    // burocratica in un momento delicato.
    expect(confermaValida('ELIMINA')).toBe(true);
    expect(confermaValida('elimina')).toBe(true);
    expect(confermaValida('  Elimina  ')).toBe(true);
  });

  /**
   * Deve essere QUELLA parola e nient'altro: è l'unico attrito prima di un'operazione
   * irreversibile. Una frase che la contiene non è una conferma — è una frase.
   */
  it.each(['', ' ', 'si', 'confermo', 'elimina il mio account', 'ELIMINAMI', 'cancella'])(
    'rifiuta «%s»',
    (testo) => {
      expect(confermaValida(testo)).toBe(false);
    },
  );

  it('rifiuta anche null e undefined senza esplodere', () => {
    expect(confermaValida(null)).toBe(false);
    expect(confermaValida(undefined)).toBe(false);
  });
});

describe('il termine dei 30 giorni', () => {
  it('la data è 30 giorni dopo la richiesta, a mezzanotte', () => {
    expect(dataCancellazione(new Date('2026-08-10T15:42:00.000Z')).toISOString()).toBe('2026-09-09T00:00:00.000Z');
  });

  /**
   * Il numero di giorni è un parametro, ma la data si scrive UNA volta e non si ricalcola mai: se
   * domani cambiassimo la soglia, chi ha già revocato non deve vedersi spostare il termine. Quello
   * che le abbiamo scritto nella mail è un impegno preso.
   */
  it('un\'altra soglia produce un\'altra data, ma per le richieste nuove', () => {
    expect(dataCancellazione(g('2026-08-10'), 7).toISOString().slice(0, 10)).toBe('2026-08-17');
    expect(GIORNI_ATTESA).toBe(30);
  });

  it('i giorni rimanenti si contano per giorni di calendario, non a ore', () => {
    // Scadenza il 9 settembre: a mezzogiorno dell'8 manca ancora un giorno, per tutto il giorno.
    expect(giorniRimanenti(g('2026-09-09'), new Date('2026-09-08T12:00:00.000Z'))).toBe(1);
    expect(giorniRimanenti(g('2026-09-09'), new Date('2026-09-08T20:00:00.000Z'))).toBe(1);
    expect(giorniRimanenti(g('2026-09-09'), new Date('2026-09-09T12:00:00.000Z'))).toBe(0);
  });

  it('⚠️ il giorno è quello di ROMA: all\'una di notte del 9 il termine è oggi, non domani', () => {
    /**
     * Il fixture di prima era `2026-09-08T23:00:00Z` con scritto «l'8 alle 23:00 manca un giorno»:
     * ma alle 23:00 UTC dell'8 in Italia è **l'una di notte del 9**. Il test misurava il giorno UTC
     * e chiamava «l'8» un istante che per la cliente è il 9 — cioè certificava il difetto.
     */
    expect(giorniRimanenti(g('2026-09-09'), new Date('2026-09-09T00:30:00+02:00'))).toBe(0);
    // ...e alle 23:50 di Roma dell'8 manca ancora un giorno, come deve essere.
    expect(giorniRimanenti(g('2026-09-09'), new Date('2026-09-08T23:50:00+02:00'))).toBe(1);
  });

  it('non diventano mai negativi', () => {
    expect(giorniRimanenti(g('2026-09-09'), g('2026-10-01'))).toBe(0);
  });

  it('«manca un giorno» è vero solo il giorno prima', () => {
    expect(eIlGiornoPrima(g('2026-09-09'), g('2026-09-08'))).toBe(true);
    expect(eIlGiornoPrima(g('2026-09-09'), g('2026-09-07'))).toBe(false);
    expect(eIlGiornoPrima(g('2026-09-09'), g('2026-09-09'))).toBe(false);
  });

  it('scaduta vuol dire da oggi in poi, non da domani', () => {
    expect(eScaduta(g('2026-09-09'), g('2026-09-08'))).toBe(false);
    expect(eScaduta(g('2026-09-09'), g('2026-09-09'))).toBe(true);
    expect(eScaduta(g('2026-09-09'), g('2026-09-20'))).toBe(true);
  });
});

/**
 * LE FATTURE. Decisione del 10/8: il distinguo si dice nel popup, nelle mail **e** in una pagina
 * dedicata. «Cancelliamo tutto» detto e poi non fatto è peggio del distinguo, ed è il genere di cosa
 * che si scopre nel momento sbagliato — quando qualcuno chiede conto.
 */
describe('le fatture si dicono in tutti e tre i posti', () => {
  it('nel popup, prima che scriva ELIMINA', () => {
    const p = testoPopup();
    expect(p.corpo).toContain(`${GIORNI_ATTESA} giorni`);
    expect(p.fatture).toMatch(/fatture/i);
    expect(p.fatture).toMatch(/dieci anni/i);
    // E si dice anche del rinnovo, che è la seconda decisione: si ferma il rinnovo, non il servizio.
    expect(p.fatture).toMatch(/rinnovo/i);
    expect(p.richiesta).toContain(PAROLA_CONFERMA);
  });

  it('nella prima mail e in quella dell\'ultimo giorno', () => {
    const link = 'https://app.metabole.eu/privacy/sospendi?token=abc';
    const info = 'https://app.metabole.eu/privacy/cancellazione';
    for (const m of [mailImmediata('Giulia', g('2026-09-09'), link, info), mailUltimoGiorno('Giulia', g('2026-09-09'), link, info)]) {
      expect(m.html).toMatch(/fatture/i);
      expect(m.html).toContain(info);
      // Il pulsante che ferma tutto c'è in entrambe: è l'unica strada che ha.
      expect(m.html).toContain(link);
      expect(m.html).toMatch(/Sospendi l'eliminazione/);
    }
  });

  it('e nella pagina, con il perché accanto a ogni voce', () => {
    expect(COSA_SI_CANCELLA.length).toBeGreaterThan(4);
    expect(COSA_RESTA.some((r) => /fattur/i.test(r.cosa))).toBe(true);
    // Il «perché» non è decorativo: un elenco di cose che teniamo senza la ragione somiglia a una
    // scusa. Ognuna deve averlo.
    expect(COSA_RESTA.every((r) => r.perche.trim().length > 20)).toBe(true);
  });
});

describe('le mail dicono la data giusta e parlano alla persona giusta', () => {
  const link = 'https://x/sospendi?token=t';
  const info = 'https://x/privacy';

  it('la prima mail nomina la data di cancellazione a parole', () => {
    const m = mailImmediata('Giulia', g('2026-09-09'), link, info);
    expect(m.oggetto).toContain('9 settembre 2026');
    expect(m.html).toContain('9 settembre 2026');
    expect(m.html).toContain('Giulia');
  });

  it('senza il nome la frase resta corretta', () => {
    expect(mailImmediata(null, g('2026-09-09'), link, info).html).toContain('Ciao,');
  });

  it('l\'ultima mail dice che è l\'ultima', () => {
    const m = mailUltimoGiorno('Giulia', g('2026-09-09'), link, info);
    expect(m.oggetto).toMatch(/ultimo avviso/i);
    expect(m.html).toMatch(/ultimo messaggio/i);
  });

  /**
   * LA DECISIONE PIÙ IMPORTANTE DEL 10/8: solo la cliente può fermare il termine. La mail allo
   * staff **non** deve contenere il pulsante — se ci fosse, quella decisione sarebbe scritta nel
   * codice e smentita da un'email.
   */
  it('la copia allo staff non ha il pulsante, e spiega perché', () => {
    const m = mailStaff('Giulia Rossi', 'giulia@x.it', g('2026-09-09'), false);
    expect(m.html).not.toContain(link);
    expect(m.html).not.toMatch(/<a[^>]*sospendi/i);
    expect(m.html).toMatch(/solo nella mail/i);
    expect(m.html).toContain('9 settembre 2026');
    expect(m.html).toContain('giulia@x.it');
  });

  it('all\'ultimo giorno anche l\'oggetto per lo staff cambia', () => {
    expect(mailStaff('Giulia Rossi', 'g@x.it', g('2026-09-09'), true).oggetto).toMatch(/Domani/);
  });

  /**
   * Quando ferma il termine, si dice anche ciò che NON è tornato da sé: il rinnovo. È la
   * contropartita onesta della scelta di disdirlo — rimetterlo in piedi da soli vorrebbe dire
   * riabbonare qualcuno senza chiederglielo.
   */
  it('la mail di sospensione è chiara su cosa NON torna da sé', () => {
    const m = mailSospesa('Giulia');
    expect(m.html).toMatch(/consenso è di nuovo attivo/i);
    expect(m.html).toMatch(/rinnovo/i);
    expect(m.html).toMatch(/non ti addebitiamo/i);
  });

  it('l\'ultima mail, quella dopo la cancellazione, non promette niente che non sia vero', () => {
    const m = mailFatta('Giulia');
    expect(m.html).toMatch(/cancellat/i);
    expect(m.html).toMatch(/fatture/i);
    // Dice anche che ricominciare vuol dire ricominciare: di lei non abbiamo tenuto niente.
    expect(m.html).toMatch(/da zero|rifare la registrazione/i);
  });
});
