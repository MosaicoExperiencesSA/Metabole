import { frasiDaChiarire, impronta, testoEsclusioniDaChiarire } from './esclusioni-da-chiarire';

describe('frasiDaChiarire', () => {
  /**
   * ⚠️ IL CASO CHE VALE LA VOCE. «Pesce tranne salmone» come termine intero non toglie niente — il
   * pesce continua ad arrivarle — e spezzato sulla virgola rende escluso il **salmone**, cioè
   * l'opposto di quello che ha scritto. Un'esclusione che fa il contrario è peggio di una che non
   * funziona, e nessun software può indovinare cosa intendeva.
   */
  it('⚠️ la frase con un\'eccezione va chiarita con una persona', () => {
    expect(frasiDaChiarire(['pesce tranne salmone', 'noci'])).toEqual(['pesce tranne salmone']);
    expect(frasiDaChiarire(['formaggi a parte la mozzarella'])).toEqual(['formaggi a parte la mozzarella']);
  });

  /**
   * ⚠️ MA NON TUTTO QUELLO CHE È SCRITTO MALE DIVENTA LAVORO PER LA COACH. «Non mi piace la cicoria»
   * è una frase, e l'avviso mentre scrive glielo dice — ma non fa l'**opposto** di quello che
   * voleva: al massimo non toglie la cicoria. Aprire un'attività anche per quelle vorrebbe dire
   * riempire la colonna di cose che non cambiano cosa mangia, e la colonna piena è quella che si
   * smette di leggere.
   */
  it('⚠️ una frase scritta male ma non pericolosa non diventa un\'attività', () => {
    expect(frasiDaChiarire(['non mi piace la cicoria'])).toEqual([]);
    expect(frasiDaChiarire(['pomodori', 'melanzane'])).toEqual([]);
    expect(frasiDaChiarire([])).toEqual([]);
  });
});

describe('impronta', () => {
  /**
   * ⚠️ IL RIFERIMENTO È L'ELENCO, NON UNA DATA NÉ UN VALORE FISSO.
   *
   * Con un riferimento fisso, una cliente che riscrive le esclusioni mettendoci un'altra frase
   * ambigua non verrebbe più richiamata: la domanda risulterebbe «già fatta» su un testo che non
   * esiste più. Con la data, l'attività rinascerebbe ogni notte sulla stessa frase.
   */
  it('⚠️ cambia quando cambia l\'elenco, e non cambia se è lo stesso', () => {
    const a = impronta(['pesce tranne salmone', 'noci']);
    expect(impronta(['pesce tranne salmone', 'noci'])).toBe(a);
    expect(impronta(['pesce tranne salmone', 'mandorle'])).not.toBe(a);
  });

  /** L'ordine e gli spazi non sono un elenco diverso: sarebbe un'attività nuova per niente. */
  it('l\'ordine e le maiuscole non contano', () => {
    expect(impronta(['Noci', ' pesce tranne salmone '])).toBe(impronta(['pesce tranne salmone', 'noci']));
  });
});

describe('testoEsclusioniDaChiarire', () => {
  it('nel titolo ci sono il nome e la frase: la coach lo legge in un elenco', () => {
    const t = testoEsclusioniDaChiarire('Maria', ['pesce tranne salmone']);
    expect(t.title).toBe('Chiedi a Maria cosa intendeva: «pesce tranne salmone»');
  });

  /**
   * ⚠️ Dice che NON è rotta e che NON correggiamo noi: sono le due cose che una coach deve sapere
   * prima di telefonare. «Le esclusioni non funzionano» detto male manda una persona a rassicurare
   * una cliente su un guasto che non c'è, e a promettere una correzione che non faremo.
   */
  it('⚠️ dice cosa succede intanto, e perché non correggiamo noi', () => {
    const d = testoEsclusioniDaChiarire('Maria', ['pesce tranne salmone']).description;
    expect(d).toContain('non è ferma e non è rotta');
    expect(d).toContain('continua ad arrivarle');
    expect(d).toContain('TUTTO il pesce');
    expect(d).toContain('segna l\'attività fatta');
  });

  it('senza nome resta una frase, non un buco', () => {
    expect(testoEsclusioniDaChiarire(null, ['x tranne y']).title).toContain('la cliente');
    expect(testoEsclusioniDaChiarire('  ', ['x tranne y']).title).toContain('la cliente');
  });
});
