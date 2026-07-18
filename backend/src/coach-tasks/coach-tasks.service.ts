import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { coachTeamScope } from '../common/coach-team';

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
    private readonly configParams: ConfigParamsService,
  ) {}

  /** Coach → le SUE clienti; coordinatrice → sue + del suo team; responsabile e admin → tutte. */
  private async coachScope(actorUserId: string): Promise<string[] | null> {
    return coachTeamScope(this.prisma, actorUserId);
  }

  /** Task aperti (da fare) visibili all'attore, dal più urgente. */
  async list(actorUserId: string, opts?: { status?: string; limit?: number }) {
    const scopeId = await this.coachScope(actorUserId);
    const status = opts?.status && ['todo', 'done', 'skipped'].includes(opts.status) ? opts.status : 'todo';
    const rows = await this.prisma.coachTask.findMany({
      where: {
        status,
        ...(scopeId ? { client: { clientProfile: { assignedCoachId: { in: scopeId } } } } : {}),
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
      if (!prof?.assignedCoachId || !scopeId.includes(prof.assignedCoachId)) throw new ForbiddenException('Questa cliente non è assegnata a te.');
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
    const clientWhere = scopeId ? { clientProfile: { assignedCoachId: { in: scopeId } } } : {};
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
      // G6 — il codice founding è partito (email automatica): la voce della coach vale di più.
      if (t.status === 'active' && dayN >= 6) {
        created += await this.ensureTask(t.clientId, 'trial_g6_code', t.id,
          'Codice founding inviato: sentila (G6)',
          'Oggi le è arrivato il codice personale valido 48h (1 mese €99 · 3 mesi €249): un tuo messaggio vale più dell\'email.',
          this.day(start, 6));
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

    // --- SCADENZE IN ARRIVO → CALENDARIO della coach (richiesta 17/07) ---
    // Ogni piano A PAGAMENTO in scadenza nei prossimi 7 giorni genera UN appunto nel
    // Calendario CRM della coach di riferimento (alla data di scadenza) + notifica
    // in app alla coach. Idempotente: si crea solo insieme al task `plan_expiry_heads_up`.
    const expiring = (await this.prisma.subscription.findMany({
      where: {
        status: 'active',
        plan: { priceCents: { gt: 0 } },
        endDate: { gte: today, lte: this.day(today, 7) },
      } as never,
      select: {
        id: true, clientId: true, endDate: true,
        plan: { select: { name: true } },
        client: { select: { firstName: true, lastName: true, clientProfile: { select: { name: true, assignedCoach: { select: { id: true, userId: true } } } } } },
      },
    })) as { id: string; clientId: string; endDate: Date | null; plan: { name: string }; client: { firstName: string | null; lastName: string | null; clientProfile: { name: string | null; assignedCoach: { id: string; userId: string } | null } | null } | null }[];
    for (const sub of expiring) {
      if (!sub.endDate) continue;
      const coach = sub.client?.clientProfile?.assignedCoach ?? null;
      if (!coach) continue; // senza coach: resta la vista "in scadenza" del responsabile
      const clientName = sub.client?.clientProfile?.name
        ?? [sub.client?.firstName, sub.client?.lastName].filter(Boolean).join(' ') ?? 'Cliente';
      const madeNew = await this.ensureTask(sub.clientId, 'plan_expiry_heads_up', sub.id,
        `Piano in scadenza: preparati al rinnovo`,
        `Il piano "${sub.plan.name}" di ${clientName} scade il ${sub.endDate.toLocaleDateString('it-IT')}: sentila PRIMA della scadenza.`,
        this.day(new Date(sub.endDate), 0));
      created += madeNew;
      if (madeNew) {
        // Appunto in Calendario CRM (visibile alla coach: creato a suo nome + legato alla scheda).
        const rec = (await this.prisma.crmRecord.findUnique({ where: { clientId: sub.clientId }, select: { id: true } }).catch(() => null)) as { id: string } | null;
        await this.prisma.crmReminder.create({
          data: {
            crmRecordId: rec?.id ?? null,
            title: `Scadenza piano — ${clientName}`,
            dueAt: new Date(sub.endDate),
            note: `Il piano "${sub.plan.name}" scade oggi: proponi rinnovo o mantenimento.`,
            createdById: coach.userId,
          },
        }).catch(() => undefined);
        // Notifica in app alla coach.
        await this.prisma.notification.create({
          data: {
            userId: coach.userId,
            type: 'plan_expiring',
            payload: {
              title: 'Piano in scadenza 📅',
              body: `Il piano "${sub.plan.name}" di ${clientName} scade il ${sub.endDate.toLocaleDateString('it-IT')}: appunto aggiunto al tuo calendario.`,
              clientId: sub.clientId,
            } as never,
            channel: 'inapp',
            scheduledFor: new Date(),
            sentAt: new Date(),
          },
        }).catch(() => undefined);
      }
    }

    // --- MANTENIMENTO: ripresa di peso importante → proponi un mese di dimagrimento ---
    // (richiesta 17/07). Cliente in mantenimento ATTIVO il cui ultimo peso supera il
    // peso d'ingresso nel mantenimento di almeno `maintenance_regain_kg` (default 3):
    // task alla coach + notifica gentile alla cliente con la proposta del mese di
    // dimagrimento. Idempotente per abbonamento.
    const regainKg = await this.configParams.getNumber('maintenance_regain_kg', 3);
    const maint = (await this.prisma.subscription.findMany({
      where: { status: 'active', startDate: { not: null }, plan: { period: 'maintenance' } } as never,
      select: { id: true, clientId: true, startDate: true },
    })) as { id: string; clientId: string; startDate: Date | null }[];
    for (const m of maint) {
      if (!m.startDate) continue;
      const start = this.day(new Date(m.startDate), 0);
      const [baseline, latest] = await Promise.all([
        this.prisma.measurement.findFirst({ where: { clientId: m.clientId, date: { lte: start } }, orderBy: { date: 'desc' }, select: { weightKg: true } }) as Promise<{ weightKg: number } | null>,
        this.prisma.measurement.findFirst({ where: { clientId: m.clientId }, orderBy: { date: 'desc' }, select: { weightKg: true, date: true } }) as Promise<{ weightKg: number; date: Date } | null>,
      ]);
      const base = baseline ?? (await this.prisma.measurement.findFirst({ where: { clientId: m.clientId, date: { gt: start } }, orderBy: { date: 'asc' }, select: { weightKg: true } }) as { weightKg: number } | null);
      if (!base || !latest || latest.date.getTime() <= start.getTime()) continue;
      const delta = latest.weightKg - base.weightKg;
      if (delta < regainKg) continue;
      const madeNew = await this.ensureTask(m.clientId, 'maintenance_regain', m.id,
        'Ripresa di peso in mantenimento: proponi un mese di dimagrimento',
        `+${Math.round(delta * 10) / 10} kg dall'inizio del mantenimento (soglia ${regainKg} kg): sentila e proponile un mese di dimagrimento per rimettersi in carreggiata.`,
        today);
      created += madeNew;
      if (madeNew) {
        await this.prisma.notification.create({
          data: {
            userId: m.clientId,
            type: 'maintenance_regain',
            payload: {
              title: 'Rimettiamoci in carreggiata 💪',
              body: 'Il peso è risalito un po\': capita, e si recupera. Un mese di dimagrimento ti riporta in rotta — parlane con la tua coach o guardalo nel negozio.',
            } as never,
            channel: 'inapp',
            scheduledFor: new Date(),
            sentAt: new Date(),
          },
        }).catch(() => undefined);
        await this.prisma.analyticsEvent.create({
          data: { eventId: randomUUID(), name: 'maintenance_regain_flagged', userId: m.clientId, phase: 'funnel', data: { subscriptionId: m.id, deltaKg: Math.round(delta * 10) / 10 } as never } as never,
        }).catch(() => undefined);
      }
    }

    return { created };
  }
}
