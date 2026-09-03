import { separaIlQuando, senzaIlQuando } from './coda-di-quando';

describe('separaIlQuando — dove finisce il piatto e comincia il quando', () => {
  it('il caso della voce: «gallette a colazione» è un alimento più un orario', () => {
    expect(separaIlQuando('le gallette a colazione')).toEqual({ nome: 'le gallette', coda: 'a colazione' });
  });

  it.each([
    // i pasti
    ['le gallette a pranzo', 'le gallette'],
    ['la bevanda di soia a merenda', 'la bevanda di soia'],
    ['le gallette per colazione', 'le gallette'],
    ['le gallette come spuntino', 'le gallette'],
    ['le gallette allo spuntino della mattina', 'le gallette'],
    ['le gallette a metà mattina', 'le gallette'],
    ['le gallette al secondo spuntino', 'le gallette'],
    // i momenti e i giorni
    ['lo yogurt greco la mattina', 'lo yogurt greco'],
    ['lo yogurt greco al mattino presto', 'lo yogurt greco'],
    ['il tacchino il sabato', 'il tacchino'],
    ['il tacchino ogni domenica', 'il tacchino'],
    ['il tacchino nel weekend', 'il tacchino'],
    ['il tacchino nei giorni feriali', 'il tacchino'],
    // il quando
    ['le gallette da domani', 'le gallette'],
    ['le gallette per ora', 'le gallette'],
    ['le gallette ogni tanto', 'le gallette'],
    ['il tacchino questa settimana', 'il tacchino'],
    ['il tacchino la settimana prossima', 'il tacchino'],
    ['il tacchino nei prossimi giorni', 'il tacchino'],
    ['il tacchino per un mese', 'il tacchino'],
    ['il tacchino per due settimane', 'il tacchino'],
    // le frequenze: è il modo in cui si scrive una prescrizione
    ['le gallette tutti i giorni', 'le gallette'],
    ['il pane integrale ogni giorno', 'il pane integrale'],
    ['le gallette due volte a settimana', 'le gallette'],
    ['le gallette una volta al giorno', 'le gallette'],
    ['le gallette 3 volte a settimana', 'le gallette'],
    // il per chi
    ['le gallette per tutte', 'le gallette'],
    ['le gallette per tutte le clienti', 'le gallette'],
    // la punteggiatura attaccata non nasconde la coda
    ['le gallette a colazione,', 'le gallette'],
  ])('«%s» → «%s»', (dentro, fuori) => {
    expect(senzaIlQuando(dentro)).toBe(fuori);
  });

  /**
   * ⛔ **LE CODE SI INCATENANO, e il modificatore in mezzo se ne va con loro** — ma solo dopo che
   * una coda è stata tolta davvero. La riga «il sabato e la domenica» nella prima stesura di questo
   * file era nascosta dentro un `.replace(' e la domenica', '')`, cioè un caso misurato e rotto
   * travestito da caso verde. L'ha trovata una revisione avversariale.
   */
  it.each([
    ['le gallette a colazione e a merenda', 'le gallette'],
    ['le gallette a pranzo e a cena', 'le gallette'],
    ['le gallette il sabato e la domenica', 'le gallette'],
    ['le gallette solo a colazione', 'le gallette'],
    ['le gallette soltanto la mattina', 'le gallette'],
    ['le gallette sempre a colazione', 'le gallette'],
  ])('«%s» → «%s»', (dentro, fuori) => {
    expect(senzaIlQuando(dentro)).toBe(fuori);
  });

  /**
   * ⛔ **LA PREPOSIZIONE DECIDE IL SIGNIFICATO, e questa è la famiglia che la prima stesura
   * sbagliava nel verso caro.** «**a** colazione» è un orario; «**da** colazione» è una categoria
   * merceologica, e «zuppa **del** giorno», «arrosto **della** domenica» sono nomi di piatto.
   * Tagliarli non fa un silenzio: fa una regola **più larga di quanto è stato chiesto** — «togli i
   * biscotti da colazione» diventava «togli tutti i biscotti», merenda compresa.
   */
  it.each([
    ['i biscotti da colazione'],
    ['i cereali da colazione'],
    ['le fette biscottate da colazione'],
    ['la zuppa del giorno'],
    ['il pesce del giorno'],
    ['la verdura del giorno'],
    ["l'arrosto della domenica"],
    ['il pollo della domenica'],
    ['la brioche del mattino'],
  ])('⛔ «%s» è un nome di prodotto, non un orario: non si tocca', (nome) => {
    expect(separaIlQuando(nome)).toEqual({ nome, coda: '' });
  });

  /**
   * ⛔ **«PER LA COLAZIONE» È UN PRODOTTO, «PER COLAZIONE» È UN ORARIO** (seconda revisione).
   * L'articolo è la differenza, ed è la stessa famiglia di «da colazione»: la prima stesura
   * ammetteva l'articolo e quindi si mangiava «biscotti per la colazione» — rifacendo con un'altra
   * preposizione il danno che il file dichiarava di aver chiuso.
   */
  it.each([
    ['i biscotti per la colazione'],
    ['i cereali per la colazione'],
    ['la barretta per lo spuntino'],
    ['lo snack per la merenda'],
    ['il piatto pronto per la cena'],
  ])('⛔ «%s» è un nome di prodotto: non si tocca', (nome) => {
    expect(separaIlQuando(nome)).toEqual({ nome, coda: '' });
  });

  it('⚠️ ma senza articolo è un orario, e si toglie', () => {
    expect(senzaIlQuando('i biscotti per colazione')).toBe('i biscotti');
    expect(senzaIlQuando('le gallette allo spuntino')).toBe('le gallette');
  });

  /**
   * ⛔ **UN TAGLIO CHE LASCIA UNA PREPOSIZIONE APPESA NON SI FA AFFATTO** (seconda revisione, ed è
   * il difetto più caro che ha trovato). L'elenco delle code non copre l'italiano intero: «durante
   * la settimana», «di tutti i giorni», «per la sera» hanno una coda riconosciuta e una parola in
   * più davanti. Tagliando, restava «l'insalata **di**» — e `chiaveAlimento('insalata di')` è la
   * stessa di `chiaveAlimento('insalata')`, cioè una regola su **tutta** l'insalata.
   *
   * ⚠️ Rifiutare il taglio riporta la frase al difetto vecchio (la coda dentro al nome); tagliare a
   * metà ne fabbrica uno nuovo e più caro. Si tiene il vecchio.
   */
  it.each([
    ['le gallette durante la settimana'],
    ['le gallette durante il weekend'],
    ['le gallette a partire da lunedi'],
    ['le gallette in questa settimana'],
    ['la tisana per la sera'],
    ['la crema per la notte'],
    ["l'insalata di tutti i giorni"],
    ['il pane di ogni giorno'],
  ])('⛔ «%s»: meglio il difetto vecchio di un nome monco', (pezzo) => {
    expect(separaIlQuando(pezzo)).toEqual({ nome: pezzo, coda: '' });
  });

  /**
   * ⚠️ **Una coda di UNA parola sola esiste**, e senza questa riga alzare il ciclo da `k >= 1` a
   * `k >= 2` non faceva diventare rosso niente — l'ha detto una prova di mutazione.
   */
  it.each([
    ['le gallette domani', 'le gallette'],
    ['le gallette oggi', 'le gallette'],
    ['le gallette subito', 'le gallette'],
    ['le gallette sempre', 'le gallette'],
  ])('«%s» → «%s»: anche una parola sola è una coda', (dentro, fuori) => {
    expect(senzaIlQuando(dentro)).toBe(fuori);
  });

  /**
   * ⚠️ **Il tetto delle parole è quello vero dell'elenco.** Sei era un intervallo morto: una
   * mutazione l'ha abbassato a quattro senza rompere niente. Questa riga tiene fermi i due numeri
   * insieme — se qualcuno aggiunge una coda più lunga, la alza.
   */
  it('⚠️ la coda più lunga dell\'elenco è di quattro parole, e ci sta', () => {
    expect(senzaIlQuando('le gallette per tutte le clienti')).toBe('le gallette');
    expect(senzaIlQuando('le gallette a colazione del mattino')).toBe('le gallette');
    expect(senzaIlQuando('le gallette nelle prossime due settimane')).toBe('le gallette');
  });

  /**
   * ⛔ **LA TRAPPOLA NUMERO UNO DI QUESTO PRODOTTO.** In italiano «X di Y» è il modo normale di
   * chiamare mezzo scaffale: un taglio che si fermasse sul «di» rifarebbe al contrario esattamente
   * il difetto che sta chiudendo — è quello che il 3/9 mattina `codaDellaFrase` ha dovuto
   * correggere.
   */
  it.each([
    ['la crema di mandorle'],
    ['il petto di tacchino'],
    ['i cracker ai cereali'],
    ['il gelato alla crema'],
    ["l'insalata di farro"],
    ['le penne agli spinaci'],
    ['la passata di pomodoro'],
    ['il filetto di merluzzo'],
    ['le punte di asparagi'],
    ['il pane a lievitazione naturale'],
    ['la pasta al pomodoro'],
    ['il riso alla cantonese'],
    ['le uova alla coque'],
    ['il pollo alla cacciatora'],
    ['la torta della nonna'],
    ['il latte di soia'],
    ['il pane bianco'],
    ['le gallette di riso'],
    ['un piatto di crema di'],
  ])('⛔ «%s» non si tocca: il nome composto resta intero', (nome) => {
    expect(separaIlQuando(nome)).toEqual({ nome, coda: '' });
  });

  /**
   * ⛔ **Quello che non è nell'elenco non si tocca**, ed è il verso giusto in cui sbagliare: il
   * difetto resta dov'era invece di nascerne uno nuovo. Una congiunzione in fondo, in particolare,
   * **non** si mangia: è quella su cui `nomeAlimento` si ferma da sé, e toglierla cambierebbe una
   * frase che questo file non ha capito.
   */
  it.each([
    ['le gallette e fammi sapere'],
    ['le gallette ma solo se le piacciono'],
    ['le gallette perche sono piu leggere'],
    ['le gallette come le altre'],
  ])('⚠️ «%s» resta com\'è: non si taglia quello che non si è capito', (pezzo) => {
    expect(separaIlQuando(pezzo)).toEqual({ nome: pezzo, coda: '' });
  });

  /**
   * ⛔ **UNA CONGIUNZIONE APPESA NON È UNA CODA.** Se non è stata tolta nessuna coda, un
   * modificatore in fondo resta dov'è: «le gallette **e**» non ha nessun quando da separare, e
   * dichiarare «coda: e» sarebbe una **cosa falsa detta da questa funzione** — la `coda` è pensata
   * per essere mostrata a chi ha scritto.
   *
   * ⚠️ Sul nome finale non si vedrebbe (`nomeAlimento` si ferma da sé sulle congiunzioni), ed è
   * proprio per questo che serve una riga qui: senza, togliere `giaTagliato` non faceva diventare
   * rosso niente. L'ha detto una prova di mutazione.
   */
  it.each([['le gallette e'], ['le gallette anche'], ['le gallette o']])(
    '⛔ «%s»: niente coda tolta, niente modificatore mangiato',
    (pezzo) => {
      expect(separaIlQuando(pezzo)).toEqual({ nome: pezzo, coda: '' });
    },
  );

  /**
   * ⚠️ **Non si taglia mai fino al vuoto.** Se il pezzo è fatto solo di coda non c'è nessun nome da
   * salvare: si restituisce com'era, e sarà `nomeAlimento` a rispondere `null` come faceva già.
   * ⛔ Rispondere il vuoto qui sposterebbe dentro questa funzione una decisione che è di là.
   */
  it.each([['a colazione'], ['tutti i giorni'], ['la mattina'], ['per tutte'], ['domani']])(
    '⚠️ «%s» non ha niente da salvare: si restituisce intero',
    (solo) => {
      expect(separaIlQuando(solo)).toEqual({ nome: solo, coda: '' });
    },
  );

  it('stringhe vuote e spazi non fanno esplodere niente', () => {
    expect(separaIlQuando('')).toEqual({ nome: '', coda: '' });
    expect(separaIlQuando('   ')).toEqual({ nome: '', coda: '' });
    expect(separaIlQuando(undefined as unknown as string)).toEqual({ nome: '', coda: '' });
  });

  it('gli accenti non cambiano niente: «lunedì» e «lunedi» sono la stessa parola', () => {
    expect(senzaIlQuando('le gallette il lunedì')).toBe('le gallette');
    expect(senzaIlQuando('le gallette il lunedi')).toBe('le gallette');
  });

  /**
   * ⚠️ La coda tolta si può leggere, e deve essere **quella intera**: la prima stesura ne staccava
   * un pezzo («volte a settimana» invece di «due volte a settimana») e dichiarava lo stesso di aver
   * tolto un ambito. Oggi nessuno la mostra a chi ha scritto; il giorno che lo facesse, direbbe una
   * cosa falsa.
   */
  it('la coda tolta è quella intera', () => {
    expect(separaIlQuando('le gallette due volte a settimana').coda).toBe('due volte a settimana');
    expect(separaIlQuando('le gallette solo a colazione').coda).toBe('solo a colazione');
    expect(separaIlQuando('le gallette il sabato e la domenica').coda).toBe('il sabato e la domenica');
  });
});
