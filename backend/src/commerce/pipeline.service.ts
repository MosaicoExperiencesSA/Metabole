import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

export interface StageInfo {
  key: string;
  label: string;
  color: string | null;
  order: number;
  isSystem: boolean;
}

/**
 * Pipeline clienti/lead: gli STATI sono definiti dall'admin e condivisi da
 * tutti. La board raggruppa i record per stato; la coach (o commerciale/admin)
 * sposta le schede da uno stato all'altro (data + responsabile tracciati).
 */
@Injectable()
export class PipelineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listStages(): Promise<StageInfo[]> {
    const rows = await this.prisma.pipelineStage.findMany({ orderBy: { order: 'asc' } });
    return rows as StageInfo[];
  }

  async stageKeys(): Promise<Set<string>> {
    const rows = await this.prisma.pipelineStage.findMany({ select: { key: true } });
    return new Set(rows.map((r: { key: string }) => r.key));
  }

  /** Board completa: stati (colonne) + schede raggruppate. */
  async board() {
    const [stages, records] = await Promise.all([
      this.listStages(),
      this.prisma.crmRecord.findMany({
        orderBy: { updatedAt: 'desc' },
        include: {
          owner: { select: { displayName: true } },
          client: {
            select: {
              email: true,
              clientProfile: {
                select: { name: true, assignedCoach: { select: { displayName: true } } },
              },
            },
          },
        },
        take: 500,
      }),
    ]);

    const now = Date.now();
    type Rec = {
      id: string;
      clientId: string | null;
      stage: string;
      name: string | null;
      email: string | null;
      valueCents: number | null;
      stageDates: Record<string, { at?: string }> | null;
      owner: { displayName: string } | null;
      client: { email: string; clientProfile: { name: string | null; assignedCoach: { displayName: string } | null } | null } | null;
    };
    const cards = (records as Rec[]).map((r) => {
      const enteredAt = r.stageDates?.[r.stage]?.at;
      const daysInStage = enteredAt ? Math.floor((now - new Date(enteredAt).getTime()) / 86_400_000) : null;
      return {
        id: r.id,
        clientId: r.clientId,
        stage: r.stage,
        name: r.client?.clientProfile?.name ?? r.name ?? r.client?.email ?? r.email ?? 'Senza nome',
        email: r.client?.email ?? r.email ?? null,
        coach: r.client?.clientProfile?.assignedCoach?.displayName ?? null,
        owner: r.owner?.displayName ?? null,
        valueCents: r.valueCents ?? null,
        daysInStage,
        isClient: Boolean(r.client),
      };
    });

    const known = new Set(stages.map((s) => s.key));
    const byStage: Record<string, typeof cards> = {};
    for (const s of stages) byStage[s.key] = [];
    const orphans: typeof cards = [];
    for (const c of cards) (byStage[c.stage] ?? orphans).push(c);

    return { stages, cards: byStage, orphans, total: cards.length, unknownStages: orphans.length > 0 && orphans.some((o) => !known.has(o.stage)) };
  }

  // ---------- Gestione stati (admin) ----------

  async createStage(input: { label: string; color?: string }, actorId: string): Promise<StageInfo> {
    const label = input.label.trim();
    if (label.length < 2) throw new BadRequestException('Nome dello stato troppo corto.');
    const key = this.slug(label);
    if (!key) throw new BadRequestException('Nome dello stato non valido.');
    const exists = await this.prisma.pipelineStage.findUnique({ where: { key } });
    if (exists) throw new BadRequestException('Esiste già uno stato con un nome simile.');
    const max = await this.prisma.pipelineStage.aggregate({ _max: { order: true } });
    const created = await this.prisma.pipelineStage.create({
      data: { key, label, color: input.color ?? '#7c8c88', order: (max._max.order ?? -1) + 1, isSystem: false },
    });
    await this.audit.log({ action: 'crm.stage.create', actorId, entityType: 'pipeline_stage', entityId: key });
    return created as StageInfo;
  }

  async updateStage(key: string, input: { label?: string; color?: string }, actorId: string): Promise<StageInfo> {
    const stage = await this.prisma.pipelineStage.findUnique({ where: { key } });
    if (!stage) throw new NotFoundException('Stato non trovato.');
    const updated = await this.prisma.pipelineStage.update({
      where: { key },
      data: {
        ...(input.label ? { label: input.label.trim() } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
      },
    });
    await this.audit.log({ action: 'crm.stage.update', actorId, entityType: 'pipeline_stage', entityId: key });
    return updated as StageInfo;
  }

  /** Riordino: elenco di chiavi nell'ordine desiderato. */
  async reorder(keys: string[], actorId: string): Promise<StageInfo[]> {
    await this.prisma.$transaction(
      keys.map((key, index) => this.prisma.pipelineStage.update({ where: { key }, data: { order: index } })),
    );
    await this.audit.log({ action: 'crm.stage.reorder', actorId, entityType: 'pipeline_stage', entityId: keys.join(',') });
    return this.listStages();
  }

  async deleteStage(key: string, actorId: string): Promise<{ removed: string }> {
    const stage = await this.prisma.pipelineStage.findUnique({ where: { key } });
    if (!stage) throw new NotFoundException('Stato non trovato.');
    if (stage.isSystem) throw new BadRequestException('Questo stato è usato dall\'automazione e non può essere eliminato (puoi rinominarlo).');
    const inUse = await this.prisma.crmRecord.count({ where: { stage: key } });
    if (inUse > 0) {
      throw new BadRequestException(`Ci sono ${inUse} clienti in questo stato: spostali prima di eliminarlo.`);
    }
    await this.prisma.pipelineStage.delete({ where: { key } });
    await this.audit.log({ action: 'crm.stage.delete', actorId, entityType: 'pipeline_stage', entityId: key });
    return { removed: key };
  }

  private slug(label: string): string {
    return label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40);
  }
}
