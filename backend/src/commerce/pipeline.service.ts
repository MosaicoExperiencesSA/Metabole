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

  /**
   * Visibilità per ruolo (come CrmService.coachScope): la COACH vede solo i suoi lead;
   * manager coach (sales), capo nutrizionista e admin tutti. Coach senza scheda staff
   * → id impossibile: board vuota, mai tutta per errore.
   */
  private async coachScope(actorUserId?: string): Promise<string | null> {
    if (!actorUserId) return null;
    const u = (await this.prisma.user.findUnique({ where: { id: actorUserId }, select: { role: true } })) as { role: string } | null;
    if (u?.role !== 'coach') return null;
    const staff = (await this.prisma.staff.findUnique({ where: { userId: actorUserId }, select: { id: true } })) as { id: string } | null;
    return staff?.id ?? '00000000-0000-0000-0000-000000000000';
  }

  /** Board completa: stati (colonne) + schede raggruppate. La coach vede SOLO i suoi lead. */
  async board(actorUserId?: string) {
    const scopeId = await this.coachScope(actorUserId);
    const [stages, records] = await Promise.all([
      this.listStages(),
      this.prisma.crmRecord.findMany({
        where: (scopeId ? { assignedCoachId: scopeId } : {}) as never,
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
    // Promemoria/appuntamenti da fare (non completati) per dare evidenza nella board:
    // per ogni scheda si tiene la scadenza più vicina e se è già passata (in ritardo).
    const recIds = (records as Rec[]).map((r) => r.id);
    const reminders = recIds.length
      ? ((await this.prisma.crmReminder.findMany({
          where: { crmRecordId: { in: recIds }, done: false } as never,
          select: { crmRecordId: true, dueAt: true },
        })) as { crmRecordId: string | null; dueAt: Date }[])
      : [];
    const nextReminder = new Map<string, Date>();
    for (const rm of reminders) {
      if (!rm.crmRecordId) continue;
      const cur = nextReminder.get(rm.crmRecordId);
      if (!cur || rm.dueAt.getTime() < cur.getTime()) nextReminder.set(rm.crmRecordId, rm.dueAt);
    }

    // Scadenza del piano per le colonne Prova/Acquisito: ultimo abbonamento con
    // scadenza per ogni cliente in board → giorni mancanti alla fine del piano.
    const clientIds = (records as Rec[]).map((r) => r.clientId).filter((x): x is string => !!x);
    const subEnd = new Map<string, Date>();
    if (clientIds.length) {
      const subs = (await this.prisma.subscription.findMany({
        where: { clientId: { in: clientIds }, endDate: { not: null } } as never,
        orderBy: { createdAt: 'desc' },
        select: { clientId: true, endDate: true },
      })) as { clientId: string; endDate: Date | null }[];
      for (const sub of subs) {
        if (sub.endDate && !subEnd.has(sub.clientId)) subEnd.set(sub.clientId, sub.endDate); // il più recente vince
      }
    }

    const cards = (records as Rec[]).map((r) => {
      const enteredAt = r.stageDates?.[r.stage]?.at;
      const daysInStage = enteredAt ? Math.floor((now - new Date(enteredAt).getTime()) / 86_400_000) : null;
      const rem = nextReminder.get(r.id) ?? null;
      const end = r.clientId ? subEnd.get(r.clientId) ?? null : null;
      // Giorni alla fine del piano (può essere negativo = scaduto). null = nessun piano con scadenza.
      const planDaysLeft = end ? Math.ceil((end.getTime() - now) / 86_400_000) : null;
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
        planDaysLeft,
        reminderAt: rem ? rem.toISOString() : null,
        reminderOverdue: rem ? rem.getTime() < now : false,
        isClient: Boolean(r.client),
      };
    });

    // Ordine dentro ogni colonna: 1) chi ha un appuntamento scaduto, 2) chi ne ha uno in
    // programma (il più vicino prima), 3) a parità, chi è da più giorni nello stato (in cima).
    const sortCol = (list: typeof cards) => [...list].sort((a, b) => {
      if (a.reminderOverdue !== b.reminderOverdue) return a.reminderOverdue ? -1 : 1;
      const ah = a.reminderAt ? 1 : 0, bh = b.reminderAt ? 1 : 0;
      if (ah !== bh) return bh - ah;
      if (a.reminderAt && b.reminderAt && a.reminderAt !== b.reminderAt) return a.reminderAt < b.reminderAt ? -1 : 1;
      return (b.daysInStage ?? -1) - (a.daysInStage ?? -1);
    });
    // Colonne Prova e Acquisito: in alto chi è PIÙ VICINO alla scadenza del piano
    // (giorni mancanti crescenti, senza scadenza in fondo); a parità l'ordine standard.
    const sortByPlanEnd = (list: typeof cards) => [...list].sort((a, b) => {
      const av = a.planDaysLeft ?? Number.MAX_SAFE_INTEGER;
      const bv = b.planDaysLeft ?? Number.MAX_SAFE_INTEGER;
      if (av !== bv) return av - bv;
      if (a.reminderOverdue !== b.reminderOverdue) return a.reminderOverdue ? -1 : 1;
      return (b.daysInStage ?? -1) - (a.daysInStage ?? -1);
    });

    const known = new Set(stages.map((s) => s.key));
    const byStage: Record<string, typeof cards> = {};
    for (const s of stages) byStage[s.key] = [];
    const orphans: typeof cards = [];
    for (const c of cards) (byStage[c.stage] ?? orphans).push(c);
    for (const k of Object.keys(byStage)) byStage[k] = k === 'trial' || k === 'paid' ? sortByPlanEnd(byStage[k]) : sortCol(byStage[k]);

    return { stages, cards: byStage, orphans: sortCol(orphans), total: cards.length, unknownStages: orphans.length > 0 && orphans.some((o) => !known.has(o.stage)) };
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
