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
  type SlotPasto,
} from './finestre-digiuno';

const SLOT_VALIDI = new Set(['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner']);

describe('la tabella delle finestre', () => {
  it('contiene le otto scelte: le cinque della tendina e le tre che nascono dall\'orologio', () => {
    expect(VALORI_FINESTRA_DIGIUNO).toEqual([
      // Scelte a mano da una tendina (11/8).
      'skip_breakfast',
      'skip_dinner',
      'skip_lunch',
      'skip_breakfast_lunch',
      'skip_dinner_breakfast',
      // Prodotte dalla durata della finestra (21/8) — vedi `orologio-digiuno.ts`.
      'skip_morning_snack',
      'skip_breakfast_and_snacks',
      'skip_all_but_dinner',
    ]);
  });

  /**
   * ⚠️ Due valori che si somigliano e valgono un pasto di differenza: `skip_breakfast_lunch` lascia
   * merenda e cena, `skip_all_but_dinner` la sola cena. Se qualcuno un giorno li «unifica», questo
   * test è il posto dove se ne accorge.
   */
  it('«solo cena» non è «salta colazione e pranzo»: la merenda li separa', () => {
    expect(slotSaltati('intermittent_fasting', 'skip_breakfast_lunch')).not.toContain('afternoon_snack');
    expect(slotSaltati('intermittent_fasting', 'skip_all_but_dinner')).toContain('afternoon_snack');
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

  /**
   * Le finestre a un pasto solo: a loro la 20-4 non si propone, la stanno già facendo.
   *
   * ⚠️ **Il nome del campo mente un po', e va detto invece di lasciarlo scoprire** (21/8).
   * `skip_breakfast_lunch` ha `unicoPasto: true` ma di pasti ne lascia **due** — merenda e cena:
   * la regola vera, quella che il test verifica sotto, è «**due pasti principali su tre saltati**»,
   * e uno spuntino non conta come pasto. Finché quella riga era sola era una convenzione
   * tollerabile; adesso accanto c'è `skip_all_but_dinner`, che di pasto ne lascia uno davvero, e le
   * due righe usano lo stesso campo per dire cose diverse.
   * ⛔ Non lo rinomino qui: `notifications.service.ts:374` ci decide se mandare la push della 20-4,
   * e cambiargli significato in una consegna che parla d'altro è il modo di romperlo. Ma il campo
   * andrebbe chiamato `unicoPastoPrincipale`.
   */
  it('«un solo pasto» è vero dove restano zero o un pasto principale su tre', () => {
    const unoSolo = FINESTRE_DIGIUNO.filter((f) => f.unicoPasto).map((f) => f.valore);
    expect(unoSolo).toEqual(['skip_breakfast_lunch', 'skip_dinner_breakfast', 'skip_all_but_dinner']);
    for (const f of FINESTRE_DIGIUNO) {
      // Coerenza: due pasti principali saltati su tre. ⚠️ Il commento diceva «tre su tre» e il
      // codice ne chiedeva due: era falso da prima, e l'ho corretto invece di ricopiarlo.
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

  /**
   * ⛔ **`primoPasto` NON ERA PROTETTO DA NIENTE** (trovato in revisione, 21/8).
   *
   * Il campo è nato il 21/8 per un difetto **già in produzione**: la mail del primo giorno riempiva
   * *«comincia dal tuo primo pasto ({{…}})»* con `pastoPrincipale`, che è l'**ultimo**, e a una
   * cliente 16:8 diceva «comincia dal tuo primo pasto (cena)». Il campo corregge la mail — ma era
   * scritto a mano su otto righe, e in revisione si è provato: rimettendo `primoPasto: 'cena'` su
   * `skip_breakfast` **tutti e 4216 i test restavano verdi**. Cioè il difetto si poteva rifare e la
   * suite taceva.
   *
   * ⚠️ Qui non si ricopia il valore: si **ricalcola** dal solo dato che non può mentire, `salta`.
   * Un test che riscrive a mano gli stessi otto valori non è una rete, è una seconda copia.
   */
  it('⛔ il primo pasto è il primo che RESTA, calcolato da `salta` e non ricopiato', () => {
    const ORDINE: SlotPasto[] = ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner'];
    const NOME: Record<SlotPasto, string> = {
      breakfast: 'colazione', morning_snack: 'merenda', lunch: 'pranzo',
      afternoon_snack: 'merenda', dinner: 'cena',
    };
    const sbagliate: string[] = [];
    for (const f of FINESTRE_DIGIUNO) {
      const primo = ORDINE.find((s) => !f.salta.includes(s));
      // ⚠️ Una finestra che salta tutto non esiste, e non deve nascere per sbaglio.
      expect(primo).toBeDefined();
      if (NOME[primo!] !== f.primoPasto) sbagliate.push(`${f.valore}: dice «${f.primoPasto}», resta «${NOME[primo!]}»`);
    }
    expect(sbagliate).toEqual([]);
  });

  /**
   * ⚠️ E l'altra metà: `pastoPrincipale` è l'**ultimo** pasto principale che resta. Il test qui
   * sopra chiedeva solo che non fosse fra quelli saltati — vero anche per un valore sbagliato
   * (`skip_breakfast` con `pastoPrincipale: 'pranzo'` passava, e il pranzo non è l'ultimo).
   */
  it('⛔ il pasto principale è l\'ULTIMO che resta, calcolato e non ricopiato', () => {
    const PRINCIPALI: [SlotPasto, string][] = [['breakfast', 'colazione'], ['lunch', 'pranzo'], ['dinner', 'cena']];
    const sbagliate: string[] = [];
    for (const f of FINESTRE_DIGIUNO) {
      const restano = PRINCIPALI.filter(([s]) => !f.salta.includes(s));
      // `skip_all_but_dinner` ne lascia uno; nessuna riga li salta tutti e tre.
      expect(restano.length).toBeGreaterThan(0);
      const ultimo = restano[restano.length - 1][1];
      if (ultimo !== f.pastoPrincipale) sbagliate.push(`${f.valore}: dice «${f.pastoPrincipale}», l'ultimo è «${ultimo}»`);
    }
    expect(sbagliate).toEqual([]);
  });

  it('finestraDigiuno trova per valore e non inventa niente', () => {
    expect(finestraDigiuno('skip_lunch')?.etichettaBreve).toBe('Pranzo');
    expect(finestraDigiuno('boh')).toBeUndefined();
    expect(finestraDigiuno(null)).toBeUndefined();
  });
});

describe('slotEsclusiTotali — digiuno + spuntini tolti (azione 3, Decisioni 13/8 §14)', () => {
  const { slotEsclusiTotali } = require('./finestre-digiuno');

  it('unisce la finestra del digiuno e i pasti esclusi della cliente', () => {
    const s = slotEsclusiTotali('intermittent_fasting', 'skip_breakfast', ['afternoon_snack']);
    expect(s.has('breakfast')).toBe(true);
    expect(s.has('afternoon_snack')).toBe(true);
  });

  it('i pasti esclusi valgono anche SENZA digiuno: sono un dato della cliente, non del percorso', () => {
    const s = slotEsclusiTotali('standard', null, ['morning_snack']);
    expect([...s]).toEqual(['morning_snack']);
  });

  it('solo gli spuntini passano da qui: un pasto principale scritto per sbaglio non toglie la cena', () => {
    const s = slotEsclusiTotali('standard', null, ['dinner', 'afternoon_snack']);
    expect(s.has('dinner')).toBe(false);
    expect(s.has('afternoon_snack')).toBe(true);
  });

  it('niente di niente = insieme vuoto', () => {
    expect(slotEsclusiTotali('standard', null, []).size).toBe(0);
    expect(slotEsclusiTotali('standard', null, undefined).size).toBe(0);
  });
});
