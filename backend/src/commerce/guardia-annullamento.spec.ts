import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { PAGE_KEY } from '../common/decorators/require-page.decorator';
import { BACKOFFICE_PAGES, DEFAULT_PERMISSIONS } from '../permissions/pages';
import { AdminSubscriptionsController } from './commerce.controller';

/**
 * CHI PUÒ ANNULLARE UN ABBONAMENTO — il decoratore, non il servizio.
 *
 * Il × sulla pastiglia del piano è nato il 17/8 con `@Roles('admin')`, «come lo storno». La gravità
 * era giusta e il cancello sbagliato: chi gestisce i piani ogni giorno è il capo nutrizionista, e
 * dalla sua utenza il pulsante non si vedeva nemmeno — l'unica strada era entrare come admin, cioè
 * fare la cosa grave con l'utenza sbagliata e lasciare «admin» scritto nel registro.
 *
 * ⚠️ Questi test guardano i **decoratori**, che è l'unico posto dove «chi può bussare» si vede senza
 * avviare l'applicazione: è la stessa lezione di `chat/guardie-rotte.spec.ts`, dove una decisione
 * implementata nel servizio moriva su un guardiano che nessun test leggeva.
 */
describe('Guardia dell\'annullamento abbonamento', () => {
  const pagina = (metodo: string) =>
    Reflect.getMetadata(PAGE_KEY, (AdminSubscriptionsController.prototype as never as Record<string, () => unknown>)[metodo]) as
      | { pageKey: string; level?: string }
      | undefined;

  it('la chiave esiste fra le pagine del backoffice (altrimenti non compare in Permessi)', () => {
    expect(BACKOFFICE_PAGES).toContain('cancel_subscription');
  });

  it('annullare chiede `cancel_subscription` in GESTIONE, esplicitamente', () => {
    // `level` scritto e non dedotto dal metodo HTTP: è una POST e `manage` verrebbe dedotto
    // comunque, ma il giorno in cui la rotta cambiasse verbo il livello non deve cambiare per caso.
    expect(pagina('cancel')).toEqual({ pageKey: 'cancel_subscription', level: 'manage' });
  });

  it('⚠️ NON resta appeso a `@Roles(\'admin\')`: con quello la spunta in pagina Permessi non deciderebbe niente', () => {
    const ruoliClasse: string[] = Reflect.getMetadata(ROLES_KEY, AdminSubscriptionsController) ?? [];
    const ruoliMetodo: string[] =
      Reflect.getMetadata(ROLES_KEY, (AdminSubscriptionsController.prototype as never as Record<string, () => unknown>).cancel) ?? [];
    expect([...ruoliClasse, ...ruoliMetodo]).toEqual([]);
  });

  it('di default lo ha SOLO l\'admin: gli altri li abilita Simone dalla tabella', () => {
    expect(DEFAULT_PERMISSIONS.admin?.cancel_subscription).toEqual({ view: true, manage: true });
    for (const ruolo of ['head_nutritionist', 'nutritionist', 'coach', 'coach_coordinator', 'sales', 'client'] as const) {
      expect(DEFAULT_PERMISSIONS[ruolo]?.cancel_subscription).toBeUndefined();
    }
  });

  it('⚠️ e il permesso nasce con `view: true`: `getForRole` filtra su `canView`, quindi un `manage` senza `view` non arriverebbe mai al backoffice', () => {
    expect(DEFAULT_PERMISSIONS.admin?.cancel_subscription?.view).toBe(true);
  });
});
