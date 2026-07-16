import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';

const DAY = 86_400_000;
const COMMISSION_CATEGORIES = ['sales_commission', 'visit_compensation'];
const APPOINTMENT_TYPES = ['call', 'televisit', 'in_person'];

interface ApptRow {
  id: string;
  clientId: string;
  staffId: string;
  staffRole: string;
  type: string;
  datetime: Date;
  status: string;
  note: string | null;
}

export interface CreateAppointmentInput {
  clientId: string;
  type: string;
  datetime: string;
  note?: string;
}
export interface UpdateAppointmentInput {
  status?: 'scheduled' | 'done' | 'cancelled';
  datetime?: string;
  note?: string;
}

interface ProfileRow {
  userId: string;
  name: string | null;
  planStartDate: Date | null;
  startWeightKg: number | null;
}
interface SubRow {
  clientId: string;
  status: string;
  endDate: Date | null;
}
interface MeasRow {
  clientId: string;
  date: Date;
  weightKg: number;
}
interface AlertRow {
  clientId: string;
}

/**
 * API dell'app Coach. Dati sempre limitati alle clienti ASSEGNATE alla coach
 * (assignedCoachId = Staff.id). I dati sanitari/clinici NON passano da qui
 * (sono riservati al nutrizionista).
 */
@Injectable()
export class CoachService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configParams: ConfigParamsService,
  ) {}

  private async staffId(userId: string): Promise<string | null> {
    const staff = await this.prisma.staff.findUnique({ where: { userId }, select: { id: true } });
    return staff?.id ?? null;
  }

  /** Elenco delle clienti della coach con un riepilogo per la lista. */
  async clients(user: AuthUser, includeLeads = false): Promise<{ clients: unknown[] }> {
    const staffId = await this.staffId(user.sub);
    if (!staffId) return { clients: [] };

    const profiles = (await this.prisma.clientProfile.findMany({
      where: { assignedCoachId: staffId },
      select: { userId: true, name: true, planStartDate: true, startWeightKg: true },
    })) as ProfileRow[];
    const ids = profiles.map((p) => p.userId);
    // Nessun cliente attivo: usciamo solo se NON sono richiesti i lead
    // (altrimenti salteremmo la parte che elenca i lead assegnati).
    if (ids.length === 0 && !includeLeads) return { clients: [] };

    const [subs, measures, alerts, objectives] = await Promise.all([
      this.prisma.subscription.findMany({
        where: { clientId: { in: ids }, status: 'active' },
        select: { clientId: true, status: true, endDate: true },
      }) as Promise<SubRow[]>,
      this.prisma.measurement.findMany({
        where: { clientId: { in: ids } },
        orderBy: { date: 'desc' },
        distinct: ['clientId'],
        select: { clientId: true, date: true, weightKg: true },
      }) as Promise<MeasRow[]>,
      this.prisma.alert.findMany({
        where: { coachId: staffId, status: 'open', clientId: { in: ids } },
        select: { clientId: true },
      }) as Promise<AlertRow[]>,
      this.prisma.objective.findMany({
        where: { clientId: { in: ids } },
        orderBy: { createdAt: 'desc' },
        distinct: ['clientId'],
        select: { clientId: true, targetWeightKg: true },
      }) as Promise<{ clientId: string; targetWeightKg: number | null }[]>,
    ]);

    const subByClient = new Map(subs.map((s) => [s.clientId, s]));
    const measByClient = new Map(measures.map((m) => [m.clientId, m]));
    const objByClient = new Map(objectives.map((o) => [o.clientId, o]));
    const alertCount = new Map<string, number>();
    for (const a of alerts) alertCount.set(a.clientId, (alertCount.get(a.clientId) ?? 0) + 1);

    const clients = profiles.map((p) => {
      const sub = subByClient.get(p.userId);
      const meas = measByClient.get(p.userId);
      const obj = objByClient.get(p.userId);
      const start = p.startWeightKg ?? null;
      const last = meas?.weightKg ?? null;
      const target = obj?.targetWeightKg ?? null;
      // Peso perso finora (positivo = calo) e % di avanzamento verso il target.
      const weightDeltaKg = start != null && last != null ? Math.round((start - last) * 10) / 10 : null;
      let progressPct: number | null = null;
      if (start != null && last != null && target != null && start !== target) {
        const pct = ((start - last) / (start - target)) * 100;
        progressPct = Math.max(0, Math.min(100, Math.round(pct)));
      }
      return {
        clientId: p.userId,
        name: p.name,
        planActive: !!sub,
        planEndDate: sub?.endDate ? sub.endDate.toISOString().slice(0, 10) : null,
        planStartDate: p.planStartDate ? p.planStartDate.toISOString().slice(0, 10) : null,
        lastMeasureDate: meas?.date ? meas.date.toISOString().slice(0, 10) : null,
        lastWeightKg: last,
        weightDeltaKg,
        progressPct,
        openAlerts: alertCount.get(p.userId) ?? 0,
      };
    });
    // Ordina: prima chi ha più alert aperti.
    clients.sort((a, b) => b.openAlerts - a.openAlerts);

    // Lead assegnati alla coach (dalla pipeline CRM) non ancora clienti attivi:
    // mostrati solo se richiesto dal flag, con badge "Lead".
    let leads: unknown[] = [];
    if (includeLeads) {
      const activeIds = new Set(ids);
      const crm = (await this.prisma.crmRecord.findMany({
        where: { assignedCoachId: staffId },
        orderBy: { assignedAt: 'desc' },
        take: 200,
        select: { id: true, clientId: true, name: true, email: true, stage: true },
      })) as { id: string; clientId: string | null; name: string | null; email: string | null; stage: string }[];
      leads = crm
        .filter((r) => !r.clientId || !activeIds.has(r.clientId))
        .map((r) => ({
          clientId: r.clientId,
          leadId: r.id,
          name: r.name ?? r.email ?? 'Lead',
          isLead: true,
          stage: r.stage,
          planActive: false,
          planEndDate: null,
          planStartDate: null,
          lastMeasureDate: null,
          lastWeightKg: null,
          weightDeltaKg: null,
          progressPct: null,
          openAlerts: 0,
        }));
    }

    return { clients: [...clients, ...leads] };
  }

  /** Riepilogo per la home della coach: clienti, piani in scadenza, guadagni, alert. */
  async dashboard(user: AuthUser) {
    const staffId = await this.staffId(user.sub);
    if (!staffId) return { isCoach: false };

    const expiringDays = await this.configParams.getNumber('expiring_plan_days', 14);
    const now = new Date();
    const horizon = new Date(now.getTime() + expiringDays * DAY);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [clientsCount, expiring, openAlerts, monthAgg, totalAgg] = await Promise.all([
      this.prisma.clientProfile.count({ where: { assignedCoachId: staffId } }),
      this.prisma.subscription.findMany({
        where: {
          status: 'active',
          endDate: { gte: now, lte: horizon },
          client: { clientProfile: { assignedCoachId: staffId } },
        },
        select: { clientId: true, endDate: true, client: { select: { clientProfile: { select: { name: true } } } } },
        orderBy: { endDate: 'asc' },
      }) as Promise<{ clientId: string; endDate: Date | null; client: { clientProfile: { name: string | null } | null } | null }[]>,
      this.prisma.alert.count({ where: { coachId: staffId, status: 'open' } }),
      this.prisma.ledgerEntry.aggregate({
        _sum: { amountCents: true },
        where: { staffId, type: 'expense' as never, category: { in: COMMISSION_CATEGORIES }, date: { gte: monthStart } },
      }),
      this.prisma.ledgerEntry.aggregate({
        _sum: { amountCents: true },
        where: { staffId, type: 'expense' as never, category: { in: COMMISSION_CATEGORIES } },
      }),
    ]);

    return {
      isCoach: true,
      clientsCount,
      openAlerts,
      earningsMonthCents: monthAgg._sum.amountCents ?? 0,
      earningsTotalCents: totalAgg._sum.amountCents ?? 0,
      expiringPlans: expiring.map((s) => ({
        clientId: s.clientId,
        name: s.client?.clientProfile?.name ?? null,
        endDate: s.endDate ? s.endDate.toISOString().slice(0, 10) : null,
      })),
    };
  }

  // ---------- Agenda / appuntamenti ----------

  private async staffNames(ids: string[]): Promise<Map<string, string>> {
    if (!ids.length) return new Map();
    const rows = (await this.prisma.staff.findMany({
      where: { id: { in: ids } },
      select: { id: true, displayName: true },
    })) as { id: string; displayName: string }[];
    return new Map(rows.map((r) => [r.id, r.displayName]));
  }

  /** Agenda della coach: appuntamenti futuri delle sue clienti (i propri gestibili, quelli col nutrizionista in sola lettura). */
  async coachAgenda(user: AuthUser): Promise<{ appointments: unknown[] }> {
    const staffId = await this.staffId(user.sub);
    if (!staffId) return { appointments: [] };

    const profiles = (await this.prisma.clientProfile.findMany({
      where: { assignedCoachId: staffId },
      select: { userId: true, name: true },
    })) as { userId: string; name: string | null }[];
    const ids = profiles.map((p) => p.userId);
    if (!ids.length) return { appointments: [] };
    const nameOf = new Map(profiles.map((p) => [p.userId, p.name]));

    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);
    const appts = (await this.prisma.appointment.findMany({
      where: { clientId: { in: ids }, status: 'scheduled', datetime: { gte: startToday } },
      orderBy: { datetime: 'asc' },
    })) as ApptRow[];

    const staffNameOf = await this.staffNames([...new Set(appts.map((a) => a.staffId))]);
    return {
      appointments: appts.map((a) => ({
        id: a.id,
        clientId: a.clientId,
        clientName: nameOf.get(a.clientId) ?? null,
        staffRole: a.staffRole,
        staffName: staffNameOf.get(a.staffId) ?? null,
        type: a.type,
        datetime: a.datetime.toISOString(),
        note: a.note,
        editable: a.staffRole === 'coach' && a.staffId === staffId,
      })),
    };
  }

  /** Crea un appuntamento (coach o nutrizionista) per una propria cliente. */
  async createAppointment(user: AuthUser, dto: CreateAppointmentInput) {
    const staffId = await this.staffId(user.sub);
    if (!staffId) throw new ForbiddenException('Solo lo staff può creare appuntamenti');
    if (!APPOINTMENT_TYPES.includes(dto.type)) throw new BadRequestException('Tipo appuntamento non valido');
    const when = new Date(dto.datetime);
    if (isNaN(when.getTime()) || when.getTime() < Date.now()) {
      throw new BadRequestException('Data/ora non valida (dev\'essere futura)');
    }

    const profile = await this.prisma.clientProfile.findUnique({
      where: { userId: dto.clientId },
      select: { assignedCoachId: true, assignedNutritionistId: true },
    });
    if (!profile) throw new NotFoundException('Cliente non trovata');

    let staffRole: 'coach' | 'nutritionist';
    if (user.role === 'coach') {
      if (profile.assignedCoachId !== staffId) throw new ForbiddenException('Non è una tua cliente');
      staffRole = 'coach';
    } else if (user.role === 'nutritionist') {
      if (profile.assignedNutritionistId !== staffId) throw new ForbiddenException('Non è una tua paziente');
      staffRole = 'nutritionist';
    } else {
      throw new ForbiddenException('Ruolo non abilitato a creare appuntamenti');
    }

    return this.prisma.appointment.create({
      data: { clientId: dto.clientId, staffId, staffRole, type: dto.type, datetime: when, note: dto.note ?? null },
    });
  }

  /** Aggiorna/annulla un appuntamento: solo chi l'ha creato. */
  async updateAppointment(user: AuthUser, id: string, dto: UpdateAppointmentInput) {
    const appt = (await this.prisma.appointment.findUnique({ where: { id } })) as ApptRow | null;
    if (!appt) throw new NotFoundException('Appuntamento non trovato');
    const staffId = await this.staffId(user.sub);
    if (!staffId || appt.staffId !== staffId) throw new ForbiddenException('Non puoi modificare questo appuntamento');

    const data: Record<string, unknown> = {};
    if (dto.status) data.status = dto.status;
    if (dto.note !== undefined) data.note = dto.note;
    if (dto.datetime) {
      const when = new Date(dto.datetime);
      if (isNaN(when.getTime())) throw new BadRequestException('Data/ora non valida');
      data.datetime = when;
    }
    return this.prisma.appointment.update({ where: { id }, data });
  }

  /** Agenda del cliente: appuntamenti futuri (coach + nutrizionista) + scadenza piano. `next` = solo il prossimo. */
  async clientAgenda(clientId: string, nextOnly = false) {
    const now = new Date();
    const appts = (await this.prisma.appointment.findMany({
      where: { clientId, status: 'scheduled', datetime: { gte: now } },
      orderBy: { datetime: 'asc' },
      take: nextOnly ? 1 : 50,
    })) as ApptRow[];
    const staffNameOf = await this.staffNames([...new Set(appts.map((a) => a.staffId))]);
    const enrich = (a: ApptRow) => ({
      id: a.id,
      staffRole: a.staffRole,
      staffName: staffNameOf.get(a.staffId) ?? null,
      type: a.type,
      datetime: a.datetime.toISOString(),
      note: a.note,
    });

    if (nextOnly) return { next: appts[0] ? enrich(appts[0]) : null };

    const sub = (await this.prisma.subscription.findFirst({
      where: { clientId, status: 'active' },
      select: { endDate: true },
    })) as { endDate: Date | null } | null;
    return {
      appointments: appts.map(enrich),
      planEndDate: sub?.endDate ? sub.endDate.toISOString().slice(0, 10) : null,
    };
  }
}
