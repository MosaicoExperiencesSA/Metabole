import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

function contextWith(user: unknown) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as never;
}

describe('RolesGuard (RBAC)', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);

  it('lascia passare se la rotta non dichiara ruoli', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(contextWith({ role: 'client' }))).toBe(true);
  });

  it('lascia passare il ruolo richiesto', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);
    expect(guard.canActivate(contextWith({ role: 'admin' }))).toBe(true);
  });

  it('blocca un ruolo non incluso (coach su rotta admin)', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);
    expect(() => guard.canActivate(contextWith({ role: 'coach' }))).toThrow(ForbiddenException);
  });

  it('blocca se manca l\'utente autenticato', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);
    expect(guard.canActivate(contextWith(undefined))).toBe(false);
  });
});
