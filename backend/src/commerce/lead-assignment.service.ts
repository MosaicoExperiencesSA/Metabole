import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

const ACCEPT_WINDOW_MS = 2 * 24 * 60 * 60 * 1000; // 2 giorni

/**
 * Assegnazione dei lead alle coach:
 * - la responsabile assegna un lead a una coach → stato "pending";
 * - la coach ha 2 giorni per accettarlo (accept) o rifiutarlo (reject);
 * - se scade, torna alla responsabile (cron) con notifica → riassegnazione;
 * - con ref code (registrazione) l'assegnazione è diretta ("accepted").
 */
@Injectable()
export class LeadAssignmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  private label(r: { name: string | null; email: string | null }): string {
    return r.name ?? r.email ?? 'senza nome';
  }

  private async staffIdOf(userId: string): Promise<string | null> {
    const s = await this.prisma.staff.findUnique({ where: { userId }, select: { id: true } });
    return s?.id ?? null;
  }

  /** La responsabile assegna un lead a una coach (in attesa di accettazione). */
  async assignCoach(recordId: string, coachStaffId: string, byUserId: string) {
    const record = await this.prisma.crmRecord.findUnique({ where: { id: recordId } });
    if (!record) throw new NotFoundException('Lead non trovato.');
    const coach = await this.prisma.staff.findFirst({
      where: { id: coachStaffId, user: { role: 'coach' } },
      include: { user: { select: { id: true } } },
    });
    if (!coach) throw new BadRequestException('Coach non valida.');

    const byStaff = await this.staffIdOf(byUserId);
    const updated = await this.prisma.crmRecord.update({
      where: { id: recordId },
      data: { assignedCoachId: coachStaffId, assignmentStatus: 'pending', assignedAt: new Date(), assignedById: byStaff },
    });
    await this.notifications.notify({
      userId: coach.user.id,
      type: 'lead_assigned',
      title: 'Nuovo lead da accettare',
      body: `Ti è stato assegnato un lead (${this.label(record)}). Hai 2 giorni per accettarlo, poi torna alla responsabile.`,
      payload: { recordId },
    });
    await this.audit.log({ action: 'crm.lead.assign', actorId: byUserId, entityType: 'crm_record', entityId: recordId, metadata: { coachStaffId } });
    return updated;
  }

  /** La coach accetta il lead assegnato. */
  async accept(recordId: string, coachUserId: string) {
    const record = await this.prisma.crmRecord.findUnique({
      where: { id: recordId },
      include: { assignedBy: { select: { userId: true } } },
    });
    if (!record || record.assignmentStatus !== 'pending') throw new BadRequestException('Nessuna assegnazione da accettare.');
    const staffId = await this.staffIdOf(coachUserId);
    if (record.assignedCoachId !== staffId) throw new ForbiddenException('Non sei la coach assegnata a questo lead.');

    const updated = await this.prisma.crmRecord.update({ where: { id: recordId }, data: { assignmentStatus: 'accepted' } });
    // Se è già una cliente registrata, imposta la coach anche sul profilo.
    if (record.clientId && staffId) {
      await this.prisma.clientProfile.updateMany({ where: { userId: record.clientId }, data: { assignedCoachId: staffId } });
    }
    if (record.assignedBy?.userId) {
      await this.notifications.notify({
        userId: record.assignedBy.userId,
        type: 'lead_accepted',
        title: 'Lead accettato',
        body: `La coach ha accettato il lead ${this.label(record)}.`,
        payload: { recordId },
      });
    }
    await this.audit.log({ action: 'crm.lead.accept', actorId: coachUserId, entityType: 'crm_record', entityId: recordId });
    return updated;
  }

  /** La coach rifiuta il lead: torna alla responsabile. */
  async reject(recordId: string, coachUserId: string, reason?: string) {
    const record = await this.prisma.crmRecord.findUnique({
      where: { id: recordId },
      include: { assignedBy: { select: { userId: true } } },
    });
    if (!record || record.assignmentStatus !== 'pending') throw new BadRequestException('Nessuna assegnazione da rifiutare.');
    const staffId = await this.staffIdOf(coachUserId);
    if (record.assignedCoachId !== staffId) throw new ForbiddenException('Non sei la coach assegnata a questo lead.');

    const updated = await this.prisma.crmRecord.update({ where: { id: recordId }, data: { assignmentStatus: null, assignedCoachId: null } });
    if (record.assignedBy?.userId) {
      await this.notifications.notify({
        userId: record.assignedBy.userId,
        type: 'lead_rejected',
        title: 'Lead rifiutato',
        body: `La coach ha rifiutato il lead ${this.label(record)}${reason ? `: ${reason}` : ''}. Riassegnalo a un'altra coach.`,
        payload: { recordId },
      });
    }
    await this.audit.log({ action: 'crm.lead.reject', actorId: coachUserId, entityType: 'crm_record', entityId: recordId, metadata: { reason } });
    return updated;
  }

  /** Lead in attesa di accettazione per la coach corrente. */
  async myPending(coachUserId: string) {
    const staffId = await this.staffIdOf(coachUserId);
    if (!staffId) return [];
    const rows = await this.prisma.crmRecord.findMany({
      where: { assignedCoachId: staffId, assignmentStatus: 'pending' },
      orderBy: { assignedAt: 'asc' },
      include: { client: { select: { email: true, clientProfile: { select: { name: true } } } }, assignedBy: { select: { displayName: true } } },
    });
    const now = Date.now();
    type Row = { id: string; name: string | null; email: string | null; assignedAt: Date | null; client: { email: string; clientProfile: { name: string | null } | null } | null; assignedBy: { displayName: string } | null };
    return (rows as Row[]).map((r) => {
      const deadline = r.assignedAt ? new Date(r.assignedAt.getTime() + ACCEPT_WINDOW_MS) : null;
      const hoursLeft = deadline ? Math.max(0, Math.round((deadline.getTime() - now) / 3_600_000)) : null;
      return {
        id: r.id,
        name: r.client?.clientProfile?.name ?? r.name ?? r.client?.email ?? r.email ?? 'Senza nome',
        email: r.client?.email ?? r.email ?? null,
        assignedBy: r.assignedBy?.displayName ?? null,
        assignedAt: r.assignedAt,
        hoursLeft,
      };
    });
  }

  /** Cron: fa scadere le assegnazioni non accettate dopo 2 giorni. */
  async expireStale(): Promise<{ expired: number }> {
    const cutoff = new Date(Date.now() - ACCEPT_WINDOW_MS);
    const stale = await this.prisma.crmRecord.findMany({
      where: { assignmentStatus: 'pending', assignedAt: { lt: cutoff } },
      include: { assignedBy: { select: { userId: true } } },
    });
    type Row = { id: string; name: string | null; email: string | null; assignedBy: { userId: string } | null };
    for (const r of stale as Row[]) {
      await this.prisma.crmRecord.update({ where: { id: r.id }, data: { assignmentStatus: null, assignedCoachId: null } });
      if (r.assignedBy?.userId) {
        await this.notifications.notify({
          userId: r.assignedBy.userId,
          type: 'lead_assignment_expired',
          title: 'Lead non accettato in tempo',
          body: `Il lead ${this.label(r)} non è stato accettato entro 2 giorni: riassegnalo a un'altra coach.`,
          payload: { recordId: r.id },
        });
      }
    }
    return { expired: stale.length };
  }

  /** Elenco coach (per il menu di assegnazione). */
  async listCoaches() {
    const rows = await this.prisma.staff.findMany({
      where: { user: { role: 'coach', status: 'active' }, active: true },
      select: { id: true, displayName: true },
      orderBy: { displayName: 'asc' },
    });
    return rows;
  }

  // ---------- Ref code coach ----------

  private randomCode(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // niente caratteri ambigui
    let s = '';
    for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
    return s;
  }

  async generateRefCode(staffUserId: string, actorId: string): Promise<{ refCode: string }> {
    const staff = await this.prisma.staff.findFirst({ where: { userId: staffUserId, user: { role: 'coach' } }, select: { id: true } });
    if (!staff) throw new BadRequestException('Il ref code è disponibile solo per le coach.');
    let code = this.randomCode();
    for (let i = 0; i < 8; i++) {
      const exists = await this.prisma.staff.findUnique({ where: { refCode: code } });
      if (!exists) break;
      code = this.randomCode();
    }
    await this.prisma.staff.update({ where: { id: staff.id }, data: { refCode: code } });
    await this.audit.log({ action: 'staff.refcode.generate', actorId, entityType: 'staff', entityId: staff.id });
    return { refCode: code };
  }

  /** Risolve una coach dal suo ref code (per la registrazione con codice). */
  async resolveByRefCode(code: string): Promise<{ coachStaffId: string; coachUserId: string } | null> {
    const coach = await this.prisma.staff.findUnique({
      where: { refCode: (code ?? '').trim().toUpperCase() },
      include: { user: { select: { id: true, role: true } } },
    });
    if (!coach || coach.user.role !== 'coach') return null;
    return { coachStaffId: coach.id, coachUserId: coach.user.id };
  }
}
