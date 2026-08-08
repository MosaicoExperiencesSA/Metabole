import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { agganciaAssegnazioneAlProfilo } from '../common/assegnazione-profilo';
import { coachTeamScope } from '../common/coach-team';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { avanzaStatoSeIndietro } from './avanza-stato';
import { PrismaService } from '../prisma/prisma.service';
import { PipelineService } from './pipeline.service';

/** Password provvisoria leggibile: niente caratteri ambigui, con cifre (come users.service). */
function genTempPassword(): string {
  const alpha = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ';
  const digits = '23456789';
  const b = randomBytes(12);
  let s = '';
  for (let i = 0; i < 8; i++) s += alpha[b[i] % alpha.length];
  s += digits[b[8] % digits.length];
  s += digits[b[9] % digits.length];
  return `Mb${s}`;
}

/**
 * CRM (spec sez. 8): ogni transizione salva DATA + RESPONSABILE in stage_dates.
 * lead_in nasce automaticamente alla registrazione; paid all'approvazione bonifico.
 * Gli STATI sono gestiti dall'admin (PipelineService), non più fissi nel codice.
 */
@Injectable()
export class CrmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly pipeline: PipelineService,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
    private readonly configParams: ConfigParamsService,
  ) {}

  /**
   * "Invia credenziali" a un lead: crea l'accesso se non esiste e gli manda **un link per
   * scegliersi la password**, non una password. Collega il lead all'utente. NON cambia lo
   * stage: il lead diventa cliente solo con l'acquisto.
   *
   * ⚠️ Fino al 7/8 questa funzione generava una password provvisoria e la spediva **in chiaro**
   * per email — e su un account già esistente la RIGENERAVA, buttando fuori chi stava usando
   * l'app e cancellando la password che si era scelta. Ora: account nuovo → password casuale
   * che nessuno conosce, account esistente → non si tocca niente. In entrambi i casi parte un
   * token di reimpostazione a tempo, lo stesso meccanismo del «password dimenticata».
   * Il segreto che viaggia è usa-e-getta e scade; nessuno resta scritto in una casella di posta.
   *
   * ⚠️ Il lead NON deve perdere la sua coach in questo passaggio (segnalazione Simone 6/8:
   * «se un lead è assegnato a me e io gli mando le credenziali deve restare legato a me»).
   * Prima l'account nasceva senza `ClientProfile`, e le liste dei clienti filtrano su
   * `ClientProfile.assignedCoachId`: la coach spediva le credenziali e subito dopo non
   * riusciva più ad aprire la scheda della sua cliente («non assegnata a nessuno»).
   * L'assegnazione si propagava solo all'onboarding — cioè quando la cliente si degnava di
   * compilare il questionario, che può non succedere mai.
   */
  async sendCredentials(recordId: string, actorId: string): Promise<{ sent: boolean; email: string }> {
    await this.assertLeadAccess(actorId, recordId);
    const rec = (await this.prisma.crmRecord.findUnique({
      where: { id: recordId },
      select: {
        id: true, email: true, name: true, phone: true, clientId: true,
        assignedCoachId: true, assignedNutritionistId: true, assignmentStatus: true,
      },
    })) as {
      id: string; email: string | null; name: string | null; phone: string | null; clientId: string | null;
      assignedCoachId: string | null; assignedNutritionistId: string | null; assignmentStatus: string | null;
    } | null;
    if (!rec) throw new NotFoundException('Lead non trovato');
    if (!rec.email || !rec.email.includes('@')) {
      throw new BadRequestException('Il lead non ha un\'email valida: aggiungila prima di inviare le credenziali.');
    }
    const email = rec.email.trim().toLowerCase();
    const firstName = rec.name?.trim().split(/\s+/)[0] || null;

    let userId = rec.clientId;
    if (!userId) {
      // Se l'email è già di un altro account, lo colleghiamo invece di duplicare.
      const existing = (await this.prisma.user.findUnique({ where: { email }, select: { id: true } })) as { id: string } | null;
      userId = existing?.id ?? null;
    }

    if (!userId) {
      // Account nuovo: nasce con una password CASUALE che non viene comunicata a nessuno — serve
      // solo perché la colonna non è nullable. L'accesso si apre col link qui sotto.
      const segreto = await argon2.hash(genTempPassword());
      const user = await this.prisma.user.create({
        data: {
          email,
          passwordHash: segreto,
          role: 'client',
          locale: 'it',
          firstName,
          phone: rec.phone?.trim() || null,
          mustChangePassword: true,
          emailVerifiedAt: new Date(),
        },
        select: { id: true },
      });
      userId = user.id;
    }
    // ⚠️ Su un account che ESISTE GIÀ non si tocca la password e non si revocano le sessioni.
    // Prima si faceva: rimandare le credenziali buttava fuori una cliente che stava usando l'app,
    // e le cambiava una password che magari si era già scelta. Il link basta: se lo usa cambia
    // password (e lì le sessioni si revocano, come in ogni reset), se non lo usa non succede nulla.

    // Il link: un token di reimpostazione, lo stesso meccanismo del «password dimenticata».
    // Dura più a lungo (un lead non legge l'email nello stesso minuto) ma resta a tempo.
    const giorni = await this.configParams.getNumber('lead_credentials_link_days', 7);
    const token = randomBytes(32).toString('hex');
    await this.prisma.actionToken.create({
      data: {
        userId,
        type: 'password_reset' as never,
        tokenHash: createHash('sha256').update(token).digest('hex'),
        expiresAt: new Date(Date.now() + Math.max(1, giorni) * 24 * 3600_000),
      },
    });
    const appUrl = (process.env.APP_URL ?? 'https://app.metabole.eu').replace(/\/+$/, '');
    const link = `${appUrl}/reset-password?token=${token}`;
    // Collega il lead all'account (senza toccare lo stage).
    await this.prisma.crmRecord.update({ where: { id: recordId }, data: { clientId: userId } });

    // Se il lead era ancora "da accettare" ed è la coach assegnata a mandare le credenziali,
    // l'accettazione è implicita: sta già lavorando il lead. Senza questo, dopo `lead_accept_days`
    // il cron di scadenza glielo toglieva di mano proprio mentre lo stava seguendo.
    // Va PRIMA dell'aggancio al profilo, perché è l'aggancio a dipendere da questo esito.
    let accettato = rec.assignmentStatus === 'accepted';
    if (rec.assignmentStatus === 'pending' && rec.assignedCoachId) {
      const staff = (await this.prisma.staff.findUnique({ where: { userId: actorId }, select: { id: true } })) as { id: string } | null;
      if (staff && staff.id === rec.assignedCoachId) {
        await this.prisma.crmRecord.update({ where: { id: recordId }, data: { assignmentStatus: 'accepted' } });
        accettato = true;
        await this.audit.log({
          action: 'crm.lead.accept',
          actorId,
          entityType: 'crm_record',
          entityId: recordId,
          metadata: { implicita: 'invio credenziali' },
        });
      }
    }

    // La coach del lead resta la coach della cliente — MA solo se l'assegnazione è accettata.
    // Un'assegnazione ancora «da accettare» può essere rifiutata, o scadere: in quei due casi
    // `CrmRecord` viene svuotato, il profilo cliente no (nessuno saprebbe se quella coach ce
    // l'ha messa l'assegnazione o una decisione successiva). Quindi non la si scrive proprio:
    // arriverà con l'accettazione, che già propaga. La nutrizionista invece non ha ciclo di
    // accettazione, quindi passa sempre.
    await agganciaAssegnazioneAlProfilo(this.prisma, userId, {
      name: rec.name,
      assignedCoachId: accettato ? rec.assignedCoachId : null,
      assignedNutritionistId: rec.assignedNutritionistId,
    });

    await this.mail.sendLeadCredentials(email, { name: rec.name, email, link }, 'it');
    await this.audit.log({
      action: 'crm.lead.send_credentials',
      actorId,
      entityType: 'crm_record',
      entityId: recordId,
      metadata: { email, viaLink: true }, // MAI segreti nei log: nemmeno il token
    });
    return { sent: true, email };
  }

  /**
   * Visibilità per ruolo: la COACH vede e gestisce SOLO i lead assegnati a lei;
   * la manager delle coach (sales), il capo nutrizionista e l'admin vedono tutto.
   * Ritorna lo staffId a cui vincolare la query se l'attore è una coach, altrimenti null.
   * (Coach senza scheda staff → id impossibile: non vede nulla, mai tutto per errore.)
   */
  private async coachScope(actorUserId?: string): Promise<string[] | null> {
    return coachTeamScope(this.prisma, actorUserId);
  }

  /** Blocca l'accesso puntuale a un lead non assegnato alla coach (detail/modifiche). */
  private async assertLeadAccess(actorUserId: string, recordId: string) {
    const scopeId = await this.coachScope(actorUserId);
    if (!scopeId) return;
    const rec = (await this.prisma.crmRecord.findUnique({ where: { id: recordId }, select: { assignedCoachId: true } })) as { assignedCoachId: string | null } | null;
    if (!rec || !rec.assignedCoachId || !scopeId.includes(rec.assignedCoachId)) throw new ForbiddenException('Questo lead non è assegnato a te.');
  }

  /** Lead pubblico dai form del sito (contatti + "Lavora con noi"). Nessuna migrazione:
   *  i metadati vanno in stageDates.lead_in.meta. Dedup soft per email (lead non ancora cliente). */
  async createPublic(input: {
    email: string; nome?: string; fonte?: string; lingua?: string; ruolo?: string; messaggio?: string;
  }): Promise<{ ok: true; id: string }> {
    const meta = {
      source: input.fonte ?? 'sito',
      lang: input.lingua,
      role: input.ruolo,
      message: input.messaggio,
      channel: 'public_form',
    };
    const existing = await this.prisma.crmRecord.findFirst({ where: { email: input.email, clientId: null } });
    const stamp = { at: new Date().toISOString(), byUserId: 'public', meta };

    const record = existing
      ? await this.prisma.crmRecord.update({
          where: { id: existing.id },
          data: {
            name: input.nome ?? existing.name,
            stageDates: { ...(existing.stageDates as object), lead_in: stamp } as never,
          },
        })
      : await this.prisma.crmRecord.create({
          data: {
            email: input.email,
            name: input.nome,
            stage: 'lead_in',
            stageDates: { lead_in: stamp } as never,
          },
        });

    await this.audit.log({
      action: 'crm.lead.public_create',
      actorId: 'public',
      entityType: 'crm_record',
      entityId: record.id,
    });
    return { ok: true, id: record.id };
  }

  /**
   * Registrazione (app o backoffice) → il cliente compare SEMPRE in Gestione lead.
   * Regola: tutti sono lead, solo alcuni diventano clienti. Per non creare doppioni,
   * se esiste già un lead "puro" con la stessa email lo si COLLEGA (clientId) invece
   * di crearne uno nuovo; altrimenti si crea il record. Non blocca mai la registrazione.
   */
  async ensureLead(clientId: string, email: string, name?: string | null): Promise<void> {
    try {
      // Già collegato a questo cliente: eventuale backfill soft di email/nome.
      const linked = await this.prisma.crmRecord.findUnique({ where: { clientId } });
      if (linked) {
        if ((!linked.email && email) || (!linked.name && name)) {
          await this.prisma.crmRecord.update({
            where: { clientId },
            data: { email: linked.email ?? email, name: linked.name ?? name ?? undefined },
          });
        }
        return;
      }
      // Esiste un lead "puro" (non ancora registrato) con la stessa email? → lo collego.
      const pure = email
        ? await this.prisma.crmRecord.findFirst({ where: { clientId: null, email } })
        : null;
      if (pure) {
        await this.prisma.crmRecord.update({
          where: { id: pure.id },
          data: { clientId, name: pure.name ?? name ?? undefined },
        });
        return;
      }
      // Nessun precedente: nuovo lead collegato al cliente.
      await this.prisma.crmRecord.create({
        data: {
          clientId,
          email,
          name: name ?? undefined,
          stage: 'lead_in',
          stageDates: { lead_in: { at: new Date().toISOString(), byUserId: null } } as never,
        },
      });
    } catch {
      /* il CRM non deve mai bloccare la registrazione */
    }
  }

  /**
   * Avanzamento automatico che NON fa retrocedere la scheda: vedi `avanza-stato.ts`, dove sta
   * la logica — la usano anche moduli che non possono dipendere da commerce (il questionario).
   */
  async autoAdvanceIfEarlier(clientId: string, stage: string, byUserId: string): Promise<boolean> {
    return avanzaStatoSeIndietro(this.prisma as never, clientId, stage, byUserId);
  }

  /** Avanzamento automatico (es. paid all'approvazione). */
  async autoAdvance(clientId: string, stage: string, byUserId: string, valueCents?: number): Promise<void> {
    try {
      const record = await this.prisma.crmRecord.findUnique({ where: { clientId } });
      const stageDates = {
        ...((record?.stageDates as Record<string, unknown>) ?? {}),
        [stage]: { at: new Date().toISOString(), byUserId },
      };
      if (record) {
        await this.prisma.crmRecord.update({
          where: { clientId },
          data: {
            stage: stage as never,
            stageDates: stageDates as never,
            ...(valueCents !== undefined ? { valueCents } : {}),
          },
        });
      } else {
        // Cliente che paga senza essere passata dai lead: la inserisco nel CRM,
        // così compare nella tabella clienti/lead come chi arriva dalla pipeline.
        await this.prisma.crmRecord.create({
          data: {
            clientId,
            stage: stage as never,
            stageDates: stageDates as never,
            ...(valueCents !== undefined ? { valueCents } : {}),
          },
        });
      }
    } catch {
      /* mai bloccare il flusso principale */
    }
  }

  async list(filter: {
    page?: number; pageSize?: number; search?: string; stage?: string; listId?: string;
    coachId?: string; nutriId?: string; tipo?: string;
    valueMin?: number; valueMax?: number; dateFrom?: string; dateTo?: string;
    sortKey?: string; sortDir?: string;
  }, actorUserId?: string) {
    const page = Math.max(0, Math.floor(filter.page ?? 0));
    const pageSize = Math.min(500, Math.max(1, Math.floor(filter.pageSize ?? 100)));
    const q = filter.search?.trim();

    const AND: Record<string, unknown>[] = [];
    if (filter.stage) AND.push({ stage: filter.stage });
    if (filter.listId) AND.push({ listMemberships: { some: { listId: filter.listId } } });
    if (q) {
      const digits = q.replace(/\D/g, '');
      const or: Record<string, unknown>[] = [
        { email: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
        // Anche sui campi separati: `name` è tenuto allineato, ma cercare per cognome deve
        // funzionare pure sulle schede in cui, per qualsiasi motivo, `name` fosse rimasto indietro.
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { alias: { contains: q, mode: 'insensitive' } },
        { client: { email: { contains: q, mode: 'insensitive' } } },
      ];
      if (digits.length >= 3) or.push({ phone: { contains: digits } });
      AND.push({ OR: or });
    }
    // Scope per ruolo: se l'attore è una coach, la query è INCHIODATA ai suoi lead
    // (il filtro coach scelto in UI viene ignorato); manager/capo/admin filtrano liberi.
    const scopeId = await this.coachScope(actorUserId);
    if (scopeId) AND.push({ assignedCoachId: { in: scopeId } });
    else if (filter.coachId === 'none') AND.push({ assignedCoachId: null });
    else if (filter.coachId) AND.push({ assignedCoachId: filter.coachId });
    if (filter.nutriId === 'none') AND.push({ NOT: { client: { clientProfile: { assignedNutritionistId: { not: null } } } } });
    else if (filter.nutriId) AND.push({ client: { clientProfile: { assignedNutritionistId: filter.nutriId } } });
    if (filter.tipo === 'client') AND.push({ stage: 'paid' });
    else if (filter.tipo === 'historical') AND.push({ stage: { not: 'paid' }, historicalPaidCents: { gt: 0 } });
    else if (filter.tipo === 'lead') AND.push({ stage: { not: 'paid' }, OR: [{ historicalPaidCents: null }, { historicalPaidCents: { lte: 0 } }] });
    if (filter.valueMin != null || filter.valueMax != null) {
      const range: Record<string, number> = {};
      if (filter.valueMin != null) range.gte = filter.valueMin;
      if (filter.valueMax != null) range.lte = filter.valueMax;
      AND.push({ OR: [{ valueCents: range }, { AND: [{ valueCents: null }, { historicalPaidCents: range }] }] });
    }
    if (filter.dateFrom) AND.push({ createdAt: { gte: new Date(filter.dateFrom + 'T00:00:00') } });
    if (filter.dateTo) AND.push({ createdAt: { lte: new Date(filter.dateTo + 'T23:59:59') } });
    const where = (AND.length ? { AND } : {}) as never;

    const dir = filter.sortDir === 'asc' ? 'asc' : 'desc';
    const sortMap: Record<string, unknown> = {
      name: { name: dir },
      // Ordinare per COGNOME è il motivo per cui nome e cognome stanno in due colonne: con un
      // campo unico «Anna Bianchi» si ordina per «Anna», che non serve a nessuno.
      // I lead importati non hanno il cognome (`null`): Postgres li mette in fondo in `asc` e
      // in cima in `desc`, ed è la scelta giusta — le schede incomplete si vedono.
      cognome: { lastName: dir },
      email: { email: dir },
      stage: { stage: dir },
      created: { createdAt: dir },
      value: { valueCents: dir },
      coach: { assignedCoach: { displayName: dir } },
    };
    const orderBy = (filter.sortKey && sortMap[filter.sortKey] ? sortMap[filter.sortKey] : { updatedAt: 'desc' }) as never;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.crmRecord.findMany({
        where,
        orderBy,
        include: {
          owner: { select: { displayName: true } },
          assignedCoach: { select: { id: true, displayName: true } },
          listMemberships: { select: { list: { select: { id: true, name: true, color: true } } } },
          client: {
            select: {
              email: true,
              phone: true,
              clientProfile: {
                select: {
                  name: true,
                  assignedCoach: { select: { displayName: true } },
                  assignedNutritionistId: true,
                  assignedNutritionist: { select: { id: true, displayName: true } },
                },
              },
            },
          },
        },
        skip: page * pageSize,
        take: pageSize,
      }),
      this.prisma.crmRecord.count({ where }),
    ]);
    return { rows: rows.map((r: Record<string, unknown>) => this.withLists(r)), total, page, pageSize };
  }

  /** Trasforma listMemberships → lists: [{id,name,color}] per il frontend. */
  private withLists(r: Record<string, unknown>) {
    const memberships = (r.listMemberships as { list: unknown }[] | undefined) ?? [];
    const { listMemberships, ...rest } = r;
    void listMemberships;
    return { ...rest, lists: memberships.map((m) => m.list) };
  }

  /** Scheda di un singolo lead: anagrafica, storico stati, promemoria collegati. */
  async detail(recordId: string, actorUserId?: string) {
    if (actorUserId) await this.assertLeadAccess(actorUserId, recordId);
    const record = await this.prisma.crmRecord.findUnique({
      where: { id: recordId },
      include: {
        owner: { select: { displayName: true } },
        assignedCoach: { select: { id: true, displayName: true } },
        client: {
          select: {
            email: true,
            phone: true,
            createdAt: true,
            clientProfile: {
              select: {
                name: true,
                assignedCoach: { select: { displayName: true } },
                assignedNutritionist: { select: { displayName: true } },
              },
            },
          },
        },
        reminders: {
          orderBy: { dueAt: 'asc' },
          select: { id: true, title: true, dueAt: true, note: true, done: true },
        },
        listMemberships: { select: { list: { select: { id: true, name: true, color: true } } } },
        crmNotes: {
          orderBy: { createdAt: 'desc' },
          take: 200,
          select: { id: true, body: true, createdAt: true, author: { select: { displayName: true } } },
        },
      } as never,
    });
    if (!record) throw new NotFoundException('Lead non trovato');
    const rec = record as Record<string, unknown>;
    const rawNotes = (rec.crmNotes ?? []) as { id: string; body: string; createdAt: Date; author: { displayName: string } | null }[];
    delete rec.crmNotes;
    return {
      ...this.withLists(rec),
      notes: rawNotes.map((n) => ({ id: n.id, body: n.body, createdAt: n.createdAt, author: n.author?.displayName ?? null })),
    };
  }

  /** Aggiunge una nota dello staff sulla scheda del lead. */
  async addLeadNote(actorUserId: string, recordId: string, body: string) {
    await this.assertLeadAccess(actorUserId, recordId);
    const text = body.trim();
    if (!text) throw new BadRequestException('La nota è vuota.');
    const record = await this.prisma.crmRecord.findUnique({ where: { id: recordId }, select: { id: true } });
    if (!record) throw new NotFoundException('Lead non trovato');
    const staff = (await this.prisma.staff.findUnique({ where: { userId: actorUserId }, select: { id: true, displayName: true } })) as { id: string; displayName: string } | null;
    const note = (await (this.prisma as unknown as { crmNote: { create: (a: object) => Promise<{ id: string; body: string; createdAt: Date }> } }).crmNote.create({
      data: { recordId, authorId: staff?.id ?? null, body: text },
    }));
    await this.audit.log({ action: 'crm.lead.note.add', actorId: actorUserId, entityType: 'crm_record', entityId: recordId });
    return { id: note.id, body: note.body, createdAt: note.createdAt, author: staff?.displayName ?? null };
  }

  /** Elimina una nota della scheda lead (solo admin, vincolo nel controller). */
  async deleteLeadNote(actorUserId: string, recordId: string, noteId: string) {
    const del = await (this.prisma as unknown as { crmNote: { deleteMany: (a: object) => Promise<{ count: number }> } }).crmNote.deleteMany({
      where: { id: noteId, recordId },
    });
    if (del.count === 0) throw new NotFoundException('Nota non trovata.');
    await this.audit.log({ action: 'crm.lead.note.delete', actorId: actorUserId, entityType: 'crm_record', entityId: recordId, metadata: { noteId } });
    return { ok: true };
  }

  /** Modifica anagrafica del lead (nome, email, valore stimato, storico importato). */
  async updateInfo(
    byUserId: string,
    recordId: string,
    input: {
      name?: string;
      firstName?: string | null;
      lastName?: string | null;
      alias?: string | null;
      email?: string;
      phone?: string | null;
      phone2?: string | null;
      valueCents?: number | null;
      previousStatus?: string | null;
      historicalPaidCents?: number | null;
      codiceFiscale?: string | null;
      address?: string | null;
      tags?: string[];
      segment?: string | null;
      channel?: string | null;
      marketingConsent?: boolean | null;
      consentChannels?: string[];
    },
  ) {
    await this.assertLeadAccess(byUserId, recordId);
    const record = await this.prisma.crmRecord.findUnique({ where: { id: recordId } });
    if (!record) throw new NotFoundException('Lead non trovato');
    // Colonne nuove (nome/cognome/alias): il client Prisma locale non le conosce finché non
    // viene rigenerato, e il deploy lo fa. Il dato c'è: è solo il tipo a essere indietro.
    const vecchio = record as unknown as { firstName: string | null; lastName: string | null; name: string | null };
    const updated = await this.prisma.crmRecord.update({
      where: { id: recordId },
      data: {
        ...(input.name !== undefined ? { name: input.name || null } : {}),
        // Correggendo nome o cognome si riallinea anche `name`, altrimenti la scheda direbbe
        // una cosa e la tabella un'altra — e nessuno saprebbe quale delle due è quella vera.
        ...(input.firstName !== undefined ? { firstName: input.firstName?.trim() || null } : {}),
        ...(input.lastName !== undefined ? { lastName: input.lastName?.trim() || null } : {}),
        ...(input.alias !== undefined ? { alias: input.alias?.trim() || null } : {}),
        ...(input.firstName !== undefined || input.lastName !== undefined
          ? {
              name:
                [
                  input.firstName !== undefined ? input.firstName?.trim() || null : vecchio.firstName,
                  input.lastName !== undefined ? input.lastName?.trim() || null : vecchio.lastName,
                ]
                  .filter(Boolean)
                  .join(' ')
                  .trim() || record.name,
            }
          : {}),
        ...(input.email !== undefined ? { email: input.email || null } : {}),
        ...(input.phone !== undefined ? { phone: input.phone?.trim() || null } : {}),
        ...(input.phone2 !== undefined ? { phone2: input.phone2?.trim() || null } : {}),
        ...(input.valueCents !== undefined ? { valueCents: input.valueCents } : {}),
        ...(input.previousStatus !== undefined ? { previousStatus: input.previousStatus || null } : {}),
        ...(input.historicalPaidCents !== undefined ? { historicalPaidCents: input.historicalPaidCents } : {}),
        ...(input.codiceFiscale !== undefined ? { codiceFiscale: (input.codiceFiscale || '').trim().toUpperCase() || null } : {}),
        ...(input.address !== undefined ? { address: input.address || null } : {}),
        ...(input.tags !== undefined ? { tags: Array.from(new Set(input.tags.map((t) => t.trim()).filter(Boolean))).slice(0, 30) } : {}),
        // Handoff punto 6: segmento/canale e consenso marketing modificabili dalla scheda.
        ...(input.segment !== undefined ? { segment: input.segment || null } : {}),
        ...(input.channel !== undefined ? { channel: input.channel || null } : {}),
        ...(input.marketingConsent !== undefined ? { marketingConsent: input.marketingConsent, consentAt: new Date(), consentSource: 'operatore' } : {}),
        ...(input.consentChannels !== undefined ? { consentChannels: input.consentChannels.filter((c) => ['email', 'whatsapp', 'sms'].includes(c)) } : {}),
      } as never,
    });
    await this.audit.log({
      action: 'crm.lead.update_info',
      actorId: byUserId,
      entityType: 'crm_record',
      entityId: recordId,
      metadata: {
        from: { name: record.name, email: record.email, valueCents: record.valueCents },
        to: { name: updated.name, email: updated.email, valueCents: updated.valueCents },
      },
    });
    return updated;
  }

  // ---------- Liste CRM (raggruppamenti manuali) ----------

  /** Tutte le liste con il numero di membri. */
  async listLists(actorUserId?: string) {
    // La coach vede il conteggio dei SOLI suoi lead in ogni lista (non i totali aziendali).
    const scopeId = await this.coachScope(actorUserId);
    const lists = await this.prisma.crmList.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            members: (scopeId ? { where: { record: { assignedCoachId: { in: scopeId } } } } : true) as never,
          },
        },
      },
    });
    return lists.map((l: Record<string, unknown>) => {
      const { _count, ...rest } = l;
      return { ...rest, memberCount: (_count as { members: number }).members };
    });
  }

  async createList(actorId: string, input: { name: string; description?: string | null; color?: string | null }) {
    const list = await this.prisma.crmList.create({
      data: { name: input.name.trim(), description: input.description || null, color: input.color || null },
    });
    await this.audit.log({ action: 'crm.list.create', actorId, entityType: 'crm_list', entityId: list.id, metadata: { name: list.name } });
    return list;
  }

  async updateList(actorId: string, id: string, input: { name?: string; description?: string | null; color?: string | null }) {
    const list = await this.prisma.crmList.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description || null } : {}),
        ...(input.color !== undefined ? { color: input.color || null } : {}),
      },
    });
    await this.audit.log({ action: 'crm.list.update', actorId, entityType: 'crm_list', entityId: id });
    return list;
  }

  async deleteList(actorId: string, id: string) {
    await this.prisma.crmList.delete({ where: { id } }); // le appartenenze cadono in cascade
    await this.audit.log({ action: 'crm.list.delete', actorId, entityType: 'crm_list', entityId: id });
    return { deleted: true };
  }

  /**
   * Imposta l'insieme delle liste di un lead (rimpiazza le appartenenze correnti).
   * Un contatto può stare in più liste contemporaneamente.
   */
  async setLeadLists(actorId: string, recordId: string, listIds: string[]) {
    await this.assertLeadAccess(actorId, recordId);
    const record = await this.prisma.crmRecord.findUnique({ where: { id: recordId }, select: { id: true } });
    if (!record) throw new NotFoundException('Lead non trovato');
    const wanted = [...new Set(listIds)];
    await this.prisma.$transaction([
      this.prisma.crmListMember.deleteMany({ where: { recordId, listId: { notIn: wanted.length ? wanted : ['__none__'] } } }),
      ...wanted.map((listId) =>
        this.prisma.crmListMember.upsert({
          where: { listId_recordId: { listId, recordId } },
          create: { listId, recordId },
          update: {},
        }),
      ),
    ]);
    await this.audit.log({ action: 'crm.lead.set_lists', actorId, entityType: 'crm_record', entityId: recordId, metadata: { listIds: wanted } });
    return this.detail(recordId);
  }

  // ---------- Import liste storiche ----------

  /**
   * Importa un lotto di contatti dalle liste storiche (file già normalizzato).
   * Match/dedup su TELEFONO o EMAIL: se esiste già un record con lo stesso
   * telefono o la stessa email lo aggiorna, altrimenti lo crea. Aggancia le liste
   * (creandole se mancano) e, se `coachRefCode` combacia con una coach attuale,
   * la assegna. Con `dryRun` non scrive nulla e restituisce solo i conteggi.
   * Idempotente: rilanciare lo stesso file aggiorna invece di duplicare.
   */
  async importRows(
    actorId: string,
    rows: Array<{
      email?: string | null;
      phone?: string | null;
      name?: string | null;
      lists?: string | null; // separate da '|'
      previousStatus?: string | null;
      historicalPaidCents?: number | null;
      coachRefCode?: string | null;
      codiceFiscale?: string | null;
      address?: string | null;
    }>,
    dryRun: boolean,
  ) {
    // Cache liste e coach (per non interrogare il DB a ogni riga).
    const lists = (await this.prisma.crmList.findMany({ select: { id: true, name: true } })) as { id: string; name: string }[];
    const listByName = new Map(lists.map((l) => [l.name.toLowerCase(), l.id]));
    const coaches = (await this.prisma.staff.findMany({
      where: { user: { role: { in: ['coach', 'coach_coordinator'] as never } } },
      select: { id: true, refCode: true },
    })) as { id: string; refCode: string | null }[];
    const coachByRef = new Map(coaches.filter((c) => c.refCode).map((c) => [c.refCode!.toUpperCase(), c.id]));

    let created = 0, merged = 0, skipped = 0, coachAssigned = 0, listLinks = 0;
    const newLists = new Set<string>();

    const cut = (s: string | null | undefined, n: number) => (s == null ? null : String(s).slice(0, n));
    for (const row of rows) {
      const email = cut((row.email ?? '').trim().toLowerCase(), 200) || null;
      const phone = (row.phone ?? '').replace(/\D/g, '').slice(0, 30) || null;
      if (!email && !phone) { skipped++; continue; } // senza chiave: non importabile
      const name = cut(row.name, 200) || null;
      const previousStatus = cut(row.previousStatus, 120) || null;
      const codiceFiscale = cut((row.codiceFiscale ?? '').trim().toUpperCase(), 20) || null;
      const address = cut(row.address, 200) || null;
      const names = (row.lists ?? '').split('|').map((s) => s.trim().slice(0, 80)).filter(Boolean);
      const coachId = row.coachRefCode ? coachByRef.get(row.coachRefCode.trim().toUpperCase()) ?? null : null;
      const orWhere = [...(phone ? [{ phone }] : []), ...(email ? [{ email }] : [])];

      if (dryRun) {
        for (const n of names) if (!listByName.has(n.toLowerCase())) newLists.add(n.toLowerCase());
        const exists = await this.prisma.crmRecord.findFirst({ where: { OR: orWhere }, select: { id: true } });
        if (exists) merged++; else created++;
        if (coachId) coachAssigned++;
        listLinks += names.length;
        continue;
      }

      // Liste: crea quelle mancanti (una tantum).
      const listIds: string[] = [];
      for (const n of names) {
        let id = listByName.get(n.toLowerCase());
        if (!id) {
          const cl = await this.prisma.crmList.create({ data: { name: n } });
          id = cl.id;
          listByName.set(n.toLowerCase(), id);
        }
        listIds.push(id);
      }

      const existing = await this.prisma.crmRecord.findFirst({ where: { OR: orWhere }, select: { id: true } });
      const base: Record<string, unknown> = {
        email,
        phone,
        name,
        previousStatus,
        historicalPaidCents: row.historicalPaidCents ?? null,
        // CF/indirizzo: scritti solo se presenti, così un re-import senza il dato
        // non cancella quello già salvato (idempotenza).
        ...(codiceFiscale ? { codiceFiscale } : {}),
        ...(address ? { address } : {}),
        ...(coachId ? { assignedCoachId: coachId, assignmentStatus: 'accepted', assignedAt: new Date() } : {}),
      };
      let recordId: string;
      if (existing) {
        await this.prisma.crmRecord.update({ where: { id: existing.id }, data: base as never });
        recordId = existing.id;
        merged++;
      } else {
        const c = await this.prisma.crmRecord.create({
          data: { ...base, stage: 'lead_in', stageDates: { lead_in: { at: new Date().toISOString(), meta: { source: 'import' } } } } as never,
        });
        recordId = c.id;
        created++;
      }
      if (coachId) coachAssigned++;
      for (const listId of listIds) {
        await this.prisma.crmListMember.upsert({
          where: { listId_recordId: { listId, recordId } },
          create: { listId, recordId },
          update: {},
        });
        listLinks++;
      }
    }

    if (!dryRun) {
      await this.audit.log({ action: 'crm.import.batch', actorId, entityType: 'crm_record', metadata: { created, merged, coachAssigned, listLinks } });
    }
    return { created, merged, skipped, coachAssigned, listLinks, newLists: dryRun ? [...newLists] : [] };
  }

  async create(byUserId: string, input: {
    email: string;
    firstName?: string;
    lastName?: string;
    alias?: string;
    name?: string;
    phone?: string;
    assignedCoachId?: string;
  }) {
    const email = input.email.trim();
    // Nome e cognome sono due dati diversi (form «Nuovo lead», 9/8) e si conservano separati:
    // così si ordina per cognome, cosa impossibile con un campo unico. `name` resta e viene
    // tenuto allineato come «Nome Cognome», perché lo leggono decine di punti — tabella,
    // pipeline, email, ricevute, import — e riscriverli tutti sarebbe stato un rischio senza
    // guadagno. Se arriva solo `name` (import storico) i due campi restano vuoti: spezzare
    // «Maria Teresa De Santis» a occhio produrrebbe un cognome sbagliato.
    const firstName = input.firstName?.trim() || null;
    const lastName = input.lastName?.trim() || null;
    const alias = input.alias?.trim() || null;
    const nomeCompleto = [firstName, lastName].filter(Boolean).join(' ').trim() || input.name?.trim() || null;
    // Anti-doppione: niente due schede CRM con la stessa email (confronto case-insensitive),
    // sia lead "puri" sia clienti già collegati. Coerente con import e registrazione.
    const dupe = (await this.prisma.crmRecord.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } } as never,
      select: { id: true },
    })) as { id: string } | null;
    if (dupe) {
      throw new BadRequestException('Esiste già un contatto con questa email. Cercalo in Gestione lead invece di crearne uno nuovo.');
    }

    // Anti-doppione anche sul TELEFONO (come per l'auto-registrazione della cliente):
    // prima il controllo scattava solo quando era l'utente a iscriversi; se la lead la
    // creava lo staff, un numero già presente passava. Confronto sulle sole cifre, con
    // match anche a suffisso (prefisso internazionale +39 opzionale).
    const phone = input.phone?.trim() || null;
    const phoneDigits = (phone ?? '').replace(/\D/g, '');
    if (phoneDigits.length >= 6) {
      const owners = (await this.prisma.crmRecord.findMany({
        where: { phone: { not: null } },
        select: { phone: true },
      })) as { phone: string | null }[];
      const clash = owners.some((o) => {
        const d = (o.phone ?? '').replace(/\D/g, '');
        return d.length >= 6 && (d === phoneDigits || d.endsWith(phoneDigits) || phoneDigits.endsWith(d));
      });
      if (clash) {
        throw new BadRequestException('Esiste già un contatto con questo numero di telefono. Cercalo in Gestione lead invece di crearne uno nuovo.');
      }
    }

    // Assegnazione. Tre casi, e la differenza fra il primo e gli altri due è il ciclo di
    // accettazione (regola di Simone: chi non è assegnato ci passa; chi assegna sé stesso no).
    //
    //  a) la crea una COACH e non indica nessuno → è sua, subito («accepted»): sta assegnando
    //     a sé stessa, non c'è niente da accettare;
    //  b) la crea una coach e indica sé stessa    → identico ad (a);
    //  c) la assegna la RESPONSABILE a una coach  → «pending» + notifica, come dalla tabella
    //     lead. Prima questo ramo la dava per accettata e **non avvisava nessuno**: la coach
    //     si ritrovava un lead in carico senza saperlo. Ora ha i suoi giorni per accettarlo,
    //     e se scade torna alla responsabile invece di restare fermo.
    const creatore = (await this.prisma.user.findUnique({ where: { id: byUserId }, select: { role: true } })) as { role: string } | null;
    const staffCreatore = (await this.prisma.staff.findUnique({ where: { userId: byUserId }, select: { id: true } })) as { id: string } | null;
    const suaStaffId = creatore?.role === 'coach' || creatore?.role === 'coach_coordinator' ? staffCreatore?.id ?? null : null;

    const esplicito = input.assignedCoachId?.trim() || null;
    const assignedCoachId = esplicito ?? suaStaffId;
    const seStessa = !!assignedCoachId && assignedCoachId === suaStaffId;
    const daAccettare = !!assignedCoachId && !seStessa;

    const record = await this.prisma.crmRecord.create({
      // `firstName`/`lastName`/`alias` sono colonne nuove: finché il client Prisma non viene
      // rigenerato (lo fa il deploy) i tipi non le conoscono. Stesso `as never` già usato qui
      // sotto per `stageDates`, e in mezzo repository per i campi appena aggiunti.
      data: {
        email,
        firstName,
        lastName,
        alias,
        name: nomeCompleto,
        phone,
        stage: 'lead_in',
        stageDates: { lead_in: { at: new Date().toISOString(), byUserId } } as never,
        ...(assignedCoachId
          ? {
              assignedCoachId,
              assignmentStatus: daAccettare ? 'pending' : 'accepted',
              assignedAt: new Date(),
              ...(daAccettare && staffCreatore ? { assignedById: staffCreatore.id } : {}),
            }
          : {}),
      } as never,
    });

    if (daAccettare) {
      // Best effort: una notifica che non parte non deve far fallire la creazione del lead.
      try {
        const coach = (await this.prisma.staff.findUnique({
          where: { id: assignedCoachId as string },
          select: { user: { select: { id: true } } },
        })) as { user: { id: string } | null } | null;
        if (coach?.user?.id) {
          await this.notifications.notify({
            userId: coach.user.id,
            type: 'lead_assigned',
            title: 'Nuovo lead da accettare',
            body: `Ti è stato assegnato un lead (${input.name?.trim() || email}). Accettalo entro la scadenza, altrimenti torna alla responsabile.`,
            payload: { recordId: record.id },
          });
        }
      } catch { /* la notifica è un di più: il lead resta creato e assegnato */ }
    }

    await this.audit.log({
      action: 'crm.lead.create',
      actorId: byUserId,
      entityType: 'crm_record',
      entityId: record.id,
      metadata: { assignedCoachId: assignedCoachId ?? null, daAccettare },
    });
    return record;
  }

  /**
   * Elimina una scheda lead (solo admin, vincolo nel controller). Se il lead è già un
   * CLIENTE (clientId valorizzato) NON si elimina da qui: l'eliminazione del cliente e di
   * tutti i suoi dati si fa dalla scheda cliente. Per un lead "puro" la cancellazione
   * porta con sé note e appartenenze a liste (cascade) e slega i promemoria.
   */
  async deleteLead(actorUserId: string, recordId: string) {
    const rec = (await this.prisma.crmRecord.findUnique({
      where: { id: recordId },
      select: { id: true, clientId: true },
    })) as { id: string; clientId: string | null } | null;
    if (!rec) throw new NotFoundException('Lead non trovato');
    if (rec.clientId) {
      throw new BadRequestException('Questo contatto è un cliente registrato: eliminalo dalla sua scheda cliente (elimina anche i dati collegati).');
    }
    await this.prisma.crmRecord.delete({ where: { id: recordId } });
    await this.audit.log({ action: 'crm.lead.delete', actorId: actorUserId, entityType: 'crm_record', entityId: recordId });
    return { ok: true };
  }

  /** Avanzamento manuale del commerciale: data + responsabile sempre registrati. */
  async advance(byUserId: string, recordId: string, input: { stage: string; ownerStaffId?: string; valueCents?: number }) {
    await this.assertLeadAccess(byUserId, recordId);
    const stageKeys = await this.pipeline.stageKeys();
    if (!stageKeys.has(input.stage)) {
      throw new NotFoundException(`Stato sconosciuto: ${input.stage}`);
    }
    const record = await this.prisma.crmRecord.findUnique({ where: { id: recordId } });
    if (!record) throw new NotFoundException('Lead non trovato');
    const stageDates = {
      ...((record.stageDates as Record<string, unknown>) ?? {}),
      [input.stage]: { at: new Date().toISOString(), byUserId },
    };
    const updated = await this.prisma.crmRecord.update({
      where: { id: recordId },
      data: {
        stage: input.stage as never,
        stageDates: stageDates as never,
        ...(input.ownerStaffId ? { ownerId: input.ownerStaffId } : {}),
        ...(input.valueCents !== undefined ? { valueCents: input.valueCents } : {}),
      },
    });
    await this.audit.log({
      action: 'crm.lead.advance',
      actorId: byUserId,
      entityType: 'crm_record',
      entityId: recordId,
      metadata: { stage: input.stage },
    });
    return updated;
  }

  /** Dashboard commerciale: conteggi per stage + conversione + incasso mese. */
  async salesDashboard() {
    const [byStage, monthIncome, stages] = await Promise.all([
      this.prisma.crmRecord.groupBy({ by: ['stage'], _count: { _all: true } }),
      this.prisma.ledgerEntry.aggregate({
        where: {
          type: 'income',
          date: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
        _sum: { amountCents: true },
      }),
      this.pipeline.listStages(),
    ]);
    type Row = { stage: string; _count: { _all: number } };
    const orderOf = new Map(stages.map((s) => [s.key, s.order]));
    const paidOrder = orderOf.get('paid') ?? Number.MAX_SAFE_INTEGER;
    const counts = Object.fromEntries((byStage as Row[]).map((r) => [r.stage, r._count._all]));
    const leads = (byStage as Row[]).reduce((a, r) => a + r._count._all, 0);
    const paidPlus = (byStage as Row[])
      .filter((r) => (orderOf.get(r.stage) ?? -1) >= paidOrder)
      .reduce((a, r) => a + r._count._all, 0);
    return {
      totalLeads: leads,
      byStage: counts,
      conversionToPaidPercent: leads ? Math.round((paidPlus / leads) * 1000) / 10 : 0,
      monthIncomeCents: monthIncome._sum.amountCents ?? 0,
    };
  }
}
