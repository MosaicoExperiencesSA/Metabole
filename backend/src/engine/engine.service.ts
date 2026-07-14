import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { toDateOnly } from '../signals/signals.service';
import {
  DEFAULT_ACTION,
  EngineRule,
  EngineSignals,
  evaluateRules,
  RuleAction,
} from './rules-evaluator';
import { SignalsCollectorService } from './signals-collector.service';

/**
 * Il motore (spec sez. 7): ogni 2 giorni combina i segnali e decide
 * menu, tono e timing — SOLO dentro protocolli approvati a monte.
 * Governance: validazione a monte → esecuzione → controllo a campione.
 */
@Injectable()
export class EngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly collector: SignalsCollectorService,
    private readonly audit: AuditService,
  ) {}

  /** Esegue il motore per una cliente. Idempotente per giorno. */
  async runForClient(clientId: string) {
    const today = toDateOnly();
    const existing = await this.prisma.engineDecision.findFirst({
      where: { clientId, date: today },
    });
    if (existing) {
      return { decision: existing, alreadyRun: true };
    }

    const { signals, screeningFlag } = await this.collector.collect(clientId);

    // GUARDRAIL (spec 7.4): stop automatismo → presa in carico umana.
    const guardrail = this.checkGuardrails(signals, screeningFlag);
    let action: RuleAction;
    let ruleId: string | null = null;
    let explanation: string;

    if (guardrail) {
      action = {
        ...DEFAULT_ACTION,
        menu: guardrail.menu ?? 'keep',
        tone: 'gentle',
        flagForReview: true,
        note: guardrail.reason,
      };
      explanation = `Guardrail: ${guardrail.reason}`;
    } else {
      const rules = await this.loadApprovedRules();
      const result = evaluateRules(signals, rules);
      action = result.action;
      ruleId = result.rule?.id ?? null;
      explanation = result.explanation;
    }

    const decision = await this.prisma.engineDecision.create({
      data: {
        clientId,
        date: today,
        inputs: { signals, screeningFlag } as never,
        ruleId,
        action: { ...action, explanation } as never,
        flaggedForReview: Boolean(action.flagForReview),
        flagReason: action.flagForReview ? (action.note ?? explanation) : null,
      },
    });

    // Escalation al nutrizionista se il caso esce dall'automatismo.
    if (guardrail?.escalate) {
      const profile = await this.prisma.clientProfile.findUnique({
        where: { userId: clientId },
        select: { assignedNutritionistId: true },
      });
      const open = await this.prisma.escalation.findFirst({
        where: { clientId, source: 'engine', status: 'open', reason: { contains: guardrail.reasonKey } },
      });
      if (!open) {
        await this.prisma.escalation.create({
          data: {
            clientId,
            reason: `[${guardrail.reasonKey}] ${guardrail.reason}`,
            source: 'engine',
            // R12: guardrail di sicurezza = categoria clinica → solo nutrizionista.
            category: 'clinical' as never,
            assignedToId: profile?.assignedNutritionistId,
          },
        });
      }
    }

    await this.audit.log({
      action: 'engine.decision',
      actorId: clientId,
      entityType: 'engine_decision',
      entityId: decision.id,
      metadata: { ruleId, flagged: decision.flaggedForReview },
    });
    return { decision, alreadyRun: false };
  }

  /** Esegue il motore per tutte le clienti attive con onboarding completato. */
  async runBatch() {
    const clients = await this.prisma.clientProfile.findMany({
      where: { onboardingCompletedAt: { not: null }, user: { status: 'active', deletedAt: null } },
      select: { userId: true },
    });
    const results = { total: clients.length, run: 0, flagged: 0, skipped: 0 };
    for (const c of clients as { userId: string }[]) {
      try {
        const { decision, alreadyRun } = await this.runForClient(c.userId);
        if (alreadyRun) results.skipped++;
        else {
          results.run++;
          if (decision.flaggedForReview) results.flagged++;
        }
      } catch {
        results.skipped++;
      }
    }
    return results;
  }

  private checkGuardrails(
    signals: EngineSignals,
    screeningFlag: boolean,
  ): { reasonKey: string; reason: string; escalate: boolean; menu?: RuleAction['menu'] } | null {
    if (screeningFlag) {
      return {
        reasonKey: 'screening',
        reason:
          'Percorso supervisionato (screening sanitario): il motore non decide in autonomia, ogni variazione passa dal nutrizionista.',
        escalate: false, // l'escalation di screening esiste già dall'onboarding
      };
    }
    if (signals.rapidLoss && (signals.energyAvg === null || signals.energyAvg <= 3)) {
      return {
        reasonKey: 'calo_rapido_energia',
        reason:
          'Calo troppo rapido con energia non alta: alzare le calorie e rallentare — decisione al nutrizionista.',
        escalate: true,
        menu: 'increase_calories',
      };
    }
    if (signals.lowEnergyChronic) {
      return {
        reasonKey: 'energia_bassa_cronica',
        reason: 'Energia bassa cronica negli ultimi check-in: serve una verifica del nutrizionista.',
        escalate: true,
      };
    }
    return null;
  }

  private async loadApprovedRules(): Promise<EngineRule[]> {
    const protocols = await this.prisma.protocol.findMany({ where: { status: 'approved' } });
    return (protocols as { id: string; name: string; definition: unknown }[])
      .map((p) => {
        const def = p.definition as {
          priority?: number;
          conditions?: EngineRule['conditions'];
          action?: RuleAction;
        };
        if (!def?.conditions || !def?.action) return null;
        return {
          id: p.id,
          name: p.name,
          priority: def.priority ?? 100,
          conditions: def.conditions,
          action: def.action,
        } as EngineRule;
      })
      .filter((r): r is EngineRule => r !== null);
  }

  // ---------- Verifiche a campione (spec 7.3, punto 3) ----------

  async listDecisions(filter: { flagged?: boolean; clientId?: string; page?: number; limit?: number }) {
    const take = Math.min(Math.max(filter.limit ?? 50, 1), 200);
    const skip = (Math.max(filter.page ?? 1, 1) - 1) * take;
    const where = {
      ...(filter.flagged !== undefined
        ? { flaggedForReview: filter.flagged, ...(filter.flagged ? { reviewedAt: null } : {}) }
        : {}),
      ...(filter.clientId ? { clientId: filter.clientId } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.engineDecision.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        include: { rule: { select: { id: true, name: true } } },
      }),
      this.prisma.engineDecision.count({ where }),
    ]);
    return { items, total, page: filter.page ?? 1, limit: take };
  }

  async reviewDecision(
    reviewerUserId: string,
    decisionId: string,
    outcome: 'confirmed' | 'corrected',
    note?: string,
  ) {
    const staff = await this.prisma.staff.findUnique({ where: { userId: reviewerUserId } });
    if (!staff) throw new ForbiddenException('Nessuna scheda staff associata');
    const decision = await this.prisma.engineDecision.findUnique({ where: { id: decisionId } });
    if (!decision) throw new NotFoundException('Decisione non trovata');
    if (decision.reviewedAt) throw new BadRequestException('Decisione già revisionata');

    // Scoping per-paziente: un nutrizionista può revisionare SOLO le decisioni dei propri
    // pazienti; il capo (head_nutritionist) e l'admin qualsiasi. Vale per OGNI via (anche
    // l'endpoint diretto /engine/decisions/:id/confirm|correct).
    const reviewer = await this.prisma.user.findUnique({
      where: { id: reviewerUserId },
      select: { role: true },
    });
    const isSupervisor = reviewer?.role === 'head_nutritionist' || reviewer?.role === 'admin';
    if (!isSupervisor) {
      const profile = await this.prisma.clientProfile.findUnique({
        where: { userId: decision.clientId },
        select: { assignedNutritionistId: true },
      });
      if (!profile || profile.assignedNutritionistId !== staff.id) {
        throw new ForbiddenException('Paziente non assegnato: revisione non consentita');
      }
    }

    const updated = await this.prisma.engineDecision.update({
      where: { id: decisionId },
      data: {
        reviewedById: staff.id,
        reviewedAt: new Date(),
        reviewOutcome: outcome,
        reviewNote: note,
      },
    });
    await this.audit.log({
      action: `engine.decision.${outcome}`,
      actorId: reviewerUserId,
      entityType: 'engine_decision',
      entityId: decisionId,
      metadata: { note },
    });
    return updated;
  }

  // ---------- Protocolli (validazione a monte, spec 7.3 punto 1) ----------

  async listProtocols(status?: string) {
    return this.prisma.protocol.findMany({
      where: status ? { status: status as never } : {},
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { id: true, displayName: true } },
        validatedBy: { select: { id: true, displayName: true } },
      },
    });
  }

  async createProtocol(
    userId: string,
    input: { name: string; type: string; definition: unknown; thresholds?: unknown; appliesTo?: string },
  ) {
    const staff = await this.prisma.staff.findUnique({ where: { userId } });
    if (!staff) throw new ForbiddenException('Nessuna scheda staff associata');
    const def = input.definition as { conditions?: unknown[]; action?: unknown };
    if (!Array.isArray(def?.conditions) || !def?.action) {
      throw new BadRequestException('definition deve contenere conditions[] e action');
    }
    const protocol = await this.prisma.protocol.create({
      data: {
        name: input.name,
        type: input.type,
        definition: input.definition as never,
        thresholds: (input.thresholds ?? undefined) as never,
        appliesTo: input.appliesTo,
        authorId: staff.id,
        status: 'pending',
      },
    });
    await this.audit.log({
      action: 'engine.protocol.create',
      actorId: userId,
      entityType: 'protocol',
      entityId: protocol.id,
    });
    return protocol;
  }

  /** Modifica protocollo (autore/nutrizionista). Torna in "pending" per la ri-validazione. */
  async updateProtocol(
    userId: string,
    id: string,
    input: { name?: string; type?: string; definition?: unknown; thresholds?: unknown; appliesTo?: string },
  ) {
    const existing = await this.prisma.protocol.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Protocollo non trovato');
    if (existing.status === 'approved') {
      throw new BadRequestException('Un protocollo approvato non si modifica.');
    }
    if (input.definition !== undefined) {
      const def = input.definition as { conditions?: unknown[]; action?: unknown };
      if (!Array.isArray(def?.conditions) || !def?.action) {
        throw new BadRequestException('definition deve contenere conditions[] e action');
      }
    }
    const data: Record<string, unknown> = { status: 'pending', validatedById: null, validatedAt: null };
    if (input.name !== undefined) data.name = input.name;
    if (input.type !== undefined) data.type = input.type;
    if (input.definition !== undefined) data.definition = input.definition as never;
    if (input.thresholds !== undefined) data.thresholds = (input.thresholds ?? undefined) as never;
    if (input.appliesTo !== undefined) data.appliesTo = input.appliesTo;
    const protocol = await this.prisma.protocol.update({ where: { id }, data });
    await this.audit.log({
      action: 'engine.protocol.update',
      actorId: userId,
      entityType: 'protocol',
      entityId: id,
    });
    return protocol;
  }

  /** Validazione a monte: mai il proprio protocollo. */
  async validateProtocol(userId: string, protocolId: string, approve: boolean) {
    const staff = await this.prisma.staff.findUnique({ where: { userId } });
    if (!staff) throw new ForbiddenException('Nessuna scheda staff associata');
    const protocol = await this.prisma.protocol.findUnique({ where: { id: protocolId } });
    if (!protocol) throw new NotFoundException('Protocollo non trovato');
    if (protocol.status !== 'pending') {
      throw new BadRequestException('Si validano solo protocolli in attesa');
    }
    if (protocol.authorId === staff.id) {
      throw new ForbiddenException('Non puoi validare un protocollo di cui sei autore');
    }
    const updated = await this.prisma.protocol.update({
      where: { id: protocolId },
      data: {
        status: approve ? 'approved' : 'rejected',
        validatedById: staff.id,
        validatedAt: new Date(),
      },
    });
    await this.audit.log({
      action: approve ? 'engine.protocol.approve' : 'engine.protocol.reject',
      actorId: userId,
      entityType: 'protocol',
      entityId: protocolId,
    });
    return updated;
  }
}
