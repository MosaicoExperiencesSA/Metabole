import { Injectable, NotFoundException } from '@nestjs/common';
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

  async list(filter: { from?: string; to?: string; includeDone?: boolean }) {
    const where: Record<string, unknown> = {};
    if (filter.from || filter.to) {
      where.dueAt = {
        ...(filter.from ? { gte: new Date(filter.from) } : {}),
        ...(filter.to ? { lte: new Date(filter.to) } : {}),
      };
    }
    if (!filter.includeDone) where.done = false;

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
      crmRecord: { name: string | null; email: string | null; client: { email: string; clientProfile: { name: string | null } | null } | null } | null;
    };
    return (rows as R[]).map((r) => ({
      id: r.id,
      title: r.title,
      dueAt: r.dueAt,
      note: r.note,
      done: r.done,
      crmRecordId: r.crmRecordId,
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
    await this.prisma.crmReminder.delete({ where: { id } });
    await this.audit.log({ action: 'crm.reminder.delete', actorId, entityType: 'crm_reminder', entityId: id });
    return { removed: id };
  }
}
