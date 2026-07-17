import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Calendario CRM: promemoria e appuntamenti legati (facoltativamente) a un
 * lead/cliente. Usati dallo staff per richiami, scadenze, note nel tempo.
 */
@Injectable()
export class RemindersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Visibilità per ruolo: coach e nutrizionista vedono SOLO i promemoria creati da
   * loro o legati ai loro assegnati (lead per la coach, clienti per il nutrizionista);
   * manager coach (sales), capo nutrizionista e admin vedono tutto.
   * Ritorna il where-OR da applicare, o null se l'attore vede tutto.
   */
  private async reminderScope(actorUserId?: string): Promise<Record<string, unknown>[] | null> {
    if (!actorUserId) return null;
    const u = (await this.prisma.user.findUnique({ where: { id: actorUserId }, select: { role: true } })) as { role: string } | null;
    const role = u?.role;
    if (role !== 'coach' && role !== 'coach_coordinator' && role !== 'nutritionist') return null;
    const staff = (await this.prisma.staff.findUnique({ where: { userId: actorUserId }, select: { id: true } })) as { id: string } | null;
    const staffId = staff?.id ?? '00000000-0000-0000-0000-000000000000';
    return role === 'coach' || role === 'coach_coordinator'
      ? [{ createdById: actorUserId }, { crmRecord: { assignedCoachId: staffId } }]
      : [{ createdById: actorUserId }, { crmRecord: { client: { clientProfile: { assignedNutritionistId: staffId } } } }];
  }

  /** Blocca modifica/eliminazione dei promemoria fuori dal proprio perimetro. */
  private async assertReminderAccess(actorUserId: string, reminder: { createdById: string | null; crmRecordId: string | null }) {
    const scope = await this.reminderScope(actorUserId);
    if (!scope) return; // manager/capo/admin
    if (reminder.createdById === actorUserId) return;
    if (reminder.crmRecordId) {
      const u = (await this.prisma.user.findUnique({ where: { id: actorUserId }, select: { role: true } })) as { role: string } | null;
      const staff = (await this.prisma.staff.findUnique({ where: { userId: actorUserId }, select: { id: true } })) as { id: string } | null;
      const rec = (await this.prisma.crmRecord.findUnique({
        where: { id: reminder.crmRecordId },
        select: { assignedCoachId: true, client: { select: { clientProfile: { select: { assignedNutritionistId: true } } } } },
      })) as { assignedCoachId: string | null; client: { clientProfile: { assignedNutritionistId: string | null } | null } | null } | null;
      const ok = u?.role === 'coach' || u?.role === 'coach_coordinator'
        ? rec?.assignedCoachId === staff?.id
        : rec?.client?.clientProfile?.assignedNutritionistId === staff?.id;
      if (ok) return;
    }
    throw new ForbiddenException('Questo promemoria non è tuo né dei tuoi assegnati.');
  }

  async list(filter: { from?: string; to?: string; includeDone?: boolean }, actorUserId?: string) {
    const where: Record<string, unknown> = {};
    if (filter.from || filter.to) {
      where.dueAt = {
        ...(filter.from ? { gte: new Date(filter.from) } : {}),
        ...(filter.to ? { lte: new Date(filter.to) } : {}),
      };
    }
    if (!filter.includeDone) where.done = false;
    const scope = await this.reminderScope(actorUserId);
    if (scope) where.OR = scope;

    const rows = await this.prisma.crmReminder.findMany({
      where,
      orderBy: { dueAt: 'asc' },
      take: 500,
      include: {
        crmRecord: {
          select: {
            id: true,
            name: true,
            email: true,
            client: { select: { email: true, clientProfile: { select: { name: true } } } },
          },
        },
      },
    });
    type R = {
      id: string; title: string; dueAt: Date; note: string | null; done: boolean; crmRecordId: string | null;
      createdById: string | null;
      crmRecord: { name: string | null; email: string | null; client: { email: string; clientProfile: { name: string | null } | null } | null } | null;
    };
    return (rows as R[]).map((r) => ({
      id: r.id,
      title: r.title,
      dueAt: r.dueAt,
      note: r.note,
      done: r.done,
      crmRecordId: r.crmRecordId,
      createdById: r.createdById,
      linkedName: r.crmRecord
        ? r.crmRecord.client?.clientProfile?.name ?? r.crmRecord.name ?? r.crmRecord.client?.email ?? r.crmRecord.email ?? null
        : null,
    }));
  }

  async create(input: { title: string; dueAt: string; note?: string; crmRecordId?: string }, actorId: string) {
    const reminder = await this.prisma.crmReminder.create({
      data: {
        title: input.title.trim(),
        dueAt: new Date(input.dueAt),
        note: input.note?.trim() || null,
        crmRecordId: input.crmRecordId || null,
        createdById: actorId,
      },
    });
    await this.audit.log({ action: 'crm.reminder.create', actorId, entityType: 'crm_reminder', entityId: reminder.id });
    return reminder;
  }

  async update(id: string, input: { title?: string; dueAt?: string; note?: string; done?: boolean }, actorId: string) {
    const existing = await this.prisma.crmReminder.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Promemoria non trovato.');
    await this.assertReminderAccess(actorId, existing as { createdById: string | null; crmRecordId: string | null });
    const updated = await this.prisma.crmReminder.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.dueAt !== undefined ? { dueAt: new Date(input.dueAt) } : {}),
        ...(input.note !== undefined ? { note: input.note.trim() || null } : {}),
        ...(input.done !== undefined ? { done: input.done } : {}),
      },
    });
    await this.audit.log({ action: 'crm.reminder.update', actorId, entityType: 'crm_reminder', entityId: id });
    return updated;
  }

  async remove(id: string, actorId: string) {
    const existing = await this.prisma.crmReminder.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Promemoria non trovato.');
    await this.assertReminderAccess(actorId, existing as { createdById: string | null; crmRecordId: string | null });
    await this.prisma.crmReminder.delete({ where: { id } });
    await this.audit.log({ action: 'crm.reminder.delete', actorId, entityType: 'crm_reminder', entityId: id });
    return { removed: id };
  }
}
