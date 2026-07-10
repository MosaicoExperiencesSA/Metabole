import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { isSystemRole, Role, STAFF_ROLES, SYSTEM_ROLE_LABELS } from '../common/roles';
import { PrismaService } from '../prisma/prisma.service';

export interface RoleInfo {
  key: string;
  label: string;
  color: string | null;
  isSystem: boolean;
  baseRole: Role; // per i ruoli di sistema coincide con key
}

/**
 * Ruoli del backoffice: i 6 di sistema (immutabili, con la logica di business)
 * più i ruoli PERSONALIZZATI creati dall'admin. Un ruolo personalizzato è
 * "etichetta + colore + ruolo di sistema di base": eredita i permessi reali del
 * ruolo di base (il backend continua a controllare `user.role`), ma ha un menu
 * su misura nella matrice permessi.
 */
@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private static readonly SYSTEM_COLORS: Partial<Record<Role, string>> = {
    admin: '#c0392b',
    head_nutritionist: '#6c5ab7',
    nutritionist: '#6c5ab7',
    coach: '#12a386',
    sales: '#b8863b',
    client: '#7c8c88',
  };

  /** Tutti i ruoli (sistema staff + personalizzati), per liste e matrice. */
  async listAll(): Promise<RoleInfo[]> {
    const system: RoleInfo[] = STAFF_ROLES.map((r) => ({
      key: r,
      label: SYSTEM_ROLE_LABELS[r],
      color: RolesService.SYSTEM_COLORS[r] ?? null,
      isSystem: true,
      baseRole: r,
    }));
    const custom = await this.prisma.customRole.findMany({ orderBy: { label: 'asc' } });
    const customInfos: RoleInfo[] = (custom as { key: string; label: string; color: string | null; baseRole: Role }[]).map((c) => ({
      key: c.key,
      label: c.label,
      color: c.color,
      isSystem: false,
      baseRole: c.baseRole,
    }));
    return [...system, ...customInfos];
  }

  /** Chiavi valide (sistema + custom): per validare i permessi. */
  async validKeys(): Promise<Set<string>> {
    const custom = await this.prisma.customRole.findMany({ select: { key: true } });
    return new Set<string>([...STAFF_ROLES, 'client', ...custom.map((c: { key: string }) => c.key)]);
  }

  /** Ruolo effettivo di un utente = ruolo personalizzato se presente, altrimenti quello di sistema. */
  effectiveKey(user: { role: string; customRoleKey?: string | null }): string {
    return user.customRoleKey ?? user.role;
  }

  async create(
    input: { label: string; baseRole: string; color?: string },
    actorId: string,
  ): Promise<RoleInfo> {
    const label = input.label.trim();
    if (label.length < 2) throw new BadRequestException('Nome del ruolo troppo corto.');
    if (!isSystemRole(input.baseRole) || input.baseRole === 'client') {
      throw new BadRequestException('Ruolo di base non valido: scegli un ruolo di sistema (coach, nutrizionista, capo, commerciale, admin).');
    }
    const key = this.slug(label);
    if (isSystemRole(key)) throw new BadRequestException('Questo nome coincide con un ruolo di sistema: scegline un altro.');
    const exists = await this.prisma.customRole.findUnique({ where: { key } });
    if (exists) throw new BadRequestException('Esiste già un ruolo con un nome simile.');

    const created = await this.prisma.customRole.create({
      data: { key, label, color: input.color ?? RolesService.SYSTEM_COLORS[input.baseRole as Role] ?? null, baseRole: input.baseRole as Role, createdById: actorId },
    });

    // Eredita i permessi (visibilità menu) del ruolo di base come punto di partenza.
    const baseRows = await this.prisma.rolePagePermission.findMany({ where: { role: input.baseRole } });
    if (baseRows.length > 0) {
      await this.prisma.rolePagePermission.createMany({
        data: (baseRows as { pageKey: string; canView: boolean; canManage: boolean }[]).map((r) => ({
          role: key,
          pageKey: r.pageKey,
          canView: r.canView,
          canManage: r.canManage,
          updatedById: actorId,
        })),
        skipDuplicates: true,
      });
    }

    await this.audit.log({
      action: 'admin.role.create',
      actorId,
      entityType: 'custom_role',
      entityId: key,
      metadata: { label, baseRole: input.baseRole },
    });
    return { key: created.key, label: created.label, color: created.color, isSystem: false, baseRole: created.baseRole as Role };
  }

  async update(key: string, input: { label?: string; color?: string }, actorId: string): Promise<RoleInfo> {
    const role = await this.prisma.customRole.findUnique({ where: { key } });
    if (!role) throw new NotFoundException('Ruolo personalizzato non trovato.');
    const updated = await this.prisma.customRole.update({
      where: { key },
      data: {
        ...(input.label ? { label: input.label.trim() } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
      },
    });
    await this.audit.log({ action: 'admin.role.update', actorId, entityType: 'custom_role', entityId: key });
    return { key: updated.key, label: updated.label, color: updated.color, isSystem: false, baseRole: updated.baseRole as Role };
  }

  async remove(key: string, actorId: string): Promise<{ removed: string; reassigned: number }> {
    const role = await this.prisma.customRole.findUnique({ where: { key } });
    if (!role) throw new NotFoundException('Ruolo personalizzato non trovato.');
    // Gli utenti con questo ruolo tornano al ruolo di sistema di base (customRoleKey → null via FK).
    const affected = await this.prisma.user.count({ where: { customRoleKey: key } });
    await this.prisma.rolePagePermission.deleteMany({ where: { role: key } });
    await this.prisma.customRole.delete({ where: { key } }); // FK SetNull azzera customRoleKey sugli utenti
    await this.audit.log({
      action: 'admin.role.delete',
      actorId,
      entityType: 'custom_role',
      entityId: key,
      metadata: { reassignedUsers: affected },
    });
    return { removed: key, reassigned: affected };
  }

  private slug(label: string): string {
    return label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40);
  }
}
