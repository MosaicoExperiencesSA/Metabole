import { nominatoNeiPassi, sostituzioniDaSapere } from './sostituzioni-nei-passi';

const PASSI = ['Taglia le carote a rondelle.', 'Fai rosolare la cipolla con l\'olio.'];

describe('nominatoNeiPassi', () => {
  it('trova il nome anche al singolare o al plurale', () => {
    expect(nominatoNeiPassi('carote', PASSI)).toBe(true);
    expect(nominatoNeiPassi('carota', PASSI)).toBe(true);
    expect(nominatoNeiPassi('cipolle', PASSI)).toBe(true);
  });

  /**
   * ⚠️ COME PAROLA, NON COME SOTTOSTRINGA. È lo stesso errore che faceva sostituire i peperoni a
   * chi scriveva «pepe»: qui costerebbe solo una riga di troppo, ma una nota che parla di un
   * ingrediente che nei passi non c'è insegna a saltare le note.
   */
  it('⚠️ «pepe» non è «peperoni»', () => {
    expect(nominatoNeiPassi('pepe', ['Aggiungi i peperoni a dadini.'])).toBe(false);
  });

  it('quello che nei passi non c\'è, non c\'è', () => {
    expect(nominatoNeiPassi('salmone', PASSI)).toBe(false);
    expect(nominatoNeiPassi('', PASSI)).toBe(false);
    expect(nominatoNeiPassi('carote', [])).toBe(false);
  });
});

describe('sostituzioniDaSapere', () => {
  /** ⚠️ IL CASO DELLA VOCE: gli ingredienti dicono «biete», i passi ancora «carote». */
  it('⚠️ dice quale nome vecchio si legge ancora, e cosa metterci', () => {
    expect(sostituzioniDaSapere([{ from: 'carote', to: 'biete' }], PASSI)).toEqual([{ da: 'carote', a: 'biete' }]);
  });

  /** ⚠️ Una nota su un ingrediente che nei passi non è nominato è rumore, e il rumore si salta. */
  it('⚠️ tace su quello che nei passi non compare', () => {
    expect(sostituzioniDaSapere([{ from: 'salmone', to: 'tonno' }], PASSI)).toEqual([]);
  });

  /** ⚠️ Mezza istruzione è peggio di nessuna: senza il nome nuovo non si dice niente. */
  it('⚠️ senza il sostituto non si scrive una nota monca', () => {
    expect(sostituzioniDaSapere([{ from: 'carote' }], PASSI)).toEqual([]);
    expect(sostituzioniDaSapere([{ from: 'carote', to: '  ' }], PASSI)).toEqual([]);
  });

  it('lo stesso alimento due volte si dice una volta sola', () => {
    expect(sostituzioniDaSapere([{ from: 'carote', to: 'biete' }, { from: 'Carote', to: 'zucchine' }], PASSI))
      .toEqual([{ da: 'carote', a: 'biete' }]);
  });

  it('un cambio che non cambia niente non si annuncia', () => {
    expect(sostituzioniDaSapere([{ from: 'carote', to: 'Carote' }], PASSI)).toEqual([]);
  });

  it('senza passi non c\'è niente da avvertire', () => {
    expect(sostituzioniDaSapere([{ from: 'carote', to: 'biete' }], [])).toEqual([]);
    expect(sostituzioniDaSapere(null, PASSI)).toEqual([]);
  });
});
