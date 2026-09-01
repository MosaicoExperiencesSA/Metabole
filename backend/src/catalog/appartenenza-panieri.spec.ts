import {
  FAMIGLIE, IMPOSSIBILI, paniereDellaVariante, panieriDaCreare, ricetteDellaGiornata,
} from './appartenenza-panieri';

describe('da quale paniere viene una variante', () => {
  it('⛔ i panieri sono 38: 10 famiglie × 4 regimi meno le 2 impossibili', () => {
    expect(FAMIGLIE).toHaveLength(10);
    expect(panieriDaCreare()).toHaveLength(38);
    expect(IMPOSSIBILI).toHaveLength(2);
  });

  it('una variante normale porta alla sua famiglia e al suo regime', () => {
    expect(paniereDellaVariante({ id: 'd', name: 'Mediterranea', regime: 'vegan' }))
      .toEqual({ tipo: 'paniere', famiglia: 'Mediterranea', regime: 'vegan' });
  });

  /**
   * ⚠️ È la strada B (§1.6), la decisione che vale di più del piano: obiettivo e struttura pasti
   * non entrano nella chiave, quindi molte varianti versano nello stesso paniere e le ricette non
   * si riscrivono.
   */
  it('⚠️ obiettivo e struttura pasti NON entrano nella chiave', () => {
    const a = paniereDellaVariante({ id: '1', name: 'Mediterranea', regime: 'omnivore' });
    const b = paniereDellaVariante({ id: '2', name: 'Mediterranea', regime: 'omnivore' });
    expect(a).toEqual(b);
  });

  it('⛔ Keto × vegano e Keto-Mediterranea × vegano sono impossibili, non vuote', () => {
    expect(paniereDellaVariante({ id: 'd', name: 'Keto (non terapeutica)', regime: 'vegan' }).tipo).toBe('impossibile');
    expect(paniereDellaVariante({ id: 'd', name: 'Keto-Mediterranea', regime: 'vegan' }).tipo).toBe('impossibile');
    // …ma le stesse famiglie in vegetariano esistono eccome.
    expect(paniereDellaVariante({ id: 'd', name: 'Keto (non terapeutica)', regime: 'vegetarian' }).tipo).toBe('paniere');
  });

  /**
   * ⛔ **Impossibile non vuol dire buttata.** In catalogo quelle due celle hanno 1764 righe di
   * giornata, e il §1.6 dice che «tornano in catalogo come vegane»: buttarle sarebbe esattamente
   * quello per cui la strada B è stata scelta al posto della A.
   */
  it('⛔ e le loro ricette hanno una casa: i panieri vegani delle famiglie vicine', () => {
    const e = paniereDellaVariante({ id: 'd', name: 'Keto (non terapeutica)', regime: 'vegan' });
    expect(e).toMatchObject({
      tipo: 'impossibile',
      dove: [{ famiglia: 'Low carb', regime: 'vegan' }, { famiglia: 'Basso indice glicemico', regime: 'vegan' }],
    });
  });

  /**
   * ⛔ **Il nome in banca dati non è quello del piano** — trovato dal primo giro in sola lettura del
   * 31/8: quattro varianti DASH approvate, 420 righe ciascuna, tutte fuori da ogni paniere per un
   * nome. Se lo script avesse scritto al primo colpo, il paniere DASH sarebbe nato vuoto.
   */
  it('⛔ «DASH (anti-ipertensiva)» è il nome vero, e porta al suo paniere', () => {
    expect(paniereDellaVariante({ id: 'd', name: 'DASH (anti-ipertensiva)', regime: 'vegan' }))
      .toEqual({ tipo: 'paniere', famiglia: 'DASH (anti-ipertensiva)', regime: 'vegan' });
    // …e il nome del piano, che in banca dati non esiste, resta non mappabile invece di far finta.
    expect(paniereDellaVariante({ id: 'd', name: 'DASH', regime: 'vegan' }).tipo).toBe('non_mappabile');
  });

  describe('le due famiglie trovate in produzione il 31/8', () => {
    it('«Flexitariana» confluisce in Flessibile: come famiglia non distingue niente', () => {
      expect(paniereDellaVariante({ id: 'd', name: 'Flexitariana', regime: 'omnivore' }))
        .toMatchObject({ tipo: 'paniere', famiglia: 'Flessibile', regime: 'omnivore' });
    });

    /**
     * ⛔ Il regime si legge **dal nome**: in banca dati «Pescetariana» dice `regime: omnivore`,
     * perché il pescetariano come regime non è mai stato acceso. Prendendo la colonna i suoi piatti
     * finirebbero nel paniere onnivoro mentre quello pescetariano resta vuoto — cioè il difetto che
     * questa riforma viene a chiudere.
     */
    it('⛔ «Pescetariana» è un regime travestito: Mediterranea × pescetariano, anche se in banca dati dice onnivoro', () => {
      expect(paniereDellaVariante({ id: 'd', name: 'Pescetariana', regime: 'omnivore' }))
        .toEqual({ tipo: 'paniere', famiglia: 'Mediterranea', regime: 'pescetarian' });
    });

    it('⚠️ e la colonna vale per tutte le altre: «Mediterranea» onnivora resta onnivora', () => {
      expect(paniereDellaVariante({ id: 'd', name: 'Mediterranea', regime: 'omnivore' }))
        .toMatchObject({ regime: 'omnivore' });
    });
  });

  describe('le famiglie che spariscono (§2.1)', () => {
    it('quelle che confluiscono portano alla famiglia vera', () => {
      expect(paniereDellaVariante({ id: 'd', name: 'Mediterranea senza glutine', regime: 'omnivore' }))
        .toMatchObject({ tipo: 'paniere', famiglia: 'Mediterranea' });
      expect(paniereDellaVariante({ id: 'd', name: 'Mediterranea ipocalorica', regime: 'omnivore' }))
        .toMatchObject({ tipo: 'paniere', famiglia: 'Mediterranea' });
    });

    /**
     * ⛔ Non si inventa un paniere «Digiuno»: sarebbe la settima famiglia fantasma dopo le sei che
     * questo lavoro esiste per chiudere. Si dichiara non mappabile e finisce in un elenco che una
     * persona guarda.
     */
    it.each(['Digiuno intermittente (16:8)', 'Vegana', 'Vegetariana (latto-ovo)', 'Ritorno in Equilibrio', 'Vacanze in Serenità'])(
      '⛔ «%s» non diventa un paniere: si dichiara', (name) => {
        expect(paniereDellaVariante({ id: 'd', name, regime: 'omnivore' }).tipo).toBe('non_mappabile');
      },
    );
  });

  it('⚠️ un nome o un regime che non conosciamo si dichiara, non si indovina', () => {
    expect(paniereDellaVariante({ id: 'd', name: 'Roba Nuova', regime: 'omnivore' }))
      .toMatchObject({ tipo: 'non_mappabile' });
    expect(paniereDellaVariante({ id: 'd', name: 'Mediterranea', regime: 'carnivoro' }))
      .toMatchObject({ tipo: 'non_mappabile' });
  });
});

describe('le ricette nominate da una giornata', () => {
  it('legge slot e recipeId', () => {
    expect(ricetteDellaGiornata([{ slot: 'lunch', recipeId: 'r1' }, { slot: 'dinner', recipeId: 'r2' }]))
      .toEqual([{ slot: 'lunch', recipeId: 'r1' }, { slot: 'dinner', recipeId: 'r2' }]);
  });

  /**
   * ⛔ `meals` è una colonna Json e non ci si fida: una riga senza `recipeId` scartata in silenzio
   * sarebbe una ricetta che sparisce dal paniere, e il confronto prima/dopo la vedrebbe come una
   * perdita — che è esattamente il modo giusto di accorgersene, purché il conto sia onesto.
   */
  it.each([[null], [42], ['lunch'], [{}], [[{ slot: 'lunch' }]], [[{ recipeId: 'r1' }]], [[null]], [[{ slot: '', recipeId: 'r1' }]]])(
    '⚠️ da %p non legge niente invece di inventare', (meals) => {
      expect(ricetteDellaGiornata(meals)).toEqual([]);
    },
  );

  it('e tiene solo le righe complete di una lista mista', () => {
    expect(ricetteDellaGiornata([{ slot: 'lunch', recipeId: 'r1' }, { slot: 'dinner' }, null, { recipeId: 'r3' }]))
      .toEqual([{ slot: 'lunch', recipeId: 'r1' }]);
  });
});
