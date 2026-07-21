import { randomUUID } from 'crypto';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { MenuService } from '../menu/menu.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { coachTeamScope, isCoachLike } from '../common/coach-team';
import { subscriptionEnd } from '../commerce/commerce.service';
import { DEFAULT_PERMISSIONS, PageKey } from '../permissions/pages';
import { Role } from '../common/roles';
import { UpdateClientDto } from './dto/update-client.dto';

const USER_FIELDS = ['firstName', 'lastName', 'addressLine', 'postalCode', 'city', 'province', 'phone', 'codiceFiscale'] as const;
const PROFILE_FIELDS = ['name', 'age', 'sex', 'heightCm', 'startWeightKg', 'startWaistCm', 'startHipsCm', 'regime', 'dietStyle', 'mealsPerDay', 'objective', 'pathType', 'coachStyle', 'character', 'intolerances', 'dislikedFoods', 'themeColor'] as const;

/**
 * Scheda cliente per lo staff: aggrega anagrafica, questionario, obiettivo,
 * pesate (misure), acquisti e stato CRM in un'unica vista.
 */
@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly menu: MenuService,
  ) {}

  /**
   * Visibilità per ruolo: coach e nutrizionista vedono SOLO i clienti assegnati a loro
   * (ClientProfile.assignedCoachId / assignedNutritionistId); la manager delle coach
   * (sales), il capo nutrizionista e l'admin vedono tutti.
   * Ritorna il vincolo da applicare alle liste, o null se l'attore vede tutto.
   */
  private async clientScope(actorUserId: string): Promise<{ field: 'assignedCoachId' | 'assignedNutritionistId'; staffIds: string[] } | null> {
    const actor = await this.prisma.user.findUnique({ where: { id: actorUserId }, select: { role: true } });
    const role = actor?.role as string | undefined;
    if (isCoachLike(role)) {
      // Coach → le sue; coordinatrice → sue + del suo team.
      const ids = (await coachTeamScope(this.prisma, actorUserId)) ?? [];
      return { field: 'assignedCoachId', staffIds: ids };
    }
    if (role !== 'nutritionist') return null;
    const staff = (await this.prisma.staff.findUnique({ where: { userId: actorUserId }, select: { id: true } })) as { id: string } | null;
    // Senza scheda staff → id impossibile: non vede nessun cliente, mai tutti per errore.
    return { field: 'assignedNutritionistId', staffIds: [staff?.id ?? '00000000-0000-0000-0000-000000000000'] };
  }

  /** Blocca l'accesso alla scheda di un cliente non assegnato all'attore. */
  private async assertClientAccess(actorUserId: string, clientUserId: string) {
    const scope = await this.clientScope(actorUserId);
    if (!scope) return;
    const prof = (await this.prisma.clientProfile.findUnique({
      where: { userId: clientUserId },
      select: { assignedCoachId: true, assignedNutritionistId: true },
    })) as { assignedCoachId: string | null; assignedNutritionistId: string | null } | null;
    const assigned = prof?.[scope.field] ?? null;
    if (!assigned || !scope.staffIds.includes(assigned)) {
      throw new ForbiddenException('Questo cliente non è assegnato a te.');
    }
  }

  /** Elenco clienti per lo staff: coach/nutrizionista SOLO i propri; manager/capo/admin tutti. */
  async listClients(actorUserId: string) {
    const scope = await this.clientScope(actorUserId);
    const where = {
      role: 'client' as never,
      deletedAt: null,
      ...(scope ? { clientProfile: { [scope.field]: { in: scope.staffIds } } } : {}),
    };
    const items = await this.prisma.user.findMany({
      where: where as never,
      select: { id: true, email: true, firstName: true, lastName: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    return { items, total: items.length };
  }

  async getDetail(userId: string, actorId: string) {
    await this.assertClientAccess(actorId, userId);
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true, email: true, role: true, status: true, locale: true, emailVerifiedAt: true, createdAt: true,
        firstName: true, lastName: true, addressLine: true, postalCode: true, city: true, province: true, phone: true, codiceFiscale: true, linkedUserId: true,
      },
    });
    if (!user) throw new NotFoundException('Utente non trovato.');
    if (user.role !== 'client') {
      throw new ForbiddenException('Questa scheda è disponibile solo per i clienti.');
    }

    const [profile, objective, measurements, checkins, waterLogs, stepLogs, subscriptions, payments, crm, notes, pending] = await Promise.all([
      this.prisma.clientProfile.findUnique({
        where: { userId },
        include: {
          assignedCoach: { select: { displayName: true } },
          assignedNutritionist: { select: { displayName: true } },
        },
      }),
      this.prisma.objective.findFirst({ where: { clientId: userId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.measurement.findMany({ where: { clientId: userId }, orderBy: { date: 'desc' }, take: 60 }),
      this.prisma.dailyCheckin.findMany({
        where: { clientId: userId },
        orderBy: { date: 'desc' },
        take: 60,
        select: { id: true, date: true, mood: true, energy: true, hunger: true, stress: true },
      }),
      this.prisma.waterLog.findMany({
        where: { clientId: userId },
        orderBy: { date: 'desc' },
        take: 60,
        select: { id: true, date: true, glasses: true, goal: true },
      }),
      this.prisma.stepLog.findMany({
        where: { clientId: userId },
        orderBy: { date: 'desc' },
        take: 60,
        select: { id: true, date: true, steps: true, goal: true },
      }),
      // Ultimi abbonamenti: in scheda si mostra prima l'ATTIVO, poi l'in attesa e
      // solo in mancanza il più recente (prima vinceva sempre il più recente per data:
      // un checkout annullato copriva la prova gratuita attiva).
      this.prisma.subscription.findMany({
        where: { clientId: userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { plan: { select: { name: true, priceCents: true, period: true } } },
      }),
      this.prisma.payment.findMany({
        where: { clientId: userId },
        orderBy: { createdAt: 'desc' },
        take: 40,
        select: { id: true, amountCents: true, description: true, method: true, status: true, createdAt: true, approvedAt: true },
      }),
      this.prisma.crmRecord.findUnique({ where: { clientId: userId }, select: { stage: true, valueCents: true, ownerId: true } }),
      this.prisma.clientNote.findMany({
        where: { clientId: userId },
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: { id: true, body: true, createdAt: true, author: { select: { displayName: true } } },
      }),
      this.prisma.pendingCommission.findMany({
        where: { clientId: userId, status: 'pending' },
        orderBy: { createdAt: 'desc' },
        select: { id: true, role: true, amountCents: true, createdAt: true },
      }),
    ]);

    await this.audit.log({ action: 'client.detail.view', actorId, entityType: 'user', entityId: userId });

    // Abbonamento "principale" della scheda: attivo > in attesa > più recente.
    const subs = subscriptions as { status: string }[];
    const subscription = subs.find((s) => s.status === 'active') ?? subs.find((s) => s.status === 'pending') ?? subs[0] ?? null;

    // Nome leggibile dello stato pipeline (es. "Prova" invece della chiave "trial") per il badge CRM.
    const stageLabel = crm
      ? ((await this.prisma.pipelineStage
          .findUnique({ where: { key: (crm as { stage: string }).stage }, select: { label: true } })
          .catch(() => null)) as { label: string } | null)?.label ?? null
      : null;

    return {
      user,
      profile, // include onboardingAnswers, consents, screeningFlag, ecc.
      objective,
      measurements,
      checkins,
      waterLogs,
      stepLogs,
      subscription,
      payments,
      crm: crm ? { ...(crm as Record<string, unknown>), stageLabel } : null,
      notes: (notes as { id: string; body: string; createdAt: Date; author: { displayName: string } | null }[]).map((n) => ({
        id: n.id,
        body: n.body,
        createdAt: n.createdAt,
        author: n.author?.displayName ?? null,
      })),
      pendingCommissions: (pending as { id: string; role: string; amountCents: number; createdAt: Date }[]).map((p) => ({
        id: p.id,
        role: p.role,
        amountCents: p.amountCents,
        createdAt: p.createdAt,
      })),
    };
  }

  /** Aggiunge una nota al log dello staff sul cliente. */
  async addNote(userId: string, actorId: string, body: string) {
    await this.assertClientAccess(actorId, userId);
    const text = body.trim();
    if (!text) throw new BadRequestException('La nota è vuota.');

    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, role: true },
    });
    if (!user) throw new NotFoundException('Utente non trovato.');
    if (user.role !== 'client') throw new ForbiddenException('La nota è disponibile solo per i clienti.');

    const staff = await this.prisma.staff.findUnique({ where: { userId: actorId }, select: { id: true } });
    const created = await this.prisma.clientNote.create({
      data: { clientId: userId, body: text.slice(0, 5000), authorId: staff?.id },
      select: { id: true, body: true, createdAt: true, author: { select: { displayName: true } } },
    });
    await this.audit.log({ action: 'client.note.add', actorId, entityType: 'user', entityId: userId });
    return { id: created.id, body: created.body, createdAt: created.createdAt, author: created.author?.displayName ?? null };
  }

  /** Elimina una nota dal log (solo admin, controllato dal controller). */
  async deleteNote(userId: string, noteId: string, actorId: string) {
    const note = await this.prisma.clientNote.findUnique({ where: { id: noteId }, select: { id: true, clientId: true } });
    if (!note || note.clientId !== userId) throw new NotFoundException('Nota non trovata.');
    await this.prisma.clientNote.delete({ where: { id: noteId } });
    await this.audit.log({ action: 'client.note.delete', actorId, entityType: 'user', entityId: userId, metadata: { noteId } });
    return { removed: noteId };
  }

  /** Invia alla cliente l'email per reimpostare la password (nessuna password gestita dallo staff). */
  async sendPasswordReset(userId: string, actorId: string, ip?: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw new NotFoundException('Utente non trovato.');
    await this.auth.requestPasswordReset(user.email, ip);
    await this.audit.log({ action: 'client.password_reset.trigger', actorId, entityType: 'user', entityId: userId });
    return { sent: true, email: user.email };
  }

  /** Imposta una password SCELTA per la cliente (da comunicarle): permesso "set_client_password". */
  async setClientPassword(userId: string, actorId: string, newPassword: string) {
    await this.assertClientAccess(actorId, userId);
    const pw = (newPassword ?? '').trim();
    if (pw.length < 8) throw new BadRequestException('La password deve avere almeno 8 caratteri.');
    await this.auth.adminSetClientPassword(userId, pw, actorId);
    return { ok: true };
  }

  /**
   * Eliminazione DEFINITIVA di un cliente/lead e di tutto ciò che gli è collegato.
   * Solo admin. Il lead (CrmRecord) è in SetNull, quindi va cancellato esplicitamente;
   * tutto il resto (profilo, misure, check-in, acquisti, ecc.) va a cascata via schema.
   */
  async hardDelete(userId: string, actorId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true },
    });
    if (!user) throw new NotFoundException('Cliente non trovato.');
    if (user.role !== 'client') {
      throw new BadRequestException('Si possono eliminare solo i clienti, non lo staff.');
    }
    // Audit PRIMA della cancellazione (dopo, l'utente non esiste più).
    await this.audit.log({
      action: 'client.hard_delete',
      actorId,
      entityType: 'user',
      entityId: userId,
      metadata: { email: user.email },
    });
    await this.prisma.$transaction([
      this.prisma.crmRecord.deleteMany({ where: { clientId: userId } }),
      this.prisma.user.delete({ where: { id: userId } }),
    ]);
    return { deleted: true };
  }

  /**
   * Vero se il ruolo può GESTIRE la pagina/permesso indicato: stessa logica del
   * PageGuard (riga della matrice se esiste, altrimenti default; admin sempre sì).
   */
  private async roleCanManage(role: string, pageKey: string): Promise<boolean> {
    if (role === 'admin') return true;
    const row = (await this.prisma.rolePagePermission
      .findUnique({ where: { role_pageKey: { role, pageKey } }, select: { canManage: true } })
      .catch(() => null)) as { canManage: boolean } | null;
    if (row) return row.canManage;
    const def = DEFAULT_PERMISSIONS[role as Role]?.[pageKey as PageKey];
    return !!def?.manage;
  }

  /** Aggiorna anagrafica (User) e questionario (ClientProfile) di un cliente. */
  async updateClient(userId: string, actorId: string, dto: UpdateClientDto) {
    await this.assertClientAccess(actorId, userId);
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
    if (!user) throw new NotFoundException('Cliente non trovato.');
    if (user.role !== 'client') throw new BadRequestException('Modificabile solo per i clienti.');

    const d = dto as Record<string, unknown>;
    const userData: Record<string, unknown> = {};
    for (const k of USER_FIELDS) if (d[k] !== undefined) userData[k] = d[k] === '' ? null : d[k];
    const profileData: Record<string, unknown> = {};
    for (const k of PROFILE_FIELDS) if (d[k] !== undefined) profileData[k] = d[k] === '' ? null : d[k];

    // TIPO DI DIETA (regime + stile): cambiarlo richiede il permesso dedicato
    // "change_diet_type" (default: nutrizionisti e admin). Il resto della scheda
    // resta modificabile da chi ha accesso, come prima.
    const DIET_TYPE_FIELDS = ['regime', 'dietStyle'] as const;
    let dietTypeChange: { before: Record<string, unknown>; after: Record<string, unknown> } | null = null;
    if (DIET_TYPE_FIELDS.some((k) => profileData[k] !== undefined)) {
      const current = (await this.prisma.clientProfile.findUnique({
        where: { userId },
        select: { regime: true, dietStyle: true },
      })) as { regime: string | null; dietStyle: string | null } | null;
      const changedKeys = DIET_TYPE_FIELDS.filter(
        (k) => profileData[k] !== undefined && (profileData[k] ?? null) !== (current?.[k] ?? null),
      );
      if (changedKeys.length > 0) {
        const actor = (await this.prisma.user.findUnique({ where: { id: actorId }, select: { role: true } })) as { role: string } | null;
        if (!(await this.roleCanManage(actor?.role ?? '', 'change_diet_type'))) {
          throw new ForbiddenException('Cambiare il tipo di dieta richiede il permesso "Cambia tipo di dieta" (nutrizionista o amministrazione).');
        }
        dietTypeChange = {
          before: { regime: current?.regime ?? null, dietStyle: current?.dietStyle ?? null },
          after: { regime: profileData.regime ?? current?.regime ?? null, dietStyle: profileData.dietStyle ?? current?.dietStyle ?? null },
        };
      }
    }

    // Fase precedente: serve per accorgersi del passaggio dimagrimento → mantenimento.
    const prevObjective = profileData.objective !== undefined
      ? ((await this.prisma.clientProfile.findUnique({ where: { userId }, select: { objective: true } }))?.objective ?? null)
      : null;

    const ops: unknown[] = [];
    if (Object.keys(userData).length) ops.push(this.prisma.user.update({ where: { id: userId }, data: userData as never }));
    if (Object.keys(profileData).length) {
      ops.push(
        this.prisma.clientProfile.upsert({
          where: { userId },
          update: profileData as never,
          create: { userId, ...profileData } as never,
        }),
      );
    }
    if (ops.length) await this.prisma.$transaction(ops as never);
    await this.audit.log({ action: 'client.update', actorId, entityType: 'user', entityId: userId });
    // Cambio del tipo di dieta: voce di audit dedicata con prima/dopo (visibile nel Log modifiche).
    if (dietTypeChange) {
      await this.audit.log({
        action: 'client.diet_type.change',
        actorId,
        entityType: 'user',
        entityId: userId,
        metadata: dietTypeChange as never,
      });
      // I menu cambiano DALLA PROSSIMA EROGAZIONE: i giorni già consumati restano,
      // i giorni futuri già erogati vengono rifatti con la nuova dieta (solo la differenza).
      try {
        const r = await this.menu.redeliverFutureDays(userId);
        await this.audit.log({
          action: 'client.diet_type.menus_redelivered',
          actorId,
          entityType: 'user',
          entityId: userId,
          metadata: { removedFutureDays: r.removed, delivered: r.delivered } as never,
        });
      } catch {
        /* la rigenerazione non deve mai bloccare il salvataggio della scheda */
      }
    }

    // Passaggio di fase dimagrimento → mantenimento: festeggia con la cliente
    // (in-app + push, best effort: non deve mai bloccare il salvataggio).
    if (profileData.objective === 'mantenimento' && prevObjective === 'dimagrimento') {
      await this.notifications
        .notify({
          userId,
          type: 'objective_reached',
          title: 'Hai raggiunto il tuo obiettivo! 🎉',
          body: 'Da oggi si passa alla fase di mantenimento: il piano cambia ritmo per aiutarti a consolidare i risultati. Complimenti!',
          payload: { from: 'dimagrimento', to: 'mantenimento' },
        })
        .catch(() => undefined);
    }
    return { updated: true };
  }

  /**
   * Menu del cliente per la revisione del nutrizionista: giorni di menu (ultime ~8
   * settimane + prossimi 7 giorni) con i piatti e le STELLINE date dal cliente.
   * Per ogni piatto: valutazione del giorno esatto se c'è, altrimenti l'ultima
   * valutazione data a quella ricetta (contrassegnata come "altro giorno").
   */
  async getMenus(userId: string, actorId: string) {
    await this.assertClientAccess(actorId, userId);
    const from = new Date();
    from.setDate(from.getDate() - 56);
    const to = new Date();
    to.setDate(to.getDate() + 7);

    const [days, ratings] = await Promise.all([
      this.prisma.menuDay.findMany({
        where: { clientId: userId, date: { gte: from, lte: to } },
        orderBy: { date: 'desc' },
        take: 70,
        select: { id: true, date: true, level: true, status: true, meals: true, diet: { select: { id: true, name: true } } },
      }) as Promise<{ id: string; date: Date; level: number; status: string; meals: unknown; diet: { id: string; name: string } | null }[]>,
      this.prisma.recipeRating.findMany({
        where: { clientId: userId },
        orderBy: { date: 'desc' },
        take: 800,
        select: { recipeId: true, date: true, stars: true, tags: true },
      }) as Promise<{ recipeId: string; date: Date; stars: number; tags: string[] }[]>,
    ]);

    const dayKey = (d: Date) => d.toISOString().slice(0, 10);
    const exact = new Map<string, { stars: number; tags: string[] }>();
    const latest = new Map<string, { stars: number; tags: string[]; date: string }>();
    for (const r of ratings) {
      exact.set(`${r.recipeId}|${dayKey(r.date)}`, { stars: r.stars, tags: r.tags });
      if (!latest.has(r.recipeId)) latest.set(r.recipeId, { stars: r.stars, tags: r.tags, date: dayKey(r.date) }); // già ordinate per data desc
    }

    const out = days.map((d) => {
      const key = dayKey(d.date);
      const meals = (Array.isArray(d.meals) ? d.meals : []) as { slot?: string; recipeId?: string; name?: string; kcal?: number }[];
      return {
        id: d.id,
        date: key,
        level: d.level,
        status: d.status,
        dietName: d.diet?.name ?? null,
        meals: meals.map((m) => {
          const ex = m.recipeId ? exact.get(`${m.recipeId}|${key}`) : undefined;
          const la = !ex && m.recipeId ? latest.get(m.recipeId) : undefined;
          return {
            slot: m.slot ?? null,
            name: m.name ?? '—',
            kcal: m.kcal ?? null,
            stars: ex?.stars ?? la?.stars ?? null,
            ratingTags: ex?.tags ?? la?.tags ?? [],
            // true = valutato proprio quel giorno; false = ultima valutazione della stessa ricetta in un altro giorno.
            ratedSameDay: ex ? true : la ? false : null,
            ratedOn: ex ? key : la?.date ?? null,
          };
        }),
      };
    });
    await this.audit.log({ action: 'client.menus.view', actorId, entityType: 'user', entityId: userId });
    return { days: out };
  }

  /**
   * Correzione di una misura inserita male dal cliente (permesso dedicato
   * "fix_measures" nella matrice Permessi). Tutto tracciato in audit con prima/dopo.
   */
  async updateMeasurement(
    userId: string,
    actorId: string,
    measurementId: string,
    input: { weightKg?: number; waistCm?: number | null; hipsCm?: number | null; thighsCm?: number | null },
  ) {
    await this.assertClientAccess(actorId, userId);
    const m = (await this.prisma.measurement.findFirst({
      where: { id: measurementId, clientId: userId },
    })) as { id: string; weightKg: number; waistCm: number | null; hipsCm: number | null; thighsCm: number | null; date: Date } | null;
    if (!m) throw new NotFoundException('Misura non trovata per questo cliente.');

    const data: Record<string, unknown> = {};
    if (input.weightKg !== undefined) {
      if (typeof input.weightKg !== 'number' || input.weightKg < 25 || input.weightKg > 400) throw new BadRequestException('Peso non plausibile (25–400 kg).');
      data.weightKg = Math.round(input.weightKg * 10) / 10;
    }
    for (const k of ['waistCm', 'hipsCm', 'thighsCm'] as const) {
      const v = input[k];
      if (v === undefined) continue;
      if (v === null) { data[k] = null; continue; }
      if (typeof v !== 'number' || v < 20 || v > 300) throw new BadRequestException('Circonferenza non plausibile (20–300 cm).');
      data[k] = Math.round(v * 10) / 10;
    }
    if (Object.keys(data).length === 0) throw new BadRequestException('Nessuna modifica indicata.');

    const updated = await this.prisma.measurement.update({ where: { id: m.id }, data: data as never });
    await this.audit.log({
      action: 'client.measurement.fix',
      actorId,
      entityType: 'measurement',
      entityId: m.id,
      metadata: {
        clientId: userId,
        date: m.date.toISOString().slice(0, 10),
        before: { weightKg: m.weightKg, waistCm: m.waistCm, hipsCm: m.hipsCm, thighsCm: m.thighsCm },
        after: data,
      },
    });
    return updated;
  }

  /**
   * Cambio della DATA DI INIZIO del piano (permesso dedicato "change_plan_start"):
   * sposta l'inizio dell'abbonamento mostrato in scheda (attivo > in attesa > più
   * recente), ricalcola la FINE dalla durata del piano e allinea la base dei menu
   * (profile.planStartDate). Tutto in audit con prima/dopo.
   */
  async updatePlanStart(userId: string, actorId: string, dateIso: string) {
    await this.assertClientAccess(actorId, userId);
    const d = new Date(String(dateIso).slice(0, 10) + 'T00:00:00.000Z');
    if (Number.isNaN(d.getTime())) throw new BadRequestException('Data non valida (formato AAAA-MM-GG).');
    const now = Date.now();
    if (Math.abs(d.getTime() - now) > 366 * 86_400_000) throw new BadRequestException('Data fuori intervallo (max un anno da oggi).');

    const subs = (await this.prisma.subscription.findMany({
      where: { clientId: userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, status: true, startDate: true, endDate: true, plan: { select: { name: true, period: true } } },
    })) as { id: string; status: string; startDate: Date | null; endDate: Date | null; plan: { name: string; period: string } }[];
    const sub = subs.find((x) => x.status === 'active') ?? subs.find((x) => x.status === 'pending') ?? subs[0] ?? null;
    if (!sub) throw new NotFoundException('Nessun abbonamento su cui spostare la data.');

    const newEnd = subscriptionEnd(d, sub.plan.period);
    const prevProfile = (await this.prisma.clientProfile.findUnique({
      where: { userId },
      select: { planStartDate: true },
    })) as { planStartDate: Date | null } | null;

    await this.prisma.$transaction([
      this.prisma.subscription.update({ where: { id: sub.id }, data: { startDate: d, endDate: newEnd } }),
      this.prisma.clientProfile.upsert({
        where: { userId },
        update: { planStartDate: d } as never,
        create: { userId, planStartDate: d } as never,
      }),
    ] as never);

    await this.audit.log({
      action: 'client.plan_start.change',
      actorId,
      entityType: 'subscription',
      entityId: sub.id,
      metadata: {
        clientId: userId,
        plan: sub.plan.name,
        before: {
          startDate: sub.startDate?.toISOString().slice(0, 10) ?? null,
          endDate: sub.endDate?.toISOString().slice(0, 10) ?? null,
          planStartDate: prevProfile?.planStartDate?.toISOString().slice(0, 10) ?? null,
        },
        after: { startDate: d.toISOString().slice(0, 10), endDate: newEnd.toISOString().slice(0, 10) },
      },
    });
    // Cambio data di inizio = il piano RIPARTE: si cancellano i menu già erogati e si
    // rieroga dalla nuova data (il motore rispetta finestre di visibilità e gate misure).
    try {
      const r = await this.menu.restartFromPlanStart(userId);
      await this.audit.log({
        action: 'client.plan_start.menus_restarted',
        actorId,
        entityType: 'user',
        entityId: userId,
        metadata: { removedDays: r.removed, delivered: r.delivered } as never,
      });
    } catch {
      /* mai bloccare lo spostamento della data per un errore di rigenerazione */
    }
    return { startDate: d.toISOString().slice(0, 10), endDate: newEnd.toISOString().slice(0, 10) };
  }

  /** Modalità viaggio/estate (staff): imposta lo stato e le date; al rientro emette un evento per il CRM/marketing. */
  async setTravel(userId: string, actorId: string, input: { state?: string; start?: string; end?: string }) {
    await this.assertClientAccess(actorId, userId);
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!user) throw new NotFoundException('Cliente non trovato.');
    if (user.role !== 'client') throw new BadRequestException('Solo per i clienti.');
    const VALID = ['in_partenza', 'in_vacanza', 'rientrato'];
    const state = input.state && VALID.includes(input.state) ? input.state : null;
    const toDate = (v?: string) => (v && !Number.isNaN(Date.parse(v)) ? new Date(v) : null);
    const data = { travelState: state, travelStart: toDate(input.start), travelEnd: toDate(input.end) };
    await this.prisma.clientProfile.upsert({
      where: { userId },
      update: data as never,
      create: { userId, ...data } as never,
    });
    if (state === 'rientrato') {
      await this.prisma.analyticsEvent.create({ data: { eventId: randomUUID(), name: 'travel_return', userId, phase: 'app', data: {} as never } as never });
    }
    await this.audit.log({ action: 'client.travel.update', actorId, entityType: 'user', entityId: userId, metadata: { state } });
    return { state };
  }

  /**
   * Cronologia delle modifiche al profilo del cliente (chi e quando):
   * anagrafica, assegnazioni coach/nutrizionista, cambio email, reset password.
   * Raccoglie le voci di audit collegate a userId, profilo e record CRM.
   */
  async changeLog(userId: string, actorId: string) {
    await this.assertClientAccess(actorId, userId);
    const user = await this.prisma.user.findFirst({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundException('Utente non trovato.');
    const [profile, crm] = await Promise.all([
      this.prisma.clientProfile.findUnique({ where: { userId }, select: { id: true } }),
      this.prisma.crmRecord.findUnique({ where: { clientId: userId }, select: { id: true } }),
    ]);
    const ids = [userId, profile?.id, crm?.id].filter((x): x is string => Boolean(x));
    const CHANGE_ACTIONS = [
      'client.update', 'me.profile.update',
      'admin.assignment.update', 'crm.nutritionist.assign',
      'crm.lead.assign', 'crm.lead.accept', 'crm.lead.reject',
      'auth.email_change_requested', 'auth.email_change_confirmed',
      'auth.email_primary_swapped', 'auth.email_secondary_removed',
      'client.password_reset.trigger',
    ];
    const rows = await this.prisma.auditLog.findMany({
      where: { entityId: { in: ids }, action: { in: CHANGE_ACTIONS } },
      orderBy: { createdAt: 'desc' },
      take: 150,
      include: { actor: { select: { email: true, firstName: true, lastName: true, role: true } } },
    });
    type Row = {
      id: string; action: string; createdAt: Date; actorId: string | null; metadata: unknown;
      actor: { email: string; firstName: string | null; lastName: string | null; role: string } | null;
    };
    await this.audit.log({ action: 'client.changelog.view', actorId, entityType: 'user', entityId: userId });
    return (rows as Row[]).map((r) => ({
      id: r.id,
      action: r.action,
      at: r.createdAt,
      metadata: r.metadata ?? null,
      self: r.actorId === userId,
      actor: r.actor
        ? { name: [r.actor.firstName, r.actor.lastName].filter(Boolean).join(' ') || r.actor.email, email: r.actor.email, role: r.actor.role }
        : null,
    }));
  }
}
