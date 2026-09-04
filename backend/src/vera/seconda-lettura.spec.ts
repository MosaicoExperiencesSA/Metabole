import { leggiMetodo } from './metodo-dettato';
import { capisci, daScartare } from './capisci';
import { parolePiene, riscritturaAccettabile, secondaLettura, secondaLetturaMetodo } from './seconda-lettura';

/**
 * La seconda lettura di Vera (decisa da Simone il 17/8). Il modello TRADUCE, `capisci` DECIDE.
 *
 * ⚠️ La maggior parte di questi test guarda la GUARDIA, non la traduzione: il valore di questa
 * consegna non è che il modello capisca di più, è che non possa aggiungere niente a nome della
 * nutrizionista. Il modello qui è finto — quello che si collauda è cosa succede alla sua risposta.
 */

/** Un modello che risponde quello che gli si dice di rispondere. */
const modelloCheDice = (frase: unknown) => jest.fn().mockResolvedValue({ frase });

const deps = (chiediAlModello: jest.Mock, avvisa?: jest.Mock) => ({
  chiediAlModello,
  capisci,
  daScartare,
  avvisa,
});

describe('riscritturaAccettabile — il modello può riordinare, non aggiungere', () => {
  it('⚠️ un alimento comparso dal nulla fa buttare la riscrittura', () => {
    // È il caso che la nota chiama «una riscrittura plausibile ma sbagliata», e il più pericoloso:
    // la frase resta giusta a leggerla, e in fondo c'è una restrizione che nessuno ha chiesto.
    const esito = riscritturaAccettabile('a Giulia togli il pesce', 'a Giulia niente pesce e crostacei');
    expect(esito.ok).toBe(false);
    expect(esito.perche).toContain('crostacei');
  });

  it('⚠️ un NOME comparso dal nulla fa buttare la riscrittura', () => {
    // Scrivere una regola sul piatto della persona sbagliata è il danno peggiore di tutti.
    expect(riscritturaAccettabile('togli i ceci', 'a Jolanda niente ceci').ok).toBe(false);
  });

  it('⚠️ un NUMERO comparso dal nulla fa buttare la riscrittura', () => {
    expect(riscritturaAccettabile('riduci le calorie a Giulia', 'riduci le calorie del 30% a Giulia').ok).toBe(false);
  });

  it('un refuso corretto passa: si confronta per radice', () => {
    // «sostitusci» → «sostituisci» è esattamente la rottura del 17/8 alle 13:41.
    const esito = riscritturaAccettabile(
      'a jolanda sostitusci ceci con fagioli',
      'a Jolanda sostituisci i ceci con i fagioli',
    );
    expect(esito.ok).toBe(true);
    expect(esito.frase).toBe('a Jolanda sostituisci i ceci con i fagioli');
  });

  it('le parole della FORMA si possono aggiungere: sono un elenco chiuso', () => {
    // «per la jolanda i ceci proprio no» → la forma canonica ha «niente», che lei non ha scritto.
    // Senza questo la riscrittura sarebbe impossibile; con l'elenco chiuso resta sicura.
    expect(riscritturaAccettabile('per la jolanda i ceci proprio no', 'a Jolanda niente ceci').ok).toBe(true);
  });

  it('una riscrittura identica all\'originale non serve a niente', () => {
    expect(riscritturaAccettabile('a Giulia niente tonno', 'a Giulia niente tonno').ok).toBe(false);
    expect(riscritturaAccettabile('a Giulia niente tonno', '  a  Giulia   niente tonno ').ok).toBe(false);
  });

  it('vuota, non-stringa, o troppo lunga: si butta', () => {
    expect(riscritturaAccettabile('x', '').ok).toBe(false);
    expect(riscritturaAccettabile('x', '   ').ok).toBe(false);
    expect(riscritturaAccettabile('x', null).ok).toBe(false);
    expect(riscritturaAccettabile('x', 42).ok).toBe(false);
    expect(riscritturaAccettabile('a Giulia niente tonno', `a Giulia niente tonno ${'e '.repeat(200)}`).ok).toBe(false);
  });
});

describe('secondaLettura — quando si chiama il modello, e quando no', () => {
  it('⚠️ una DOMANDA non arriva nemmeno al modello', async () => {
    // La più insidiosa: «posso togliere il pesce a Giulia?» → «togli il pesce a Giulia». Si ferma
    // prima della chiamata, non dopo: un traduttore non è il posto dove fermare una domanda.
    const modello = modelloCheDice('a Giulia niente pesce');
    expect(await secondaLettura('posso togliere il pesce a Giulia?', deps(modello))).toBeNull();
    expect(modello).not.toHaveBeenCalled();
  });

  it('⚠️ «non togliere il tonno» non arriva al modello: è l\'inversione dell\'istruzione', async () => {
    const modello = modelloCheDice('togli il tonno');
    expect(await secondaLettura('non togliere il tonno a Giulia', deps(modello))).toBeNull();
    expect(modello).not.toHaveBeenCalled();
  });

  it('il modello non risponde (credito, 503, timeout): «non ci arrivo», come oggi', async () => {
    // `generateJson` torna null su ogni errore e non lancia: la seconda lettura è un DI PIÙ, e se
    // manca non manca niente.
    const modello = jest.fn().mockResolvedValue(null);
    expect(await secondaLettura('per la jolanda i ceci proprio no', deps(modello))).toBeNull();
  });

  it('riscrittura buona e capita: torna intento E frase riscritta', async () => {
    const modello = modelloCheDice('a Jolanda niente ceci');
    const esito = await secondaLettura<{ tipo: string }>('per la jolanda i ceci proprio no', deps(modello));
    expect(esito).not.toBeNull();
    // ⚠️ Si restituisce la FRASE, non solo l'intento: è quella che si mostra prima di eseguire,
    // perché «ceci → fagioli» non fa vedere se il modello ha aggiunto qualcosa e la frase sì.
    expect(esito?.riscritta).toBe('a Jolanda niente ceci');
    expect(esito?.intento.tipo).toBe('restrizione');
  });

  it('⚠️ riscrittura che la guardia rifiuta: null, E si scrive perché', async () => {
    // Un rifiuto silenzioso è un mistero: se la guardia scatta spesso va saputo.
    const modello = modelloCheDice('a Giulia niente pesce e crostacei');
    const avvisa = jest.fn();
    expect(await secondaLettura('a Giulia togli il pesce', deps(modello, avvisa))).toBeNull();
    expect(avvisa).toHaveBeenCalledTimes(1);
    expect(avvisa.mock.calls[0][0]).toContain('crostacei');
  });

  it('riscrittura pulita che però `capisci` non riconosce: null, senza inventare', async () => {
    // Il modello ha riordinato senza aggiungere, ma la forma non è fra quelle dichiarate. A decidere
    // resta `capisci`: se non passa da lì non succede niente.
    const modello = modelloCheDice('la jolanda i ceci');
    expect(await secondaLettura('jolanda ceci mah', deps(modello))).toBeNull();
  });

  it('il modello riceve la frase e NIENTE altro: nessun dato di nessuno', async () => {
    const modello = modelloCheDice('a Jolanda niente ceci');
    await secondaLettura('per la jolanda i ceci proprio no', deps(modello));
    const [system, prompt] = modello.mock.calls[0];
    expect(prompt).toContain('per la jolanda i ceci proprio no');
    // Il prompt è la frase e basta: non c'è l'elenco delle clienti, non c'è il catalogo.
    expect(prompt.length).toBeLessThan(200);
    expect(system).toContain('SOLO le parole che ci sono nella frase');
  });

  it('frase vuota: non si chiama niente', async () => {
    const modello = modelloCheDice('qualcosa');
    expect(await secondaLettura('', deps(modello))).toBeNull();
    expect(await secondaLettura('   ', deps(modello))).toBeNull();
    expect(modello).not.toHaveBeenCalled();
  });
});

/**
 * ⛔ **LA SECONDA LETTURA DEL METODO DI COTTURA** — Simone, 4/9: «Vera utilizza una AI giusto?».
 *
 * Le tre proprietà sono le stesse del resto del file, e queste prove servono a tenerle: il modello
 * **riscrive**, a decidere resta il parser deterministico, e la riscrittura **si mostra**.
 */
describe('la seconda lettura del metodo', () => {
  const leggi = (f: string) => leggiMetodo(f);
  const completo = (e: ReturnType<typeof leggiMetodo>) => e.tipo === 'metodo';

  const conModello = (frase: unknown) => ({
    chiediAlModello: jest.fn().mockResolvedValue({ frase }),
    leggi,
    completo,
  });

  it('⛔ una frase che il parser non capisce, riscritta, diventa un metodo', async () => {
    const r = await secondaLetturaMetodo(
      'lo butto in forno finche non e dorato',
      conModello('al forno\nbuttarlo in forno finche non e dorato'),
    );
    expect(r?.esito.tipo).toBe('metodo');
    expect(r?.esito.tipo === 'metodo' && r.esito.metodo.type).toBe('forno');
    /** ⚠️ E la riscrittura torna indietro per essere MOSTRATA. */
    expect(r?.riscritta).toContain('al forno');
  });

  /**
   * ⛔ **GLI A CAPO RESTANO.** Appiattendo la riscrittura su una riga sola il parser non troverebbe
   * più i passaggi, e la seconda lettura sarebbe inutile proprio nel caso per cui esiste.
   */
  it('⛔ la riscrittura resta su più righe', async () => {
    const r = await secondaLetturaMetodo(
      'lo butto in forno finche non e dorato',
      conModello('al forno\nbuttarlo in forno finche non e dorato'),
    );
    expect(r?.riscritta.split('\n')).toHaveLength(2);
  });

  /**
   * ⛔ **LA PRIMA RIGA È LIBERA, I PASSAGGI NO** — corretto il 4/9 dopo una revisione, ed è la
   * differenza fra una funzione che lavora e una che rifiuta quasi sempre.
   *
   * Il prompt **chiede** come prima riga il nome del modo — «piatto freddo», «veloce», «meal prep» —
   * e chi scrive «lo lascio crudo» quelle parole non le ha usate: la guardia dei comandi le
   * bocciava come «parole nuove». La riscrittura giusta veniva buttata in quattro casi su sei.
   *
   * ⚠️ E toglierla da lì non apre un buco: quella riga è guardata da altri due — `leggiMetodo`
   * accetta solo i sei codici, e **il modo lo conferma una persona**.
   */
  it.each([
    ['lo lascio crudo', 'piatto freddo\nlasciarlo crudo', 'piatto_freddo'],
    ['si fa in due minuti', 'veloce\nsi fa in due minuti', 'veloce'],
    ['lo preparo la sera prima', 'meal prep\nprepararlo la sera prima', 'meal_prep'],
  ])('⛔ «%s» adesso passa', async (frase, riscritta, atteso) => {
    const r = await secondaLetturaMetodo(frase, conModello(riscritta));
    expect(r?.esito.tipo === 'metodo' && r.esito.metodo.type).toBe(atteso);
  });

  /**
   * ⚠️ **Ai passaggi si chiede di non riscrivere i verbi**, ed è il motivo per cui il prompt lo dice
   * in maiuscolo: la guardia confronta le **radici**, e «si fa» → «farlo» cambia radice. Una
   * riscrittura fedelissima nel senso veniva buttata come parola nuova.
   *
   * ⚠️ Il verso però è quello sicuro: si perde una riscrittura buona, non se ne accetta una brutta.
   * Quando succede si torna a chiedere, che è il comportamento di sempre.
   */
  it('⚠️ un verbo riscritto nei passaggi fa ancora cadere la riscrittura', async () => {
    const r = await secondaLetturaMetodo('si fa in due minuti', conModello('veloce\nfarlo in due minuti'));
    expect(r).toBeNull();
  });

  /**
   * ⛔ **LA GUARDIA VALE ANCHE QUI: il modello può riordinare, non aggiungere.** Un passaggio
   * inventato finisce nella scheda che una persona legge mentre cucina.
   */
  it('⛔ una riscrittura che aggiunge parole si butta', async () => {
    const r = await secondaLetturaMetodo(
      'lo butto in forno',
      conModello('al forno\nspennellare con olio e rosmarino'),
    );
    expect(r).toBeNull();
  });

  /** ⛔ E i numeri inventati — una temperatura, un tempo — sono la specie peggiore. */
  it('⛔ e una che inventa una temperatura pure', async () => {
    const r = await secondaLetturaMetodo(
      'lo metto in forno finche non e dorato',
      conModello('al forno\nmetterlo in forno a 180 gradi'),
    );
    expect(r).toBeNull();
  });

  /**
   * ⛔ **A decidere resta il PARSER.** Se la riscrittura non è un metodo completo, non si va avanti:
   * il modello non ha voce in capitolo sull'esito, solo sulla forma della frase.
   */
  it('⛔ se la riscrittura non è un metodo completo, non passa', async () => {
    const r = await secondaLetturaMetodo('lo butto in forno', conModello('al forno'));
    expect(r).toBeNull();
  });

  /**
   * ⛔ **E se la prima riga non è un modo, non si va avanti lo stesso** — anche quando i passaggi
   * sono impeccabili. È l'unica cosa che il parser decide qui, e questa prova la tiene: senza,
   * togliere il controllo `completo` sarebbe passato inosservato (l'ha mostrato una prova di
   * mutazione, che era rimasta verde).
   */
  it('⛔ e se la prima riga non nomina un modo, nemmeno', async () => {
    const r = await secondaLetturaMetodo(
      'lo butto in forno finche non e dorato',
      conModello('poi si serve\nbuttarlo in forno finche non e dorato'),
    );
    expect(r).toBeNull();
  });

  /**
   * ⛔ **E la libertà della prima riga NON si estende ai passaggi.** Qui il modo («al forno») non
   * era nella frase — quindi la prima riga passa — ma il passaggio inventa il rosmarino: si butta.
   * È la prova che il confine sta dove deve.
   */
  it('⛔ prima riga libera, ma un passaggio inventato butta tutto lo stesso', async () => {
    const r = await secondaLetturaMetodo(
      'lo lascio crudo',
      conModello('piatto freddo\nlasciarlo crudo con rosmarino'),
    );
    expect(r).toBeNull();
  });

  /** ⚠️ Una riscrittura senza passaggi non è un metodo: la prima riga da sola non basta. */
  it('⚠️ e la sola prima riga non passa', async () => {
    expect(await secondaLetturaMetodo('lo lascio crudo', conModello('piatto freddo'))).toBeNull();
  });

  /** ⚠️ Modello non disponibile: si torna al comportamento di prima, cioè si richiede. */
  it('⚠️ senza modello non succede niente', async () => {
    const r = await secondaLetturaMetodo('lo butto in forno', {
      chiediAlModello: jest.fn().mockResolvedValue(null), leggi, completo,
    });
    expect(r).toBeNull();
  });

  it('⚠️ e una frase vuota non arriva nemmeno al modello', async () => {
    const deps = conModello('al forno\ninfornare');
    expect(await secondaLetturaMetodo('   ', deps)).toBeNull();
    expect(deps.chiediAlModello).not.toHaveBeenCalled();
  });
});

/**
 * ⛔ **PERCHÉ NON ESISTE UNA GUARDIA «NIENTE OMISSIONI»** — scritta e tolta il 4/9, dopo una
 * revisione.
 *
 * Sembrava la cosa che avrebbe reso sicuro passare al modello il testo della ricetta: se nessuna
 * parola può sparire, nessun ingrediente si perde. ⛔ Ma `parolePiene` scarta i token sotto le tre
 * lettere e `radice` confronta i primi quattro caratteri: le due omissioni che contano davvero le
 * passano sotto tutte e due. Queste prove tengono il ricordo — una guardia che promette di vedere
 * le omissioni e non vede proprio quelle gravi è peggio della sua assenza, perché ci si appoggia.
 */
describe('⛔ le omissioni che una guardia per parole non può vedere', () => {
  /** ⛔ «tonno 80 g» → «tonno g»: la grammatura sparita è invisibile a un confronto per parole. */
  it('⛔ una grammatura sparita non è una parola persa', () => {
    expect(parolePiene('tonno 80 g olive 120 g')).not.toContain('80');
  });

  /** ⛔ E due ingredienti con la stessa radice si coprono a vicenda: «pomodorini» sparisce sotto «pomodoro». */
  it('⛔ due ingredienti con la stessa radice si coprono a vicenda', () => {
    const radice = (p: string) => p.slice(0, 4);
    expect(radice('pomodoro')).toBe(radice('pomodorini'));
  });
});
