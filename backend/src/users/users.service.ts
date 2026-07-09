import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuditService } from '../audit/audit.service';
import { Role } from '../common/roles';
import { PrismaService } from '../prisma/prisma.service';

const PUBLIC_USER_SELECT = {
  id: true,
  email: true,
  role: true,
  locale: true,
  status: true,
  emailVerifiedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(params: { role?: Role; page?: number; limit?: number }) {
    const take = Math.min(Math.max(params.limit ?? 50, 1), 200);
    const skip = (Math.max(params.page ?? 1, 1) - 1) * take;
    const where = {
      deletedAt: null,
      ...(params.role ? { role: params.role } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: PUBLIC_USER_SELECT,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page: params.page ?? 1, limit: take };
  }

  async getById(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: PUBLIC_USER_SELECT,
    });
    if (!user) throw new NotFoundException('Utente non trovato');
    return user;
  }

  private static readonly STAFF_ROLES: Role[] = [
    'coach',
    'nutritionist',
    'head_nutritionist',
    'sales',
  ];

  async create(
    data: {
      email: string;
      password: string;
      role: Role;
      locale?: string;
      displayName?: string;
    },
    actorId: string,
  ) {
    const email = data.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email già registrata');

    const passwordHash = await argon2.hash(data.password);
    const user = await this.prisma.user.create({
      data: { email, passwordHash, role: data.role, locale: data.locale ?? 'it' },
      select: PUBLIC_USER_SELECT,
    });

    // Per i ruoli di staff crea anche la scheda Staff (assegnazioni, agenda, team).
    if (UsersService.STAFF_ROLES.includes(data.role)) {
      await this.prisma.staff.create({
        data: {
          userId: user.id,
          displayName: data.displayName ?? email.split('@')[0],
        },
      });
    }

    await this.audit.log({
      action: 'admin.user.create',
      actorId,
      entityType: 'user',
      entityId: user.id,
      metadata: { role: data.role },
    });
    return user;
  }

  /** Assegna (o riassegna) coach e/o nutrizionista a una cliente. */
  async assign(
    data: { clientId: string; coachId?: string; nutritionistId?: string },
    actorId: string,
  ) {
    const profile = await this.prisma.clientProfile.findUnique({
      where: { userId: data.clientId },
    });
    if (!profile) {
      throw new NotFoundException(
        'Profilo cliente non trovato: la cliente deve completare il questionario.',
      );
    }
    if (data.coachId) await this.assertStaffRole(data.coachId, 'coach');
    if (data.nutritionistId) {
      await this.assertStaffRole(data.nutritionistId, 'nutritionist');
    }

    const updated = await this.prisma.clientProfile.update({
      where: { userId: data.clientId },
      data: {
        ...(data.coachId ? { assignedCoachId: data.coachId } : {}),
        ...(data.nutritionistId ? { assignedNutritionistId: data.nutritionistId } : {}),
      },
      include: {
        assignedCoach: { select: { id: true, displayName: true } },
        assignedNutritionist: { select: { id: true, displayName: true } },
      },
    });
    await this.audit.log({
      action: 'admin.assignment.update',
      actorId,
      entityType: 'client_profile',
      entityId: profile.id,
      metadata: { coachId: data.coachId, nutritionistId: data.nutritionistId },
    });
    return updated;
  }

  private async assertStaffRole(staffId: string, role: Role): Promise<void> {
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
      include: { user: { select: { role: true, status: true } } },
    });
    if (!staff || !staff.active || staff.user.status !== 'active' || staff.user.role !== role) {
      throw new NotFoundException(`Staff ${role} non valido o non attivo: ${staffId}`);
    }
  }

  async update(
    id: string,
    data: { role?: Role; status?: 'active' | 'suspended'; locale?: string },
    actorId: string,
  ) {
    await this.getById(id); // 404 se non esiste
    const user = await this.prisma.user.update({
      where: { id },
      data,
      select: PUBLIC_USER_SELECT,
    });
    if (data.status === 'suspended' || data.role) {
      // Cambi di ruolo o sospensione: revoca le sessioni attive.
      await this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    await this.audit.log({
      action: 'admin.user.update',
      actorId,
      entityType: 'user',
      entityId: id,
      metadata: data as Record<string, unknown>,
    });
    return user;
  }
}
