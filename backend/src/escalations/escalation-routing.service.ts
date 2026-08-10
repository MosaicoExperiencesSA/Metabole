import { Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { EscalationCategory, ESCALATION_ROUTING } from './escalation-routing';
import { decidiRiapertura } from './riapertura';
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
  private readonly logger = new Logger(EscalationRoutingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly configParams: ConfigParamsService,
  ) {}

  async open(input: OpenInput) {
    const routing = ESCALATION_ROUTING[input.category];
    if (input.dedupe !== false) {
      /**
       * «Se ha risolto, basta fino a nuova segnalazione» (11/8): il controllo guarda anche l'ultima
       * **risolta** e non solo quelle aperte. Vedi `riapertura.ts` — e nota che il caso in cui si
       * riapre comunque (peggioramento) qui non si applica: queste segnalazioni non hanno un
       * «quanto», e le apre chi ha già deciso che serve.
       */
      const finestraGiorni = await this.configParams.getNumber('escalation_reopen_days', 14);
      const decisione = await decidiRiapertura(this.prisma as never, {
        clientId: input.clientId,
        category: input.category,
        finestraGiorni,
      });
      if (!decisione.apri) {
        this.logger.log(`Segnalazione ${input.category} per ${input.clientId}: non riaperta — ${decisione.motivo}`);
        return decisione.precedente ? { id: decisione.precedente.id } : null;
      }
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
