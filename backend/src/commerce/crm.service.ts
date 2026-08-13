import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { agganciaAssegnazioneAlProfilo } from '../common/assegnazione-profilo';
import { coachTeamScope } from '../common/coach-team';
import { avvisaNuovoLeadDaAssegnare } from '../common/avvisa-manager-coach';
import { filtroPerimetroSuCliente, perimetroClienti } from '../common/perimetro-clienti';
import { dichiaraSenzaGlutine } from '../menu/senza-glutine';
import { daValutare, filtroDaValutare } from '../clients/idoneita';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { avanzaStatoSeIndietro } from './avanza-stato';
import { campiCambiati } from '../common/diff-campi';
import { PrismaService } from '../prisma/prisma.service';
import { avvisaCoachDellaCliente } from '../common/avvisa-coach';
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
    // «Hai un nuovo lead da assegnare» (§16.3). Solo se NON ha già una coach: il form del sito non
    // ne assegna nessuna, ma un lead riaperto potrebbe averla — e avvisare per un lead già assegnato
    // insegna a ignorare l'avviso.
    if (!(record as { assignedCoachId?: string | null }).assignedCoachId) {
      await avvisaNuovoLeadDaAssegnare(this.prisma, this.notifications, { id: record.id, nome: input.nome, email: input.email }, console);
    }
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
      // Nessun precedente: nuovo lead collegato al cliente. È il caso della richiesta di Simone —
      // «la cliente si è registrata» — e nasce senza coach, quindi si avvisa (§16.3).
      const nuovo = await this.prisma.crmRecord.create({
        data: {
          clientId,
          email,
          name: name ?? undefined,
          stage: 'lead_in',
          stageDates: { lead_in: { at: new Date().toISOString(), byUserId: null } } as never,
        },
      });
      await avvisaNuovoLeadDaAssegnare(this.prisma, this.notifications, { id: nuovo.id, nome: name, email }, console);
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

  /**
   * «PERCORSO CONCLUSO»: la scheda entra nell'ultima colonna quando il piano è finito da una
   * settimana e non è stato rinnovato. Chiesto dalle coach (8/8).
   *
   * La colonna esisteva nella pipeline dal primo giorno — `path_ended`, ordine 9 — e **non la
   * scriveva nessuno**: restava vuota per sempre, e le clienti che avevano finito il percorso
   * rimanevano ferme nella colonna dell'ultima cosa fatta (di solito «Follow-up»), mescolate a
   * quelle ancora in corso. Sulla board non si distingueva chi c'era da chi se n'era andato.
   *
   * Perché **+7 giorni** e non il giorno stesso: il rinnovo arriva quasi sempre nei giorni
   * subito dopo la scadenza — un bonifico, una carta da rifare, una decisione presa con calma.
   * Spostare la scheda il giorno della scadenza vorrebbe dire archiviare qualcuno che sta per
   * tornare, e farlo proprio nella settimana in cui la coach dovrebbe richiamarlo.
   *
   * Tre garanzie, e tutte e tre servono:
   *  - **non retrocede mai** (`avanzaStatoSeIndietro`): se la scheda è già più avanti, o la
   *    coach l'ha spostata a mano, resta dov'è;
   *  - **niente abbonamento attivo o in attesa**: chi ha rinnovato, chi è in prova, chi ha un
   *    ordine ancora da pagare NON è concluso. Un bonifico in attesa è una persona che sta
   *    tornando, non una che se n'è andata;
   *  - **finestra e non data esatta**: si guarda l'intervallo fra 7 e 120 giorni fa, così una
   *    notte in cui il cron non gira non lascia indietro delle schede per sempre.
   */
  async chiudiPercorsiConclusi(): Promise<{ esaminati: number; spostati: number }> {
    const giorni = await this.configParams.getNumber('path_ended_days', 7);
    const oggi = new Date();
    const soglia = new Date(oggi.getTime() - Math.max(1, giorni) * 86_400_000);
    // Limite indietro: le schede molto vecchie non si toccano più. Spostarle adesso in blocco
    // farebbe apparire sulla board decine di «concluse» tutte insieme, come se fosse successo
    // oggi — e nessuno saprebbe più cosa guardare.
    const limite = new Date(oggi.getTime() - 120 * 86_400_000);

    const scaduti = (await this.prisma.subscription.findMany({
      where: { endDate: { lte: soglia, gte: limite } } as never,
      select: { clientId: true },
      distinct: ['clientId'],
      take: 500,
    })) as { clientId: string }[];

    let spostati = 0;
    for (const s of scaduti) {
      try {
        const vivo = await this.prisma.subscription.findFirst({
          where: {
            clientId: s.clientId,
            OR: [
              { status: 'pending' },
              { status: 'active', OR: [{ endDate: null }, { endDate: { gte: oggi } }] },
            ],
          } as never,
          select: { id: true },
        });
        if (vivo) continue;
        if (await avanzaStatoSeIndietro(this.prisma as never, s.clientId, 'path_ended', 'sistema')) {
          spostati += 1;
          /**
           * LA COACH DEVE SAPERLO (richiesta di Simone dell'11/8: «e soprattutto che mandavamo
           * notifiche alla sua coach? dello spostamento?»).
           *
           * Prima lo spostamento lasciava solo una riga di audit: la scheda cambiava colonna di
           * notte e la coach lo scopriva — se lo scopriva — guardando la board. È l'avviso più utile
           * di tutti, perché arriva nel momento in cui una telefonata può ancora far rinnovare: il
           * piano è finito da una settimana e nessuno ha comprato niente.
           */
          await avvisaCoachDellaCliente(this.prisma, this.notifications, s.clientId, {
            type: 'client_path_ended',
            title: 'Percorso concluso',
            body: (nome) =>
              `${nome} ha il piano finito da ${giorni} giorni e non ha rinnovato: la scheda è passata in «Percorso concluso».`,
          });
          await this.audit.log({
            action: 'crm.lead.path_ended',
            entityType: 'crm_record',
            entityId: s.clientId,
            metadata: { motivo: `piano finito da almeno ${giorni} giorni, nessun rinnovo` },
          }).catch(() => undefined);
        }
      } catch {
        /* una scheda che non si sposta non deve fermare le altre */
      }
    }
    return { esaminati: scaduti.length, spostati };
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
    coachId?: string; nutriId?: string; tipo?: string; daValutare?: boolean;
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
    /**
     * ⚠️ IL PERIMETRO DELLA NUTRIZIONISTA — aggiunto l'11/8, prima non c'era.
     *
     * Qui sopra c'è solo lo scope della coach, su `CrmRecord.assignedCoachId`. Finché questa lista
     * era «Gestione lead» bastava: una nutrizionista non ci passava. Ma l'elenco Clienti diventa la
     * stessa tabella (§16.4), e l'elenco Clienti **restringe anche per nutrizionista** — quindi
     * senza questa riga unificare le due avrebbe **allargato** a ogni nutrizionista la vista su
     * tutte le clienti dell'azienda, in silenzio e senza che nessun errore lo dicesse.
     *
     * Si filtra sulla CLIENTE collegata (`client.clientProfile`), non su un campo del CRM: la
     * nutrizionista non è assegnata ai lead, è assegnata alle clienti. Conseguenza voluta: i
     * contatti senza cliente collegata non li vede — non sono suoi.
     */
    const perimetro = await perimetroClienti(this.prisma, actorUserId);
    if (perimetro?.field === 'assignedNutritionistId') AND.push(filtroPerimetroSuCliente(perimetro));
    if (scopeId) AND.push({ assignedCoachId: { in: scopeId } });
    else if (filter.coachId === 'none') AND.push({ assignedCoachId: null });
    else if (filter.coachId) AND.push({ assignedCoachId: filter.coachId });
    if (filter.nutriId === 'none') AND.push({ NOT: { client: { clientProfile: { assignedNutritionistId: { not: null } } } } });
    else if (filter.nutriId) AND.push({ client: { clientProfile: { assignedNutritionistId: filter.nutriId } } });
    /**
     * ⚠️ «SOLO DA VALUTARE» — la coda della nutrizionista, chiesta al database e non alla pagina.
     *
     * La pastiglia da sola non risparmiava un'apertura a nessuno: con centinaia di clienti in
     * pagine da cento, le da valutare si trovavano scorrendo con l'occhio. E una coda che si legge
     * scorrendo è una coda che si guarda il primo giorno.
     *
     * Filtrare qui e non sulle righe già scaricate è la differenza fra un totale in cima che
     * corrisponde e uno che no — e fra un'esportazione in Excel che applica i filtri che dichiara e
     * una che ne dichiara uno in più di quelli che ha.
     *
     * La condizione arriva da `clients/idoneita.ts`, accanto alla funzione che risponde alla stessa
     * domanda sulla scheda: se le due divergessero, la nutrizionista guarderebbe una coda che le
     * sembra completa. C'è un test che le tiene ferme insieme.
     */
    if (filter.daValutare) AND.push({ client: { clientProfile: filtroDaValutare() } });
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
    /**
     * ⚠️ `id` COME SECONDO CRITERIO, sempre.
     *
     * Nessuno dei campi ordinabili è univoco: i lead importati da un CSV in un colpo condividono
     * `updatedAt` al millisecondo, e decine hanno lo stesso stato o lo stesso valore. Con un
     * ordinamento non univoco Postgres non garantisce lo stesso ordine fra due query, e chi legge a
     * pagine — l'elenco, e dall'11/8 anche l'esportazione in Excel, che ne chiede dieci di fila —
     * riceve righe **ripetute** in una pagina e altre che non compaiono in nessuna. A schermo si
     * nota poco; in un file che dichiara di essere completo, no.
     */
    const primario = (filter.sortKey && sortMap[filter.sortKey] ? sortMap[filter.sortKey] : { updatedAt: 'desc' }) as Record<string, unknown>;
    const orderBy = [primario, { id: 'asc' }] as never;

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
                  // Le tre liste servono SOLO a calcolare `senzaGlutine` qui sotto: sono nella
                  // stessa query, non costano un giro in più.
                  allergies: true,
                  intolerances: true,
                  dislikedFoods: true,
                  // Idem per «da valutare»: stessa query, e senza queste due la nutrizionista
                  // dovrebbe aprire le schede una per una per sapere su chi deve decidere.
                  idoneita: true,
                  screeningFlag: true,
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

  /**
   * Trasforma listMemberships → lists: [{id,name,color}] per il frontend, e aggiunge `senzaGlutine`.
   *
   * Il glutine è dichiarato dalla cliente in tre campi diversi (allergie, intolleranze, cibi non
   * graditi) e la regola per riconoscerlo sta in un posto solo, `menu/senza-glutine.ts` — «senza
   * glutine» è un dato che se sbagli in lettura mandi il pane a una celiaca, quindi non si
   * reimplementa in una tabella. Serve alla pastiglia accanto al nome nell'elenco Clienti, che era
   * l'unico posto in cui si vedeva chi l'ha dichiarato e non ha ancora la dieta dedicata.
   */
  private withLists(r: Record<string, unknown>) {
    const memberships = (r.listMemberships as { list: unknown }[] | undefined) ?? [];
    const { listMemberships, ...rest } = r;
    void listMemberships;
    const profilo = (r.client as {
      clientProfile?: {
        allergies?: string[]; intolerances?: string[]; dislikedFoods?: string[];
        idoneita?: string | null; screeningFlag?: boolean | null;
      } | null;
    } | null)?.clientProfile ?? null;
    const senzaGlutine = profilo
      ? dichiaraSenzaGlutine([...(profilo.allergies ?? []), ...(profilo.intolerances ?? []), ...(profilo.dislikedFoods ?? [])])
      : false;
    /**
     * ⚠️ «QUESTA VA ANCORA VALUTATA» — §8 dell'handoff: «la cliente in coda nella lista della
     * nutrizionista, con il motivo».
     *
     * Senza questa riga il via libera clinico è una porta senza campanello: la decisione si può
     * prendere, ma nessuno sa **su chi** va presa se non aprendo le schede una per una. Ed è
     * proprio il caso in cui non aprire una scheda ha una conseguenza.
     *
     * ⚠️ La regola è la stessa della scheda (`clients/idoneita.ts`), importata e non riscritta: se
     * l'elenco contasse in modo diverso, la nutrizionista aprirebbe una cliente segnata «da
     * valutare» e ci troverebbe scritto «non serve» — e a quel punto smetterebbe di fidarsi
     * dell'elenco, che è il modo in cui un elenco muore.
     */
    const valutare = profilo ? daValutare(profilo) : false;
    return {
      ...rest,
      senzaGlutine,
      daValutare: valutare,
      // Il motivo: è quello che le fa decidere se aprirla adesso o dopo.
      motivoValutazione: !valutare
        ? null
        : (profilo?.allergies ?? []).length
          ? 'allergie dichiarate'
          : 'patologie o farmaci dichiarati',
      lists: memberships.map((m) => m.list),
    };
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
            // ⚠️ Serve l'id: dalla scheda lead la nutrizionista corregge le allergie, e lo fa
            // chiamando lo STESSO endpoint della scheda cliente (`PATCH /clients/:id`). Un secondo
            // endpoint che scrive lo stesso dato sanitario sarebbe una seconda regola da tenere
            // allineata — e su questo campo è esattamente quello che si sta smettendo di fare.
            id: true,
            email: true,
            phone: true,
            createdAt: true,
            clientProfile: {
              select: {
                name: true,
                assignedCoach: { select: { displayName: true } },
                assignedNutritionist: { select: { displayName: true } },
                // Allergie e intolleranze nella scheda lead (richiesta di Simone, 13/8). Sono lo
                // stesso dato della scheda cliente, letto dallo stesso posto: se qui comparisse un
                // elenco diverso da quello di là, nessuna delle due schermate sarebbe credibile.
                allergies: true,
                allergiesOther: true,
                allergieDichiarateIl: true,
                intolerances: true,
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
    // COSA è cambiato, campo per campo. Prima qui finivano solo nome, email e valore: chi
    // correggeva un telefono, un codice fiscale o il consenso marketing lasciava una riga di log
    // che non diceva niente di quel cambio (richiesta di Simone dell'8/8). `origine: 'backoffice'`
    // distingue queste modifiche da quelle che la cliente fa dall'app.
    const cambiati = campiCambiati(
      record as unknown as Record<string, unknown>,
      updated as unknown as Record<string, unknown>,
      Object.keys(input),
    );
    await this.audit.log({
      action: 'crm.lead.update_info',
      actorId: byUserId,
      entityType: 'crm_record',
      entityId: recordId,
      metadata: {
        origine: 'backoffice',
        campi: cambiati,
        // Il riassunto di prima resta: qualche vista vecchia lo legge, e costa due campi.
        from: { name: record.name, email: record.email, valueCents: record.valueCents },
        to: { name: updated.name, email: updated.email, valueCents: updated.valueCents },
      },
    });
    return updated;
  }

  /**
   * LOG DELLE MODIFICHE della scheda lead: chi ha cambiato cosa, e **da dove**.
   *
   * Richiesta di Simone dell'8/8: «nel log modifiche del lead segnamo anche i cambi dati da
   * backoffice? e i cambi da app? se non è così va implementato». Erano entrambi mancanti, in due
   * modi diversi: dal backoffice l'audit c'era ma registrava tre campi su diciassette e **non era
   * visibile da nessuna parte** (nella scheda c'erano solo lo storico stati e le note); dall'app la
   * riga di log non diceva che cosa fosse cambiato.
   *
   * Qui i due mondi finiscono nella stessa lista, ordinata per data: le azioni sulla scheda lead
   * (`crm_record`) e quelle della cliente sul proprio profilo (`user`), quando il lead è diventato
   * cliente. È l'unico modo per rispondere alla domanda che si fa davvero — «questo numero di
   * telefono chi l'ha cambiato?» — senza sapere in anticipo se è stata la coach o la cliente.
   */
  async logModifiche(recordId: string, actorUserId: string) {
    await this.assertLeadAccess(actorUserId, recordId);
    const record = (await this.prisma.crmRecord.findUnique({
      where: { id: recordId },
      select: { id: true, clientId: true },
    })) as { id: string; clientId: string | null } | null;
    if (!record) throw new NotFoundException('Lead non trovato');

    // Le entità da cui possono arrivare modifiche di questo lead: la scheda CRM e — se è diventata
    // cliente — l'utente, da cui passano sia le modifiche dall'app sia quelle dalla scheda cliente.
    const ids = [record.id, record.clientId].filter((x): x is string => Boolean(x));
    const AZIONI = [
      'crm.lead.update_info', 'crm.lead.advance', 'crm.lead.assign', 'crm.lead.accept',
      'crm.lead.reject', 'crm.nutritionist.assign', 'crm.lead.credentials_sent',
      'client.update', 'me.profile.update', 'admin.assignment.update',
      'auth.email_change_confirmed', 'client.password_reset.trigger',
    ];
    const rows = (await this.prisma.auditLog.findMany({
      where: { entityId: { in: ids }, action: { in: AZIONI } },
      orderBy: { createdAt: 'desc' },
      take: 150,
      include: { actor: { select: { email: true, firstName: true, lastName: true, role: true } } },
    })) as {
      id: string; action: string; createdAt: Date; actorId: string | null; metadata: unknown;
      actor: { email: string; firstName: string | null; lastName: string | null; role: string } | null;
    }[];

    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      at: r.createdAt,
      metadata: r.metadata ?? null,
      // `self` = l'ha fatto la cliente stessa, non lo staff. In scheda cambia chi si ringrazia e
      // chi si va a cercare: una modifica fatta dalla cliente non è un errore di un'operatrice.
      self: !!record.clientId && r.actorId === record.clientId,
      actor: r.actor
        ? { name: [r.actor.firstName, r.actor.lastName].filter(Boolean).join(' ') || r.actor.email, email: r.actor.email, role: r.actor.role }
        : null,
    }));
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
