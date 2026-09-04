/**
 * ⛔ **LE DODICI COPPIE LETTE IL 4/9, E COSA SUCCEDE ADESSO A OGNUNA.**
 *
 * `npm run diag:esclusioni` in produzione ha elencato dodici coppie (chiave dentro una parola più
 * lunga) da leggere una per una. Simone ha risposto; qui c'è l'esito, piatto per piatto, perché
 * fra sei mesi la risposta si legga senza ricostruirla.
 *
 * ⛔ **Dieci NO, due SÌ, una lasciata stare** — e le tre categorie si correggono in modo diverso:
 * · le famiglie APERTE (`grana`, `grano`: sgranato, sgranando, sgranocchiare…) con la regola di
 *   posizione, perché un elenco chiuso le rincorrerebbe per sempre;
 * · i casi SINGOLI e noti (`platter`, `umbrie`, `rapanelli`) con l'elenco delle omonime;
 * · i SÌ non si toccano — l'aceto nel sottaceto c'è, e il fiordilatte è mozzarella di latte.
 *
 * ⚠️ **E una non si è risolta né SÌ né NO**: «soffrittata» non è una parola italiana, quindi quel
 * piatto ha un refuso nel nome e può essere «soffritto» storpiato (niente uovo) o «frittata»
 * storpiata (uovo eccome). Una ricetta su ventiquattromila, e i due errori non costano uguale:
 * tenerla esclusa toglie un piatto, toglierla può mettere un uovo nel piatto di chi è allergico.
 * Su un caso solo e ambiguo si tiene — ed è scritto qui perché non venga «sistemato» domani.
 */
import { hitsExclusion } from './exclusions';

const prende = (piatto: string, chiave: string) => hitsExclusion(piatto.toLowerCase(), [chiave]) !== null;

describe('le dodici coppie del 4/9', () => {
  describe('i NO — la chiave c\'è dentro la parola ma l\'alimento no', () => {
    it.each([
      ['insalata di melagrana e finocchi', 'grana'],
      ['succo di melograno fresco', 'grano'],
      ['piselli sgranati al vapore', 'grana'],
      ['mais sgranato in padella', 'grana'],
      ['mandorle sgranocchiate a merenda', 'grano'],
      ['platter di verdure crude', 'latte'],
      ['insalata di rapanelli e rucola', 'pane'],
      ['tortino alle umbrie', 'brie'],
    ])('«%s» non è escluso per «%s»', (piatto, chiave) => {
      expect(prende(piatto, chiave)).toBe(false);
    });
  });

  describe('i SÌ — la chiave c\'è, e l\'alimento pure', () => {
    it('il sottaceto ha l\'aceto, e chi è sensibile ai solfiti deve restarne fuori', () => {
      expect(prende('cetriolini sottaceto', 'aceto')).toBe(true);
    });

    /** ⛔ La riga che decide la forma della correzione: per questo `latte` non usa la posizione. */
    it('il fiordilatte è mozzarella di latte', () => {
      expect(prende('pizza con fiordilatte e basilico', 'latte')).toBe(true);
    });

    it('e la soffrittata resta esclusa, perché nessuno sa cosa sia', () => {
      expect(prende('soffrittata di verdure', 'frittata')).toBe(true);
    });
  });

  /**
   * ⛔ **E QUELLO CHE LA CORREZIONE NON DEVE PORTARSI VIA.** Una regola di posizione su `grana` e
   * `grano` è larga: queste sono le parole vere che devono continuare a scattare, o si toglie
   * protezione invece di darne.
   */
  describe('quello che resta preso, al posto giusto', () => {
    it.each([
      ['scaglie di grana padano', 'grana'],
      ['insalata di grano saraceno', 'grano'],
      ['pasta di grano duro', 'grano'],
      ['pane integrale tostato', 'pane'],
      ['tagliere con brie e noci', 'brie'],
      ['latte intero e biscotti', 'latte'],
    ])('«%s» resta escluso per «%s»', (piatto, chiave) => {
      expect(prende(piatto, chiave)).toBe(true);
    });
  });

  /**
   * ⚠️ **Un falso che c'era già e che questa correzione NON tocca**, scritto invece che scoperto
   * dopo: «granoturco» è mais, di glutine non ne ha, e comincia una parola — quindi la regola di
   * posizione non lo scarta. Si chiude il giorno che la diagnostica lo nomina, non per analogia.
   */
  it('⚠️ «granoturco» resta preso per «grano», ed è un falso dichiarato', () => {
    expect(prende('polenta di granoturco', 'grano')).toBe(true);
  });
});
