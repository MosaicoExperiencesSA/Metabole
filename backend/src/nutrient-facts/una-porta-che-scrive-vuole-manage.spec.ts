import { PAGE_KEY } from '../common/decorators/require-page.decorator';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { BACKOFFICE_PAGES } from '../permissions/pages';
import { NutrientFactsController } from './nutrient-facts.controller';

/**
 * ⛔ **IL PULSANTE «RIFAI IL CONTO ADESSO» È UNA PORTA CHE SCRIVE, E VUOLE `manage`.**
 *
 * Aggiunto il 25/8 dopo la revisione avversariale, che ha misurato il buco: togliendo del tutto
 * `@RequirePage` dalla rotta nuova, **823 test restavano verdi**. Sarebbe rimasto solo `@Roles`, e
 * una nutrizionista in **sola lettura** avrebbe potuto lanciare un giro da trecento scritture — il
 * contrario esatto di «sola lettura».
 *
 * ⚠️ Regola di progetto (Simone, 13/8): *«tutte le pagine che aggiungiamo vanno gestite nei
 * permessi, sempre»*, e **la chiave nasce insieme alla guardia che la legge**. Questo test è la
 * guardia della guardia: non prova un comportamento, tiene fermo un decoratore — che è l'unica cosa
 * che nessun altro test guarda.
 */
describe('⛔ le porte che scrivono nella banca dati nutrizionale', () => {
  const pagina = (metodo: string) =>
    Reflect.getMetadata(PAGE_KEY, (NutrientFactsController.prototype as never as Record<string, () => unknown>)[metodo]) as
      | { pageKey: string; level?: string }
      | undefined;

  it('la chiave esiste fra le pagine del backoffice (altrimenti non compare in Permessi)', () => {
    expect(BACKOFFICE_PAGES).toContain('nutrient_facts');
  });

  it('⛔ «rifai il conto adesso» chiede `nutrient_facts` in scrittura', () => {
    expect(pagina('ricalcolaMancanti')).toEqual({ pageKey: 'nutrient_facts', level: 'manage' });
  });

  /**
   * ⚠️ E la porta che **legge** l'elenco resta in lettura: se chiedesse `manage` anche lei, la
   * nutrizionista in sola lettura non vedrebbe più la pagina — un permesso troppo stretto chiude
   * il servizio tanto quanto uno troppo largo lo apre.
   */
  it('l\'elenco si legge con la sola visione', () => {
    expect(pagina('mancanti')?.pageKey).toBe('nutrient_facts');
    expect(pagina('mancanti')?.level ?? 'view').toBe('view');
  });

  /** ⚠️ E nessuna cliente bussa a questo controller: i ruoli stanno sulla classe. */
  it('solo lo staff clinico entra', () => {
    const ruoli: string[] = Reflect.getMetadata(ROLES_KEY, NutrientFactsController) ?? [];
    expect(ruoli).toEqual(expect.arrayContaining(['admin', 'nutritionist', 'head_nutritionist']));
    expect(ruoli).not.toContain('client');
  });
});
