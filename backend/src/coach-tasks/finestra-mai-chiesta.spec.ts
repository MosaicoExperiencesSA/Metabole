import {
  GIORNI_DI_GRAZIA,
  RIFERIMENTO_UNICO,
  serveChiedereLaFinestra,
  testoFinestraMaiChiesta,
} from './finestra-mai-chiesta';

const ADESSO = new Date('2026-08-21T09:00:00Z');
/** Un profilo nato `giorni` fa. */
const nato = (giorni: number) => new Date(ADESSO.getTime() - giorni * 24 * 60 * 60 * 1000);
const VECCHIA = nato(90);

describe('serveChiedereLaFinestra', () => {
  it('in digiuno, non ha mai scelto, e il suo profilo ha mesi: sì', () => {
    expect(serveChiedereLaFinestra('intermittent_fasting', null, VECCHIA, ADESSO)).toBe(true);
    expect(serveChiedereLaFinestra('intermittent_fasting', undefined, VECCHIA, ADESSO)).toBe(true);
  });

  it('⚠️ ha già scelto: non si ridisturba', () => {
    expect(serveChiedereLaFinestra('intermittent_fasting', nato(10), VECCHIA, ADESSO)).toBe(false);
  });

  it('⚠️ chi non è in digiuno non ha nessuna finestra da scegliere', () => {
    expect(serveChiedereLaFinestra('classic3', null, VECCHIA, ADESSO)).toBe(false);
    expect(serveChiedereLaFinestra('five', null, VECCHIA, ADESSO)).toBe(false);
    expect(serveChiedereLaFinestra(null, null, VECCHIA, ADESSO)).toBe(false);
    expect(serveChiedereLaFinestra(undefined, undefined, VECCHIA, ADESSO)).toBe(false);
  });

  /**
   * ⛔ **LA GRAZIA — il difetto che questa consegna ha quasi introdotto** (21/8).
   *
   * Tolta la domanda dal questionario, «in digiuno + finestra vuota» è diventato vero per **ogni**
   * cliente appena iscritta: l'attività si sarebbe aperta la notte stessa dell'iscrizione, per
   * tutte, con dentro l'istruzione di aprire una tendina cancellata. Un avviso che compare sempre
   * non è un avviso — e la colonna della coach smette di essere letta anche per le righe vere.
   */
  describe('⛔ prima parla l\'app: la grazia', () => {
    it.each([[0], [1], [GIORNI_DI_GRAZIA - 1]])(
      'iscritta %s giorni fa: NON si apre niente, gliela sta chiedendo l\'app',
      (giorni) => {
        expect(serveChiedereLaFinestra('intermittent_fasting', null, nato(giorni), ADESSO)).toBe(false);
      },
    );

    it.each([[GIORNI_DI_GRAZIA], [GIORNI_DI_GRAZIA + 1], [90]])(
      'iscritta %s giorni fa e ancora niente: adesso serve una telefonata',
      (giorni) => {
        expect(serveChiedereLaFinestra('intermittent_fasting', null, nato(giorni), ADESSO)).toBe(true);
      },
    );

    /** ⚠️ «Non lo so» costa meno di «ho indovinato»: senza la data non si fa telefonare nessuno. */
    it.each([[null], [undefined]])('senza la data del profilo (%s) non si chiede', (quando) => {
      expect(serveChiedereLaFinestra('intermittent_fasting', null, quando as never, ADESSO)).toBe(false);
    });
  });
});

describe('testoFinestraMaiChiesta — deve dire anche cosa succede INTANTO', () => {
  it('nel titolo c\'è il nome, perché la coach lo legge in un elenco', () => {
    expect(testoFinestraMaiChiesta('Maria').title).toBe('Chiedi a Maria a che ora mangia nel digiuno');
  });

  it('senza nome resta una frase, non un buco', () => {
    expect(testoFinestraMaiChiesta(null).title).toBe('Chiedi a la cliente a che ora mangia nel digiuno');
    expect(testoFinestraMaiChiesta('  ').title).toContain('la cliente');
  });

  /**
   * ⚠️ È la riga che impedisce alla correzione di diventare il danno: «manca la finestra» letto da
   * solo suona come un guasto, e una coach che chiama allarmata una cliente che sta bene ha fatto
   * più danno del dato mancante.
   */
  it('⚠️ dice che NON è ferma e NON è rotta: il difetto è una domanda mancata', () => {
    const d = testoFinestraMaiChiesta('Maria').description;
    expect(d).toContain('NON è ferma e non è rotta');
    expect(d).toContain('riceve tutti i pasti della sua dieta');
  });

  /**
   * ⛔ **NON MANDARLA DOVE NON C'È PIÙ NIENTE** (21/8). Il testo diceva: «impostala dalla scheda
   * (Modifica → «Pasti che salta»), oppure può sceglierla lei dal Profilo dell'app». Tutte e due
   * quelle schermate sono state cancellate in questa consegna. La coach ci sarebbe andata, non
   * avrebbe trovato niente, e avrebbe chiuso l'attività senza fare la cosa che serve.
   *
   * ⚠️ Un'attività che dice **cosa fare** vale un'attività che dice cosa manca; una che dice cosa
   * fare in un posto che non esiste vale meno di niente, perché brucia anche la fiducia nelle altre.
   */
  it('⛔ dice che NON può impostarlo lei, e dove lo sposta la cliente', () => {
    const d = testoFinestraMaiChiesta('Maria').description;
    expect(d).toContain('Non lo puoi impostare tu');
    expect(d).toContain('orologio');
    expect(d).toContain('segna l\'attività fatta');
  });

  /**
   * ⛔ **«INTANTO» NON È LA STESSA FRASE PER TUTTE** (corretto in revisione, 21/8).
   *
   * L'attività adesso nasce da `fastingSceltoIl`, non da `fastingWindow`: arriva quindi anche a chi
   * una finestra ce l'ha — quella di prima dell'orologio. A lei il testo diceva «riceve tutti i
   * pasti della sua dieta», e con `skip_all_but_dinner` il motore ne salta quattro: **mangia una
   * volta al giorno**. La coach le avrebbe telefonato con in mano l'esatto contrario.
   */
  describe('⛔ chi una finestra ce l\'ha, non riceve «tutti i pasti»', () => {
    const conFinestra = () =>
      testoFinestraMaiChiesta('Maria', 'skip_all_but_dinner', 'Un pasto solo, la sera (OMAD)').description;

    /**
     * ⚠️ La prima stesura di questo test cercava `not.toContain('riceve tutti i pasti')` — e falliva
     * sulla frase **giusta**, perché «NON riceve tutti i pasti» quella sequenza ce l'ha dentro. Si
     * guarda l'affermazione che non deve esserci, non un pezzo di parola.
     */
    it('⛔ non le si dice che il motore non salta niente, perché salta eccome', () => {
      expect(conFinestra()).not.toContain('il motore non salta niente');
      expect(conFinestra()).toContain('NON riceve tutti i pasti');
      expect(conFinestra()).toContain('il motore la sta applicando');
    });

    it('le si dice QUALE finestra le resta addosso, a parole', () => {
      expect(conFinestra()).toContain('Un pasto solo, la sera (OMAD)');
    });

    /** ⚠️ Senza l'etichetta resta il codice: è brutto, ma è meglio di una frase falsa. */
    it('senza etichetta ripiega sul codice invece di tacere', () => {
      const d = testoFinestraMaiChiesta('Maria', 'skip_all_but_dinner', null).description;
      expect(d).toContain('skip_all_but_dinner');
    });

    it('⚠️ e chi non ce l\'ha continua a leggere la frase giusta per lei', () => {
      const d = testoFinestraMaiChiesta('Maria', null, null).description;
      expect(d).toContain('il motore non salta niente e riceve tutti i pasti della sua dieta');
      expect(d).not.toContain('NON riceve tutti i pasti');
    });
  });

  /** ⛔ E non nomina più le due schermate cancellate: è la parte che si dimentica di togliere. */
  it.each([['«Pasti che salta»'], ['Profilo dell\'app'], ['questionario']])(
    '⛔ non manda più a «%s»',
    (sparita) => {
      expect(testoFinestraMaiChiesta('Maria').description).not.toContain(sparita);
    },
  );
});

describe('il riferimento dell\'attività', () => {
  /**
   * ⚠️ La chiave di unicità è `clientId + kind + refId`: se il riferimento fosse la data o l'id del
   * piano, l'attività rinascerebbe — ogni notte, o a ogni rinnovo — su una domanda già fatta.
   */
  it('⚠️ è fisso: la domanda si fa una volta sola', () => {
    expect(RIFERIMENTO_UNICO).toBe('unica');
  });
});
