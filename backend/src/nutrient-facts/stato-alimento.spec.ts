import { fraseAmbiguita, scegliPerStato, statoNelTesto } from './stato-alimento';

const riga = (state: string | null, name = 'x') => ({ state, name });

describe('statoNelTesto', () => {
  it.each([
    ['quante calorie ha il riso bollito?', 'bollito'],
    ['80 g di farro crudo', 'crudo'],
    ['la pasta cotta quanto pesa', 'cotto'],
    ['fagioli secchi', 'secco'],
    ['lenticchie lessate', 'bollito'],
  ])('«%s» → %s', (testo, atteso) => expect(statoNelTesto(testo)).toBe(atteso));

  it('quando non lo dice, torna null — e non si indovina', () => {
    expect(statoNelTesto('quante calorie ha il riso?')).toBeNull();
    expect(statoNelTesto('')).toBeNull();
  });

  /**
   * ⚠️ Il confronto è per PAROLA. «crudo» dentro «crudité» non è uno stato, e un confronto per
   * sottostringa avrebbe risposto con sicurezza a domande che non lo dicevano — cioè avrebbe
   * trasformato una guardia in una fonte di errori.
   */
  it('⚠️ una parola di stato dentro un\'altra parola non conta', () => {
    expect(statoNelTesto('un piatto di crudité')).toBeNull();
    expect(statoNelTesto('il biscotto')).toBeNull();
  });
});

describe('scegliPerStato', () => {
  it('una riga sola: è quella', () => {
    expect(scegliPerStato([riga('crudo')], 'riso')).toMatchObject({ tipo: 'unica' });
  });

  it('nessuna riga: niente', () => {
    expect(scegliPerStato([], 'riso')).toEqual({ tipo: 'niente' });
  });

  /**
   * ⚠️ IL CASO CHE VALE. Due righe «riso bianco», una crudo e una bollito: prima rispondeva la
   * prima che il database restituiva. Dalla tabella del 18/8, il farro va da 353 kcal a 127 —
   * rispondere con quella sbagliata non è un'imprecisione, è un altro pasto.
   */
  it('⚠️ due stati e la domanda non lo dice: NON si sceglie', () => {
    const e = scegliPerStato([riga('crudo'), riga('bollito')], 'quante calorie ha il riso?');
    expect(e.tipo).toBe('ambiguo');
    if (e.tipo === 'ambiguo') expect(e.stati.sort()).toEqual(['bollito', 'crudo']);
  });

  it('ma se la domanda lo dice, si sceglie quella riga', () => {
    const e = scegliPerStato([riga('crudo'), riga('bollito')], 'il riso bollito quante calorie ha');
    expect(e).toMatchObject({ tipo: 'per_stato', stato: 'bollito' });
    if (e.tipo === 'per_stato') expect(e.riga.state).toBe('bollito');
  });

  it('lo stato chiesto non c\'è in tabella: si resta sull\'ambiguità invece di ripiegare', () => {
    const e = scegliPerStato([riga('crudo'), riga('bollito')], 'riso al forno cotto in padella secco');
    // «secco» è il primo riconosciuto, e in tabella non c'è: meglio chiedere che dare il crudo.
    expect(e.tipo).toBe('ambiguo');
  });

  /**
   * ⚠️ Due righe con lo STESSO stato non sono ambigue: sono duplicati, e la differenza che conta
   * non c'è. Trattarle come ambigue avrebbe fatto rispondere «dipende» a una domanda che non
   * dipende da niente — cioè avrebbe reso la guardia rumore.
   */
  it('⚠️ righe con lo stesso stato (o tutte senza) non sono ambigue', () => {
    expect(scegliPerStato([riga('crudo'), riga('crudo')], 'riso').tipo).toBe('unica');
    expect(scegliPerStato([riga(null), riga(null)], 'riso').tipo).toBe('unica');
  });
});

describe('fraseAmbiguita — è un\'ISTRUZIONE, non un dato', () => {
  it('dice quali stati abbiamo, quanto cambia, e di NON dire numeri', () => {
    const f = fraseAmbiguita('riso bianco', ['crudo', 'bollito']);
    expect(f).toContain('crudo o bollito');
    expect(f).toContain('NON dire nessun numero');
    expect(f).toContain('chiedi prima');
  });

  /**
   * ⚠️ Dice anche QUANTO cambia. «Dipende dallo stato» suona come una pignoleria; «le kcal possono
   * ridursi di quasi tre volte» spiega perché la domanda vale la pena di essere fatta.
   */
  it('⚠️ e dice quanto cambia, non solo che cambia', () => {
    expect(fraseAmbiguita('farro', ['crudo', 'bollito'])).toContain('quasi tre volte');
  });
});
