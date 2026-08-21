import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { aGiorno } from '../common/date-only';
import { coachTeamScope } from '../common/coach-team';
import { frasePrezziPercorso, type PianoDaCitare } from '../commerce/prezzo-piano';
import { PushService } from '../notifications/push.service';
import {
  RIFERIMENTO_UNICO,
  TIPO_FINESTRA_MAI_CHIESTA,
  serveChiedereLaFinestra,
  testoFinestraMaiChiesta,
} from './finestra-mai-chiesta';
import { finestraDigiuno } from '../menu/finestre-digiuno';
import { escalateAttivitaScadute } from './avvisi-attivita';
import { apriAttivitaCoach } from './porta-delle-attivita';
import { STATI_CON_UN_PIANO, STATI_QUALCOSA_IN_BALLO } from '../commerce/stati-abbonamento';
import { frasiDaChiarire, impronta, TIPO_ESCLUSIONI_DA_CHIARIRE, testoEsclusioniDaChiarire } from './esclusioni-da-chiarire';

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
    // La push delle attività (Simone, 14/8): prima nascevano mute e si vedevano solo in pagina.
    private readonly push: PushService,
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
    const today = aGiorno(new Date()); // il giorno di Roma: vedi la nota su `oggiPiu`
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
    const today = aGiorno(new Date()); // il giorno di Roma: vedi la nota su `oggiPiu`
    const tomorrow = new Date(today.getTime() + 86_400_000);
    const dayAfter = new Date(today.getTime() + 2 * 86_400_000);

    const [openTasks, overdueTasks, trialsActive, expiringToday, expiringTomorrow, expiredTrials] = await Promise.all([
      this.prisma.coachTask.count({ where: { status: 'todo', ...(scopeId ? { client: clientWhere } : {}) } as never }),
      this.prisma.coachTask.count({ where: { status: 'todo', dueDate: { lt: today }, ...(scopeId ? { client: clientWhere } : {}) } as never }),
      // ⚠️ `STATI_CON_UN_PIANO` e non `'active'` (19/8, voce 258): una prova che comincia lunedì è
      // una prova avviata, e la coach la deve vedere adesso — è la settimana in cui si converte.
      this.prisma.subscription.count({ where: { status: { in: STATI_CON_UN_PIANO }, plan: { priceCents: 0 }, ...(scopeId ? { client: clientWhere } : {}) } as never }),
      this.prisma.subscription.count({ where: { status: { in: STATI_CON_UN_PIANO }, plan: { priceCents: 0 }, endDate: { gte: today, lt: tomorrow }, ...(scopeId ? { client: clientWhere } : {}) } as never }),
      this.prisma.subscription.count({ where: { status: { in: STATI_CON_UN_PIANO }, plan: { priceCents: 0 }, endDate: { gte: tomorrow, lt: dayAfter }, ...(scopeId ? { client: clientWhere } : {}) } as never }),
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
        // 'paused' NON è uno stato di Subscription: l'enum è pending|active|cancelled|expired e le
        // pause vivono nella tabella pause_request. Metterlo qui faceva rifiutare la query da Prisma
        // → 500. Stesso errore già corretto in commerce.service.ts:204: qui era stato ricopiato.
        // Niente `as never` su questa query, di proposito: è proprio il cast che spegneva il
        // controllo del compilatore e ha lasciato passare 'paused' due volte. Senza, uno stato
        // inesistente non compila nemmeno.
        // ⚠️ Con la coda dentro (voce 258): «ha già qualcosa» comprende il piano che parte lunedì.
      where: { clientId: t.clientId, status: { in: [...STATI_QUALCOSA_IN_BALLO] } as never },
        select: { id: true },
      });
      if (!active) notConverted++;
    }
    return { openTasks, overdueTasks, trialsActive, expiringToday, expiringTomorrow, notConverted };
  }

  // ---------- Generazione automatica (cron giornaliero) ----------

  /**
   * ⚠️ **DUE FUNZIONI DOVE PRIMA CE N'ERA UNA, e la differenza non è cosmetica.**
   *
   * `day(base, n)` prendeva `setHours(0, 0, 0, 0)` — il fuso del **processo**, UTC su Render — e la
   * usavano due tipi di chiamante mescolati: chi partiva da **adesso** («la scadenza è domani») e
   * chi partiva da una **data salvata** (l'inizio di una prova, la fine di un piano). Sono due
   * domande diverse:
   *
   *  - **«che giorno è oggi»** è il giorno di **Roma**: fra mezzanotte e le 02:00 in Italia il
   *    server rispondeva ancora ieri, quindi un'attività aperta all'una di notte nasceva con la
   *    scadenza di ieri — già in ritardo prima che qualcuno potesse farla;
   *  - **«di che giorno è questa data salvata»** resta il giorno **UTC**, e di proposito: sono
   *    istanti veri scritti in banca dati da punti diversi, e rileggerli in un altro fuso
   *    sposterebbe di un giorno le prove e i piani già venduti. Quello si misura prima
   *    (`npm run diag:giorno-piani`), non si cambia di slancio.
   */
  private oggiPiu(plusDays: number, adesso: Date = new Date()): Date {
    return new Date(aGiorno(adesso).getTime() + plusDays * 86_400_000);
  }

  /** Il giorno di una data SALVATA, più `plusDays`. Letto in UTC — vedi la nota qui sopra. */
  private giornoPiu(base: Date, plusDays: number): Date {
    const g = Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate());
    return new Date(g + plusDays * 86_400_000);
  }

  /**
   * Apre un'attività **fuori dal giro notturno**, quando succede il fatto che la rende necessaria.
   *
   * ⚠️ Passa da `ensureTask` e non scrive su `coachTask` per conto suo: è l'unico punto in cui
   * nasce un'attività, ed è anche quello che manda la push alla coach. Una seconda strada per
   * creare attività vorrebbe dire un tipo che non avvisa nessuno — e non si vedrebbe, perché
   * l'attività in elenco ci sarebbe lo stesso.
   *
   * ⚠️ Torna **`'creata'` o `'gia-presente'`, non un booleano** — e la differenza conta più di quanto
   * sembri. Con un booleano chi chiamava traduceva `false` in «non è riuscita», e lo diceva a chi
   * aveva appena deciso: «⚠️ l'attività NON risulta aperta». Ma `false` vuol dire che **c'era già**,
   * cioè che è tutto a posto. Trovato dalla revisione della notte del 18/8, poche ore dopo aver
   * reso quel caso — il secondo salvataggio dello stesso giorno — normale invece che impossibile.
   *
   * ⚠️ E se c'era già **il testo si aggiorna**, quando è cambiato: la descrizione è una fotografia
   * del momento in cui l'attività è nata («questa cliente non ha una coach assegnata»), e resta
   * appesa lì anche dopo che il motivo è sparito. Chi la legge la legge **dopo**.
   * ⚠️ La push però **non riparte**: nasce con l'attività. Chi chiama deve saperlo, e dirlo.
   */
  async apriAttivita(p: {
    clientId: string;
    kind: string;
    refId: string;
    title: string;
    description: string;
    /** Entro quando. Default: domani — chi apre un'attività a mano ha di solito fretta. */
    dueDate?: Date;
  }): Promise<'creata' | 'gia-presente'> {
    const scadenza = p.dueDate ?? this.oggiPiu(1);
    const creata = (await this.ensureTask(p.clientId, p.kind, p.refId, p.title, p.description, scadenza)) === 1;
    if (creata) return 'creata';
    await this.prisma.coachTask
      .updateMany({
        where: { clientId: p.clientId, kind: p.kind, refId: p.refId, NOT: { description: p.description } } as never,
        data: { title: p.title, description: p.description },
      })
      .catch(() => undefined);
    return 'gia-presente';
  }

  /**
   * Crea il task se non esiste già (unicità cliente+tipo+riferimento). Ritorna 1 se creato.
   *
   * ⚠️ La creazione e la push alla coach stanno insieme in `apriAttivitaCoach`
   * (`porta-delle-attivita.ts`) e non più qui: fino al 20/8 il commento diceva «questo è l'unico
   * punto in cui nasce ogni attività, quindi nessun tipo può sfuggire» — e due tipi sfuggivano
   * davvero. La spiegazione lunga sta in quel file.
   */
  private async ensureTask(clientId: string, kind: string, refId: string, title: string, description: string, dueDate: Date): Promise<number> {
    const esito = await apriAttivitaCoach(this.prisma, this.push, { clientId, kind, refId, title, description, dueDate });
    return esito === 'creata' ? 1 : 0;
  }

  /**
   * Genera i task dovuti a OGGI (idempotente: unicità per cliente+tipo+piano).
   * Prova (piani a prezzo 0, G = giorni dall'inizio):
   *  G0 verifica misure · G1 benvenuto (obbligatorio) · G4 se aderenza <70% ·
   *  G7 "domani finisce" · +7 dopo la scadenza ultima chiamata (se non convertita).
   * Ogni fine piano (anche non prova): consegna report + proponi rinnovo/mantenimento.
   */
  /**
   * I PREZZI DEL PERCORSO, LETTI DAL NEGOZIO — una volta per giro, non uno per task.
   *
   * ⚠️ Nel testo del task G6 i prezzi erano **scritti dentro la frase** («1 mese €99 · 3 mesi
   * €249»). Il giorno che si cambia un prezzo dal Negozio, la coach legge il vecchio e lo ripete
   * alla cliente — e nessuno se ne accorge, perché una frase non dà errore. Al momento di
   * scriverlo, per giunta, il piano da 3 mesi a database costava €297: quel testo era già sbagliato.
   *
   * `frasePrezziPercorso` torna `null` se i piani non ci sono: allora la parentesi **sparisce**, e
   * la frase resta vera. Meglio una parola in meno che una cifra sbagliata detta da una persona di
   * cui la cliente si fida.
   */
  private async prezziPercorso(): Promise<string | null> {
    try {
      const piani = (await this.prisma.plan.findMany({
        where: { active: true, period: { in: ['1m', '3m'] } } as never,
        select: { id: true, period: true, priceCents: true, listPriceCents: true, promoEndsAt: true },
      })) as PianoDaCitare[];
      return frasePrezziPercorso(piani);
    } catch {
      // Un prezzo che non si riesce a leggere non deve impedire la creazione dei task.
      return null;
    }
  }

  async generateDaily(): Promise<{ created: number; escalation: { avvisate: number; rimaste: number } }> {
    const now = new Date();
    const today = aGiorno(now); // il giorno di Roma: vedi la nota su `oggiPiu`
    let created = 0;
    const prezzi = await this.prezziPercorso();

    // --- PROVE (attive o scadute da poco) ---
    const trials = (await this.prisma.subscription.findMany({
      // ⚠️ `queued` compreso (19/8, voce 258): una prova che comincia lunedì genera già i suoi
      // compiti — il riquadro qui sopra la conta fra le «prove attive», e una coach che vede il
      // numero ma non trova la riga di lavoro smette di fidarsi di tutti e due.
      where: { plan: { priceCents: 0 }, status: { in: ['active', 'queued', 'expired'] as never }, startDate: { not: null } } as never,
      select: { id: true, clientId: true, status: true, startDate: true, endDate: true },
    })) as { id: string; clientId: string; status: string; startDate: Date | null; endDate: Date | null }[];

    for (const t of trials) {
      if (!t.startDate) continue;
      const start = this.giornoPiu(t.startDate, 0); // data SALVATA: giorno UTC, dichiarato
      const dayN = Math.floor((today.getTime() - start.getTime()) / 86_400_000);
      if (dayN < 0) continue;
      /**
       * ⚠️ **Anche una prova ancora scritta `queued`** (19/8, voce 258): siamo già oltre `dayN >= 0`,
       * quindi la partenza è arrivata — se lo stato dice ancora «in coda» vuol dire che la
       * promozione notturna è in ritardo, e intanto quella cliente sta ricevendo i menu. Guardando
       * il solo `active`, il riquadro la contava fra le prove attive (più su) e la coach non trovava
       * nessuna riga di lavoro: un numero e una lista che si contraddicono, e si smette di fidarsi
       * di tutti e due.
       */
      const partita = t.status === 'active' || t.status === 'queued';

      // G0 — misure iniziali (solo finché mancano: senza punto A niente report).
      if (partita && dayN >= 0) {
        const hasMeasure = await this.prisma.measurement.count({ where: { clientId: t.clientId } });
        if (hasMeasure === 0) {
          created += await this.ensureTask(t.clientId, 'trial_g0_measures', t.id,
            'Verifica le misure iniziali (G0)',
            'La prova è partita: controlla che abbia inserito peso e misure del giorno 0. Senza punto A non esiste il report A→B.',
            this.giornoPiu(start, 0));
        }
      }
      // G1 — benvenuto personale (obbligatorio).
      if (partita && dayN >= 1) {
        created += await this.ensureTask(t.clientId, 'trial_g1_welcome', t.id,
          'Messaggio personale di benvenuto (G1) — obbligatorio',
          'È il momento che decide tutto: mandale un messaggio personale (non un template) su come è andato il primo giorno.',
          this.giornoPiu(start, 1));
      }
      // G4 — solo se aderenza < 70% nei primi 4 giorni (check-in ≤ 2 su 4).
      if (partita && dayN >= 4) {
        const checkins = await this.prisma.dailyCheckin.count({
          where: { clientId: t.clientId, date: { gte: start, lt: this.giornoPiu(start, 4) } },
        });
        if (checkins <= 2) {
          created += await this.ensureTask(t.clientId, 'trial_g4_adherence', t.id,
            'Senti come va: aderenza sotto il 70% (G4)',
            `Solo ${checkins} check-in nei primi 4 giorni: chiamala o scrivile per capire cosa la blocca.`,
            this.giornoPiu(start, 4));
        }
      }
      // G6 — il codice founding è partito (email automatica): la voce della coach vale di più.
      if (partita && dayN >= 6) {
        created += await this.ensureTask(t.clientId, 'trial_g6_code', t.id,
          'Codice founding inviato: sentila (G6)',
          `Oggi le è arrivato il codice personale valido 48h${prezzi ? ` (${prezzi})` : ''}: un tuo messaggio vale più dell'email.`,
          this.giornoPiu(start, 6));
      }
      // G7 — chiusura: "domani finisce, ti va di continuare?".
      if (partita && dayN >= 7) {
        created += await this.ensureTask(t.clientId, 'trial_g7_closing', t.id,
          'WhatsApp di chiusura prova (G7)',
          '"Domani finisce la prova: ti va di continuare?" — ricordale il codice personale e cosa perde se il profilo si cancella.',
          this.giornoPiu(start, 7));
      }
      // +7 dopo la scadenza — ultima chiamata (solo se NON convertita).
      if (t.status === 'expired' && t.endDate && now.getTime() >= this.giornoPiu(new Date(t.endDate), 7).getTime()) {
        const converted = await this.prisma.subscription.findFirst({
          // 'paused' NON è uno stato di Subscription: l'enum è pending|active|cancelled|expired e le
          // pause vivono nella tabella pause_request. Metterlo qui faceva rifiutare la query da Prisma
          // → 500. Stesso errore già corretto in commerce.service.ts:204: qui era stato ricopiato.
        // Niente `as never` su questa query, di proposito: è proprio il cast che spegneva il
        // controllo del compilatore e ha lasciato passare 'paused' due volte. Senza, uno stato
        // inesistente non compila nemmeno.
          // ⚠️ Con la coda dentro (voce 258): «ha già qualcosa» comprende il piano che parte lunedì.
      where: { clientId: t.clientId, status: { in: [...STATI_QUALCOSA_IN_BALLO] } as never },
          select: { id: true },
        });
        if (!converted) {
          created += await this.ensureTask(t.clientId, 'trial_post7_lastcall', t.id,
            'Ultima chiamata post-prova (+7)',
            'Il profilo personalizzato sta per essere cancellato (o lo è già): ultima proposta, poi si chiude con gentilezza.',
            this.giornoPiu(new Date(t.endDate), 7));
        }
      }
    }

    // --- FINE PIANO (ogni piano con scadenza raggiunta, prova inclusa) ---
    const ended = (await this.prisma.subscription.findMany({
      // ⚠️ NON `queued`: un piano ancora in coda non è un piano finito, anche se la sua fine è
      // passata — è una coda arrivata a scadenza senza mai partire, e il report di fine percorso è
      // l'ultima cosa da mandare a quella cliente. Le vede `promuoviCodeArrivate`, che le grida nei
      // log di proposito invece di promuoverle.
      where: { endDate: { lte: now, gte: this.oggiPiu(-14) }, status: { in: ['active', 'expired'] as never } } as never,
      select: { id: true, clientId: true, endDate: true },
    })) as { id: string; clientId: string; endDate: Date | null }[];
    for (const sub of ended) {
      if (!sub.endDate) continue;
      created += await this.ensureTask(sub.clientId, 'plan_end_report', sub.id,
        'Fine piano: consegna il report e proponi il rinnovo',
        'Il piano è finito: consegnale il report A→B e proponi rinnovo o mantenimento.',
        this.giornoPiu(new Date(sub.endDate), 0));
    }

    // --- SCADENZE IN ARRIVO → CALENDARIO della coach (richiesta 17/07) ---
    // Ogni piano A PAGAMENTO in scadenza nei prossimi 7 giorni genera UN appunto nel
    // Calendario CRM della coach di riferimento (alla data di scadenza) + notifica
    // in app alla coach. Idempotente: si crea solo insieme al task `plan_expiry_heads_up`.
    const expiring = (await this.prisma.subscription.findMany({
      where: {
        // ⚠️ Anche in coda (19/8): la dashboard della coach conta già le scadenze così, e questo è
        // l'appunto in Calendario **per lo stesso identico evento**. Con due condizioni diverse la
        // coach vedeva il piano nell'elenco e non lo trovava in agenda — e quando due schermate
        // dicono cose diverse non se ne crede più nessuna delle due.
        status: { in: STATI_CON_UN_PIANO as never },
        plan: { priceCents: { gt: 0 } },
        endDate: { gte: today, lte: this.giornoPiu(today, 7) },
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
        this.giornoPiu(new Date(sub.endDate), 0));
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
      const start = this.giornoPiu(new Date(m.startDate), 0);
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

    /**
     * LA DOMANDA MAI FATTA sulla finestra del digiuno (voce 256). Vedi `finestra-mai-chiesta.ts`:
     * non è un dato da riempire, è una conversazione da avere — quindi diventa lavoro di una
     * persona, non un messaggio automatico a freddo.
     */
    created += await this.chiediLaFinestraDelDigiuno(today);

    /**
     * «PESCE TRANNE SALMONE»: la frase che va chiarita con una persona (voce 267, 19/8). Stessa
     * forma della finestra del digiuno, e per la stessa ragione: chi l'ha scritta è l'unica che sa
     * cosa intendeva. Vedi `esclusioni-da-chiarire.ts`.
     */
    created += await this.chiediCosaIntendeva(today);

    /**
     * L'ESCALATION ALLA MANAGER (Simone, 14/8): le attività ancora «da fare» il giorno dopo la
     * scadenza. In coda al giro, così un problema qui non ferma la generazione — e comunque
     * `escalateAttivitaScadute` non lancia mai.
     */
    const escalation = await escalateAttivitaScadute(this.prisma, this.push);
    return { created, escalation };
  }

  /**
   * Un'attività per ogni cliente che fra i cibi esclusi ha scritto una **frase con un'eccezione**
   * («pesce tranne salmone»): quel termine non toglie nessun piatto, quindi il cibo che credeva di
   * aver escluso continua ad arrivarle — e ⚠️ correggerlo da soli farebbe il contrario di quello che
   * voleva. Vedi `esclusioni-da-chiarire.ts` per il perché è un lavoro di una persona.
   *
   * ⚠️ Solo chi ha un piano comprato: aprire un'attività su chi ha finito il percorso mesi fa è dare
   * alla coach lavoro che non serve a nessuno.
   *
   * ⚠️ Non lancia mai: è un ramo in coda a una notte di lavoro.
   */
  private async chiediCosaIntendeva(today: Date): Promise<number> {
    try {
      const profili = (await this.prisma.clientProfile.findMany({
        where: {
          // ⚠️ Il filtro grosso lo fa il database (l'elenco non è vuoto), il **giudizio** lo prende
          // il modulo: la regola sta scritta in un posto solo, e domani potrebbe non essere «tranne».
          NOT: { dislikedFoods: { isEmpty: true } },
          user: { subscriptions: { some: { status: { in: [...STATI_CON_UN_PIANO] } } } as never },
        } as never,
        select: { userId: true, name: true, dislikedFoods: true },
        take: 200,
      })) as { userId: string; name: string | null; dislikedFoods: string[] }[];

      let fatte = 0;
      for (const p of profili) {
        const frasi = frasiDaChiarire(p.dislikedFoods ?? []);
        if (!frasi.length) continue;
        const { title, description } = testoEsclusioniDaChiarire(p.name, frasi);
        fatte += await this.ensureTask(
          p.userId,
          TIPO_ESCLUSIONI_DA_CHIARIRE,
          // ⚠️ L'impronta dell'elenco, non una data: se lei lo riscrive con un'altra frase ambigua la
          // domanda torna ad avere senso, e con un riferimento fisso non gliela farebbe più nessuno.
          impronta(p.dislikedFoods ?? []),
          title,
          description,
          this.giornoPiu(today, 3),
        );
      }
      return fatte;
    } catch {
      return 0;
    }
  }

  /**
   * Un'attività per ogni cliente **in corso** che è in digiuno senza finestra impostata: la
   * domanda del questionario è arrivata dopo di lei, e quali pasti mangia lo sta decidendo un
   * valore di scorta. Vedi `finestra-mai-chiesta.ts` per il perché di un'attività e non di un
   * messaggio di Gaia.
   *
   * ⚠️ Solo chi ha un abbonamento **attivo**: aprire un'attività su una persona che ha finito il
   * percorso mesi fa è dare alla coach lavoro che non serve a nessuno — ed è il modo più rapido di
   * insegnarle a ignorare la colonna.
   *
   * ⚠️ Non lancia mai: è un ramo in coda a una notte di lavoro, e un errore qui non deve portarsi
   * via i task che contano.
   */
  private async chiediLaFinestraDelDigiuno(today: Date): Promise<number> {
    try {
      const profili = (await this.prisma.clientProfile.findMany({
        where: {
          pathType: 'intermittent_fasting',
          /**
           * ⛔ **`fastingSceltoIl`, non `fastingWindow`** (21/8). La finestra è *derivata*
           * dall'orologio: filtrare sul campo derivato vuol dire filtrare sull'effetto invece che
           * sulla causa. `fastingSceltoIl` dice una cosa sola — gliel'abbiamo chiesto e ha risposto —
           * e non torna mai indietro.
           */
          fastingSceltoIl: null,
          // ⚠️ Anche la coda: la finestra del digiuno si chiede PRIMA che il piano cominci (voce 258),
      // che è proprio il momento in cui serve saperla.
      user: { subscriptions: { some: { status: { in: [...STATI_CON_UN_PIANO] } } } as never },
        } as never,
        select: {
          userId: true, name: true, pathType: true, fastingSceltoIl: true,
          // ⚠️ `onboardingCompletedAt` e non `createdAt`: la riga del profilo nasce all'assegnazione
          // del lead, mesi prima del questionario. Vedi `finestra-mai-chiesta.ts`.
          onboardingCompletedAt: true,
          // Serve al TESTO, non alla decisione: chi ha una finestra storica non riceve «tutti i
          // pasti», e la coach non deve telefonarle dicendole il contrario.
          fastingWindow: true,
        },
        take: 200,
      })) as {
        userId: string; name: string | null; pathType: string | null; fastingSceltoIl: Date | null;
        onboardingCompletedAt: Date | null; fastingWindow: string | null;
      }[];

      let fatte = 0;
      for (const p of profili) {
        /**
         * La query filtra già, ma la decisione la prende il modulo: è lui il posto dove sta scritta
         * la regola. ⚠️ E qui non è una ripetizione — la **grazia** (chi si è iscritta da meno di tre
         * giorni: prima gliela chiede l'app) sta solo nel modulo, e questo è il ciclo che la applica.
         */
        if (!serveChiedereLaFinestra(p.pathType, p.fastingSceltoIl, p.onboardingCompletedAt, today)) continue;
        const { title, description } = testoFinestraMaiChiesta(
          p.name,
          p.fastingWindow,
          p.fastingWindow ? finestraDigiuno(p.fastingWindow)?.etichettaStaff ?? null : null,
        );
        fatte += await this.ensureTask(
          p.userId,
          TIPO_FINESTRA_MAI_CHIESTA,
          RIFERIMENTO_UNICO,
          title,
          description,
          this.giornoPiu(today, 3),
        );
      }
      return fatte;
    } catch {
      return 0;
    }
  }
}
