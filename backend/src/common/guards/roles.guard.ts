import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthUser } from '../interfaces/auth-user.interface';
import { Role } from '../roles';

/**
 * RBAC: se la rotta dichiara @Roles(...), l'utente deve avere uno dei ruoli.
 * Senza @Roles la rotta è aperta a qualsiasi utente autenticato.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser | undefined;
    if (!user) return false; // JwtAuthGuard non ha popolato l'utente (rotta @Public con @Roles: errore di config)

    if (!required.includes(user.role)) {
      throw new ForbiddenException('Ruolo non autorizzato per questa risorsa');
    }
    return true;
  }
}
