import { ForbiddenException } from '@nestjs/common';
import { PageGuard } from './page.guard';
import { PAGE_KEY } from '../decorators/require-page.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * IL FAIL-OPEN DEL PAGEGUARD, E LA PREMESSA CHE IL 17/8 HA SMESSO DI VALERE.
 *
 * Il guardiano, sugli errori di lettura dei permessi, tornava `true` con una motivazione scritta nel
 * suo docstring: «fail-open: @Roles resta applicato». Quel giorno due rotte sono passate da
 * `@Roles('admin')` alla sola chiave di matrice (`impersonate` l'11/8, `cancel_subscription` il
 * 17/8) — e `RolesGuard` **senza metadata lascia passare qualunque utente autenticato**.
 *
 * ⚠️ Lo scenario, trovato in revisione: un blip del database di trenta secondi, e una cliente loggata
 * chiama `POST /admin/subscriptions/:id/cancel`. `annullaAbbonamento` non verifica nessuna
 * proprietà: annulla il piano di chiunque, e nel registro resta il suo nome.
 *
 * Questi test tengono ferme le due metà della regola: dove c'è ancora un `@Roles` si resta
 * permissivi (un errore di lettura non deve chiudere fuori tutto lo staff da una pagina già
 * protetta dal ruolo); dove non c'è, si chiude.
 */
function contesto(meta: { pagina?: { pageKey: string; level?: string }; ruoli?: string[] }, ruoloUtente = 'client') {
  const reflector = {
    getAllAndOverride: jest.fn((chiave: unknown) => {
      if (chiave === IS_PUBLIC_KEY) return undefined;
      if (chiave === PAGE_KEY) return meta.pagina;
      if (chiave === ROLES_KEY) return meta.ruoli;
      return undefined;
    }),
  };
  const ctx = {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ method: 'POST', user: { sub: 'u1', role: ruoloUtente } }) }),
  };
  return { reflector, ctx };
}

/** Un Prisma che casca: è il blip di database che il fail-open doveva coprire. Nuovo a ogni test,
 *  altrimenti il conteggio delle chiamate lo eredita chi viene dopo. */
const prismaRotto = () => ({
  rolePagePermission: { findUnique: jest.fn().mockRejectedValue(new Error('pool esaurito')) },
});

describe('PageGuard — il fail-open vale solo se sotto c\'è ancora una rete', () => {
  it('⚠️ rotta SENZA @Roles (`cancel_subscription`): se i permessi non si leggono, si CHIUDE', async () => {
    const { reflector, ctx } = contesto({ pagina: { pageKey: 'cancel_subscription', level: 'manage' } });
    const prisma = prismaRotto();
    const guard = new PageGuard(reflector as never, prisma as never);
    await expect(guard.canActivate(ctx as never)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rotta CON @Roles: si resta permissivi come prima — il ruolo la protegge comunque', async () => {
    const { reflector, ctx } = contesto(
      { pagina: { pageKey: 'purchases' }, ruoli: ['admin', 'sales'] },
      'sales',
    );
    const prisma = prismaRotto();
    const guard = new PageGuard(reflector as never, prisma as never);
    await expect(guard.canActivate(ctx as never)).resolves.toBe(true);
  });

  it('l\'admin non passa nemmeno dal database: resta superutente', async () => {
    const { reflector, ctx } = contesto({ pagina: { pageKey: 'cancel_subscription', level: 'manage' } }, 'admin');
    const prisma = prismaRotto();
    const guard = new PageGuard(reflector as never, prisma as never);
    await expect(guard.canActivate(ctx as never)).resolves.toBe(true);
    expect(prisma.rolePagePermission.findUnique).not.toHaveBeenCalled();
  });

  it('una rotta senza `@RequirePage` non è affare di questo guardiano', async () => {
    const { reflector, ctx } = contesto({});
    const prisma = prismaRotto();
    const guard = new PageGuard(reflector as never, prisma as never);
    await expect(guard.canActivate(ctx as never)).resolves.toBe(true);
  });
});
