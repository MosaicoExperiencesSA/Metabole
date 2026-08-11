import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { SolaLetturaImpersonazioneGuard } from './sola-lettura-impersonazione.guard';

/** Un contesto Nest ridotto a quello che la guardia guarda davvero. */
function ctx(req: Record<string, unknown>): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
}

const IMPERSONATA = { sub: 'cli-1', email: 'a@b.it', role: 'client', impersonatedBy: 'admin-1' };
const NORMALE = { sub: 'cli-1', email: 'a@b.it', role: 'client' };

describe('SolaLetturaImpersonazioneGuard', () => {
  const guardia = new SolaLetturaImpersonazioneGuard();

  it('lascia passare tutto a chi NON sta impersonando', () => {
    expect(guardia.canActivate(ctx({ method: 'POST', path: '/api/v1/me/measures', user: NORMALE }))).toBe(true);
    expect(guardia.canActivate(ctx({ method: 'DELETE', path: '/api/v1/me/account', user: NORMALE }))).toBe(true);
  });

  it('lascia passare le letture anche sotto impersonazione', () => {
    for (const method of ['GET', 'HEAD', 'OPTIONS', 'get']) {
      expect(guardia.canActivate(ctx({ method, path: '/api/v1/me/menu', user: IMPERSONATA }))).toBe(true);
    }
  });

  it('rifiuta ogni scrittura sotto impersonazione, spiegando perché', () => {
    for (const method of ['POST', 'PATCH', 'PUT', 'DELETE']) {
      const chiamata = () => guardia.canActivate(ctx({ method, path: '/api/v1/me/measures', user: IMPERSONATA }));
      expect(chiamata).toThrow(ForbiddenException);
      expect(chiamata).toThrow(/SOLA LETTURA/);
    }
  });

  it('lascia uscire: POST /auth/logout passa anche sotto impersonazione', () => {
    expect(guardia.canActivate(ctx({ method: 'POST', path: '/api/v1/auth/logout', user: IMPERSONATA }))).toBe(true);
    // Con lo slash finale e con la query: è la stessa rotta.
    expect(guardia.canActivate(ctx({ method: 'POST', path: '/api/v1/auth/logout/', user: IMPERSONATA }))).toBe(true);
    expect(guardia.canActivate(ctx({ method: 'POST', url: '/api/v1/auth/logout?all=1', user: IMPERSONATA }))).toBe(true);
  });

  it('NON lascia passare «passa all\'altro profilo»: da una sessione impersonata sarebbe una scala', () => {
    expect(() => guardia.canActivate(ctx({ method: 'POST', path: '/api/v1/auth/switch', user: IMPERSONATA }))).toThrow(ForbiddenException);
  });

  it('una rotta che CONTIENE «/auth/logout» ma non finisce lì non passa', () => {
    expect(() => guardia.canActivate(ctx({ method: 'POST', path: '/api/v1/auth/logout/tutti-i-device', user: IMPERSONATA }))).toThrow(ForbiddenException);
  });

  it('nessun utente in richiesta: non è affare di questa guardia', () => {
    expect(guardia.canActivate(ctx({ method: 'POST', path: '/api/v1/auth/login' }))).toBe(true);
  });
});
