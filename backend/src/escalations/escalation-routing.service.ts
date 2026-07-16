import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { EscalationCategory, ESCALATION_ROUTING } from './escalation-routing';
import { NotificationsService } from '../notifications/notifications.service';
import { ESCALATION_NOTIF } from '../notifications/staff-notifications';

interface OpenInput {
  clientId: string;
  category: EscalationCategory;
  reason: string;
  source?: 'engine' | 'coach' | 'screening';
  /** Se una segnalazione APERTA di questa categoria esiste già, non se ne crea un'altra. */
  dedupe?: boolean;
}

/**
 * R12 — Apertura di segnalazioni con instradamento per categoria: assegna al ruolo giusto
 * (il membro del team GIÀ assegnato alla cliente per quel ruolo; se assente resta non
 * assegnata e la vede il pool). Idempotente per (cliente, categoria) quando `dedupe`.
 * È un helper additivo: i creatori esistenti continuano a funzionare, chi vuole il routing
 * standard usa questo metodo.
 */
@Injectable()
export class EscalationRoutingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async open(input: OpenInput) {
    const routing = ESCALATION_ROUTING[input.category];
    if (input.dedupe !== false) {
      const existing = await this.prisma.escalation.findFirst({
        where: {
          clientId: input.clientId,
          category: input.category as never,
          status: { in: ['open', 'in_progress'] as never },
        },
        select: { id: true },
      });
      if (existing) return existing;
    }

    const profile = await this.prisma.clientProfile.findUnique({
      where: { userId: input.clientId },
      select: { assignedCoachId: true, assignedNutritionistId: true, name: true },
    });
    const assignedToId =
      routing.primary === 'nutritionist' ? profile?.assignedNutritionistId : profile?.assignedCoachId;

    const created = await this.prisma.escalation.create({
      data: {
        clientId: input.clientId,
        reason: input.reason,
        source: (input.source ?? 'engine') as never,
        category: input.category as never,
        assignedToId: assignedToId ?? undefined,
      },
    });
    await this.audit.log({
      action: 'escalation.open',
      actorId: input.clientId,
      entityType: 'escalation',
      entityId: created.id,
      metadata: { category: input.category, primary: routing.primary },
    });

    // Notifica staff: la segnalazione arriva SIA alla coach SIA alla nutrizionista
    // assegnate alla cliente (l'opt-out per tipo nel profilo è rispettato in notify()).
    await this.notifyAssignedStaff(input.category, profile, input.reason).catch(() => undefined);
    return created;
  }

  /** Avvisa coach e nutrizionista assegnate della nuova segnalazione. */
  private async notifyAssignedStaff(
    category: EscalationCategory,
    profile: { assignedCoachId: string | null; assignedNutritionistId: string | null; name: string | null } | null,
    reason: string,
  ): Promise<void> {
    if (!profile) return;
    const staffIds = [profile.assignedCoachId, profile.assignedNutritionistId].filter(
      (v): v is string => !!v,
    );
    if (staffIds.length === 0) return;
    const staff = await this.prisma.staff.findMany({
      where: { id: { in: staffIds } },
      select: { userId: true },
    });
    const info = ESCALATION_NOTIF[category];
    const who = profile.name ?? 'una cliente';
    for (const s of staff) {
      await this.notifications
        .notify({
          userId: s.userId,
          type: info.type,
          title: info.title,
          body: `${info.title} · ${who}${reason ? `: ${reason}` : ''}`,
          payload: { category },
        })
        .catch(() => undefined);
    }
  }
}
