/**
 * LE FINESTRE DEL DIGIUNO — la tabella che tiene insieme otto punti del prodotto.
 *
 * Segnalazione di Simone dell'11/8: nella tendina mancavano «salta la cena» e «salta il pranzo».
 * Erano assenti da **cinque** elenchi diversi (motore, tre DTO, questionario) e il motore non
 * avrebbe saputo cosa saltare nemmeno se qualcuno le avesse scritte a mano in uno solo.
 *
 * Questi test non verificano la nutrizione: verificano che la tabella resti **completa e coerente**,
 * cioè la proprietà che il difetto ha violato. Una finestra aggiunta domani senza slot, o presente
 * nel questionario e non nel motore, fa fallire qui invece di arrivare in produzione.
 */

import {
  FINESTRE_DIGIUNO,
  VALORI_FINESTRA_DIGIUNO,
  eUnicoPasto,
  finestraDigiuno,
  pastoPrincipaleDigiuno,
  slotSaltati,
} from './finestre-digiuno';

const SLOT_VALIDI = new Set(['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner']);

describe('la tabella delle finestre', () => {
  it('contiene le cinque scelte, comprese quelle che mancavano', () => {
    expect(VALORI_FINESTRA_DIGIUNO).toEqual([
      'skip_breakfast',
      'skip_dinner',
      'skip_lunch',
      'skip_breakfast_lunch',
      'skip_dinner_breakfast',
    ]);
  });

  it.each(FINESTRE_DIGIUNO.map((f) => [f.valore, f] as const))('«%s» è completa', (_v, f) => {
    // Ogni finestra deve saltare qualcosa e avere tutte le etichette: una voce senza slot comparirebbe
    // nella tendina e non cambierebbe niente nel menu — il difetto più difficile da notare.
    expect(f.salta.length).toBeGreaterThan(0);
    expect(f.salta.every((s) => SLOT_VALIDI.has(s))).toBe(true);
    for (const etichetta of [f.etichettaStaff, f.etichettaCliente, f.etichettaBreve]) {
      expect(etichetta.trim().length).toBeGreaterThan(2);
    }
  });

  it('nessun valore e nessuna etichetta duplicati', () => {
    expect(new Set(VALORI_FINESTRA_DIGIUNO).size).toBe(VALORI_FINESTRA_DIGIUNO.length);
    const brevi = FINESTRE_DIGIUNO.map((f) => f.etichettaBreve);
    expect(new Set(brevi).size).toBe(brevi.length);
  });

  /**
   * LA REGOLA DELLO SPUNTINO ADIACENTE. Se salti la colazione, uno spuntino alle dieci riaprirebbe
   * la finestra; per simmetria, se salti la cena, quello del pomeriggio la accorcia. La regola
   * esisteva solo per la colazione: estenderla alla cena è una scelta, e sta scritta qui.
   */
  it('lo spuntino adiacente segue il pasto saltato', () => {
    expect(slotSaltati('intermittent_fasting', 'skip_breakfast')).toEqual(new Set(['breakfast', 'morning_snack']));
    expect(slotSaltati('intermittent_fasting', 'skip_dinner')).toEqual(new Set(['dinner', 'afternoon_snack']));
  });

  /**
   * `skip_lunch` è l'unica che NON è una finestra di digiuno: colazione e cena lasciano due finestre
   * corte invece di una lunga. Toglie solo il pranzo, e gli spuntini li decide il numero di pasti.
   */
  it('«salta il pranzo» toglie solo il pranzo', () => {
    expect(slotSaltati('intermittent_fasting', 'skip_lunch')).toEqual(new Set(['lunch']));
    expect(eUnicoPasto('skip_lunch')).toBe(false);
  });

  it('chi non è in digiuno non salta niente, e nemmeno chi non ha scelto la finestra', () => {
    expect(slotSaltati('five', 'skip_breakfast').size).toBe(0);
    expect(slotSaltati('intermittent_fasting', null).size).toBe(0);
    expect(slotSaltati('intermittent_fasting', 'inventata').size).toBe(0);
  });

  /** Le due finestre a un pasto solo: a loro la 20-4 non si propone, la stanno già facendo. */
  it('«un solo pasto» è vero solo dove ne resta uno', () => {
    const unoSolo = FINESTRE_DIGIUNO.filter((f) => f.unicoPasto).map((f) => f.valore);
    expect(unoSolo).toEqual(['skip_breakfast_lunch', 'skip_dinner_breakfast']);
    for (const f of FINESTRE_DIGIUNO) {
      // Coerenza: «un pasto solo» deve corrispondere a tre slot principali saltati su tre.
      const pastiPrincipaliSaltati = f.salta.filter((s) => s === 'breakfast' || s === 'lunch' || s === 'dinner').length;
      expect(f.unicoPasto).toBe(pastiPrincipaliSaltati === 2);
    }
  });

  /**
   * Il pasto principale finisce in due posti che prima non sapevano delle voci nuove: il
   * suggerimento della 20-4 («per te la cena») e la mail del primo giorno («riparti dal pranzo»).
   */
  it('il pasto principale è sempre uno dei pasti che restano', () => {
    const nome: Record<string, string> = { colazione: 'breakfast', pranzo: 'lunch', cena: 'dinner' };
    for (const f of FINESTRE_DIGIUNO) {
      expect(f.salta).not.toContain(nome[f.pastoPrincipale]);
    }
    expect(pastoPrincipaleDigiuno('skip_dinner')).toBe('pranzo');
    expect(pastoPrincipaleDigiuno('skip_breakfast')).toBe('cena');
    // Valore sconosciuto (dato vecchio, o scritto a mano): si ripiega sulla cena invece di esplodere.
    expect(pastoPrincipaleDigiuno('inventata')).toBe('cena');
  });

  it('finestraDigiuno trova per valore e non inventa niente', () => {
    expect(finestraDigiuno('skip_lunch')?.etichettaBreve).toBe('Pranzo');
    expect(finestraDigiuno('boh')).toBeUndefined();
    expect(finestraDigiuno(null)).toBeUndefined();
  });
});
