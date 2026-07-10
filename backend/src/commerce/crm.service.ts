import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { PipelineService } from './pipeline.service';

/**
 * CRM (spec sez. 8): ogni transizione salva DATA + RESPONSABILE in stage_dates.
 * lead_in nasce automaticamente alla registrazione; paid all'approvazione bonifico.
 * Gli STATI sono gestiti dall'admin (PipelineService), non più fissi nel codice.
 */
@Injectable()
export class CrmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly pipeline: PipelineService,
  ) {}

  /** Registrazione → lead automatico (non blocca mai il flusso chiamante). */
  async ensureLead(clientId: string, email: string): Promise<void> {
    try {
      await this.prisma.crmRecord.upsert({
        where: { clientId },
        create: {
          clientId,
          email,
          stage: 'lead_in',
          stageDates: { lead_in: { at: new Date().toISOString(), byUserId: null } } as never,
        },
        update: {},
      });
    } catch {
      /* il CRM non deve mai bloccare la registrazione */
    }
  }

  /** Avanzamento automatico (es. paid all'approvazione). */
  async autoAdvance(clientId: string, stage: string, byUserId: string, valueCents?: number): Promise<void> {
    try {
      const record = await this.prisma.crmRecord.findUnique({ where: { clientId } });
      const stageDates = {
        ...((record?.stageDates as Record<string, unknown>) ?? {}),
        [stage]: { at: new Date().toISOString(), byUserId },
      };
      if (record) {
        await this.prisma.crmRecord.update({
          where: { clientId },
          data: {
            stage: stage as never,
            stageDates: stageDates as never,
            ...(valueCents !== undefined ? { valueCents } : {}),
          },
        });
      } else {
        // Cliente che paga senza essere passata dai lead: la inserisco nel CRM,
        // così compare nella tabella clienti/lead come chi arriva dalla pipeline.
        await this.prisma.crmRecord.create({
          data: {
            clientId,
            stage: stage as never,
            stageDates: stageDates as never,
            ...(valueCents !== undefined ? { valueCents } : {}),
          },
        });
      }
    } catch {
      /* mai bloccare il flusso principale */
    }
  }

  async list(filter: { stage?: string }) {
    return this.prisma.crmRecord.findMany({
      where: filter.stage ? { stage: filter.stage as never } : {},
      orderBy: { updatedAt: 'desc' },
      include: {
        owner: { select: { displayName: true } },
        assignedCoach: { select: { id: true, displayName: true } },
        client: {
          select: {
            email: true,
            clientProfile: {
              select: {
                name: true,
                assignedCoach: { select: { displayName: true } },
                assignedNutritionist: { select: { displayName: true } },
              },
            },
          },
        },
      },
      take: 200,
    });
  }

  async create(byUserId: string, input: { email: string; name?: string }) {
    const record = await this.prisma.crmRecord.create({
      data: {
        email: input.email,
        name: input.name,
        stage: 'lead_in',
        stageDates: { lead_in: { at: new Date().toISOString(), byUserId } } as never,
      },
    });
    await this.audit.log({
      action: 'crm.lead.create',
      actorId: byUserId,
      entityType: 'crm_record',
      entityId: record.id,
    });
    return record;
  }

  /** Avanzamento manuale del commerciale: data + responsabile sempre registrati. */
  async advance(byUserId: string, recordId: string, input: { stage: string; ownerStaffId?: string; valueCents?: number }) {
    const stageKeys = await this.pipeline.stageKeys();
    if (!stageKeys.has(input.stage)) {
      throw new NotFoundException(`Stato sconosciuto: ${input.stage}`);
    }
    const record = await this.prisma.crmRecord.findUnique({ where: { id: recordId } });
    if (!record) throw new NotFoundException('Lead non trovato');
    const stageDates = {
      ...((record.stageDates as Record<string, unknown>) ?? {}),
      [input.stage]: { at: new Date().toISOString(), byUserId },
    };
    const updated = await this.prisma.crmRecord.update({
      where: { id: recordId },
      data: {
        stage: input.stage as never,
        stageDates: stageDates as never,
        ...(input.ownerStaffId ? { ownerId: input.ownerStaffId } : {}),
        ...(input.valueCents !== undefined ? { valueCents: input.valueCents } : {}),
      },
    });
    await this.audit.log({
      action: 'crm.lead.advance',
      actorId: byUserId,
      entityType: 'crm_record',
      entityId: recordId,
      metadata: { stage: input.stage },
    });
    return updated;
  }

  /** Dashboard commerciale: conteggi per stage + conversione + incasso mese. */
  async salesDashboard() {
    const [byStage, monthIncome, stages] = await Promise.all([
      this.prisma.crmRecord.groupBy({ by: ['stage'], _count: { _all: true } }),
      this.prisma.ledgerEntry.aggregate({
        where: {
          type: 'income',
          date: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
        _sum: { amountCents: true },
      }),
      this.pipeline.listStages(),
    ]);
    type Row = { stage: string; _count: { _all: number } };
    const orderOf = new Map(stages.map((s) => [s.key, s.order]));
    const paidOrder = orderOf.get('paid') ?? Number.MAX_SAFE_INTEGER;
    const counts = Object.fromEntries((byStage as Row[]).map((r) => [r.stage, r._count._all]));
    const leads = (byStage as Row[]).reduce((a, r) => a + r._count._all, 0);
    const paidPlus = (byStage as Row[])
      .filter((r) => (orderOf.get(r.stage) ?? -1) >= paidOrder)
      .reduce((a, r) => a + r._count._all, 0);
    return {
      totalLeads: leads,
      byStage: counts,
      conversionToPaidPercent: leads ? Math.round((paidPlus / leads) * 1000) / 10 : 0,
      monthIncomeCents: monthIncome._sum.amountCents ?? 0,
    };
  }
}
