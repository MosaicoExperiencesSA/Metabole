import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { DEFAULT_PERMISSIONS, PageKey } from '../../permissions/pages';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PAGE_KEY, PageLevel } from '../decorators/require-page.decorator';
import { AuthUser } from '../interfaces/auth-user.interface';
import { Role } from '../roles';

/**
 * Applica la matrice permessi pagina×ruolo lato server (difesa in profondità):
 * se la rotta è taggata con @RequirePage, il ruolo deve avere view (GET) o manage
 * (modifiche) su quella pagina. Rotte non taggate → invariate (solo @Roles).
 * L'admin è sempre ammesso (superutente). Fail-open sugli errori di lookup:
 * resta comunque attivo @Roles.
 */
@Injectable()
export class PageGuard implements CanActivate {
  private readonly logger = new Logger(PageGuard.name);
  constructor(private readonly reflector: Reflector, private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;

    const meta = this.reflector.getAllAndOverride<{ pageKey: string; level?: PageLevel } | undefined>(
      PAGE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!meta?.pageKey) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user as AuthUser | undefined;
    if (!user) return false;
    if (user.role === 'admin') return true; // superutente

    const level: PageLevel = meta.level ?? (req.method === 'GET' ? 'view' : 'manage');
    try {
      const row = await this.prisma.rolePagePermission.findUnique({
        where: { role_pageKey: { role: user.role, pageKey: meta.pageKey } },
        select: { canView: true, canManage: true },
      });
      let allowed: boolean;
      if (row) {
        allowed = level === 'view' ? row.canView : row.canManage;
      } else {
        const def = DEFAULT_PERMISSIONS[user.role as Role]?.[meta.pageKey as PageKey];
        allowed = level === 'view' ? !!def?.view : !!def?.manage;
      }
      if (!allowed) throw new ForbiddenException('Non hai il permesso per questa sezione.');
      return true;
    } catch (e) {
      if (e instanceof ForbiddenException) throw e;
      this.logger.warn(`PageGuard lookup fallito (${user.role}/${meta.pageKey}): ${e instanceof Error ? e.message : e}`);
      return true; // fail-open: @Roles resta applicato
    }
  }
}
