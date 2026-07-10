import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { isSystemRole } from '../common/roles';
import { PrismaService } from '../prisma/prisma.service';
import { RolesService } from '../roles/roles.service';
import { BACKOFFICE_PAGES, PageKey } from './pages';

@Injectable()
export class PermissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly roles: RolesService,
  ) {}

  /** Matrice completa: elenco ruoli (sistema + personalizzati) + permessi per ruolo. */
  async getMatrix() {
    const [rows, roleList] = await Promise.all([
      this.prisma.rolePagePermission.findMany({ orderBy: [{ role: 'asc' }, { pageKey: 'asc' }] }),
      this.roles.listAll(),
    ]);
    const byRole: Record<string, { pageKey: string; canView: boolean; canManage: boolean }[]> = {};
    for (const row of rows) {
      (byRole[row.role] ??= []).push({
        pageKey: row.pageKey,
        canView: row.canView,
        canManage: row.canManage,
      });
    }
    return { pages: BACKOFFICE_PAGES, roles: roleList, matrix: byRole };
  }

  /** Permessi del ruolo EFFETTIVO dell'utente (per costruire il menu del frontend). */
  async getForRole(effectiveRole: string) {
    const rows = await this.prisma.rolePagePermission.findMany({
      where: { role: effectiveRole, canView: true },
      orderBy: { pageKey: 'asc' },
      select: { pageKey: true, canView: true, canManage: true },
    });
    return { role: effectiveRole, pages: rows };
  }

  async update(
    input: { role: string; pageKey: string; canView?: boolean; canManage?: boolean },
    actorId: string,
  ) {
    const valid = await this.roles.validKeys();
    if (!valid.has(input.role)) {
      throw new BadRequestException(`Ruolo sconosciuto: ${input.role}`);
    }
    if (!BACKOFFICE_PAGES.includes(input.pageKey as PageKey)) {
      throw new BadRequestException(`Sezione sconosciuta: ${input.pageKey}`);
    }
    // Anti-lockout: l'admin (ruolo di sistema) non può perdere la gestione permessi.
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
        system: isSystemRole(input.role),
        from: existing ? { canView: existing.canView, canManage: existing.canManage } : null,
        to: { canView: updated.canView, canManage: updated.canManage },
      },
    });
    return updated;
  }
}
