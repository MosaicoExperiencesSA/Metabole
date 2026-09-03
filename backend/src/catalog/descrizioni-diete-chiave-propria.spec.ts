/**
 * ⛔ **«DESCRIZIONI DIETE» HA UNA CHIAVE SUA, E LA SEPARAZIONE SI VEDE SOLO SUI DECORATORI.**
 *
 * Fino al 3/9 la pagina girava su `diets_catalog`, cioè **il permesso di un'altra pagina**: non si
 * poteva dare a una nutrizionista i testi senza darle il catalogo, né toglierle il catalogo
 * lasciandole i testi. È il difetto che `CLAUDE.md` vieta per esteso — *«ogni pagina nuova del
 * backoffice ha una chiave di permesso SUA»* — e che `descrizioni-diete-cosa-resta` denunciava dal
 * 28/8.
 *
 * ⚠️ La separazione **dipende da un dettaglio del guardiano**: `page.guard.ts` usa
 * `getAllAndOverride([handler, class])`, quindi la chiave del **metodo batte quella della classe**.
 * Senza quel comportamento le due rotte chiederebbero `diets_catalog` **in più**, e la chiave nuova
 * sarebbe stata una separazione apparente. Queste prove tengono ferma la cosa da cui dipende.
 */
import 'reflect-metadata';
import { PAGE_KEY } from '../common/decorators/require-page.decorator';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { DietsController } from './catalog.controller';
import { BACKOFFICE_PAGES, INHERIT_DEFAULTS, PAGE_GRANTS } from '../permissions/pages';

const suMetodo = <T>(chiave: string, metodo: string): T | undefined =>
  Reflect.getMetadata(chiave, (DietsController.prototype as unknown as Record<string, never>)[metodo]) as T | undefined;

describe('la chiave propria della pagina «Descrizioni diete»', () => {
  it('⛔ esiste come chiave dichiarata', () => {
    expect([...BACKOFFICE_PAGES]).toContain('diet_descriptions');
  });

  it('⛔ la lettura chiede la SUA chiave, non quella del catalogo', () => {
    expect(suMetodo<{ pageKey: string; level?: string }>(PAGE_KEY, 'descrizioni'))
      .toMatchObject({ pageKey: 'diet_descriptions' });
  });

  it('⛔ e la scrittura chiede la sua chiave in «gestisce»', () => {
    expect(suMetodo<{ pageKey: string; level?: string }>(PAGE_KEY, 'updateFamilyProduct'))
      .toMatchObject({ pageKey: 'diet_descriptions', level: 'manage' });
  });

  /**
   * ⚠️ Il `PageGuard` è permissivo se il database non risponde: dietro deve restare un cancello.
   * E questi sono i tre ruoli che il 3/9 mattina hanno avuto il permesso di scrivere i testi.
   */
  it('⚠️ e i ruoli restano sotto', () => {
    expect(suMetodo<string[]>(ROLES_KEY, 'updateFamilyProduct'))
      .toEqual(['nutritionist', 'head_nutritionist', 'admin']);
  });

  /**
   * ⛔ **NON passa da `PAGE_GRANTS`, ed era la scorciatoia da evitare.** Il guardiano prova la
   * chiave concessa **allo stesso livello** della rotta: una riga `diet_descriptions:
   * ['diets_catalog']` farebbe passare `GET /diets` in vista, ma in **gestione** farebbe passare
   * anche `POST /diets`, `PATCH /diets/:id` e `DELETE /diets/:id`. Cioè ricreerebbe **al contrario**
   * l'accoppiamento che questa separazione scioglie: dare i testi finirebbe per dare il catalogo.
   */
  it('⛔ e non è un grantor: dare i testi non deve dare il catalogo', () => {
    expect((PAGE_GRANTS as Record<string, readonly string[]>).diet_descriptions).toBeUndefined();
  });

  /**
   * ⚠️ **Eredita alla nascita**, che è il legame giusto: separare una schermata non deve togliere
   * accesso a chi oggi ce l'ha. ⛔ E non è permanente — dopo, la figlia vive per conto suo, o
   * separarla non servirebbe a niente.
   */
  it('⚠️ ma eredita da `diets_catalog` alla nascita della riga', () => {
    expect((INHERIT_DEFAULTS as Record<string, string>).diet_descriptions).toBe('diets_catalog');
  });
});

/**
 * ⛔ **E LA ROTTA STA PRIMA DI `:id`.**
 *
 * Nest cerca le rotte nell'ordine in cui sono dichiarate, e `@Get(':id')` combacia anche con
 * `descrizioni`: dichiarata dopo, questa rotta non verrebbe **mai** raggiunta — risponderebbe
 * l'altra, con un 404 su una dieta che si chiama «descrizioni». ⚠️ È la stessa lezione già scritta
 * in questo controller per `famiglia/product`, e l'ho rifatta lo stesso scrivendo la rotta in
 * fondo: da qui c'è una prova.
 */
describe('l\'ordine delle rotte', () => {
  const sorgente = require('node:fs').readFileSync(require('node:path').join(__dirname, 'catalog.controller.ts'), 'utf8') as string;

  /**
   * ⚠️ **Si cerca il DECORATORE, non la parola.** La prima stesura usava `indexOf("@Get(':id')")` e
   * trovava la **menzione dentro il commento** che spiega proprio questa regola, venti righe più su:
   * la prova diceva «la rotta sta dopo» di una rotta che sta prima. Un test che legge un sorgente
   * deve distinguere il codice dalla prosa che lo racconta.
   */
  const dove = (decoratore: string): number =>
    sorgente.search(new RegExp(`^\\s*${decoratore.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm'));

  it('⛔ `@Get(\'descrizioni\')` è dichiarata PRIMA di `@Get(\':id\')`', () => {
    expect(dove("@Get('descrizioni')")).toBeGreaterThan(0);
    expect(dove("@Get(':id')")).toBeGreaterThan(0);
    expect(dove("@Get('descrizioni')")).toBeLessThan(dove("@Get(':id')"));
  });

  /** ⚠️ E la stessa cosa vale per la scrittura, che era già così da agosto. */
  it('⚠️ e `famiglia/product` prima di `:id/product`', () => {
    expect(dove("@Patch('famiglia/product')")).toBeLessThan(dove("@Patch(':id/product')"));
  });
});
