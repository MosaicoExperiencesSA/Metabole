import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthUser } from '../interfaces/auth-user.interface';

/**
 * Guardia JWT globale: tutte le rotte richiedono un access token valido,
 * tranne quelle marcate con @Public().
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const token = this.extractBearer(request.headers?.authorization);
    if (!token) throw new UnauthorizedException('Token mancante');

    try {
      const payload = await this.jwtService.verifyAsync<AuthUser & { scope?: string }>(token);
      // I token "widget" (lunga scadenza) valgono SOLO sull'endpoint pubblico del widget.
      if (payload.scope === 'widget') throw new UnauthorizedException('Token widget non valido qui');
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Token non valido o scaduto');
    }
  }

  private extractBearer(header?: string): string | null {
    if (!header) return null;
    const [type, token] = header.split(' ');
    return type === 'Bearer' && token ? token : null;
  }
}
