import { suggestAllergens } from '../catalog/allergens';
import { FRASI_CHE_NON_SONO, dentroUnaFraseCheNonE, exclusionKeys, hitsExclusion, soloDentroFrasi } from './exclusions';
import { decisioneLattosio } from './lattosio';
import { sostitutoSicuro } from './sostituzioni-sicure';

/**
 * ⛔ **I LATTI VEGETALI SPARIVANO DAL PIANO DI CHI È ALLERGICO AL LATTE** — 31/8, trovato misurando
 * prima di scrivere la somma degli allergeni su ventitremila ricette.
 *
 * «latte di cocco» contiene «latte». `PAROLE_CHE_NON_SONO` non poteva vederlo — là l'omonima è una
 * parola **diversa** («bovino» per «vino»), qui la parola è **identica alla chiave**. Risultato: il
 * tag `latte` finiva su ogni latte vegetale e su ogni burro di frutta secca, e da lì il piatto
 * spariva dal piano di chi è allergico al latte — cioè proprio di chi quei prodotti li mangia
 * **al posto** del latte.
 *
 * ⚠️ E non si vede: un allergene di troppo non produce nessun errore, produce un menu più povero su
 * una persona che ha già meno scelta di tutte le altre.
 *
 * ⚠️ Le prove sono su **tutte e due le porte**, e non è una ripetizione: il tag della ricetta
 * (`suggestAllergens`) e il filtro che toglie il piatto (`hitsExclusion`) sono due strade diverse
 * sulle stesse liste, e il 31/8 la seconda aveva pure un terzo giro — la radice — che le frasi non
 * consultava affatto.
 */
describe('le frasi che contengono una chiave senza esserla', () => {
  const tag = (nome: string) => suggestAllergens([{ name: nome }]).map((x) => x.allergen);
  const tolto = (nome: string, allergene: string) => hitsExclusion(nome, exclusionKeys([allergene])) !== null;

  describe('⛔ quello che NON deve più contare come latte', () => {
    it.each([
      'latte di cocco', 'latte di soia', 'latte di riso', 'latte di avena', 'latte vegetale',
      'burro di arachidi', 'burro di mandorle', 'burro di cacao', 'burro di sesamo', 'burro di cocco',
      'panna di cocco', 'yogurt di soia', 'yogurt di cocco', 'yogurt vegetale',
    ])('«%s»', (nome) => {
      expect(tag(nome)).not.toContain('latte');
      expect(tolto(nome, 'latte')).toBe(false);
    });

    /**
     * ⛔ Il buco della SECONDA porta, trovato il 31/8 dopo aver chiuso la prima: «yogurt di soia»
     * usciva dal giro della chiave esatta (la frase lo scartava) e **rientrava dal giro della
     * radice**, che guardava solo le omonime. Il piatto spariva lo stesso, e il primo tabulato
     * diceva che era a posto.
     */
    it('⛔ e non rientra dalla porta della radice', () => {
      expect(hitsExclusion('yogurt di soia', new Set(['yogurt']))).toBeNull();
      expect(hitsExclusion('yogurt di cocco', new Set(['yogurt']))).toBeNull();
    });

    /**
     * ⚠️ «latte d'avena» è come si scrive davvero, ed è la forma trovata in catalogo il 31/8: la
     * riga con «di» non la vedeva. Le due forme si generano dalla stessa riga.
     */
    it.each(["latte d'avena", "latte d'anacardi"])('⚠️ e con l\'apostrofo: «%s»', (nome) => {
      expect(tag(nome)).not.toContain('latte');
      expect(tolto(nome, 'latte')).toBe(false);
    });
  });

  describe('⛔ quello che DEVE restare latte — sbagliare qui arriva nel piatto', () => {
    it.each([
      'burro chiarificato', 'ghee', 'latte intero', 'latte scremato', 'burro salato',
      'yogurt greco', 'yogurt magro', 'panna fresca', 'ricotta vaccina', 'fiocchi di latte',
      /**
       * ⚠️ Fuori dall'elenco APPOSTA: molti prodotti in commercio contengono caseinato, che è
       * proteina del latte. Restano esclusi, ed è la parte dell'elenco chiuso che vale quanto
       * quella scritta.
       */
      'panna vegetale', 'formaggio vegano',
    ])('«%s»', (nome) => {
      expect(tag(nome)).toContain('latte');
      expect(tolto(nome, 'latte')).toBe(true);
    });
  });

  describe('la frutta a guscio', () => {
    it.each(['noce moscata', 'noci moscate', 'noce di cocco', 'noci di cocco'])(
      '⛔ «%s» non è frutta a guscio', (nome) => {
        expect(tag(nome)).not.toContain('frutta_a_guscio');
        expect(tolto(nome, 'frutta a guscio')).toBe(false);
      },
    );

    it.each(['noce di macadamia', 'noce pecan', 'noce brasiliana', 'noci sgusciate', 'gherigli di noci'])(
      '⛔ «%s» SÌ, e sbagliare qui arriva nel piatto', (nome) => {
        expect(tag(nome)).toContain('frutta_a_guscio');
        expect(tolto(nome, 'frutta a guscio')).toBe(true);
      },
    );
  });

  /**
   * ⛔ La forma che il 23/8 aveva già morso una volta, con il carpaccio: **basta UNA occorrenza che
   * superi i filtri** perché la chiave valga. La frase scarta la sua occorrenza, non la chiave.
   */
  describe('⛔ il piatto misto resta escluso', () => {
    it.each([
      ['latte di cocco e latte intero', 'latte'],
      ['torta con burro di arachidi e burro salato', 'latte'],
      ['dolce con noce moscata e noci pecan', 'frutta a guscio'],
    ])('«%s» resta escluso per %s', (nome, allergene) => {
      expect(tolto(nome, allergene)).toBe(true);
    });

    /**
     * ⛔ **E il TAG, non solo il filtro** — buco trovato dalla revisione: il `describe` guardava solo
     * `hitsExclusion`, e una mutazione che passava sempre la PRIMA occorrenza restava verde. Ma il
     * tag è la porta che **scrive** sulle ricette generate: lì «latte di cocco e latte intero»
     * perdeva il tag `latte`, cioè un ingrediente che il latte ce l'ha usciva come se non l'avesse.
     */
    it.each([
      ['latte di cocco e latte intero', 'latte'],
      ['burro di arachidi e burro salato', 'latte'],
      ['dolce con noce moscata e noci pecan', 'frutta_a_guscio'],
    ])('⛔ e «%s» tiene il tag %s', (nome, codice) => {
      expect(tag(nome)).toContain(codice);
    });
  });

  /**
   * ⛔ **LE PORTE SONO QUATTRO, NON DUE** — e le altre due sono peggio: `lattosio.ts` e
   * `sostituzioni-sicure.ts` non tolgono un piatto, **sostituiscono un ingrediente**. Su «latte di
   * cocco» rispondevano «sostituisci con latte senza lattosio»: un derivato del latte aggiunto a un
   * piatto che non ne aveva, e il delattosato le proteine del latte le contiene tutte.
   */
  describe('⛔ e le due porte che SOSTITUISCONO', () => {
    it.each(['latte di cocco', 'latte di soia', "latte d'avena", 'yogurt di soia', 'panna di cocco', 'burro di cacao'])(
      '«%s» non si sostituisce come se fosse latte', (nome) => {
        expect(decisioneLattosio(nome)).toBeNull();
        expect(sostitutoSicuro(nome)).toBeNull();
      },
    );

    it.each(['latte intero', 'yogurt greco', 'panna fresca', 'burro'])(
      '⛔ mentre «%s» si sostituisce ancora', (nome) => {
        expect(decisioneLattosio(nome)).toMatchObject({ azione: 'sostituisci' });
      },
    );

    it('⚠️ e il piatto misto si sostituisce: «tutte dentro una frase» vuol dire tutte', () => {
      expect(soloDentroFrasi('latte di cocco e latte intero', 'latte')).toBe(false);
      expect(decisioneLattosio('latte di cocco e latte intero')).toMatchObject({ azione: 'sostituisci' });
    });

    it('una chiave che non compare non è «solo dentro le frasi»', () => {
      expect(soloDentroFrasi('pane e pomodoro', 'latte')).toBe(false);
    });
  });

  describe('l\'aggancio', () => {
    it('vale solo dentro la frase, non prima e non dopo', () => {
      const h = 'crema al latte di cocco con latte';
      expect(dentroUnaFraseCheNonE(h, 'latte', h.indexOf('latte'))).toBe(true);
      expect(dentroUnaFraseCheNonE(h, 'latte', h.lastIndexOf('latte'))).toBe(false);
    });

    /**
     * ⛔ Buco trovato dalla revisione: **ogni caso della spec aveva la frase all'inizio del nome**,
     * quindi una mutazione che passava `0` al posto dell'indice vero restava verde. I nomi veri la
     * frase ce l'hanno in mezzo.
     */
    it.each([
      'dolce allo yogurt di soia', 'torta al latte di cocco', 'crema con burro di arachidi',
      'gelato alla panna di cocco', 'biscotti con noce moscata', 'budino al latte di avena',
    ])('⛔ «%s» — la frase vale anche in mezzo al nome', (nome) => {
      expect(tolto(nome, 'latte') || tolto(nome, 'frutta a guscio')).toBe(false);
    });

    it('una chiave senza frasi dichiarate non è mai dentro niente', () => {
      expect(dentroUnaFraseCheNonE('pane di segale', 'pane', 0)).toBe(false);
    });

    /**
     * ⚠️ Le liste sono CHIUSE: questa prova non guarda i contenuti — li guardano quelle sopra —
     * guarda che nessuno ci infili una regola larga. Una voce che è solo «burro di» o «latte»
     * spegnerebbe l'esclusione per tutto ciò che la contiene, ghee compreso.
     */
    it('⛔ nessuna frase è un prefisso generico: si scrivono alimenti interi', () => {
      for (const [chiave, frasi] of Object.entries(FRASI_CHE_NON_SONO)) {
        for (const f of frasi) {
          expect(f.trim()).toBe(f);
          expect(f.split(/\s+/).length).toBeGreaterThanOrEqual(2);
          expect(f).not.toBe(chiave);
          expect(f.length).toBeGreaterThan(chiave.length + 2);
        }
      }
    });
  });
});
