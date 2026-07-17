import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { toDateOnly } from '../common/date-only';

/**
 * Congelamento abbonamento per vacanza ("pausa").
 *
 * Filosofia: la cliente che va in vacanza non deve perdere i giorni pagati. La
 * pausa sospende il menu (Event `pause_period`) E fa slittare in avanti la
 * scadenza dell'abbonamento (`subscription.endDate += giorni`).
 *
 * Regola concordata:
 *  - fino a 20 giorni → congelamento AUTOMATICO (nessuna approvazione);
 *  - da 21 a 90 giorni → serve l'OK dello staff assegnato (nutrizionista o coach):
 *    si crea una richiesta `pending` e si avvisano coach e nutrizionista;
 *  - oltre 90 giorni → non consentito da qui (va gestito manualmente).
 */
const FREEZE_AUTO_MAX_DAYS = 20;
const FREEZE_ABS_MAX_DAYS = 90;

@Injectable()
export class PauseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Giorni inclusivi tra due date (21→21 dello stesso mese = ... ). */
  private daysInclusive(start: Date, end: Date): number {
    return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  }

  // ---------- Cliente ----------

  /**
   * La cliente chiede una pausa. Ritorna lo stato: `auto_approved` (già
   * congelata) oppure `pending` (in attesa dello staff).
   */
  async requestPause(clientId: string, input: { startDate: string; endDate: string }) {
    const startDate = toDateOnly(input.startDate);
    const endDate = toDateOnly(input.endDate);
    if (endDate.getTime() < startDate.getTime()) {
      throw new BadRequestException('La fine non può precedere l\'inizio.');
    }
    const days = this.daysInclusive(startDate, endDate);
    if (days > FREEZE_ABS_MAX_DAYS) {
      throw new BadRequestException(
        `Una pausa può durare al massimo ${FREEZE_ABS_MAX_DAYS} giorni: per periodi più lunghi contatta il tuo staff.`,
      );
    }

    // Niente due richieste/pause sovrapposte in attesa.
    const overlapping = await this.prisma.pauseRequest.findFirst({
      where: {
        clientId,
        status: 'pending',
      },
    });
    if (overlapping) {
      throw new BadRequestException('Hai già una richiesta di pausa in attesa di approvazione.');
    }

    if (days <= FREEZE_AUTO_MAX_DAYS) {
      const event = await this.createPauseEvent(clientId, startDate, endDate);
      const newEnd = await this.freezeSubscription(clientId, days);
      const request = await this.prisma.pauseRequest.create({
        data: {
          clientId,
          startDate,
          endDate,
          days,
          status: 'auto_approved',
          eventId: event.id,
          decidedAt: new Date(),
        },
      });
      await this.audit.log({
        action: 'pause.auto_approved',
        actorId: clientId,
        entityType: 'pause_request',
        entityId: request.id,
        metadata: { days },
      });
      return {
        status: 'auto_approved' as const,
        days,
        newEndDate: newEnd ? newEnd.toISOString() : null,
      };
    }

    // >20 giorni: richiesta in attesa dello staff.
    const request = await this.prisma.pauseRequest.create({
      data: { clientId, startDate, endDate, days, status: 'pending' },
    });
    await this.audit.log({
      action: 'pause.requested',
      actorId: clientId,
      entityType: 'pause_request',
      entityId: request.id,
      metadata: { days },
    });
    await this.notifyAssignedStaff(clientId, days).catch(() => undefined);
    return { status: 'pending' as const, days };
  }

  /** Le richieste di pausa della cliente (storico + in attesa). */
  async myRequests(clientId: string) {
    return this.prisma.pauseRequest.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // ---------- Staff ----------

  /**
   * Vincolo di visibilità per lo staff: coach e nutrizionista vedono SOLO le
   * richieste delle clienti assegnate a loro; capo nutrizionista, manager coach
   * (sales) e admin vedono tutte. Ritorna il where sul clientProfile, o null.
   */
  private async staffScope(actorUserId: string): Promise<{ field: 'assignedCoachId' | 'assignedNutritionistId'; staffId: string } | null> {
    const actor = await this.prisma.user.findUnique({ where: { id: actorUserId }, select: { role: true } });
    const role = actor?.role as string | undefined;
    if (role !== 'coach' && role !== 'nutritionist') return null;
    const staff = (await this.prisma.staff.findUnique({ where: { userId: actorUserId }, select: { id: true } })) as { id: string } | null;
    return {
      field: role === 'coach' ? 'assignedCoachId' : 'assignedNutritionistId',
      staffId: staff?.id ?? '00000000-0000-0000-0000-000000000000',
    };
  }

  /** Richieste in attesa da approvare (scope per ruolo). */
  async pendingForStaff(actorUserId: string) {
    const scope = await this.staffScope(actorUserId);
    const rows = await this.prisma.pauseRequest.findMany({
      where: {
        status: 'pending',
        ...(scope
          ? { client: { clientProfile: { [scope.field]: scope.staffId } } }
          : {}),
      } as never,
      orderBy: { createdAt: 'asc' },
      include: {
        client: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
            clientProfile: { select: { name: true } },
          },
        },
      },
      take: 200,
    });
    type Row = {
      id: string;
      clientId: string;
      startDate: Date;
      endDate: Date;
      days: number;
      createdAt: Date;
      client: { email: string; firstName: string | null; lastName: string | null; clientProfile: { name: string | null } | null } | null;
    };
    return (rows as Row[]).map((r) => ({
      id: r.id,
      clientId: r.clientId,
      name: r.client?.clientProfile?.name
        ?? [r.client?.firstName, r.client?.lastName].filter(Boolean).join(' ')
        ?? r.client?.email
        ?? 'Cliente',
      email: r.client?.email ?? null,
      startDate: r.startDate.toISOString(),
      endDate: r.endDate.toISOString(),
      days: r.days,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /** Verifica che l'attore possa decidere su questa richiesta. */
  private async assertCanDecide(actorUserId: string, clientId: string) {
    const scope = await this.staffScope(actorUserId);
    if (!scope) return; // capo nutrizionista / sales / admin
    const prof = (await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { assignedCoachId: true, assignedNutritionistId: true },
    })) as { assignedCoachId: string | null; assignedNutritionistId: string | null } | null;
    if (!prof || prof[scope.field] !== scope.staffId) {
      throw new ForbiddenException('Questa cliente non è assegnata a te.');
    }
  }

  /** Lo staff approva o rifiuta una richiesta di pausa. */
  async decide(actorUserId: string, requestId: string, approve: boolean, note?: string) {
    const request = await this.prisma.pauseRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Richiesta non trovata.');
    if (request.status !== 'pending') {
      throw new BadRequestException('Questa richiesta è già stata gestita.');
    }
    await this.assertCanDecide(actorUserId, request.clientId);

    const staff = (await this.prisma.staff.findUnique({ where: { userId: actorUserId }, select: { id: true } })) as { id: string } | null;

    if (approve) {
      const event = await this.createPauseEvent(request.clientId, request.startDate, request.endDate);
      const newEnd = await this.freezeSubscription(request.clientId, request.days);
      const updated = await this.prisma.pauseRequest.update({
        where: { id: requestId },
        data: {
          status: 'approved',
          eventId: event.id,
          decidedByStaffId: staff?.id ?? null,
          decidedAt: new Date(),
          staffNote: note ?? null,
        },
      });
      await this.audit.log({
        action: 'pause.approved',
        actorId: actorUserId,
        entityType: 'pause_request',
        entityId: requestId,
        metadata: { days: request.days },
      });
      await this.notifications
        .notify({
          userId: request.clientId,
          type: 'pause_decision',
          title: 'Pausa approvata',
          body: `La tua pausa di ${request.days} giorni è stata approvata: la scadenza slitta in avanti.${note ? ` Nota: ${note}` : ''}`,
          payload: { requestId, approved: true, newEndDate: newEnd ? newEnd.toISOString() : null },
        })
        .catch(() => undefined);
      return updated;
    }

    const updated = await this.prisma.pauseRequest.update({
      where: { id: requestId },
      data: {
        status: 'rejected',
        decidedByStaffId: staff?.id ?? null,
        decidedAt: new Date(),
        staffNote: note ?? null,
      },
    });
    await this.audit.log({
      action: 'pause.rejected',
      actorId: actorUserId,
      entityType: 'pause_request',
      entityId: requestId,
      metadata: { days: request.days },
    });
    await this.notifications
      .notify({
        userId: request.clientId,
        type: 'pause_decision',
        title: 'Pausa non approvata',
        body: `La tua richiesta di pausa non è stata approvata.${note ? ` Motivo: ${note}` : ' Contatta il tuo staff per trovare una soluzione.'}`,
        payload: { requestId, approved: false },
      })
      .catch(() => undefined);
    return updated;
  }

  // ---------- Meccanica ----------

  /**
   * Crea l'evento di pausa (sospende il menu nel periodo). Bypassa il cap 30gg
   * di EventsService perché qui la durata è già validata (≤90) ed eventualmente
   * approvata dallo staff.
   */
  private async createPauseEvent(clientId: string, startDate: Date, endDate: Date) {
    const lastMeasure = await this.prisma.measurement.findFirst({
      where: { clientId },
      orderBy: { date: 'desc' },
      select: { weightKg: true },
    });
    return this.prisma.event.create({
      data: {
        clientId,
        type: 'vacation' as never,
        label: 'Pausa (vacanza)',
        startDate,
        endDate,
        mode: 'pause_period' as never,
        planPhaseState: 'before',
        startWeightKg: lastMeasure?.weightKg ?? null,
      },
    });
  }

  /**
   * Fa slittare in avanti di `days` giorni la scadenza dell'abbonamento attivo.
   * Se non c'è scadenza impostata (abbonamento senza fine) non fa nulla.
   */
  private async freezeSubscription(clientId: string, days: number): Promise<Date | null> {
    const sub = await this.prisma.subscription.findFirst({
      where: { clientId, status: 'active' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, endDate: true },
    });
    if (!sub || !sub.endDate) return null;
    const newEnd = new Date(sub.endDate.getTime() + days * 86_400_000);
    await this.prisma.subscription.update({ where: { id: sub.id }, data: { endDate: newEnd } });
    return newEnd;
  }

  /** Avvisa coach e nutrizionista assegnate della richiesta in attesa. */
  private async notifyAssignedStaff(clientId: string, days: number): Promise<void> {
    const profile = await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { assignedCoachId: true, assignedNutritionistId: true, name: true },
    });
    if (!profile) return;
    const staffIds = [profile.assignedCoachId, profile.assignedNutritionistId].filter(
      (v): v is string => !!v,
    );
    if (staffIds.length === 0) return;
    const staff = await this.prisma.staff.findMany({
      where: { id: { in: staffIds } },
      select: { userId: true },
    });
    const who = profile.name ?? 'Una cliente';
    for (const s of staff) {
      await this.notifications
        .notify({
          userId: s.userId,
          type: 'pause_request',
          title: 'Richiesta di pausa',
          body: `${who} chiede una pausa di ${days} giorni: va approvata o rifiutata.`,
          payload: { clientId, days },
        })
        .catch(() => undefined);
    }
  }
}
