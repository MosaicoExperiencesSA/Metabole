import { Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { EscalationCategory, ESCALATION_ROUTING } from './escalation-routing';

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
      select: { assignedCoachId: true, assignedNutritionistId: true },
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
    return created;
  }
}
