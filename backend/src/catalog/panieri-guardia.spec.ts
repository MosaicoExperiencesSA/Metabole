import { PAGE_KEY } from '../common/decorators/require-page.decorator';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { BACKOFFICE_PAGES } from '../permissions/pages';
import { PanieriController } from './panieri.controller';

/**
 * ⛔ **LA CHIAVE `panieri` NASCE INSIEME ALLA GUARDIA CHE LA LEGGE.**
 *
 * Regola di progetto (Simone, 13/8): *«tutte le pagine che aggiungiamo vanno gestite nei permessi,
 * sempre»*. ⚠️ E una chiave dichiarata che nessun endpoint legge è **un interruttore che non
 * accende niente**: è già successo con `assignments`, e da fuori non si distingue da un permesso
 * che funziona — chi lo spegne crede di aver tolto un accesso, e non ha tolto niente.
 *
 * ⛔ Qui pesa più che altrove: **chi tocca una riga di un paniere cambia da dove arrivano i piatti
 * di tutte le clienti di quella famiglia**, non la giornata di una. Una scrittura senza `manage`
 * darebbe a una nutrizionista in sola lettura il pool di tutte.
 */
describe('⛔ le porte dei panieri', () => {
  const pagina = (metodo: string) =>
    Reflect.getMetadata(PAGE_KEY, (PanieriController.prototype as never as Record<string, () => unknown>)[metodo]) as
      | { pageKey: string; level?: string }
      | undefined;
  const ruoli = (metodo: string) =>
    Reflect.getMetadata(ROLES_KEY, (PanieriController.prototype as never as Record<string, () => unknown>)[metodo]) as string[] | undefined;

  it('la chiave esiste fra le pagine del backoffice, altrimenti non compare in Permessi', () => {
    expect((BACKOFFICE_PAGES as readonly string[]).includes('panieri')).toBe(true);
  });

  it('⛔ la classe è protetta dalla chiave `panieri`', () => {
    expect(Reflect.getMetadata(PAGE_KEY, PanieriController)).toMatchObject({ pageKey: 'panieri' });
  });

  /**
   * ⛔ **Le due porte che SCRIVONO vogliono `manage`.** Senza, resterebbe solo `@Roles`, e la sola
   * vista potrebbe aggiungere e togliere piatti dal pool di tutte le clienti di una famiglia.
   */
  it('⛔ aggiungere e togliere vogliono `manage`', () => {
    for (const metodo of ['aggiungi', 'togli']) {
      expect(pagina(metodo)).toMatchObject({ pageKey: 'panieri', level: 'manage' });
    }
  });

  /**
   * ⛔ **E CHI SCRIVE LO DICE LA CASELLA, non un secondo elenco di ruoli** — cambiato il 7/9.
   *
   * Qui c'era il contrario: `@Roles('head_nutritionist', 'admin')` sui due metodi, e questa prova lo
   * teneva fermo. ⚠️ Il giorno in cui Simone ha acceso «Panieri · gestisce» alla Nutrizionista, quel
   * secondo elenco l'avrebbe bloccata lo stesso — la casella accesa, la porta chiusa, e nessun modo
   * di capirlo dall'interfaccia. È lo stesso difetto di «Compensi staff» e «Provvigioni», trovato lo
   * stesso giorno.
   *
   * ⚠️ **Il `@Roles` della classe resta, e questa prova lo pretende**: senza, `PageGuard` diventa
   * l'unico cancello e sul suo fail-open non ci sarebbe più nessuna rete. Quello che non deve
   * tornare è il **secondo** elenco, sui metodi.
   */
  it('⛔ i due metodi che scrivono NON hanno un elenco di ruoli proprio: decide la casella', () => {
    for (const metodo of ['aggiungi', 'togli']) {
      expect(ruoli(metodo)).toBeUndefined();
    }
  });

  it('⚠️ mentre leggere lo può fare anche chi propone le diete', () => {
    const r = (Reflect.getMetadata(ROLES_KEY, PanieriController) ?? []) as string[];
    expect(r).toContain('nutritionist');
  });

  /**
   * ⛔ **`doveSta` LEGGE e basta, e non deve chiedere `manage`** (2/9). Serve al popup «Modifica
   * ricetta» per dire in quali panieri sta un piatto: chiedere `manage` per **guardare** vorrebbe
   * dire che una nutrizionista in sola lettura apre la scheda e vede un errore al posto
   * dell'informazione. ⚠️ Ma la chiave della classe deve continuare a coprirlo: è pur sempre una
   * finestra sul pool di tutte.
   */
  it('⛔ `doveSta` legge: nessun `manage`, ma la chiave della classe vale lo stesso', () => {
    expect(pagina('doveSta')?.level).toBeUndefined();
    expect(Reflect.getMetadata(PAGE_KEY, PanieriController)).toMatchObject({ pageKey: 'panieri' });
    /** ⚠️ E nessun `@Roles` suo: vale quello della classe, che comprende chi propone le diete. */
    expect(ruoli('doveSta')).toBeUndefined();
  });
});
