import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { Role, ROLES } from '../common/roles';
import { PrismaService } from '../prisma/prisma.service';
import { BACKOFFICE_PAGES, PageKey } from './pages';

@Injectable()
export class PermissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Matrice completa, raggruppata per ruolo (per la pagina admin del backoffice). */
  async getMatrix() {
    const rows = await this.prisma.rolePagePermission.findMany({
      orderBy: [{ role: 'asc' }, { pageKey: 'asc' }],
    });
    const byRole: Record<string, { pageKey: string; canView: boolean; canManage: boolean }[]> = {};
    for (const row of rows) {
      (byRole[row.role] ??= []).push({
        pageKey: row.pageKey,
        canView: row.canView,
        canManage: row.canManage,
      });
    }
    return { pages: BACKOFFICE_PAGES, roles: byRole };
  }

  /** Permessi del ruolo dell'utente autenticato (per costruire il menu del frontend). */
  async getForRole(role: Role) {
    const rows = await this.prisma.rolePagePermission.findMany({
      where: { role, canView: true },
      orderBy: { pageKey: 'asc' },
      select: { pageKey: true, canView: true, canManage: true },
    });
    return { role, pages: rows };
  }

  async update(
    input: { role: Role; pageKey: string; canView?: boolean; canManage?: boolean },
    actorId: string,
  ) {
    if (!ROLES.includes(input.role)) {
      throw new BadRequestException(`Ruolo sconosciuto: ${input.role}`);
    }
    if (!BACKOFFICE_PAGES.includes(input.pageKey as PageKey)) {
      throw new BadRequestException(`Sezione sconosciuta: ${input.pageKey}`);
    }
    if (input.role === 'admin' && input.pageKey === 'permissions') {
      throw new BadRequestException(
        'I permessi dell\'admin sulla gestione permessi non sono modificabili (protezione anti-lockout).',
      );
    }

    const existing = await this.prisma.rolePagePermission.findUnique({
      where: { role_pageKey: { role: input.role, pageKey: input.pageKey } },
    });
    const updated = await this.prisma.rolePagePermission.upsert({
      where: { role_pageKey: { role: input.role, pageKey: input.pageKey } },
      create: {
        role: input.role,
        pageKey: input.pageKey,
        canView: input.canView ?? false,
        canManage: input.canManage ?? false,
        updatedById: actorId,
      },
      update: {
        ...(input.canView !== undefined ? { canView: input.canView } : {}),
        ...(input.canManage !== undefined ? { canManage: input.canManage } : {}),
        updatedById: actorId,
      },
    });
    await this.audit.log({
      action: 'admin.permissions.update',
      actorId,
      entityType: 'role_page_permission',
      entityId: `${input.role}:${input.pageKey}`,
      metadata: {
        from: existing ? { canView: existing.canView, canManage: existing.canManage } : null,
        to: { canView: updated.canView, canManage: updated.canManage },
      },
    });
    return updated;
  }
}
