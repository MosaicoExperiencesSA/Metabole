import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { coachTeamScope } from '../common/coach-team';
import { STAGE_DA_CLIENTE } from './sospensione-in-pipeline';

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
  private async coachScope(actorUserId?: string): Promise<string[] | null> {
    return coachTeamScope(this.prisma, actorUserId);
  }

  /**
   * Board completa: stati (colonne) + schede raggruppate. La coach vede SOLO i suoi lead.
   *
   * ## Il difetto che questa funzione aveva (segnalato l'11/8: «perché non c'è più Patricia?»)
   *
   * Prima caricava **le 500 schede aggiornate più di recente su tutto il CRM** e poi le smistava
   * nelle colonne. Con le liste storiche importate (decine di migliaia di lead) quelle 500 erano
   * quasi tutte «Nuovo contatto»: nella schermata che Simone ha mandato, 485 su 500. Le clienti vere
   * che non venivano toccate da qualche giorno **cadevano fuori dalla finestra** e sparivano dalla
   * board — Patricia era in «Acquisito» con 349 € incassati, nel database, e la colonna non la
   * mostrava.
   *
   * E il numero accanto al titolo della colonna era contato sulle schede caricate: non diceva «te ne
   * mostro una di due», diceva «una». Un conteggio sbagliato è peggio di un elenco incompleto, perché
   * toglie anche il sospetto.
   *
   * Adesso sono due cose separate:
   * 1. i **conteggi** arrivano da un `groupBy` sul database — esatti, per ogni colonna, sempre;
   * 2. le **schede** si caricano per colonna, con un tetto per colonna. Così una colonna piena di
   *    lead freddi non affama le altre, e quando il tetto morde la colonna lo dichiara
   *    (`mostrate` < `totale`) invece di far finta che il resto non esista.
   */
  async board(actorUserId?: string) {
    const scopeId = await this.coachScope(actorUserId);
    const dove = (scopeId ? { assignedCoachId: { in: scopeId } } : {}) as never;
    const stages = await this.listStages();

    // Conteggio vero per stato: una riga per colonna, indipendente da quante schede si disegnano.
    const conteggi = (await this.prisma.crmRecord.groupBy({
      by: ['stage'],
      where: dove,
      _count: { _all: true },
    })) as unknown as { stage: string; _count: { _all: number } }[];
    const totalePerStato = new Map(conteggi.map((c) => [c.stage, c._count._all]));

    const INCLUDI = {
      owner: { select: { displayName: true } },
      client: {
        select: {
          email: true,
          clientProfile: {
            select: { name: true, assignedCoach: { select: { displayName: true } } },
          },
        },
      },
    };

    /**
     * Quante schede si disegnano per colonna. Cento, chieste da Simone l'11/8 («mostrami le 100 più
     * recenti non 60») dopo aver visto i numeri veri: 86.323 schede in tutto, 86.274 in «Nuovo
     * contatto». Il tetto serve al browser, non al database: le colonne scorrono dentro sé stesse, e
     * quello che sta oltre le cento si cerca dai lead, con i filtri.
     */
    const PER_COLONNA = 100;
    const perStato = await Promise.all(
      stages.map((st) =>
        this.prisma.crmRecord.findMany({
          where: { ...(dove as object), stage: st.key } as never,
          orderBy: { updatedAt: 'desc' },
          include: INCLUDI,
          take: PER_COLONNA,
        }),
      ),
    );
    /**
     * Le schede con uno stato che NON è più fra le colonne (uno stato personalizzato eliminato
     * dall'admin): finivano fra gli «orfani» e continuano a farlo, ma vanno cercate a parte, perché
     * le query di sopra chiedono uno stato alla volta.
     */
    const orfane = await this.prisma.crmRecord.findMany({
      where: { ...(dove as object), stage: { notIn: stages.map((s) => s.key) } } as never,
      orderBy: { updatedAt: 'desc' },
      include: INCLUDI,
      take: PER_COLONNA,
    });
    const records = [...perStato.flat(), ...orfane];

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
    /**
     * ⚠️ Anche «In sospensione» si ordina per scadenza del piano (25/8): lì dentro ci sono clienti
     * con un piano che corre — la sospensione lo allunga, non lo ferma — e la domanda di chi guarda
     * quella colonna è la stessa delle altre due: **a chi sta per scadere il piano**.
     */
    for (const k of Object.keys(byStage)) {
      byStage[k] = k === 'trial' || STAGE_DA_CLIENTE.includes(k) ? sortByPlanEnd(byStage[k]) : sortCol(byStage[k]);
    }

    /**
     * `totali` è il conteggio VERO per colonna, `cards` quello che si disegna. Sono due numeri
     * diversi e vanno mandati entrambi: è la differenza fra «ce n'è una» e «te ne mostro una di due».
     */
    const totali: Record<string, number> = {};
    for (const st of stages) totali[st.key] = totalePerStato.get(st.key) ?? 0;
    const totaleGenerale = [...totalePerStato.values()].reduce((a, n) => a + n, 0);

    return {
      stages,
      cards: byStage,
      totali,
      orphans: sortCol(orphans),
      /** Quante schede esistono in tutto, non quante ne sono state caricate. */
      total: totaleGenerale,
      unknownStages: orphans.length > 0 && orphans.some((o) => !known.has(o.stage)),
    };
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
