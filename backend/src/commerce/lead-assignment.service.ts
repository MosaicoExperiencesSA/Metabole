import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { nextRuleCode, refCodeBase, splitDisplayName } from '../common/ref-code';
import { ConfigParamsService } from '../config-params/config-params.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Assegnazione dei lead alle coach:
 * - la responsabile assegna un lead a una coach → stato "pending";
 * - la coach ha N giorni per accettarlo (accept) o rifiutarlo (reject) — soglia in
 *   config `lead_accept_days` (default 2);
 * - se scade, torna alla responsabile (cron) con notifica → riassegnazione;
 * - con ref code (registrazione) l'assegnazione è diretta ("accepted").
 */
@Injectable()
export class LeadAssignmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly configParams: ConfigParamsService,
  ) {}

  /** Finestra di accettazione in millisecondi (da `lead_accept_days`, default 2 giorni). */
  private async acceptWindowMs(): Promise<number> {
    const days = await this.configParams.getNumber('lead_accept_days', 2);
    return Math.max(1, days) * DAY_MS;
  }

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
    const windowMs = await this.acceptWindowMs();
    type Row = { id: string; name: string | null; email: string | null; assignedAt: Date | null; client: { email: string; clientProfile: { name: string | null } | null } | null; assignedBy: { displayName: string } | null };
    return (rows as Row[]).map((r) => {
      const deadline = r.assignedAt ? new Date(r.assignedAt.getTime() + windowMs) : null;
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

  /** Cron: fa scadere le assegnazioni non accettate oltre la finestra (config). */
  async expireStale(): Promise<{ expired: number }> {
    const days = await this.configParams.getNumber('lead_accept_days', 2);
    const cutoff = new Date(Date.now() - Math.max(1, days) * DAY_MS);
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
          body: `Il lead ${this.label(r)} non è stato accettato entro ${days} ${days === 1 ? 'giorno' : 'giorni'}: riassegnalo a un'altra coach.`,
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

  /** Elenco nutrizionisti (per il menu di assegnazione). */
  async listNutritionists() {
    return this.prisma.staff.findMany({
      where: { user: { role: 'nutritionist', status: 'active' }, active: true },
      select: { id: true, displayName: true },
      orderBy: { displayName: 'asc' },
    });
  }

  /**
   * Assegna (o rimuove) il nutrizionista di una cliente.
   * A differenza della coach non c'è finestra di accettazione: l'assegnazione è
   * diretta sul profilo. Vale solo per clienti registrati (non per i lead puri).
   * Passa stringa vuota per rimuovere.
   */
  async assignNutritionist(recordId: string, nutritionistStaffId: string, byUserId: string) {
    const record = await this.prisma.crmRecord.findUnique({ where: { id: recordId } });
    if (!record) throw new NotFoundException('Lead non trovato.');
    if (!record.clientId) {
      throw new BadRequestException('Il nutrizionista si assegna a una cliente registrata, non a un semplice lead.');
    }
    const staffId: string | null = nutritionistStaffId ? nutritionistStaffId : null;
    let nutriUserId: string | null = null;
    if (staffId) {
      const nutri = await this.prisma.staff.findFirst({
        where: { id: staffId, user: { role: 'nutritionist' } },
        include: { user: { select: { id: true } } },
      });
      if (!nutri) throw new BadRequestException('Nutrizionista non valido.');
      nutriUserId = nutri.user.id;
    }

    const profile = await this.prisma.clientProfile.findUnique({ where: { userId: record.clientId }, select: { id: true, name: true } });
    if (!profile) {
      throw new BadRequestException('Profilo cliente non trovato: la cliente deve completare il questionario.');
    }
    await this.prisma.clientProfile.update({
      where: { userId: record.clientId },
      data: { assignedNutritionistId: staffId },
    });

    if (nutriUserId) {
      await this.notifications.notify({
        userId: nutriUserId,
        type: 'client_assigned_nutritionist',
        title: 'Nuova cliente assegnata',
        body: `Ti è stata assegnata una nuova cliente: ${profile.name ?? this.label(record)}.`,
        payload: { clientId: record.clientId },
      });
    }
    await this.audit.log({
      action: 'crm.nutritionist.assign',
      actorId: byUserId,
      entityType: 'client_profile',
      entityId: profile.id,
      metadata: { nutritionistStaffId: staffId },
    });
    return { clientId: record.clientId, assignedNutritionistId: staffId };
  }

  // ---------- Ref code coach ----------

  private randomCode(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // niente caratteri ambigui
    let s = '';
    for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
    return s;
  }

  /**
   * Genera (o imposta, se `desired` è indicato) il ref code di una coach.
   * `desired`: codice scelto dall'admin (3-12 caratteri, lettere/numeri, salvato
   * in maiuscolo); dev'essere libero. Senza `desired` si genera col metodo
   * aziendale (5 lettere cognome + iniziale nome + progressivo da 01);
   * codice casuale solo come ripiego se il nome non è disponibile.
   */
  async generateRefCode(staffUserId: string, actorId: string, desired?: string): Promise<{ refCode: string }> {
    const staff = await this.prisma.staff.findFirst({
      where: { userId: staffUserId, user: { role: 'coach' } },
      select: { id: true, displayName: true, user: { select: { firstName: true, lastName: true } } },
    });
    if (!staff) throw new BadRequestException('Il ref code è disponibile solo per le coach.');
    let code: string;
    if (desired?.trim()) {
      code = desired.trim().toUpperCase();
      if (!/^[A-Z0-9]{3,12}$/.test(code)) {
        throw new BadRequestException('Ref code non valido: da 3 a 12 caratteri, solo lettere e numeri.');
      }
      const owner = await this.prisma.staff.findUnique({ where: { refCode: code }, select: { id: true } });
      if (owner && owner.id !== staff.id) {
        throw new BadRequestException('Ref code già assegnato a un\'altra coach.');
      }
      // Stessa forma dei codici cliente "porta un'amica": il codice non deve esistere neanche lì.
      const clientOwner = await this.prisma.clientProfile.findUnique({ where: { referralCode: code }, select: { userId: true } });
      if (clientOwner) throw new BadRequestException('Codice già usato da un invito cliente.');
    } else {
      code = await this.ruleOrRandomCode(staff);
    }
    await this.prisma.staff.update({ where: { id: staff.id }, data: { refCode: code } });
    await this.audit.log({ action: 'staff.refcode.generate', actorId, entityType: 'staff', entityId: staff.id, metadata: desired ? { custom: true } : undefined });
    return { refCode: code };
  }

  /** true se il codice è già usato da una coach O da un invito cliente. */
  private async codeTaken(code: string): Promise<boolean> {
    const [s, c] = await Promise.all([
      this.prisma.staff.findUnique({ where: { refCode: code }, select: { id: true } }),
      this.prisma.clientProfile.findUnique({ where: { referralCode: code }, select: { userId: true } }),
    ]);
    return Boolean(s || c);
  }

  /**
   * Codice col metodo aziendale (cognome+iniziale+01…); se nome/cognome non
   * ricavabili (da user o displayName) o progressivi esauriti → casuale.
   */
  private async ruleOrRandomCode(staff: {
    displayName?: string | null;
    user?: { firstName?: string | null; lastName?: string | null } | null;
  }): Promise<string> {
    const fromDisplay = splitDisplayName(staff.displayName);
    const base = refCodeBase(
      staff.user?.firstName || fromDisplay.firstName,
      staff.user?.lastName || fromDisplay.lastName,
    );
    if (base) {
      const code = await nextRuleCode(base, (c) => this.codeTaken(c));
      if (code) return code;
    }
    return this.freshRefCode();
  }

  /** Ripiego casuale: ref code univoco (controllato anche sui codici cliente). */
  private async freshRefCode(): Promise<string> {
    let code = this.randomCode();
    for (let i = 0; i < 8; i++) {
      if (!(await this.codeTaken(code))) break;
      code = this.randomCode();
    }
    return code;
  }

  /**
   * Invito della coach corrente: il suo ref code (creato se manca) + il link di
   * registrazione precompilato da condividere con la cliente (backlog #2).
   */
  async myInvite(coachUserId: string): Promise<{ refCode: string; url: string }> {
    const staff = await this.prisma.staff.findFirst({
      where: { userId: coachUserId, user: { role: 'coach' } },
      select: { id: true, refCode: true, displayName: true, user: { select: { firstName: true, lastName: true } } },
    });
    if (!staff) throw new BadRequestException('L\'invito è disponibile solo per le coach.');
    let refCode = staff.refCode;
    if (!refCode) {
      refCode = await this.ruleOrRandomCode(staff);
      await this.prisma.staff.update({ where: { id: staff.id }, data: { refCode } });
      await this.audit.log({ action: 'staff.refcode.generate', actorId: coachUserId, entityType: 'staff', entityId: staff.id });
    }
    const base = (process.env.APP_URL ?? 'https://app.metabole.eu').replace(/\/+$/, '');
    return { refCode, url: `${base}/register?ref=${refCode}` };
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

  /**
   * Auto-assegna una cliente alla coach del ref code al momento della registrazione.
   * A differenza dell'assegnazione manuale (che resta "pending" con finestra di 2 giorni),
   * il ref code è una scelta esplicita della cliente: l'assegnazione è immediata e già accettata.
   * Non blocca mai la registrazione: se qualcosa non torna, ritorna false silenziosamente.
   */
  async autoAssignByRefCode(clientId: string, code: string): Promise<boolean> {
    const resolved = await this.resolveByRefCode(code);
    if (!resolved) return false;
    const record = await this.prisma.crmRecord.findUnique({
      where: { clientId },
      select: { id: true },
    });
    if (!record) return false;
    await this.prisma.crmRecord.update({
      where: { id: record.id },
      data: {
        assignedCoachId: resolved.coachStaffId,
        assignmentStatus: 'accepted',
        assignedAt: new Date(),
        assignedById: null, // auto-assegnazione via codice, non da un manager
      },
    });
    // Se il profilo cliente esiste già, propaghiamo la coach; altrimenti verrà
    // impostata all'onboarding (updateMany su 0 righe è sicuro).
    await this.prisma.clientProfile.updateMany({
      where: { userId: clientId },
      data: { assignedCoachId: resolved.coachStaffId },
    });
    await this.audit.log({
      action: 'lead.assign.refcode',
      entityType: 'crm_record',
      entityId: record.id,
      metadata: { coachStaffId: resolved.coachStaffId, code: code.trim().toUpperCase() },
    });
    return true;
  }
}
