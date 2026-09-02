import { CAMPI_CHE_CAMBIANO_LA_BASE, laBaseVaRifatta } from './base-personale-da-rifare';

describe('⛔ laBaseVaRifatta', () => {
  it('sì quando cambia la famiglia — è il caso di Rosa, Arianna e Carla', () => {
    expect(laBaseVaRifatta(['name', 'dietFamily'])).toBe(true);
  });

  it('sì per regime, stile e numero di pasti', () => {
    expect(laBaseVaRifatta(['regime'])).toBe(true);
    expect(laBaseVaRifatta(['dietStyle'])).toBe(true);
    expect(laBaseVaRifatta(['mealsPerDay'])).toBe(true);
  });

  /**
   * ⛔ **I quattro che mancavano.** `profile.service` guardava solo i primi quattro campi, e
   * `buildPersonalBase` ne legge otto: una cliente che passava da 5 a 3 pasti, o a cui si
   * aggiungeva un'allergia dalla scheda, restava con la base di prima.
   */
  it('⛔ e per pathType e objective, che decidono quale variante la serve', () => {
    expect(laBaseVaRifatta(['pathType'])).toBe(true);
    expect(laBaseVaRifatta(['objective'])).toBe(true);
  });

  /**
   * ⛔ **Il caso peggiore.** La base è l'elenco delle ricette **sicure**: un'allergia aggiunta
   * dalla scheda che non la rifà lascia dentro i piatti che la contengono, e il cambio di piatto
   * in chat pesca proprio di lì.
   */
  it('⛔ e per le allergie, che sono il motivo per cui la base esiste', () => {
    expect(laBaseVaRifatta(['allergies'])).toBe(true);
    expect(laBaseVaRifatta(['allergiesOther'])).toBe(true);
  });

  it('no quando si toccano solo campi che non spostano le ricette', () => {
    expect(laBaseVaRifatta(['name', 'age', 'themeColor', 'coachStyle', 'startWeightKg'])).toBe(false);
  });

  it('⚠️ e su un elenco vuoto o assente non si rifà niente', () => {
    expect(laBaseVaRifatta([])).toBe(false);
    expect(laBaseVaRifatta(null)).toBe(false);
    expect(laBaseVaRifatta(undefined)).toBe(false);
  });

  /** ⚠️ Prende anche le chiavi di un oggetto, che è la forma che ha `profileData` nello staff. */
  it('⚠️ funziona sulle chiavi di un oggetto', () => {
    expect(laBaseVaRifatta(Object.keys({ name: 'x', allergies: ['latte'] }))).toBe(true);
    expect(laBaseVaRifatta(Object.keys({ name: 'x' }))).toBe(false);
  });

  /**
   * ⚠️ **L'elenco deve restare allineato a quello che `buildPersonalBase` legge.** Questa prova non
   * lo può garantire da sola — nessuna prova può — ma tiene fermo il numero: se qualcuno ne toglie
   * uno senza accorgersene, qui diventa rosso e va a rileggere il perché.
   */
  it('⚠️ i campi sono nove, e ognuno ha una ragione scritta nel file', () => {
    expect([...CAMPI_CHE_CAMBIANO_LA_BASE].sort()).toEqual([
      'allergies', 'allergiesOther', 'dietFamily', 'dietStyle', 'fastingWindow',
      'mealsPerDay', 'objective', 'pathType', 'regime',
    ]);
  });
});
