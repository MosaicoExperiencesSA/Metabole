import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateClientDto } from './dto/update-client.dto';

const USER_FIELDS = ['firstName', 'lastName', 'addressLine', 'postalCode', 'city', 'province', 'phone'] as const;
const PROFILE_FIELDS = ['name', 'age', 'sex', 'heightCm', 'startWeightKg', 'startWaistCm', 'startHipsCm', 'regime', 'dietStyle', 'mealsPerDay', 'pathType', 'coachStyle', 'character', 'intolerances', 'dislikedFoods', 'themeColor'] as const;

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
      select: {
        id: true, email: true, role: true, status: true, locale: true, emailVerifiedAt: true, createdAt: true,
        firstName: true, lastName: true, addressLine: true, postalCode: true, city: true, province: true, phone: true,
      },
    });
    if (!user) throw new NotFoundException('Utente non trovato.');
    if (user.role !== 'client') {
      throw new ForbiddenException('Questa scheda è disponibile solo per i clienti.');
    }

    const [profile, objective, measurements, checkins, waterLogs, stepLogs, subscription, payments, crm, notes, pending] = await Promise.all([
      this.prisma.clientProfile.findUnique({
        where: { userId },
        include: {
          assignedCoach: { select: { displayName: true } },
          assignedNutritionist: { select: { displayName: true } },
        },
      }),
      this.prisma.objective.findFirst({ where: { clientId: userId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.measurement.findMany({ where: { clientId: userId }, orderBy: { date: 'desc' }, take: 60 }),
      this.prisma.dailyCheckin.findMany({
        where: { clientId: userId },
        orderBy: { date: 'desc' },
        take: 60,
        select: { id: true, date: true, mood: true, energy: true, hunger: true, stress: true },
      }),
      this.prisma.waterLog.findMany({
        where: { clientId: userId },
        orderBy: { date: 'desc' },
        take: 60,
        select: { id: true, date: true, glasses: true, goal: true },
      }),
      this.prisma.stepLog.findMany({
        where: { clientId: userId },
        orderBy: { date: 'desc' },
        take: 60,
        select: { id: true, date: true, steps: true, goal: true },
      }),
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
      this.prisma.clientNote.findMany({
        where: { clientId: userId },
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: { id: true, body: true, createdAt: true, author: { select: { displayName: true } } },
      }),
      this.prisma.pendingCommission.findMany({
        where: { clientId: userId, status: 'pending' },
        orderBy: { createdAt: 'desc' },
        select: { id: true, role: true, amountCents: true, createdAt: true },
      }),
    ]);

    await this.audit.log({ action: 'client.detail.view', actorId, entityType: 'user', entityId: userId });

    return {
      user,
      profile, // include onboardingAnswers, consents, screeningFlag, ecc.
      objective,
      measurements,
      checkins,
      waterLogs,
      stepLogs,
      subscription,
      payments,
      crm,
      notes: (notes as { id: string; body: string; createdAt: Date; author: { displayName: string } | null }[]).map((n) => ({
        id: n.id,
        body: n.body,
        createdAt: n.createdAt,
        author: n.author?.displayName ?? null,
      })),
      pendingCommissions: (pending as { id: string; role: string; amountCents: number; createdAt: Date }[]).map((p) => ({
        id: p.id,
        role: p.role,
        amountCents: p.amountCents,
        createdAt: p.createdAt,
      })),
    };
  }

  /** Aggiunge una nota al log dello staff sul cliente. */
  async addNote(userId: string, actorId: string, body: string) {
    const text = body.trim();
    if (!text) throw new BadRequestException('La nota è vuota.');

    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, role: true },
    });
    if (!user) throw new NotFoundException('Utente non trovato.');
    if (user.role !== 'client') throw new ForbiddenException('La nota è disponibile solo per i clienti.');

    const staff = await this.prisma.staff.findUnique({ where: { userId: actorId }, select: { id: true } });
    const created = await this.prisma.clientNote.create({
      data: { clientId: userId, body: text.slice(0, 5000), authorId: staff?.id },
      select: { id: true, body: true, createdAt: true, author: { select: { displayName: true } } },
    });
    await this.audit.log({ action: 'client.note.add', actorId, entityType: 'user', entityId: userId });
    return { id: created.id, body: created.body, createdAt: created.createdAt, author: created.author?.displayName ?? null };
  }

  /** Elimina una nota dal log (solo admin, controllato dal controller). */
  async deleteNote(userId: string, noteId: string, actorId: string) {
    const note = await this.prisma.clientNote.findUnique({ where: { id: noteId }, select: { id: true, clientId: true } });
    if (!note || note.clientId !== userId) throw new NotFoundException('Nota non trovata.');
    await this.prisma.clientNote.delete({ where: { id: noteId } });
    await this.audit.log({ action: 'client.note.delete', actorId, entityType: 'user', entityId: userId, metadata: { noteId } });
    return { removed: noteId };
  }

  /** Invia alla cliente l'email per reimpostare la password (nessuna password gestita dallo staff). */
  async sendPasswordReset(userId: string, actorId: string, ip?: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw new NotFoundException('Utente non trovato.');
    await this.auth.requestPasswordReset(user.email, ip);
    await this.audit.log({ action: 'client.password_reset.trigger', actorId, entityType: 'user', entityId: userId });
    return { sent: true, email: user.email };
  }

  /**
   * Eliminazione DEFINITIVA di un cliente/lead e di tutto ciò che gli è collegato.
   * Solo admin. Il lead (CrmRecord) è in SetNull, quindi va cancellato esplicitamente;
   * tutto il resto (profilo, misure, check-in, acquisti, ecc.) va a cascata via schema.
   */
  async hardDelete(userId: string, actorId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true },
    });
    if (!user) throw new NotFoundException('Cliente non trovato.');
    if (user.role !== 'client') {
      throw new BadRequestException('Si possono eliminare solo i clienti, non lo staff.');
    }
    // Audit PRIMA della cancellazione (dopo, l'utente non esiste più).
    await this.audit.log({
      action: 'client.hard_delete',
      actorId,
      entityType: 'user',
      entityId: userId,
      metadata: { email: user.email },
    });
    await this.prisma.$transaction([
      this.prisma.crmRecord.deleteMany({ where: { clientId: userId } }),
      this.prisma.user.delete({ where: { id: userId } }),
    ]);
    return { deleted: true };
  }

  /** Aggiorna anagrafica (User) e questionario (ClientProfile) di un cliente. */
  async updateClient(userId: string, actorId: string, dto: UpdateClientDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
    if (!user) throw new NotFoundException('Cliente non trovato.');
    if (user.role !== 'client') throw new BadRequestException('Modificabile solo per i clienti.');

    const d = dto as Record<string, unknown>;
    const userData: Record<string, unknown> = {};
    for (const k of USER_FIELDS) if (d[k] !== undefined) userData[k] = d[k] === '' ? null : d[k];
    const profileData: Record<string, unknown> = {};
    for (const k of PROFILE_FIELDS) if (d[k] !== undefined) profileData[k] = d[k] === '' ? null : d[k];

    const ops: unknown[] = [];
    if (Object.keys(userData).length) ops.push(this.prisma.user.update({ where: { id: userId }, data: userData as never }));
    if (Object.keys(profileData).length) {
      ops.push(
        this.prisma.clientProfile.upsert({
          where: { userId },
          update: profileData as never,
          create: { userId, ...profileData } as never,
        }),
      );
    }
    if (ops.length) await this.prisma.$transaction(ops as never);
    await this.audit.log({ action: 'client.update', actorId, entityType: 'user', entityId: userId });
    return { updated: true };
  }
}
