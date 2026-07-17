import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Task coach (handoff Prezzi/Prova, punto 5): "la coach deve vedere cosa fare e
 * quando, non ricordarselo". Il cron giornaliero genera i task sui momenti chiave
 * della PROVA (G0 misure, G1 benvenuto — il momento che decide tutto, G4 aderenza,
 * G7 chiusura, +7 ultima chiamata) e di OGNI fine piano (report + rinnovo).
 * La coach li vede in dashboard con scadenza e stato (da fare / fatto / saltato).
 */
@Injectable()
export class CoachTasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Coach → solo le SUE clienti assegnate; responsabile coach (sales) e admin → tutte. */
  private async coachScope(actorUserId: string): Promise<string | null> {
    const u = (await this.prisma.user.findUnique({ where: { id: actorUserId }, select: { role: true } })) as { role: string } | null;
    if (u?.role !== 'coach') return null;
    const staff = (await this.prisma.staff.findUnique({ where: { userId: actorUserId }, select: { id: true } })) as { id: string } | null;
    return staff?.id ?? '00000000-0000-0000-0000-000000000000';
  }

  /** Task aperti (da fare) visibili all'attore, dal più urgente. */
  async list(actorUserId: string, opts?: { status?: string; limit?: number }) {
    const scopeId = await this.coachScope(actorUserId);
    const status = opts?.status && ['todo', 'done', 'skipped'].includes(opts.status) ? opts.status : 'todo';
    const rows = await this.prisma.coachTask.findMany({
      where: {
        status,
        ...(scopeId ? { client: { clientProfile: { assignedCoachId: scopeId } } } : {}),
      } as never,
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
      take: Math.min(200, Math.max(1, opts?.limit ?? 100)),
      include: {
        client: { select: { email: true, firstName: true, lastName: true, clientProfile: { select: { name: true } } } },
      },
    });
    type Row = {
      id: string; clientId: string; kind: string; title: string; description: string | null;
      dueDate: Date; status: string;
      client: { email: string; firstName: string | null; lastName: string | null; clientProfile: { name: string | null } | null } | null;
    };
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return (rows as Row[]).map((t) => ({
      id: t.id,
      clientId: t.clientId,
      kind: t.kind,
      title: t.title,
      description: t.description,
      dueDate: t.dueDate.toISOString().slice(0, 10),
      overdue: t.dueDate.getTime() < today.getTime(),
      status: t.status,
      clientName: t.client?.clientProfile?.name
        ?? [t.client?.firstName, t.client?.lastName].filter(Boolean).join(' ')
        ?? t.client?.email
        ?? 'Cliente',
    }));
  }

  /** Cambia lo stato di un task (fatto / saltato / da fare). Scope coach rispettato. */
  async setStatus(actorUserId: string, taskId: string, status: string) {
    if (!['todo', 'done', 'skipped'].includes(status)) throw new BadRequestException('Stato non valido.');
    const task = await this.prisma.coachTask.findUnique({ where: { id: taskId }, select: { id: true, clientId: true } });
    if (!task) throw new NotFoundException('Task non trovato.');
    const scopeId = await this.coachScope(actorUserId);
    if (scopeId) {
      const prof = (await this.prisma.clientProfile.findUnique({ where: { userId: task.clientId }, select: { assignedCoachId: true } })) as { assignedCoachId: string | null } | null;
      if (prof?.assignedCoachId !== scopeId) throw new ForbiddenException('Questa cliente non è assegnata a te.');
    }
    const updated = await this.prisma.coachTask.update({
      where: { id: taskId },
      data: {
        status,
        doneById: status === 'todo' ? null : actorUserId,
        doneAt: status === 'todo' ? null : new Date(),
      },
    });
    await this.audit.log({ action: `coach_task.${status}`, actorId: actorUserId, entityType: 'coach_task', entityId: taskId });
    return updated;
  }

  /**
   * Contatori per la dashboard: task aperti, prove attive, in scadenza oggi/domani,
   * prove scadute non convertite (per l'ultima chiamata).
   */
  async summary(actorUserId: string) {
    const scopeId = await this.coachScope(actorUserId);
    const clientWhere = scopeId ? { clientProfile: { assignedCoachId: scopeId } } : {};
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 86_400_000);
    const dayAfter = new Date(today.getTime() + 2 * 86_400_000);

    const [openTasks, overdueTasks, trialsActive, expiringToday, expiringTomorrow, expiredTrials] = await Promise.all([
      this.prisma.coachTask.count({ where: { status: 'todo', ...(scopeId ? { client: clientWhere } : {}) } as never }),
      this.prisma.coachTask.count({ where: { status: 'todo', dueDate: { lt: today }, ...(scopeId ? { client: clientWhere } : {}) } as never }),
      this.prisma.subscription.count({ where: { status: 'active', plan: { priceCents: 0 }, ...(scopeId ? { client: clientWhere } : {}) } as never }),
      this.prisma.subscription.count({ where: { status: 'active', plan: { priceCents: 0 }, endDate: { gte: today, lt: tomorrow }, ...(scopeId ? { client: clientWhere } : {}) } as never }),
      this.prisma.subscription.count({ where: { status: 'active', plan: { priceCents: 0 }, endDate: { gte: tomorrow, lt: dayAfter }, ...(scopeId ? { client: clientWhere } : {}) } as never }),
      this.prisma.subscription.findMany({
        where: { status: 'expired', plan: { priceCents: 0 }, ...(scopeId ? { client: clientWhere } : {}) } as never,
        select: { clientId: true },
        distinct: ['clientId'] as never,
      }) as Promise<{ clientId: string }[]>,
    ]);

    // Non convertite: prova scaduta e nessun abbonamento attivo/in attesa oggi.
    let notConverted = 0;
    for (const t of expiredTrials) {
      const active = await this.prisma.subscription.findFirst({
        where: { clientId: t.clientId, status: { in: ['active', 'pending', 'paused'] as never } },
        select: { id: true },
      });
      if (!active) notConverted++;
    }
    return { openTasks, overdueTasks, trialsActive, expiringToday, expiringTomorrow, notConverted };
  }

  // ---------- Generazione automatica (cron giornaliero) ----------

  private day(base: Date, plusDays: number): Date {
    const d = new Date(base);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + plusDays);
    return d;
  }

  /** Crea il task se non esiste già (unicità cliente+tipo+riferimento). Ritorna 1 se creato. */
  private async ensureTask(clientId: string, kind: string, refId: string, title: string, description: string, dueDate: Date): Promise<number> {
    const exists = await this.prisma.coachTask.findUnique({
      where: { clientId_kind_refId: { clientId, kind, refId } } as never,
      select: { id: true },
    });
    if (exists) return 0;
    await this.prisma.coachTask.create({ data: { clientId, kind, refId, title, description, dueDate } });
    return 1;
  }

  /**
   * Genera i task dovuti a OGGI (idempotente: unicità per cliente+tipo+piano).
   * Prova (piani a prezzo 0, G = giorni dall'inizio):
   *  G0 verifica misure · G1 benvenuto (obbligatorio) · G4 se aderenza <70% ·
   *  G7 "domani finisce" · +7 dopo la scadenza ultima chiamata (se non convertita).
   * Ogni fine piano (anche non prova): consegna report + proponi rinnovo/mantenimento.
   */
  async generateDaily(): Promise<{ created: number }> {
    const now = new Date();
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    let created = 0;

    // --- PROVE (attive o scadute da poco) ---
    const trials = (await this.prisma.subscription.findMany({
      where: { plan: { priceCents: 0 }, status: { in: ['active', 'expired'] as never }, startDate: { not: null } } as never,
      select: { id: true, clientId: true, status: true, startDate: true, endDate: true },
    })) as { id: string; clientId: string; status: string; startDate: Date | null; endDate: Date | null }[];

    for (const t of trials) {
      if (!t.startDate) continue;
      const start = new Date(t.startDate); start.setHours(0, 0, 0, 0);
      const dayN = Math.floor((today.getTime() - start.getTime()) / 86_400_000);
      if (dayN < 0) continue;

      // G0 — misure iniziali (solo finché mancano: senza punto A niente report).
      if (t.status === 'active' && dayN >= 0) {
        const hasMeasure = await this.prisma.measurement.count({ where: { clientId: t.clientId } });
        if (hasMeasure === 0) {
          created += await this.ensureTask(t.clientId, 'trial_g0_measures', t.id,
            'Verifica le misure iniziali (G0)',
            'La prova è partita: controlla che abbia inserito peso e misure del giorno 0. Senza punto A non esiste il report A→B.',
            this.day(start, 0));
        }
      }
      // G1 — benvenuto personale (obbligatorio).
      if (t.status === 'active' && dayN >= 1) {
        created += await this.ensureTask(t.clientId, 'trial_g1_welcome', t.id,
          'Messaggio personale di benvenuto (G1) — obbligatorio',
          'È il momento che decide tutto: mandale un messaggio personale (non un template) su come è andato il primo giorno.',
          this.day(start, 1));
      }
      // G4 — solo se aderenza < 70% nei primi 4 giorni (check-in ≤ 2 su 4).
      if (t.status === 'active' && dayN >= 4) {
        const checkins = await this.prisma.dailyCheckin.count({
          where: { clientId: t.clientId, date: { gte: start, lt: this.day(start, 4) } },
        });
        if (checkins <= 2) {
          created += await this.ensureTask(t.clientId, 'trial_g4_adherence', t.id,
            'Senti come va: aderenza sotto il 70% (G4)',
            `Solo ${checkins} check-in nei primi 4 giorni: chiamala o scrivile per capire cosa la blocca.`,
            this.day(start, 4));
        }
      }
      // G7 — chiusura: "domani finisce, ti va di continuare?".
      if (t.status === 'active' && dayN >= 7) {
        created += await this.ensureTask(t.clientId, 'trial_g7_closing', t.id,
          'WhatsApp di chiusura prova (G7)',
          '"Domani finisce la prova: ti va di continuare?" — ricordale il codice personale e cosa perde se il profilo si cancella.',
          this.day(start, 7));
      }
      // +7 dopo la scadenza — ultima chiamata (solo se NON convertita).
      if (t.status === 'expired' && t.endDate && now.getTime() >= this.day(new Date(t.endDate), 7).getTime()) {
        const converted = await this.prisma.subscription.findFirst({
          where: { clientId: t.clientId, status: { in: ['active', 'pending', 'paused'] as never } },
          select: { id: true },
        });
        if (!converted) {
          created += await this.ensureTask(t.clientId, 'trial_post7_lastcall', t.id,
            'Ultima chiamata post-prova (+7)',
            'Il profilo personalizzato sta per essere cancellato (o lo è già): ultima proposta, poi si chiude con gentilezza.',
            this.day(new Date(t.endDate), 7));
        }
      }
    }

    // --- FINE PIANO (ogni piano con scadenza raggiunta, prova inclusa) ---
    const ended = (await this.prisma.subscription.findMany({
      where: { endDate: { lte: now, gte: this.day(now, -14) }, status: { in: ['active', 'expired'] as never } } as never,
      select: { id: true, clientId: true, endDate: true },
    })) as { id: string; clientId: string; endDate: Date | null }[];
    for (const sub of ended) {
      if (!sub.endDate) continue;
      created += await this.ensureTask(sub.clientId, 'plan_end_report', sub.id,
        'Fine piano: consegna il report e proponi il rinnovo',
        'Il piano è finito: consegnale il report A→B e proponi rinnovo o mantenimento.',
        this.day(new Date(sub.endDate), 0));
    }

    return { created };
  }
}
