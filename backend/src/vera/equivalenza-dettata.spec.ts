import {
  bastaPerScrivere,
  leggiEquivalenza,
  testoAnteprima,
  testoChiediAltri,
  testoChiediNome,
  testoFatto,
} from './equivalenza-dettata';

describe('leggiEquivalenza — le forme in cui si dice davvero', () => {
  it('«aggiungi equivalenza: pollo, tacchino, coniglio»', () => {
    expect(leggiEquivalenza('aggiungi equivalenza: petto di pollo, tacchino, coniglio')?.alimenti)
      .toEqual(['petto di pollo', 'tacchino', 'coniglio']);
  });

  it('«voglio aggiungere un\'equivalenza fra pollo e tacchino»', () => {
    expect(leggiEquivalenza("voglio aggiungere un'equivalenza fra pollo e tacchino")?.alimenti)
      .toEqual(['pollo', 'tacchino']);
  });

  /** ⚠️ L'alimento di partenza è il PRIMO MEMBRO, non solo il nome: un gruppo che non lo contiene
   *  direbbe al motore di scambiare due cose che con lui non c'entrano. */
  it('⚠️ «al posto del pollo si può mettere tacchino o coniglio»: il pollo è dentro il gruppo', () => {
    const e = leggiEquivalenza('al posto del pollo si può mettere tacchino o coniglio');
    expect(e?.alimenti).toEqual(['pollo', 'tacchino', 'coniglio']);
  });

  it('«pollo, tacchino e coniglio sono equivalenti»', () => {
    expect(leggiEquivalenza('pollo, tacchino e coniglio sono equivalenti')?.alimenti)
      .toEqual(['pollo', 'tacchino', 'coniglio']);
  });

  /**
   * ⚠️ IL CASO DELLO SCREENSHOT (19/8). «aggiungi equivalenza» secco è una richiesta **capita**: si
   * riconosce, e si chiedono gli alimenti. Rispondere «non ci arrivo» a una frase che si è capita
   * benissimo è quello che ha fatto scrivere a Simone «Vera ancora non capisce».
   */
  it('⚠️ «aggiungi equivalenza» da solo si capisce, e non è «non ci arrivo»', () => {
    expect(leggiEquivalenza('aggiungi equivalenza')).toEqual({ alimenti: [], nome: null });
    expect(leggiEquivalenza("voglio aggiungere un'equivalenza")).toEqual({ alimenti: [], nome: null });
  });

  /**
   * ⚠️ MA UNA FRASE CHE NON LA CHIEDE NON DIVENTA UN'EQUIVALENZA. «Pollo e tacchino» da solo è un
   * elenco di alimenti: trattarlo come una richiesta trasformerebbe ogni frase in una regola del
   * motore, che è la cosa più pericolosa che questa chat possa fare.
   */
  it('⚠️ un elenco di alimenti non è una richiesta', () => {
    expect(leggiEquivalenza('pollo e tacchino')).toBeNull();
    expect(leggiEquivalenza('a Giulia niente formaggi molli')).toBeNull();
    expect(leggiEquivalenza('')).toBeNull();
  });

  it('lo stesso alimento due volte si conta una volta sola', () => {
    expect(leggiEquivalenza('aggiungi equivalenza: pollo, Pollo, tacchino')?.alimenti)
      .toEqual(['pollo', 'tacchino']);
  });
});

describe('quando non basta per scrivere', () => {
  /** ⚠️ Un gruppo con un alimento solo non scambia niente: si chiede invece di scriverlo. */
  it('⚠️ un solo alimento non è un\'equivalenza', () => {
    const e = leggiEquivalenza('aggiungi equivalenza: pollo')!;
    expect(bastaPerScrivere(e)).toBe(false);
    expect(testoChiediAltri(e)).toContain('pollo');
    expect(testoChiediAltri(e)).toContain('almeno un altro');
  });

  it('senza nessun alimento chiede quali sono, con un esempio', () => {
    const e = leggiEquivalenza('aggiungi equivalenza')!;
    expect(bastaPerScrivere(e)).toBe(false);
    expect(testoChiediAltri(e)).toContain('per esempio');
  });

  it('con due alimenti si può scrivere', () => {
    expect(bastaPerScrivere(leggiEquivalenza('aggiungi equivalenza: pollo e tacchino')!)).toBe(true);
  });
});

describe('i testi', () => {
  const e = leggiEquivalenza('aggiungi equivalenza: pollo, tacchino')!;

  /**
   * ⚠️ L'ANTEPRIMA DICE COSA SUCCEDE DAVVERO, e sono due cose: che il motore **scambierà** quegli
   * alimenti nei piatti (non è una nota, è una regola) e che nasce come **proposta**. Una regola che
   * si crede locale e agisce su trecento persone è il difetto peggiore che questa chat possa fare.
   */
  it('⚠️ dice che è una regola del motore e che nasce come proposta', () => {
    const t = testoAnteprima(e, 'carni bianche');
    expect(t).toContain('carni bianche');
    expect(t).toContain('scambiarli');
    expect(t).toContain('proposta');
    expect(t).toContain('capo nutrizionista');
  });

  /** ⚠️ Il nome non si inventa: «Equivalenza 1» non dice niente a chi la rilegge fra un mese. */
  it('⚠️ il nome si chiede, e intanto si mostra cosa ci va dentro', () => {
    expect(testoChiediNome(e)).toContain('pollo, tacchino');
  });

  it('a cose fatte dice che il motore non lo usa ancora', () => {
    expect(testoFatto('carni bianche', 2)).toContain('non lo usa');
  });
});
