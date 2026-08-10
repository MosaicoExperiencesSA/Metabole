import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { agganciaAssegnazioneAlProfilo } from '../common/assegnazione-profilo';
import { nextRuleCode, refCodeBase, splitDisplayName } from '../common/ref-code';
import { ConfigParamsService } from '../config-params/config-params.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { coachTeamScope } from '../common/coach-team';

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
  private readonly logger = new Logger(LeadAssignmentService.name);

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

  // ---------- Storico delle assegnazioni (tabella `lead_assignment`) ----------
  //
  // Ogni assegnazione è una riga che nasce «pending» e finisce in un modo solo: accepted, rejected,
  // expired o reassigned. I tre campi su `crm_record` restano la verità sullo stato di ADESSO (li
  // leggono la dashboard, i filtri, la pipeline); qui c'è la storia, che prima veniva sovrascritta.
  // Le scritture sullo storico non devono mai far fallire l'assegnazione: se questa tabella ha un
  // problema, il lavoro delle coach continua e l'errore finisce nei log, come per l'audit.

  private nomeStaff(s: { displayName: string | null } | null | undefined): string | null {
    return s?.displayName?.trim() || null;
  }

  /**
   * Apre una riga di storico, chiudendo prima come `reassigned` quelle ancora in attesa sullo
   * stesso lead: un lead può essere in attesa da una coach sola, e la riassegnazione mentre l'altra
   * non aveva ancora risposto è essa stessa un fatto da conservare.
   */
  private async apriStorico(
    recordId: string,
    coachStaffId: string,
    byStaffId: string | null,
    origin: 'manual' | 'bulk' | 'ref_code',
    esitoIniziale: 'pending' | 'accepted' = 'pending',
  ): Promise<void> {
    try {
      const [coach, assegnante] = await Promise.all([
        this.prisma.staff.findUnique({ where: { id: coachStaffId }, select: { displayName: true } }),
        byStaffId ? this.prisma.staff.findUnique({ where: { id: byStaffId }, select: { displayName: true } }) : Promise.resolve(null),
      ]);
      const adesso = new Date();
      await this.prisma.leadAssignment.updateMany({
        where: { recordId, status: 'pending' },
        data: { status: 'reassigned', resolvedAt: adesso },
      });
      await this.prisma.leadAssignment.create({
        data: {
          recordId,
          coachId: coachStaffId,
          coachName: this.nomeStaff(coach) ?? 'coach senza nome',
          assignedById: byStaffId,
          assignedByName: this.nomeStaff(assegnante),
          status: esitoIniziale,
          origin,
          assignedAt: adesso,
          // Il ref code è già accettato in partenza: nasce e si chiude nello stesso istante.
          resolvedAt: esitoIniziale === 'accepted' ? adesso : null,
        },
      });
    } catch (err) {
      this.logger.error('Storico assegnazioni: apertura non riuscita', err instanceof Error ? err.stack : String(err));
    }
  }

  /** Chiude l'assegnazione in attesa su questo lead con il suo esito. */
  private async chiudiStorico(recordId: string, esito: 'accepted' | 'rejected' | 'expired', reason?: string): Promise<void> {
    try {
      await this.prisma.leadAssignment.updateMany({
        where: { recordId, status: 'pending' },
        data: { status: esito, resolvedAt: new Date(), ...(reason ? { reason } : {}) },
      });
    } catch (err) {
      this.logger.error('Storico assegnazioni: chiusura non riuscita', err instanceof Error ? err.stack : String(err));
    }
  }

  /** La responsabile assegna un lead a una coach (in attesa di accettazione). */
  async assignCoach(recordId: string, coachStaffId: string, byUserId: string) {
    const record = await this.prisma.crmRecord.findUnique({ where: { id: recordId } });
    if (!record) throw new NotFoundException('Lead non trovato.');
    const coach = await this.prisma.staff.findFirst({
      where: { id: coachStaffId, user: { role: { in: ['coach', 'coach_coordinator'] as never } } },
      include: { user: { select: { id: true } } },
    });
    if (!coach) throw new BadRequestException('Coach non valida.');

    // Coordinatrice (e coach): può muovere SOLO i lead già suoi o del suo team,
    // e SOLO verso una coach del suo team (sé compresa). Responsabile/capo/admin: tutto.
    const scope = await coachTeamScope(this.prisma, byUserId);
    if (scope) {
      if (!scope.includes(coachStaffId)) throw new ForbiddenException('Puoi assegnare solo alle coach del tuo team.');
      if (!record.assignedCoachId || !scope.includes(record.assignedCoachId)) {
        throw new ForbiddenException('Questo lead non è del tuo perimetro: chiedi alla responsabile.');
      }
    }

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
    await this.apriStorico(recordId, coachStaffId, byStaff, 'manual');
    await this.audit.log({ action: 'crm.lead.assign', actorId: byUserId, entityType: 'crm_record', entityId: recordId, metadata: { coachStaffId } });
    return updated;
  }

  /**
   * Assegnazione MASSIVA: la responsabile seleziona piu' lead e li assegna in un
   * colpo solo alla stessa coach (tutti in stato "pending", una sola notifica).
   */
  async assignCoachMany(recordIds: string[], coachStaffId: string, byUserId: string) {
    const ids = Array.from(new Set((recordIds ?? []).filter(Boolean)));
    if (ids.length === 0) throw new BadRequestException('Nessun lead selezionato.');

    const coach = await this.prisma.staff.findFirst({
      where: { id: coachStaffId, user: { role: { in: ['coach', 'coach_coordinator'] as never } } },
      include: { user: { select: { id: true } } },
    });
    if (!coach) throw new BadRequestException('Coach non valida.');

    // Perimetro coordinatrice/coach anche in massa: target nel team, lead già del team.
    const scope = await coachTeamScope(this.prisma, byUserId);
    if (scope && !scope.includes(coachStaffId)) throw new ForbiddenException('Puoi assegnare solo alle coach del tuo team.');

    // Scarta gli id inesistenti cosi' il conteggio riflette solo i lead reali.
    const existing = await this.prisma.crmRecord.findMany({
      where: {
        id: { in: ids },
        ...(scope ? { assignedCoachId: { in: scope } } : {}),
      } as never,
      select: { id: true },
    }) as { id: string }[];
    const existingIds = existing.map((r) => r.id);
    if (existingIds.length === 0) throw new BadRequestException(scope ? 'Nessuno dei lead selezionati è del tuo perimetro.' : 'Nessun lead valido da assegnare.');

    const byStaff = await this.staffIdOf(byUserId);
    await this.prisma.crmRecord.updateMany({
      where: { id: { in: existingIds } },
      data: { assignedCoachId: coachStaffId, assignmentStatus: 'pending', assignedAt: new Date(), assignedById: byStaff },
    });

    const n = existingIds.length;
    await this.notifications.notify({
      userId: coach.user.id,
      type: 'lead_assigned',
      title: n === 1 ? 'Nuovo lead da accettare' : `${n} nuovi lead da accettare`,
      body:
        n === 1
          ? 'Ti è stato assegnato 1 lead. Hai 2 giorni per accettarlo, poi torna alla responsabile.'
          : `Ti sono stati assegnati ${n} lead. Hai 2 giorni per accettarli, poi tornano alla responsabile.`,
      payload: { recordIds: existingIds },
    });
    for (const id of existingIds) await this.apriStorico(id, coachStaffId, byStaff, 'bulk');
    /**
     * UNA riga di audit per OGNI lead, non una sola con l'id del primo.
     *
     * Prima era `entityId: existingIds[0]`: il log della scheda di un lead si legge per `entityId`,
     * quindi 199 lead su 200 avevano una scheda che diceva «nessuno ti ha mai assegnato». Il conteggio
     * complessivo resta nel metadata di ogni riga, così si capisce che faceva parte di un'azione di
     * massa e non di duecento clic.
     */
    await this.audit.logMany(
      existingIds.map((id) => ({
        action: 'crm.lead.assign_bulk',
        actorId: byUserId,
        entityType: 'crm_record',
        entityId: id,
        metadata: { coachStaffId, count: n },
      })),
    );
    return { assigned: n, coachStaffId };
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
    // Prima era un `updateMany`: se il profilo non esisteva ancora (account nato da
    // "Invia credenziali", questionario mai compilato) aggiornava ZERO righe in silenzio
    // e l'assegnazione si perdeva. Ora, se manca, il profilo viene creato.
    if (record.clientId && staffId) {
      await agganciaAssegnazioneAlProfilo(this.prisma, record.clientId, {
        name: record.name,
        assignedCoachId: staffId,
      });
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
    await this.chiudiStorico(recordId, 'accepted');
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

    // Lo storico si chiude PRIMA di azzerare i campi sul lead: dopo l'update non si sa più chi era
    // la coach, ed è esattamente l'informazione che il rifiuto deve conservare.
    await this.chiudiStorico(recordId, 'rejected', reason);
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
    // Coordinatrice: vede i lead in attesa di TUTTO il suo perimetro (lei + team),
    // così può riassegnarli in massa alle sue coach; la coach vede solo i propri.
    const scope = (await coachTeamScope(this.prisma, coachUserId)) ?? [staffId];
    const rows = await this.prisma.crmRecord.findMany({
      where: { assignedCoachId: { in: scope }, assignmentStatus: 'pending' },
      orderBy: { assignedAt: 'asc' },
      include: { client: { select: { email: true, clientProfile: { select: { name: true } } } }, assignedBy: { select: { displayName: true } }, assignedCoach: { select: { id: true, displayName: true } } },
    });
    const now = Date.now();
    const windowMs = await this.acceptWindowMs();
    type Row = { id: string; name: string | null; email: string | null; assignedAt: Date | null; client: { email: string; clientProfile: { name: string | null } | null } | null; assignedBy: { displayName: string } | null; assignedCoach: { id: string; displayName: string } | null };
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
        // Per la vista della coordinatrice: su quale coach è in attesa, e se è "mio".
        coachName: r.assignedCoach?.displayName ?? null,
        mine: r.assignedCoach?.id === staffId,
      };
    });
  }

  /**
   * STORICO delle assegnazioni nel perimetro di chi guarda — il «mostra accettati» di Simone.
   *
   * Il perimetro è lo stesso di `myPending`: la coach vede le sue, la coordinatrice quelle del suo
   * team, la responsabile e l'admin tutte. Non è un dettaglio di comodo: lo storico contiene nomi di
   * clienti e motivi di rifiuto scritti dalle colleghe, e la regola su chi può leggerli deve essere
   * la stessa che vale per l'elenco in attesa, non una più larga perché «è solo storico».
   *
   * Include le pendenti: la tabella è una sola e il flag decide cosa mostrare, quindi il server
   * manda tutto e il filtro sta dove c'è la spunta.
   */
  async storicoAssegnazioni(userId: string, limite = 500) {
    const staffId = await this.staffIdOf(userId);
    // `coachTeamScope` restituisce null per chi non ha limiti di perimetro (responsabile, capo
    // nutrizioniste, admin): per loro il filtro non c'è. Per tutti gli altri il perimetro è il team,
    // o solo sé stessi.
    const scope = await coachTeamScope(this.prisma, userId);
    const righe = await this.prisma.leadAssignment.findMany({
      where: scope === null ? {} : { coachId: { in: scope } },
      orderBy: { assignedAt: 'desc' },
      take: Math.min(Math.max(limite, 1), 2000),
      include: { record: { select: { id: true, name: true, email: true, clientId: true, stage: true } } },
    });
    return this.formattaStorico(righe, staffId);
  }

  private async formattaStorico(
    righe: unknown[],
    staffId: string | null,
  ) {
    type Riga = {
      id: string;
      recordId: string;
      coachId: string | null;
      coachName: string;
      assignedByName: string | null;
      status: string;
      origin: string;
      assignedAt: Date;
      resolvedAt: Date | null;
      reason: string | null;
      record: { id: string; name: string | null; email: string | null; clientId: string | null; stage: string } | null;
    };
    const windowMs = await this.acceptWindowMs();
    const now = Date.now();
    return (righe as Riga[]).map((r) => ({
      id: r.id,
      recordId: r.recordId,
      name: r.record?.name ?? r.record?.email ?? 'Senza nome',
      email: r.record?.email ?? null,
      /** true se il lead è diventata una cliente registrata: nella tabella si linka alla scheda. */
      clientId: r.record?.clientId ?? null,
      stage: r.record?.stage ?? null,
      coachName: r.coachName,
      assignedBy: r.assignedByName,
      status: r.status,
      origin: r.origin,
      assignedAt: r.assignedAt,
      resolvedAt: r.resolvedAt,
      reason: r.reason,
      mine: !!staffId && r.coachId === staffId,
      // Solo per le pendenti: quanto manca. Sulle chiuse non vuol dire niente e resta null.
      hoursLeft:
        r.status === 'pending'
          ? Math.max(0, Math.round((r.assignedAt.getTime() + windowMs - now) / 3_600_000))
          : null,
    }));
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
      // Come per il rifiuto: prima lo storico, poi l'azzeramento dei campi.
      await this.chiudiStorico(r.id, 'expired');
      /**
       * L'audit della scadenza: prima non c'era. Un lead tornava alla responsabile e nel log non
       * compariva nulla — l'unica traccia era la notifica, che si legge e sparisce. È la riga che
       * risponde a «perché questo lead è di nuovo da assegnare?».
       */
      await this.audit.log({
        action: 'crm.lead.assign_expired',
        entityType: 'crm_record',
        entityId: r.id,
        metadata: { days },
      });
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

  /** Elenco coach per il menu di assegnazione (coordinatrice → solo il suo team). */
  async listCoaches(actorUserId?: string) {
    const scope = actorUserId ? await coachTeamScope(this.prisma, actorUserId) : null;
    const rows = await this.prisma.staff.findMany({
      where: {
        user: { role: { in: ['coach', 'coach_coordinator'] as never }, status: 'active' },
        active: true,
        ...(scope ? { id: { in: scope } } : {}),
      } as never,
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
    let staff = await this.prisma.staff.findFirst({
      where: { userId: staffUserId, user: { role: { in: ['coach', 'coach_coordinator', 'sales'] as never } } },
      select: { id: true, displayName: true, user: { select: { firstName: true, lastName: true } } },
    });
    if (!staff) {
      // Coordinatrici create in passato SENZA scheda Staff (mancava coach_coordinator
      // tra gli STAFF_ROLES): la creiamo al volo, così anche la manager coach ha il
      // suo ref code come le altre coach.
      const user = await this.prisma.user.findFirst({
        where: { id: staffUserId, role: { in: ['coach', 'coach_coordinator', 'sales'] as never } },
        select: { id: true, email: true, firstName: true, lastName: true },
      });
      if (!user) throw new BadRequestException('Il ref code è disponibile solo per le coach.');
      staff = await this.prisma.staff.create({
        data: { userId: user.id, displayName: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email.split('@')[0] },
        select: { id: true, displayName: true, user: { select: { firstName: true, lastName: true } } },
      });
    }
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
    // Anche la NUTRIZIONISTA: `resolveByRefCode` accetta già il suo codice e
    // `autoAssignByRefCode` le assegna la cliente. Escluderla da qui voleva dire darle un
    // codice funzionante che però non poteva vedere.
    const staff = await this.prisma.staff.findFirst({
      where: {
        userId: coachUserId,
        user: { role: { in: ['coach', 'coach_coordinator', 'sales', 'nutritionist', 'head_nutritionist'] as never } },
      },
      select: { id: true, refCode: true, displayName: true, user: { select: { firstName: true, lastName: true } } },
    });
    if (!staff) throw new BadRequestException('Il link d\'invito è disponibile solo allo staff con una scheda personale: chiedi a un amministratore di crearla.');
    let refCode = staff.refCode;
    if (!refCode) {
      refCode = await this.ruleOrRandomCode(staff);
      await this.prisma.staff.update({ where: { id: staff.id }, data: { refCode } });
      await this.audit.log({ action: 'staff.refcode.generate', actorId: coachUserId, entityType: 'staff', entityId: staff.id });
    }
    const base = (process.env.APP_URL ?? 'https://app.metabole.eu').replace(/\/+$/, '');
    return { refCode, url: `${base}/register?ref=${refCode}` };
  }

  /**
   * Risolve uno STAFF dal suo ref code (per la registrazione con codice).
   * Il codice può essere di una coach o di una nutrizionista: sono gli unici due
   * casi in cui l'assegnazione del team avviene senza il responsabile.
   */
  async resolveByRefCode(
    code: string,
  ): Promise<{ staffId: string; userId: string; role: 'coach' | 'nutritionist' } | null> {
    const staff = await this.prisma.staff.findUnique({
      where: { refCode: (code ?? '').trim().toUpperCase() },
      include: { user: { select: { id: true, role: true } } },
    });
    if (!staff || (staff.user.role !== 'coach' && staff.user.role !== 'coach_coordinator' && staff.user.role !== 'nutritionist')) return null;
    // La coordinatrice, ai fini dell'assegnazione via ref code, conta come coach.
    return { staffId: staff.id, userId: staff.user.id, role: staff.user.role === 'nutritionist' ? 'nutritionist' : 'coach' };
  }

  /**
   * Auto-assegna una cliente alla coach O alla nutrizionista del ref code al momento
   * della registrazione. A differenza dell'assegnazione manuale del responsabile
   * (che per la coach resta "pending" con finestra di 2 giorni), il ref code è una
   * scelta esplicita della cliente: l'assegnazione è immediata e già accettata.
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
    if (resolved.role === 'coach') {
      await this.prisma.crmRecord.update({
        where: { id: record.id },
        data: {
          assignedCoachId: resolved.staffId,
          assignmentStatus: 'accepted',
          assignedAt: new Date(),
          assignedById: null, // auto-assegnazione via codice, non da un manager
        },
      });
      // Anche il ref code entra nell'archivio, marcato per come è nato: senza questa riga le coach
      // che lavorano solo col proprio link avrebbero uno storico vuoto.
      await this.apriStorico(record.id, resolved.staffId, null, 'ref_code', 'accepted');
    } else {
      await this.prisma.crmRecord.update({
        where: { id: record.id },
        data: { assignedNutritionistId: resolved.staffId },
      });
    }
    // Propaghiamo lo staff al profilo, creandolo se non c'è. Prima era un `updateMany` che si
    // affidava all'onboarding: chi si registra col codice di una coach e poi non compila il
    // questionario resta invisibile a quella coach, perché le liste clienti filtrano sul profilo.
    await agganciaAssegnazioneAlProfilo(this.prisma, clientId, {
      assignedCoachId: resolved.role === 'coach' ? resolved.staffId : null,
      assignedNutritionistId: resolved.role === 'coach' ? null : resolved.staffId,
    });
    await this.audit.log({
      action: 'lead.assign.refcode',
      entityType: 'crm_record',
      entityId: record.id,
      metadata: { staffId: resolved.staffId, role: resolved.role, code: code.trim().toUpperCase() },
    });
    return true;
  }
}
