/**
 * ⛔ **LA RIGA MANCANTE, LATO SERVER: dove il difetto di `INHERIT_DEFAULTS` non era una voce di
 * menu ma una porta.**
 *
 * `INHERIT_DEFAULTS` promette che «separare una schermata nei Permessi non toglie accesso a
 * nessuno». La prima correzione del 2/9 sistemava `syncDefaults` — chi **crea** la riga — e
 * lasciava scoperti i due punti che risolvono la riga **mancante a tempo di richiesta**: questo
 * guardiano e `ruoloPuo`. Ripiegavano sui `DEFAULT_PERMISSIONS` arricchiti, cioè sul meccanismo
 * dichiarato rotto.
 *
 * ⚠️ **E non è una finestra teorica**: `onModuleInit` assorbe l'errore di `syncDefaults` con un
 * `warn`, quindi un singhiozzo del database all'avvio lascia un'istanza viva **per sempre** con le
 * righe mancanti. L'ha trovata la revisione avversariale provandola sul guardiano vero.
 */
import { ForbiddenException } from '@nestjs/common';
import { PageGuard } from './page.guard';
import { PAGE_KEY } from '../decorators/require-page.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

function contesto(pageKey: string, ruoloUtente: string, metodo = 'GET') {
  const reflector = {
    getAllAndOverride: jest.fn((chiave: unknown) => {
      if (chiave === IS_PUBLIC_KEY) return undefined;
      if (chiave === PAGE_KEY) return { pageKey };
      if (chiave === ROLES_KEY) return undefined;
      return undefined;
    }),
  };
  const ctx = {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ method: metodo, user: { sub: 'u1', role: ruoloUtente } }) }),
  };
  return { reflector, ctx };
}

/** Una matrice in cui esistono SOLO le righe elencate: tutte le altre sono «mancanti». */
const prismaCon = (righe: Record<string, { canView: boolean; canManage: boolean }>) => ({
  rolePagePermission: {
    findUnique: jest.fn(({ where }: { where: { role_pageKey: { role: string; pageKey: string } } }) =>
      Promise.resolve(righe[`${where.role_pageKey.role}:${where.role_pageKey.pageKey}`] ?? null)),
  },
});

const passa = async (guard: PageGuard, ctx: unknown) => {
  try { return await guard.canActivate(ctx as never); } catch (e) {
    if (e instanceof ForbiddenException) return false;
    throw e;
  }
};

describe('PageGuard — una riga mancante vale quanto la riga del genitore', () => {
  /**
   * ⛔ **IL VERSO CHE NON SI VEDE.** Simone aveva spento a mano `diets_catalog` al capo
   * nutrizionista, dove il default lo dà acceso. Col difetto, `equivalence_groups` — che non ha una
   * riga sua — valeva **acceso**: la pagina tornava a chi il catalogo era stato tolto.
   */
  it('⛔ genitore SPENTO a mano: la figlia senza riga NON passa', async () => {
    const prisma = prismaCon({ 'head_nutritionist:diets_catalog': { canView: false, canManage: false } });
    const { reflector, ctx } = contesto('equivalence_groups', 'head_nutritionist');
    const guard = new PageGuard(reflector as never, prisma as never);
    expect(await passa(guard, ctx)).toBe(false);
  });

  /**
   * ⛔ **E IL VERSO CHE SI VEDE.** Acceso a mano dove il default è spento: col difetto la pagina
   * spariva a chi doveva averla.
   */
  it('⛔ genitore ACCESO a mano: la figlia senza riga passa', async () => {
    const prisma = prismaCon({ 'coach:diets_catalog': { canView: true, canManage: true } });
    const { reflector, ctx } = contesto('equivalence_groups', 'coach');
    const guard = new PageGuard(reflector as never, prisma as never);
    expect(await passa(guard, ctx)).toBe(true);
  });

  it('⚠️ e il livello si eredita separato: sola vista non dà la gestione', async () => {
    const prisma = prismaCon({ 'coach:diets_catalog': { canView: true, canManage: false } });
    const vista = contesto('equivalence_groups', 'coach', 'GET');
    const gestione = contesto('equivalence_groups', 'coach', 'POST');
    expect(await passa(new PageGuard(vista.reflector as never, prisma as never), vista.ctx)).toBe(true);
    expect(await passa(new PageGuard(gestione.reflector as never, prisma as never), gestione.ctx)).toBe(false);
  });

  it('la riga PROPRIA della figlia comanda su quella del genitore', async () => {
    const prisma = prismaCon({
      'coach:diets_catalog': { canView: false, canManage: false },
      'coach:equivalence_groups': { canView: true, canManage: true },
    });
    const { reflector, ctx } = contesto('equivalence_groups', 'coach');
    expect(await passa(new PageGuard(reflector as never, prisma as never), ctx)).toBe(true);
  });

  /**
   * ⛔ **LA PORTA VERA: `diet_workspace` è figlia di `diets_catalog` e concede `recipes`.**
   *
   * Ereditare la riga del genitore le darebbe di aprire `recipes` — che il genitore non apre — a
   * un ruolo a cui `recipes` era stato tolto. È il caso che la revisione ha provato sul guardiano:
   * `diets_catalog` acceso a mano, `recipes` spento, riga `diet_workspace` mancante, e una rotta
   * `@RequirePage('recipes')` in gestione passava. Adesso le pagine «hub» non ereditano.
   */
  it('⛔ una figlia «hub» non eredita: `diets_catalog` acceso a mano non apre `recipes`', async () => {
    // La coach non ha `diet_workspace` nei default: se lo ereditasse dal catalogo acceso a mano,
    // entrerebbe in `recipes` — che nessuno le ha dato — attraverso l'hub.
    const prisma = prismaCon({ 'coach:diets_catalog': { canView: true, canManage: true } });
    const { reflector, ctx } = contesto('recipes', 'coach', 'PATCH');
    expect(await passa(new PageGuard(reflector as never, prisma as never), ctx)).toBe(false);
  });

  /**
   * ⚠️ **E QUESTO NON È UN DIFETTO, È IL PROGETTO — ma va scritto, o al primo controllo sembra un
   * buco.** Il nutrizionista ha «Gestione dieta» nei **default**: spegnergli `recipes` a mano non
   * gli chiude le API delle ricette, perché ci entra dall'hub. È il motivo per cui `PAGE_GRANTS`
   * esiste — «bastano poche voci di menu per gestire tutto» — e per togliergliele davvero bisogna
   * spegnere anche gli hub. Voce `togliere-una-chiave-non-basta-se-c-e-un-hub`.
   */
  it('⚠️ ma spegnere `recipes` a un ruolo che ha l\'hub nei default non gli chiude la porta', async () => {
    const prisma = prismaCon({ 'nutritionist:recipes': { canView: false, canManage: false } });
    const { reflector, ctx } = contesto('recipes', 'nutritionist', 'PATCH');
    expect(await passa(new PageGuard(reflector as never, prisma as never), ctx)).toBe(true);
  });

  /**
   * ⚠️ E l'hub continua a fare il suo mestiere quando **ha** la sua riga: chi ha «Gestione dieta»
   * entra nelle API di ricette e catalogo, che è il motivo per cui `PAGE_GRANTS` esiste.
   */
  it('⚠️ ma con la sua riga l\'hub concede come sempre', async () => {
    const prisma = prismaCon({
      'nutritionist:diet_workspace': { canView: true, canManage: true },
      'nutritionist:recipes': { canView: false, canManage: false },
    });
    const { reflector, ctx } = contesto('recipes', 'nutritionist', 'PATCH');
    expect(await passa(new PageGuard(reflector as never, prisma as never), ctx)).toBe(true);
  });

  it('⚠️ una pagina senza genitore e senza riga resta sui suoi default', async () => {
    const prisma = prismaCon({});
    const coach = contesto('clients', 'coach');
    const sales = contesto('clients', 'sales');
    expect(await passa(new PageGuard(coach.reflector as never, prisma as never), coach.ctx)).toBe(true);
    expect(await passa(new PageGuard(sales.reflector as never, prisma as never), sales.ctx)).toBe(false);
  });

  it('⚠️ e l\'admin passa comunque, prima di ogni lettura', async () => {
    const prisma = prismaCon({ 'admin:diets_catalog': { canView: false, canManage: false } });
    const { reflector, ctx } = contesto('equivalence_groups', 'admin');
    expect(await passa(new PageGuard(reflector as never, prisma as never), ctx)).toBe(true);
    expect(prisma.rolePagePermission.findUnique).not.toHaveBeenCalled();
  });
});
