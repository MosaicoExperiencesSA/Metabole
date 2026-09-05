import { chiaveCombacia, derivatoVegetale, PIANTE_DEI_DERIVATI } from './exclusions';
import { suggestAllergens } from '../catalog/allergens';

/**
 * ⛔ **I DERIVATI VEGETALI NON SONO LATTE NÉ UOVA — e le preparazioni sì.**
 *
 * La regola toglie una protezione (il tag latte/uova, l'esclusione della cliente) dove la parola
 * dice da sé che è vegetale. È una porta che **toglie**, quindi qui la controprova conta più della
 * prova: ogni riga «resta» sotto è un falso negativo su un allergene che non ci si può permettere.
 */

const dedotti = (nome: string) => suggestAllergens([{ name: nome }]).map((a) => a.allergen);

describe('derivatoVegetale: la forma, non l\'elenco', () => {
  it('⛔ i due falsi misurati il 4/9 non sono più latte né uova', () => {
    expect(dedotti('ricotta di mandorla')).not.toContain('latte');
    expect(dedotti('uova di lino')).not.toContain('uova');
  });

  /**
   * ⛔ **«formaggio vegano» e «panna vegetale» RESTANO latte** — decisione del 31/8
   * (`frasi-che-non-sono.spec.ts`): molti prodotti «vegetali» in commercio contengono caseinato.
   * La prima stesura di questa regola li smontava, e la suite l'ha fermata: qui si toglie un tag,
   * e per un'allergia si sbaglia verso il tag che resta. Il suffisso lo guarda solo il cancello.
   */
  it('⛔ «formaggio vegano» e «panna vegetale» restano latte per gli allergeni (31/8)', () => {
    expect(dedotti('formaggio vegano')).toContain('latte');
    expect(dedotti('panna vegetale')).toContain('latte');
  });

  it('⚠️ «di ‹pianta›» dopo un NOME di ingrediente lo smonta', () => {
    for (const n of ['ricotta di anacardi', 'parmigiano di mandorle', 'mozzarella di riso', 'formaggio d\'avena', 'yogurt di cocco']) {
      expect(dedotti(n)).not.toContain('latte');
    }
    // ⚠️ E la pianta resta quello che è: «burro di arachidi» dichiara le arachidi.
    expect(dedotti('burro di arachidi')).toContain('arachidi');
    expect(dedotti('burro di arachidi')).not.toContain('latte');
  });

  /** ⚠️ Le forme trovate il 5/9 sul catalogo vero: senza il «di», e le piante che mancavano. */
  it('⚠️ «latte mandorla», «burro di semi di girasole», «burro di pistacchio», «yogurt soya» non sono latte', () => {
    for (const n of ['latte mandorla', 'latte cocco light', 'yogurt soia naturale', 'burro arachidi naturale', 'burro di semi di girasole',
      'burro di pistacchio', 'burro di tahina', 'burro di walnut', 'yogurt soya non zuccherato', 'ricotta di legumi (ceci)', 'ricotta di noce']) {
      expect(dedotti(n)).not.toContain('latte');
    }
    expect(dedotti('maionese di semi di girasole')).not.toContain('uova');
  });

  /**
   * ⚠️ Vale per la CHIAVE che segue «senza», non per l'allergene: «pasta senza glutine» resta glutine
   * per via di «pasta». È un difetto a sé (una celiaca non riceve la pasta senza glutine) e sta
   * nell'elenco Lavori come voce sua, non chiuso di sponda qui.
   */
  it('⚠️ «senza uova» non è uova; ma «torta senza uova e latte» tiene il latte, e «latte senza lattosio» resta latte', () => {
    expect(dedotti('lievito per dolci (senza uova)')).not.toContain('uova');
    expect(dedotti('torta senza uova e latte')).toContain('latte');
    expect(dedotti('latte senza lattosio')).toContain('latte');
  });

  it('⚠️ «granata semi» è melograno, non grana', () => {
    expect(dedotti('granata semi')).not.toContain('latte');
    expect(dedotti('grana padano')).toContain('latte');
  });

  /** ⛔ LA CONTROPROVA CHE CONTA: le preparazioni con «di ‹pianta›» restano di uova. */
  it('⛔ «frittata di zucchine» e «omelette di funghi» RESTANO uova', () => {
    expect(dedotti('frittata di zucchine')).toContain('uova');
    expect(dedotti('omelette di funghi')).toContain('uova');
    expect(dedotti('frittata di patate')).toContain('uova');
  });

  /** ⛔ E gli animali dopo «di» restano animali. */
  it('⛔ «formaggio di capra», «ricotta di pecora», «uova di quaglia», «latte di bufala» restano', () => {
    expect(dedotti('formaggio di capra')).toContain('latte');
    expect(dedotti('ricotta di pecora')).toContain('latte');
    expect(dedotti('latte di bufala')).toContain('latte');
    expect(dedotti('uova di quaglia')).toContain('uova');
    expect(dedotti('mozzarella di bufala')).toContain('latte');
    // E senza il «di» vale lo stesso: la parola dopo deve essere una pianta.
    expect(dedotti('mozzarella fior di latte')).toContain('latte');
    expect(dedotti('yogurt greco intero')).toContain('latte');
    expect(dedotti('latte intero')).toContain('latte');
    expect(dedotti('ricotta fresca')).toContain('latte');
    expect(dedotti('uova intere')).toContain('uova');
    expect(dedotti('pasta all\'uovo integrale')).toContain('uova');
  });

  it('⛔ «di ‹pianta›» deve stare SUBITO dopo: «ricotta fresca di mandorla» resta latte', () => {
    expect(dedotti('ricotta fresca di mandorla')).toContain('latte');
  });

  /** ⚠️ Un piatto con tutt'e due — «latte di cocco e latte intero» — resta latte per il secondo. */
  it('⚠️ basta un\'occorrenza vera perché la chiave valga', () => {
    expect(chiaveCombacia('ricotta di mandorla e ricotta di pecora', 'ricott')).toBe(true);
    expect(chiaveCombacia('ricotta di mandorla e ricotta di anacardi', 'ricott')).toBe(false);
  });

  it('⚠️ e la stessa risposta vale per le esclusioni della cliente, che passano dalla stessa porta', () => {
    expect(chiaveCombacia('pasta con ricotta di mandorla e basilico', 'ricott')).toBe(false);
    expect(chiaveCombacia('pasta con ricotta e basilico', 'ricott')).toBe(true);
  });

  /** ⛔ Chi allunga l'elenco delle piante ci mette una pianta: nessun animale, mai. */
  it('⛔ nell\'elenco delle piante non c\'è nessun animale', () => {
    const animali = ['capra', 'pecora', 'bufala', 'mucca', 'vacca', 'gallina', 'quaglia', 'anatra', 'oca', 'pesce', 'manzo', 'maiale'];
    for (const a of animali) expect(PIANTE_DEI_DERIVATI.some((p) => a.startsWith(p) || p.startsWith(a))).toBe(false);
  });

  it('la funzione nuda: sì solo per le chiavi che hanno una versione vegetale', () => {
    expect(derivatoVegetale('salmone di carote', 'salmone', 0)).toBe(false); // il pesce finto lo gestisce `senzaImitazioni`, non questa porta
    expect(derivatoVegetale('formaggio di anacardi', 'formagg', 0)).toBe(true);
    expect(derivatoVegetale('frittata di patate', 'frittat', 0)).toBe(false);
  });
});
