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

  async create(
    data: { email: string; password: string; role: Role; locale?: string },
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
    await this.audit.log({
      action: 'admin.user.create',
      actorId,
      entityType: 'user',
      entityId: user.id,
      metadata: { role: data.role },
    });
    return user;
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
