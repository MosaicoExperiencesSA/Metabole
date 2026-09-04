import { classifica, regimeGiusto, sembraUnImitazione } from './etichetta-contro-contenuto';

/**
 * ⛔ IL GIUDIZIO DI `regime:contenuto`, provato PRIMA che riscriva il catalogo.
 *
 * Con `APPLICA=1` quello script cambia `Recipe.regime` in blocco — 549 ricette al primo giro. Il
 * 1/9 il suo mucchio «sicuro» conteneva due errori nelle prime trenta righe, e li ha visti una
 * persona leggendo l'output: non una prova, perché il giudizio stava dentro lo script.
 */
describe('classifica', () => {
  it('pesce fra gli ingredienti → sicura, e va a pescetariano', () => {
    const e = classifica('Salmone al forno con asparagi', ['filetto di salmone', 'asparagi']);
    expect(e).toEqual({ tipo: 'sicura', cosa: 'pesce', prova: 'filetto di salmone', regimeGiusto: 'pescetarian' });
  });

  it('carne fra gli ingredienti → sicura, e va a onnivoro', () => {
    const e = classifica('Tacchino ai funghi', ['petto di tacchino', 'funghi']);
    expect(e).toEqual({ tipo: 'sicura', cosa: 'carne', prova: 'petto di tacchino', regimeGiusto: 'omnivore' });
  });

  it('⚠️ la carne vince sul pesce: «mare e monti» esiste', () => {
    const e = classifica('Risotto mare e monti', ['gamberi', 'salsiccia']);
    expect(e).toMatchObject({ tipo: 'sicura', cosa: 'carne' });
  });

  /** ⛔ I DUE FALSI POSITIVI VERI, presi dalla produzione dell'1/9. */
  it('⛔ «Carota tagliata sottile» non rende onnivoro un Buddha Bowl di lenticchie', () => {
    const e = classifica('Buddha Bowl di Lenticchie Nere e Germogli su Base di Quinoa',
      ['Lenticchie nere', 'Carota tagliata sottile', 'Quinoa']);
    expect(e).toEqual({ tipo: 'ok' });
  });

  it('⛔ la «ricciolina» è una cicoria, non una ricciola', () => {
    const e = classifica('Torta di Riso Integrale Salata con Ricotta e Cicoria Amara',
      ['riso integrale', 'ricotta', 'cicoria amara cruda (ricciolina)']);
    expect(e).toEqual({ tipo: 'ok' });
  });

  /**
   * ⛔ **LE IMITAZIONI: da «dubbia» a «ok», ed è un miglioramento, non una resa.**
   *
   * Fino al 4/9 questi tre finivano in «dubbia — sembra un'imitazione»: il riconoscitore leggeva
   * `prosciutto` e `acciughe` come carne e pesce, e questo modulo si rifiutava di correggere a
   * macchina un piatto che non capiva. Era la scelta giusta finché il dubbio c'era.
   *
   * ⚠️ Adesso il dubbio non c'è più: `piatto-di-cosa.ts` sa che «prosciutto **di tofu**» e
   * «acciughe **vegetali**» non sono carne né pesce (misurato in produzione con
   * `diag:carne-fuori-posto`, otto falsi su otto). Quindi la risposta giusta è **«ok»** — non c'è
   * niente da correggere — e mandare una persona a guardarli sarebbe il rumore che questo modulo
   * evita altrove: *«rumore che fa sembrare grosso un lavoro che non c'è»*.
   *
   * ⛔ **`sembraUnImitazione` resta e serve ancora**: prende le forme che il riconoscitore non
   * vede, dove il segno vegetale sta in un altro pezzo del testo — nome da una parte, ingredienti
   * dall'altra. Quello che è cambiato è che i casi attaccati li risolve chi di dovere, una volta
   * sola, invece di due punti che si passano un dubbio.
   */
  it.each([
    ['Insalata di melone, feta e prosciutto di tofu affumicato', ['prosciutto di tofu affumicato', 'melone']],
    ['Lenticchie Nere con Petto d\'Anatra di Tofu', ['petto d\'anatra di tofu affumicato', 'lenticchie']],
    ['Crostoni con hummus e acciughe vegetali', ['acciughe vegetali', 'ceci']],
  ])('✅ «%s» non è più un dubbio: non c\'è niente da correggere', (nome, ing) => {
    expect(classifica(nome, ing)).toEqual({ tipo: 'ok' });
  });

  /**
   * ⛔ **QUESTA PROVA È STATA GIRATA IL 1/9, perché proteggeva dalla parte sbagliata.**
   *
   * Diceva che «Prosciutto con contorno vegetale» doveva finire nei dubbi, «per prudenza». Ma
   * «dubbia» vuol dire *non correggo*, cioè **lascia il prosciutto etichettato vegetariano** — che
   * è esattamente il danno da cui volevo proteggermi. La prudenza qui va nell'altro verso:
   * correggerlo a `omnivore` è la mossa sicura, perché è carne davvero.
   *
   * ⚠️ E ci arriva da sé con la regola dell'adiacenza: fra «prosciutto» e «vegetale» ci sono due
   * parole, quindi non è un'imitazione — è un prosciutto con un contorno.
   */
  it('⛔ «Prosciutto con contorno vegetale» è prosciutto vero, e si corregge', () => {
    const e = classifica('Prosciutto con contorno vegetale', ['prosciutto crudo', 'verdure grigliate']);
    expect(e).toMatchObject({ tipo: 'sicura', cosa: 'carne', regimeGiusto: 'omnivore' });
  });

  /**
   * ⛔ **I FALSI POSITIVI DELLA PRIMA STESURA, presi dalla produzione dell'1/9.** Cercava la parola
   * nel testo intero, e in cucina italiana «brodo vegetale» sta in metà delle ricette di pesce:
   * **152 ricette finite fra le dubbie**, quasi tutte a torto, e 147 piatti di pesce veri rimasti
   * `omnivore` che `panieri:pulisci` stava per togliere dai panieri pescetariani.
   */
  it.each([
    ['Tonno al sesamo su purè di ceci e rucola', ['tonno fresco', 'purè di ceci']],
    ['Merluzzo in umido con patate dolci', ['filetto di merluzzo', 'brodo vegetale']],
    ['Gamberoni al vapore con riso basmati', ['gamberoni', 'salsa di soia']],
    ['Branzino al forno con purè di ceci', ['filetto di branzino', 'ceci lessati']],
  ])('⚠️ «%s» NON è un\'imitazione: la parola non è attaccata all\'animale', (nome, ing) => {
    expect(classifica(nome, ing)).toMatchObject({ tipo: 'sicura', cosa: 'pesce' });
  });

  it('⚠️ un pesce nominato solo nel titolo è dubbio: può mancare l\'ingrediente in elenco', () => {
    const e = classifica('Branzino al forno con verdure rosse e limone', ['verdure rosse', 'limone']);
    expect(e).toMatchObject({ tipo: 'dubbia', cosa: 'pesce', perche: 'solo nel nome' });
  });

  /**
   * ⛔ **Uno degli otto veri del 4/9.** Era «dubbia»; adesso è «ok», perché «polpo **d'alghe**» il
   * riconoscitore lo legge per quello che è. È il caso per cui la regola è stata scritta.
   */
  it('✅ un piatto vegetale che si chiama come un pesce non è più un dubbio', () => {
    expect(classifica("Polpo d'Alghe Nori Farcito", ['alga nori', 'riso integrale'])).toEqual({ tipo: 'ok' });
  });

  it('una ricetta davvero vegetale non risulta niente', () => {
    expect(classifica('Pasta al pomodoro', ['pasta integrale', 'pomodoro', 'basilico'])).toEqual({ tipo: 'ok' });
  });

  it('regimeGiusto: il più stretto che può mangiarlo', () => {
    expect(regimeGiusto('pesce')).toBe('pescetarian');
    expect(regimeGiusto('carne')).toBe('omnivore');
  });

  it('sembraUnImitazione vuole l\'animale attaccato alla parola', () => {
    expect(sembraUnImitazione('prosciutto vegetale')).toBe('vegetale');
    expect(sembraUnImitazione('polpo di ceci')).toBe('di ceci');
    expect(sembraUnImitazione('brodo vegetale')).toBeNull();
    expect(sembraUnImitazione('purè di ceci')).toBeNull();
    expect(sembraUnImitazione('ragù di manzo')).toBeNull();
  });
});

/**
 * ⛔ L'ONNIVORO, E LA CONTRADDIZIONE CHE CHIUDE — 1/9, seconda scoperta.
 *
 * `diag:carne-fuori-posto` ha trovato **2351 righe** con una ricetta `omnivore` dentro un paniere
 * `pescetarian`. Non è un errore di riempimento: è `panieri:pesce` che fa il suo mestiere. Ma
 * `panieri:pulisci`, che giudica col regime, le butterebbe fuori — svuotando i panieri appena
 * costruiti. ⚠️ La radice è l'etichetta: un piatto di solo pesce non è `omnivore`, è `pescetarian`.
 */
describe('classifica — le ricette dichiarate onnivore', () => {
  it('⛔ un piatto di solo PESCE dichiarato onnivoro va corretto a pescetariano', () => {
    const e = classifica('Branzino al forno', ['filetto di branzino', 'limone'], 'omnivore');
    expect(e).toEqual({ tipo: 'sicura', cosa: 'pesce', prova: 'filetto di branzino', regimeGiusto: 'pescetarian' });
  });

  /** ⚠️ La carne in una ricetta onnivora è al posto suo: proporre `omnivore` → `omnivore` è rumore. */
  it('⚠️ ma la CARNE in una ricetta onnivora non è niente da correggere', () => {
    expect(classifica('Tacchino ai funghi', ['petto di tacchino'], 'omnivore')).toEqual({ tipo: 'ok' });
  });

  it('⚠️ e nemmeno un nome che sembra carne, se la ricetta è già onnivora', () => {
    expect(classifica('Cotoletta alla milanese', ['pangrattato'], 'omnivore')).toEqual({ tipo: 'ok' });
  });

  it('⚠️ senza regime dichiarato il giudizio è quello di prima', () => {
    expect(classifica('Tacchino ai funghi', ['petto di tacchino'])).toMatchObject({ tipo: 'sicura', cosa: 'carne' });
  });
});
