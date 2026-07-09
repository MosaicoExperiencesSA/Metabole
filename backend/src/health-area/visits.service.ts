import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Visite (spec sez. 11): la PRIMA visita è SEMPRE in presenza — il modulo
 * impedisce di prenotarla in telematica. La televisita vale solo per i controlli.
 * Dopo ogni visita l'obiettivo viene riconfermato (Objective.history).
 */
@Injectable()
export class VisitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Scheda staff + verifica che la cliente sia in carico (il capo vede tutte). */
  async assertPatientAccess(user: AuthUser, clientId: string) {
    const staff = await this.prisma.staff.findUnique({ where: { userId: user.sub } });
    if (!staff) throw new ForbiddenException('Nessuna scheda staff');
    if (user.role === 'head_nutritionist') return staff;
    const profile = await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { assignedNutritionistId: true },
    });
    if (!profile || profile.assignedNutritionistId !== staff.id) {
      throw new ForbiddenException('La cliente non è tra i tuoi pazienti');
    }
    return staff;
  }

  async listForClient(clientId: string) {
    return this.prisma.visit.findMany({
      where: { clientId },
      orderBy: { datetime: 'desc' },
      select: {
        id: true,
        type: true,
        datetime: true,
        status: true,
        videoRoomId: true,
        nutritionist: { select: { displayName: true } },
        // notes escluse: riservate allo staff sanitario
      },
    });
  }

  async agenda(user: AuthUser) {
    const staff = await this.prisma.staff.findUnique({ where: { userId: user.sub } });
    if (!staff) throw new ForbiddenException('Nessuna scheda staff');
    const where =
      user.role === 'head_nutritionist'
        ? { datetime: { gte: new Date(Date.now() - 86_400_000) } }
        : { nutritionistId: staff.id, datetime: { gte: new Date(Date.now() - 86_400_000) } };
    return this.prisma.visit.findMany({
      where,
      orderBy: { datetime: 'asc' },
      take: 100,
      include: {
        client: { select: { id: true, email: true, clientProfile: { select: { name: true } } } },
        nutritionist: { select: { displayName: true } },
      },
    });
  }

  async create(
    user: AuthUser,
    input: { clientId: string; type: 'in_person' | 'televisit'; datetime: string },
  ) {
    const staff = await this.assertPatientAccess(user, input.clientId);
    const when = new Date(input.datetime);
    if (Number.isNaN(when.getTime()) || when.getTime() < Date.now()) {
      throw new BadRequestException('Data/ora visita non valida o nel passato');
    }

    // VINCOLO NORMATIVO: prima visita sempre in presenza.
    const previousVisits = await this.prisma.visit.count({
      where: { clientId: input.clientId, status: { not: 'cancelled' } },
    });
    if (previousVisits === 0 && input.type === 'televisit') {
      throw new BadRequestException(
        'La prima visita deve essere in presenza (linee guida): la televisita vale solo per i controlli successivi.',
      );
    }

    const visit = await this.prisma.visit.create({
      data: {
        clientId: input.clientId,
        nutritionistId: staff.id,
        type: input.type as never,
        datetime: when,
      },
    });
    await this.audit.log({
      action: 'health.visit.create',
      actorId: user.sub,
      entityType: 'visit',
      entityId: visit.id,
      metadata: { clientId: input.clientId, type: input.type, first: previousVisits === 0 },
    });
    return visit;
  }

  /** Avvio televisita: genera la stanza video (placeholder per il provider WebRTC). */
  async start(user: AuthUser, visitId: string) {
    const visit = await this.prisma.visit.findUnique({ where: { id: visitId } });
    if (!visit) throw new NotFoundException('Visita non trovata');
    await this.assertPatientAccess(user, visit.clientId);
    if (visit.type !== 'televisit') {
      throw new BadRequestException('Solo le televisite hanno una stanza video');
    }
    if (visit.status !== 'scheduled') {
      throw new BadRequestException('La visita non è prenotata');
    }
    const videoRoomId = visit.videoRoomId ?? `metabole-${randomBytes(8).toString('hex')}`;
    const updated = await this.prisma.visit.update({
      where: { id: visitId },
      data: { videoRoomId },
    });
    await this.audit.log({
      action: 'health.visit.start',
      actorId: user.sub,
      entityType: 'visit',
      entityId: visitId,
    });
    return { visit: updated, joinUrl: `https://meet.example.eu/${videoRoomId}` };
  }

  /** Chiusura visita: note riservate + riconferma obiettivo (spec sez. 8). */
  async complete(
    user: AuthUser,
    visitId: string,
    input: { notes?: string; confirmObjective?: boolean },
  ) {
    const visit = await this.prisma.visit.findUnique({ where: { id: visitId } });
    if (!visit) throw new NotFoundException('Visita non trovata');
    const staff = await this.assertPatientAccess(user, visit.clientId);
    if (visit.status !== 'scheduled') {
      throw new BadRequestException('La visita non è in stato prenotato');
    }

    const updated = await this.prisma.visit.update({
      where: { id: visitId },
      data: { status: 'done', ...(input.notes ? { notes: input.notes } : {}) },
    });

    let objectiveReconfirmed = false;
    if (input.confirmObjective) {
      const objective = await this.prisma.objective.findFirst({
        where: { clientId: visit.clientId },
        orderBy: { createdAt: 'desc' },
      });
      if (objective) {
        const history = Array.isArray(objective.history) ? [...(objective.history as unknown[])] : [];
        history.push({
          at: new Date().toISOString(),
          event: 'reconfirmed_after_visit',
          visitId,
          byStaffId: staff.id,
        });
        await this.prisma.objective.update({
          where: { id: objective.id },
          data: {
            status: 'confirmed',
            confirmedByNutritionistAt: new Date(),
            history: history as never,
          },
        });
        objectiveReconfirmed = true;
      }
    }

    await this.audit.log({
      action: 'health.visit.complete',
      actorId: user.sub,
      entityType: 'visit',
      entityId: visitId,
      metadata: { objectiveReconfirmed },
    });
    return { visit: updated, objectiveReconfirmed };
  }
}
