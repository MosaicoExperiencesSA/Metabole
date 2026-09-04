import { fuoriRegime, regimeEffettivo, VIETATI } from './regime-del-candidato';

/**
 * ⛔ **IL CANCELLO CHE PRIMA NON SERVIVA** — 4/9. Finché i gruppi di equivalenza erano legati a una
 * dieta, nessuno di questi casi poteva capitare: il gruppo «Carni bianche» non arrivava a una
 * vegetariana perché era di un'altra dieta. Da oggi ci arriva, e queste sono le prove che si ferma.
 *
 * ⚠️ Il verso in cui si sbaglia: un falso positivo toglie una proposta e manda la richiesta alla
 * nutrizionista; un falso negativo mette la carne nel piatto di una vegetariana. Per questo il
 * regime sconosciuto vale come il più stretto, e c'è una prova che lo dice.
 */
describe('fuoriRegime', () => {
  it('a un\'onnivora non toglie niente', () => {
    expect(fuoriRegime('petto di pollo', 'omnivore')).toBeNull();
    expect(fuoriRegime('branzino', 'omnivore')).toBeNull();
    expect(fuoriRegime('ricotta', 'omnivore')).toBeNull();
  });

  it('a una vegetariana ferma la carne e il pesce, non i latticini', () => {
    expect(fuoriRegime('petto di pollo', 'vegetarian')).toBe('carne');
    expect(fuoriRegime('branzino', 'vegetarian')).toBe('pesce');
    expect(fuoriRegime('ricotta', 'vegetarian')).toBeNull();
    expect(fuoriRegime('uova', 'vegetarian')).toBeNull();
  });

  it('a una pescetariana ferma la carne e lascia passare il pesce', () => {
    expect(fuoriRegime('coniglio', 'pescetarian')).toBe('carne');
    expect(fuoriRegime('merluzzo', 'pescetarian')).toBeNull();
  });

  it('a una vegana ferma anche i derivati del latte e le uova', () => {
    expect(fuoriRegime('ricotta', 'vegan')).toBe('latticini');
    expect(fuoriRegime('frittata', 'vegan')).toBe('uova');
    expect(fuoriRegime('tofu', 'vegan')).toBeNull();
  });

  /**
   * ⛔ La prova che vale più di tutte: un regime che non conosciamo **non è un via libera**. Prima
   * di questa riga un `dietId` mancante avrebbe voluto dire «nessun cancello», cioè il pollo
   * proposto a chiunque.
   */
  it('un regime sconosciuto, vuoto o nullo vale come il più stretto', () => {
    for (const r of [null, undefined, '', 'boh', 'flexitarian']) {
      expect(fuoriRegime('petto di pollo', r)).toBe('carne');
      expect(fuoriRegime('ricotta', r)).toBe('latticini');
    }
    expect(regimeEffettivo(null)).toBe('vegan');
  });

  /**
   * ⚠️ Il vocabolario è quello di casa, non uno nuovo: «hamburger di ceci» non è carne (lo dice
   * `piatto-di-cosa.ts`, riscritto l'1/9 proprio per questo) e «tonno di ceci» non è pesce.
   */
  it('non scambia per carne o pesce le imitazioni vegetali', () => {
    expect(fuoriRegime('hamburger di ceci', 'vegetarian')).toBeNull();
    expect(fuoriRegime('tonno di ceci', 'vegetarian')).toBeNull();
    expect(fuoriRegime('seitan', 'vegetarian')).toBeNull();
  });

  it('un nome vuoto non è fuori regime: non c\'è niente da giudicare', () => {
    expect(fuoriRegime('', 'vegan')).toBeNull();
    expect(fuoriRegime('   ', 'vegan')).toBeNull();
  });

  /**
   * ⚠️ La tabella è il cuore: se un giorno qualcuno svuota una riga «per far passare più cose», qui
   * si vede. E l'onnivora è l'unica riga vuota che ci può stare.
   */
  it('la tabella dei divieti non si allenta per sbaglio', () => {
    expect(VIETATI.omnivore).toHaveLength(0);
    expect([...VIETATI.pescetarian]).toEqual(['carne']);
    expect([...VIETATI.vegetarian]).toEqual(['carne', 'pesce']);
    expect([...VIETATI.vegan]).toEqual(['carne', 'pesce', 'latticini', 'uova']);
  });
});
