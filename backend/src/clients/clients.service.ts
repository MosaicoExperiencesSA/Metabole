import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Scheda cliente per lo staff: aggrega anagrafica, questionario, obiettivo,
 * pesate (misure), acquisti e stato CRM in un'unica vista.
 */
@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly audit: AuditService,
  ) {}

  async getDetail(userId: string, actorId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, email: true, role: true, status: true, locale: true, emailVerifiedAt: true, createdAt: true },
    });
    if (!user) throw new NotFoundException('Utente non trovato.');
    if (user.role !== 'client') {
      throw new ForbiddenException('Questa scheda è disponibile solo per i clienti.');
    }

    const [profile, objective, measurements, subscription, payments, crm] = await Promise.all([
      this.prisma.clientProfile.findUnique({
        where: { userId },
        include: {
          assignedCoach: { select: { displayName: true } },
          assignedNutritionist: { select: { displayName: true } },
        },
      }),
      this.prisma.objective.findFirst({ where: { clientId: userId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.measurement.findMany({ where: { clientId: userId }, orderBy: { date: 'desc' }, take: 60 }),
      this.prisma.subscription.findFirst({
        where: { clientId: userId },
        orderBy: { createdAt: 'desc' },
        include: { plan: { select: { name: true, priceCents: true, period: true } } },
      }),
      this.prisma.payment.findMany({
        where: { clientId: userId },
        orderBy: { createdAt: 'desc' },
        take: 40,
        select: { id: true, amountCents: true, description: true, method: true, status: true, createdAt: true, approvedAt: true },
      }),
      this.prisma.crmRecord.findUnique({ where: { clientId: userId }, select: { stage: true, valueCents: true, ownerId: true } }),
    ]);

    await this.audit.log({ action: 'client.detail.view', actorId, entityType: 'user', entityId: userId });

    return {
      user,
      profile, // include onboardingAnswers, consents, screeningFlag, ecc.
      objective,
      measurements,
      subscription,
      payments,
      crm,
    };
  }

  /** Invia alla cliente l'email per reimpostare la password (nessuna password gestita dallo staff). */
  async sendPasswordReset(userId: string, actorId: string, ip?: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw new NotFoundException('Utente non trovato.');
    await this.auth.requestPasswordReset(user.email, ip);
    await this.audit.log({ action: 'client.password_reset.trigger', actorId, entityType: 'user', entityId: userId });
    return { sent: true, email: user.email };
  }
}
