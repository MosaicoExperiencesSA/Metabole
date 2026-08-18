import {
  fraseAiutoEsclusioni,
  problemaDellaVoce,
  problemiEsclusioni,
  vociScritte,
} from './esclusioni-scritte-bene';

describe('vociScritte', () => {
  it('spezza sui separatori che il resto del progetto già usa', () => {
    expect(vociScritte('cicoria, tonno; panna')).toEqual(['cicoria', 'tonno', 'panna']);
  });

  it('accetta anche un elenco già spezzato', () => {
    expect(vociScritte(['cicoria', ' tonno '])).toEqual(['cicoria', 'tonno']);
  });

  it('vuoto è vuoto, senza esplodere', () => {
    expect(vociScritte('')).toEqual([]);
    expect(vociScritte([])).toEqual([]);
  });
});

describe('problemaDellaVoce — un alimento scritto bene non dice niente', () => {
  it.each(['cicoria', 'tonno', 'panna', 'yogurt greco intero al naturale', 'pesce', 'latte di soia'])(
    '«%s» va bene',
    (v) => expect(problemaDellaVoce(v)).toBeNull(),
  );

  /**
   * ⚠️ Con gli spazi intorno nel confronto: «ma» dentro «marmellata» non è una negazione, e un
   * confronto per sottostringa avrebbe segnalato mezzo catalogo — cioè avrebbe reso l'avviso
   * rumore al primo giro.
   */
  it('⚠️ una parola di eccezione DENTRO un\'altra parola non conta: «marmellata» non contiene «ma»', () => {
    expect(problemaDellaVoce('marmellata')).toBeNull();
    expect(problemaDellaVoce('salvia')).toBeNull(); // contiene «salvo»? no: il confronto è per parola
  });
});

describe('⚠️ IL CASO CHE FA DANNO: «pesce tranne salmone, tonno»', () => {
  /**
   * Spezzata sulla virgola diventa «pesce tranne salmone» + «tonno», cioè rende escluso il TONNO —
   * che è l'opposto di quello che la cliente aveva scritto: lo elencava fra le eccezioni.
   */
  it('la voce con l\'eccezione viene segnalata; l\'altra no, perché «tonno» è un alimento vero', () => {
    const p = problemiEsclusioni('pesce tranne salmone, tonno');
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ voce: 'pesce tranne salmone', tipo: 'eccezione' });
    expect(p[0].spiegazione).toContain('non toglie niente dal menu');
  });

  /**
   * ⚠️ NESSUN SUGGERIMENTO, ed è deliberato. La correzione più ovvia — tenere la prima parola —
   * escluderebbe TUTTO il pesce, salmone compreso: di nuovo il contrario di quello che voleva.
   * Chi ha scritto la frase è l'unica persona che sa cosa intendeva.
   */
  it('⚠️ e NON suggerisce niente: indovinare qui vorrebbe dire escludere anche il salmone', () => {
    expect(problemiEsclusioni('pesce tranne salmone')[0].suggerimento).toBeNull();
  });

  it.each(['pesce eccetto il salmone', 'formaggi a parte la ricotta', 'latticini salvo lo yogurt', 'frutta ma non le banane'])(
    'riconosce anche «%s»',
    (v) => expect(problemaDellaVoce(v)?.tipo).toBe('eccezione'),
  );
});

describe('la frase intera: «Non mi piace la cicoria»', () => {
  it('è segnalata, e IL SUGGERIMENTO C\'È perché qui indovinare non è indovinare', () => {
    const p = problemaDellaVoce('Non mi piace la cicoria');
    expect(p?.tipo).toBe('frase');
    expect(p?.suggerimento).toBe('cicoria');
  });

  it.each([
    ['Non mangio il maiale', 'maiale'],
    ['non voglio la panna', 'panna'],
    ['odio le melanzane', 'melanzane'],
    ['evito i formaggi', 'formaggi'],
    ['Niente glutine', 'glutine'],
  ])('«%s» → suggerisce «%s»', (scritto, atteso) => {
    expect(problemaDellaVoce(scritto)?.suggerimento).toBe(atteso);
  });

  it('se dopo la frase non resta niente, non si inventa un suggerimento', () => {
    expect(problemaDellaVoce('non mi piace')?.suggerimento).toBeNull();
  });
});

describe('la voce troppo lunga', () => {
  it('oltre sei parole si insospettisce e invita alla virgola', () => {
    const p = problemaDellaVoce('carne rossa e bianca e anche il pesce azzurro');
    expect(p?.tipo).toBe('troppo_lunga');
    expect(p?.spiegazione).toContain('separale con una virgola');
  });

  /** ⚠️ La lunghezza da sola non basta a far scattare l'avviso su un alimento vero: «yogurt greco
   *  intero al naturale» sono cinque parole ed è un alimento. */
  it('⚠️ ma un alimento lungo davvero non viene segnalato', () => {
    expect(problemaDellaVoce('yogurt greco intero al naturale')).toBeNull();
  });
});

describe('fraseAiutoEsclusioni — deve dire la conseguenza e come si scrive', () => {
  it('niente problemi, niente frase: un avviso che compare sempre non è un avviso', () => {
    expect(fraseAiutoEsclusioni([])).toBeNull();
    expect(fraseAiutoEsclusioni(problemiEsclusioni('cicoria, tonno'))).toBeNull();
  });

  it('⚠️ dice cosa succede davvero, non «formato non valido»', () => {
    const f = fraseAiutoEsclusioni(problemiEsclusioni('pesce tranne salmone'))!;
    expect(f).toContain('non toglie niente dal menu');
    expect(f).not.toContain('formato');
  });

  it('⚠️ e chiude sempre con COME si scrive: un avviso senza la strada d\'uscita è un rimprovero', () => {
    const f = fraseAiutoEsclusioni(problemiEsclusioni('Non mi piace la cicoria'))!;
    expect(f).toContain('Volevi scrivere «cicoria»?');
    expect(f).toContain('uno per virgola');
    expect(f).toContain('Quelli che mangi non serve elencarli');
  });
});
