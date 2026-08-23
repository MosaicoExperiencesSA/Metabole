import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { STATI_CON_UN_PIANO } from '../commerce/stati-abbonamento';
import { MonitoringService } from '../monitoring/monitoring.service';
import { NotificationsService } from '../notifications/notifications.service';
import { toDateOnly } from '../common/date-only';
import { destinatariStaffDellaCliente } from '../common/avvisa-nutrizionista';
import { attivoInCorso } from '../commerce/abbonamento-in-corso';
import { codaCheSlitta } from './coda-che-slitta';
import { aGiorno } from '../common/date-only';
import { giorniSospesi, giornoDiRientro, rientroInArrivo, ultimoGiornoSospeso } from './giorno-di-rientro';
import { TIPO_PESATA_DEL_RIENTRO, testoPesataDelRientro } from '../menu/pesata-del-rientro';
import { giornoDelDato } from '../common/date-only';
import { fraseDellaTregua, treguaFraVacanze } from './tregua-fra-vacanze';

/**
 * Congelamento abbonamento per vacanza ("pausa").
 *
 * Filosofia: la cliente che va in vacanza non deve perdere i giorni pagati. La
 * pausa sospende il menu (Event `pause_period`) E fa slittare in avanti la
 * scadenza dell'abbonamento (`subscription.endDate += giorni`).
 *
 * Regola concordata:
 *  - fino a 20 giorni → congelamento AUTOMATICO (nessuna approvazione);
 *  - da 21 a 90 giorni → serve l'OK dello staff assegnato (nutrizionista o coach):
 *    si crea una richiesta `pending` e si avvisano coach e nutrizionista;
 *  - oltre 90 giorni → non consentito da qui (va gestito manualmente).
 */
/**
 * L'etichetta con cui si riconosce la sospensione nata dalla card «Modalità viaggio».
 * ⚠️ È un dato, non un testo da mostrare: cambiarla scollega le sospensioni già create.
 */
export const ETICHETTA_VIAGGIO = 'Modalità viaggio';

const FREEZE_AUTO_MAX_DAYS = 20;
const FREEZE_ABS_MAX_DAYS = 90;

@Injectable()
export class PauseService {
  /** ⚠️ La pausa che non sposta niente deve dirlo: è un regalo promesso e non dato. */
  private readonly logger = new Logger(PauseService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly configParams: ConfigParamsService,
    // I menu di rientro li genera il modulo monitoraggio: stessa macchina, stessa qualità.
    private readonly monitoring: MonitoringService,
  ) {}

  /** Giorni inclusivi tra due date (21→21 dello stesso mese = ... ). */
  private daysInclusive(start: Date, end: Date): number {
    return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  }

  // ---------- Cliente ----------

  /**
   * La cliente chiede una pausa. Ritorna lo stato: `auto_approved` (già
   * congelata) oppure `pending` (in attesa dello staff).
   */
  async requestPause(clientId: string, input: { startDate: string; endDate: string }) {
    const startDate = toDateOnly(input.startDate);
    const endDate = toDateOnly(input.endDate);
    if (endDate.getTime() < startDate.getTime()) {
      throw new BadRequestException('La fine non può precedere l\'inizio.');
    }
    const days = this.daysInclusive(startDate, endDate);
    if (days > FREEZE_ABS_MAX_DAYS) {
      throw new BadRequestException(
        `Una pausa può durare al massimo ${FREEZE_ABS_MAX_DAYS} giorni: per periodi più lunghi contatta il tuo staff.`,
      );
    }

    // ⛔ La tregua fra due vacanze (23/8): qui si ferma, e si dice a chi rivolgersi.
    const tregua = await treguaFraVacanze(this.prisma, (k, d) => this.configParams.getNumber(k, d), clientId, startDate);
    if (tregua.mancano > 0) throw new BadRequestException(fraseDellaTregua(tregua));

    // Niente due richieste/pause sovrapposte in attesa.
    const overlapping = await this.prisma.pauseRequest.findFirst({
      where: {
        clientId,
        status: 'pending',
      },
    });
    if (overlapping) {
      throw new BadRequestException('Hai già una richiesta di pausa in attesa di approvazione.');
    }

    if (days <= FREEZE_AUTO_MAX_DAYS) {
      const event = await this.createPauseEvent(clientId, startDate, endDate);
      const newEnd = await this.freezeSubscription(clientId, days);
      const request = await this.prisma.pauseRequest.create({
        data: {
          clientId,
          startDate,
          endDate,
          days,
          status: 'auto_approved',
          eventId: event.id,
          decidedAt: new Date(),
        },
      });
      await this.audit.log({
        action: 'pause.auto_approved',
        actorId: clientId,
        entityType: 'pause_request',
        entityId: request.id,
        metadata: { days },
      });
      return {
        status: 'auto_approved' as const,
        days,
        newEndDate: newEnd ? newEnd.toISOString() : null,
      };
    }

    // >20 giorni: richiesta in attesa dello staff.
    const request = await this.prisma.pauseRequest.create({
      data: { clientId, startDate, endDate, days, status: 'pending' },
    });
    await this.audit.log({
      action: 'pause.requested',
      actorId: clientId,
      entityType: 'pause_request',
      entityId: request.id,
      metadata: { days },
    });
    await this.notifyAssignedStaff(clientId, days).catch(() => undefined);
    return { status: 'pending' as const, days };
  }

  /** Le richieste di pausa della cliente (storico + in attesa). */
  async myRequests(clientId: string) {
    return this.prisma.pauseRequest.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // ---------- Staff ----------

  /**
   * Vincolo di visibilità per lo staff: coach e nutrizionista vedono SOLO le
   * richieste delle clienti assegnate a loro; capo nutrizionista, manager coach
   * (sales) e admin vedono tutte. Ritorna il where sul clientProfile, o null.
   */
  private async staffScope(actorUserId: string): Promise<{ field: 'assignedCoachId' | 'assignedNutritionistId'; staffId: string } | null> {
    const actor = await this.prisma.user.findUnique({ where: { id: actorUserId }, select: { role: true } });
    const role = actor?.role as string | undefined;
    if (role !== 'coach' && role !== 'coach_coordinator' && role !== 'nutritionist') return null;
    const staff = (await this.prisma.staff.findUnique({ where: { userId: actorUserId }, select: { id: true } })) as { id: string } | null;
    return {
      field: role === 'nutritionist' ? 'assignedNutritionistId' : 'assignedCoachId',
      staffId: staff?.id ?? '00000000-0000-0000-0000-000000000000',
    };
  }

  /** Richieste in attesa da approvare (scope per ruolo). */
  async pendingForStaff(actorUserId: string) {
    const scope = await this.staffScope(actorUserId);
    const rows = await this.prisma.pauseRequest.findMany({
      where: {
        status: 'pending',
        ...(scope
          ? { client: { clientProfile: { [scope.field]: scope.staffId } } }
          : {}),
      } as never,
      orderBy: { createdAt: 'asc' },
      include: {
        client: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
            clientProfile: { select: { name: true } },
          },
        },
      },
      take: 200,
    });
    type Row = {
      id: string;
      clientId: string;
      startDate: Date;
      endDate: Date;
      days: number;
      createdAt: Date;
      client: { email: string; firstName: string | null; lastName: string | null; clientProfile: { name: string | null } | null } | null;
    };
    return (rows as Row[]).map((r) => ({
      id: r.id,
      clientId: r.clientId,
      name: r.client?.clientProfile?.name
        ?? [r.client?.firstName, r.client?.lastName].filter(Boolean).join(' ')
        ?? r.client?.email
        ?? 'Cliente',
      email: r.client?.email ?? null,
      startDate: r.startDate.toISOString(),
      endDate: r.endDate.toISOString(),
      days: r.days,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /** Verifica che l'attore possa decidere su questa richiesta. */
  private async assertCanDecide(actorUserId: string, clientId: string) {
    const scope = await this.staffScope(actorUserId);
    if (!scope) return; // capo nutrizionista / sales / admin
    const prof = (await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { assignedCoachId: true, assignedNutritionistId: true },
    })) as { assignedCoachId: string | null; assignedNutritionistId: string | null } | null;
    if (!prof || prof[scope.field] !== scope.staffId) {
      throw new ForbiddenException('Questa cliente non è assegnata a te.');
    }
  }

  /** Lo staff approva o rifiuta una richiesta di pausa. */
  async decide(actorUserId: string, requestId: string, approve: boolean, note?: string) {
    const request = await this.prisma.pauseRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException('Richiesta non trovata.');
    if (request.status !== 'pending') {
      throw new BadRequestException('Questa richiesta è già stata gestita.');
    }
    await this.assertCanDecide(actorUserId, request.clientId);

    const staff = (await this.prisma.staff.findUnique({ where: { userId: actorUserId }, select: { id: true } })) as { id: string } | null;

    if (approve) {
      const event = await this.createPauseEvent(request.clientId, request.startDate, request.endDate);
      const newEnd = await this.freezeSubscription(request.clientId, request.days);
      const updated = await this.prisma.pauseRequest.update({
        where: { id: requestId },
        data: {
          status: 'approved',
          eventId: event.id,
          decidedByStaffId: staff?.id ?? null,
          decidedAt: new Date(),
          staffNote: note ?? null,
        },
      });
      await this.audit.log({
        action: 'pause.approved',
        actorId: actorUserId,
        entityType: 'pause_request',
        entityId: requestId,
        metadata: { days: request.days },
      });
      await this.notifications
        .notify({
          userId: request.clientId,
          type: 'pause_decision',
          title: 'Pausa approvata',
          body: `La tua pausa di ${request.days} giorni è stata approvata: la scadenza slitta in avanti.${note ? ` Nota: ${note}` : ''}`,
          payload: { requestId, approved: true, newEndDate: newEnd ? newEnd.toISOString() : null },
        })
        .catch(() => undefined);
      return updated;
    }

    const updated = await this.prisma.pauseRequest.update({
      where: { id: requestId },
      data: {
        status: 'rejected',
        decidedByStaffId: staff?.id ?? null,
        decidedAt: new Date(),
        staffNote: note ?? null,
      },
    });
    await this.audit.log({
      action: 'pause.rejected',
      actorId: actorUserId,
      entityType: 'pause_request',
      entityId: requestId,
      metadata: { days: request.days },
    });
    await this.notifications
      .notify({
        userId: request.clientId,
        type: 'pause_decision',
        title: 'Pausa non approvata',
        body: `La tua richiesta di pausa non è stata approvata.${note ? ` Motivo: ${note}` : ' Contatta il tuo staff per trovare una soluzione.'}`,
        payload: { requestId, approved: false },
      })
      .catch(() => undefined);
    return updated;
  }

  // ---------- Sorveglianza durante la pausa (voce #3) ----------

  /**
   * Giro giornaliero sulle pause IN CORSO.
   *
   * Durante una pausa i menu sono sospesi: finora nessuno chiedeva più il peso e la coach non
   * sapeva nulla, così una cliente poteva sparire per settimane e tornare con un problema che
   * nessuno aveva visto arrivare. Qui teniamo un occhio aperto, senza invadenza:
   *  1. fissiamo il peso di riferimento il giorno in cui la pausa comincia;
   *  2. ogni tot giorni chiediamo una pesata, con tono da vacanza;
   *  3. se il peso supera la soglia, avvisiamo la coach UNA volta.
   *
   * ⚠️ Nessuna proposta commerciale, per decisione esplicita di Simone (6/8): la cliente è in
   * vacanza e ha già pagato.
   *
   * 4. **Al RIENTRO**, se il peso è salito oltre la soglia, i menu di rientro arrivano da soli e
   *    sono **inclusi** (7/8): la sospensione l'ha chiesta su un percorso già pagato. Durante la
   *    pausa no — lì i menu sono sospesi per definizione, e mandarglieli mentre è in vacanza
   *    sarebbe il contrario del punto di avere una pausa.
   */
  async surveillanceTick(): Promise<{ pauseAttive: number; misureChieste: number; coachAvvisate: number; menuDiRientro: number }> {
    const now = new Date();
    // ⚠️ Il giorno di Roma, non quello del processo: era `setHours(0,0,0,0)`, che su Render è UTC.
    // Questo giro decide quali pause sono in corso OGGI e a chi tocca il menu di rientro — nelle
    // due ore dopo mezzanotte guardava ancora ieri, cioè rimandava di un giro il rientro di chi la
    // pausa l'aveva appena finita.
    const oggi = aGiorno(now);

    const [askDays, sogliaKg] = await Promise.all([
      this.configParams.getNumber('pause_watch_ask_days', 5),
      this.configParams.getNumber('pause_watch_regain_kg', 2),
    ]);

    const pause = (await this.prisma.pauseRequest.findMany({
      where: {
        status: { in: ['auto_approved', 'approved'] },
        startDate: { lte: oggi },
        endDate: { gte: oggi },
      },
    })) as {
      id: string;
      clientId: string;
      startDate: Date;
      endDate: Date;
      refWeightKg: number | null;
      lastMeasureAskAt: Date | null;
      coachAlertedAt: Date | null;
    }[];

    let misureChieste = 0;
    let coachAvvisate = 0;

    for (const p of pause) {
      try {
        // 1) Peso di riferimento, fissato una volta sola all'inizio della pausa.
        let riferimento = p.refWeightKg;
        if (riferimento == null) {
          const fineGiornoInizio = new Date(p.startDate);
          fineGiornoInizio.setHours(23, 59, 59, 999);
          const prima = (await this.prisma.measurement.findFirst({
            where: { clientId: p.clientId, date: { lte: fineGiornoInizio } },
            orderBy: { date: 'desc' },
            select: { weightKg: true },
          })) as { weightKg: number } | null;
          // Se non si era mai pesata prima della partenza, prendiamo la prima pesata utile.
          const dopo = prima
            ? null
            : ((await this.prisma.measurement.findFirst({
                where: { clientId: p.clientId, date: { gt: fineGiornoInizio } },
                orderBy: { date: 'asc' },
                select: { weightKg: true },
              })) as { weightKg: number } | null);
          riferimento = prima?.weightKg ?? dopo?.weightKg ?? null;
          if (riferimento != null) {
            await this.prisma.pauseRequest.update({
              where: { id: p.id },
              data: { refWeightKg: riferimento } as never,
            });
          }
        }

        const ultima = (await this.prisma.measurement.findFirst({
          where: { clientId: p.clientId },
          orderBy: { date: 'desc' },
          select: { weightKg: true, date: true },
        })) as { weightKg: number; date: Date } | null;

        // 2) Soglia superata → avviso alla coach, una volta sola per pausa.
        if (riferimento != null && ultima && !p.coachAlertedAt && ultima.weightKg - riferimento >= sogliaKg) {
          const delta = Math.round((ultima.weightKg - riferimento) * 10) / 10;
          await this.prisma.pauseRequest.update({
            where: { id: p.id },
            data: { coachAlertedAt: now } as never,
          });
          await this.creaTaskCoach(
            p.clientId,
            p.id,
            'Peso in salita durante la pausa',
            `+${delta} kg rispetto al peso di partenza della pausa (soglia ${sogliaKg} kg). La pausa finisce il ${p.endDate.toLocaleDateString('it-IT')}: una parola adesso vale più di una rincorsa al rientro.`,
            oggi,
          );
          await this.avvisaStaffPausa(p.clientId, delta, p.endDate);
          coachAvvisate++;
        }

        /**
         * ⚠️ Dentro la finestra di rientro il promemoria «da vacanza» NON parte: «sei in pausa e
         * va benissimo così, nessun compito» e «si riparte, pesati» a poche ore di distanza sono
         * due messaggi che si smentiscono. La push della pesata del rientro la manda il passo
         * 3-bis qui sotto, che gira sugli EVENT — così copre anche le pause senza richiesta.
         */
        const anticipoRientro = await this.configParams.getNumber('menu_visible_days_before_return', 1);
        if (rientroInArrivo({ startDate: p.startDate, endDate: p.endDate }, now, anticipoRientro)) continue;

        // 3) Promemoria misure, con tono da vacanza e senza insistere.
        const misuraVecchia = !ultima || now.getTime() - ultima.date.getTime() >= askDays * 86_400_000;
        const chiestoDaPoco =
          p.lastMeasureAskAt != null && now.getTime() - p.lastMeasureAskAt.getTime() < askDays * 86_400_000;
        if (misuraVecchia && !chiestoDaPoco) {
          await this.prisma.pauseRequest.update({
            where: { id: p.id },
            data: { lastMeasureAskAt: now } as never,
          });
          await this.notifications
            .notify({
              userId: p.clientId,
              type: 'pause_measure_ask',
              title: 'Un numero al volo ⚖️',
              body: 'Sei in pausa e va benissimo così: nessun menu, nessun compito. Se ti capita, segna il peso ogni tanto — al rientro ripartiamo da dove sei davvero, senza sorprese.',
            })
            .catch(() => undefined);
          misureChieste++;
        }
      } catch {
        // Una pausa che va storta non deve fermare le altre né il cron.
      }
    }

    /**
     * ⛔ **3-bis) LA PESATA DEL RIENTRO, DAL GIRO NOTTURNO — su TUTTE le sospensioni** (23/8).
     *
     * Due correzioni di revisione insieme:
     *  - la richiesta nasceva solo dentro `deliverIfEligible`, che gira quando la cliente **apre
     *    l'app**: la push che serve a riportarla in app partiva solo verso chi era già in app. Chi
     *    in vacanza l'app non la apre — giustamente: le abbiamo detto che non ha compiti — si
     *    svegliava il giorno del rientro senza menu e senza spesa;
     *  - e girare sulle `pauseRequest` non basta: il Calendario in app crea **solo l'`event`**, e
     *    quelle clienti non avrebbero mai ricevuto la push. Il cancello del rientro guarda gli
     *    event, e questo passo guarda gli stessi event.
     *
     * Stesso tipo e stesso testo della richiesta in-app (`pesata-del-rientro.ts`): le due porte si
     * vedono nel throttle e non mandano due push per la stessa cosa.
     */
    const anticipoRientroNotturno = await this.configParams.getNumber('menu_visible_days_before_return', 1);
    const finestraEvento = new Date(oggi.getTime() - 3 * 86_400_000);
    const inRientro = (await this.prisma.event.findMany({
      where: {
        mode: 'pause_period' as never,
        endDate: { gte: finestraEvento, lte: new Date(oggi.getTime() + Math.max(0, Math.floor(anticipoRientroNotturno)) * 86_400_000) },
      } as never,
      select: { clientId: true, startDate: true, endDate: true },
    })) as { clientId: string; startDate: Date; endDate: Date }[];
    for (const e of inRientro) {
      try {
        const rientro = rientroInArrivo(e, now, anticipoRientroNotturno);
        if (!rientro) continue; // finestra non ancora aperta
        if (rientro.getTime() < oggi.getTime()) continue; // rientro già passato: tocca al ciclo
        const daQuando = new Date(now.getTime() - Math.max(1, askDays) * 86_400_000);
        const giaChiesto = await this.prisma.notification.findFirst({
          where: { userId: e.clientId, type: TIPO_PESATA_DEL_RIENTRO, createdAt: { gte: daQuando } } as never,
          select: { id: true },
        });
        if (giaChiesto) continue;
        const pesataCiSta = await this.prisma.measurement.findFirst({
          where: {
            clientId: e.clientId,
            date: { gte: new Date(rientro.getTime() - Math.max(0, Math.floor(anticipoRientroNotturno)) * 86_400_000) },
          },
          select: { id: true },
        });
        if (pesataCiSta) continue;
        const testo = testoPesataDelRientro(rientro);
        await this.notifications
          .notify({ userId: e.clientId, type: TIPO_PESATA_DEL_RIENTRO, title: testo.titolo, body: testo.corpo })
          .catch(() => undefined);
        misureChieste++;
      } catch {
        // Una cliente che va storta non ferma le altre.
      }
    }

    // 4) PAUSE APPENA FINITE: se torna con qualche chilo in più, i menu di rientro sono già lì.
    //    Erano un prodotto a €29 fino al 7/8; chiedere soldi a chi rientra da una vacanza con
    //    tre chili addosso era il momento peggiore per farlo. Ora si erogano e basta.
    const menuDiRientro = await this.erogaRientriDiFinePausa(oggi, sogliaKg);

    return { pauseAttive: pause.length, misureChieste, coachAvvisate, menuDiRientro };
  }

  /**
   * Menu di rientro a fine pausa, INCLUSI. Guarda le pause chiuse negli ultimi giorni a cui non
   * sono ancora stati erogati: se il peso è sopra il riferimento di partenza oltre la soglia, si
   * generano le giornate migliori dello storico personale.
   *
   * La finestra di 3 giorni serve a due cose: prendere anche le pause finite mentre il cron era
   * fermo, e non ripescare all'infinito quelle vecchie di mesi.
   */
  private async erogaRientriDiFinePausa(oggi: Date, sogliaKg: number): Promise<number> {
    const da = new Date(oggi);
    da.setDate(da.getDate() - 3);
    const finite = (await this.prisma.pauseRequest.findMany({
      where: {
        status: { in: ['auto_approved', 'approved'] },
        endDate: { gte: da, lt: oggi },
        rientroMenusAt: null,
      } as never,
      select: { id: true, clientId: true, refWeightKg: true, endDate: true },
    })) as { id: string; clientId: string; refWeightKg: number | null; endDate: Date }[];

    let erogati = 0;
    for (const p of finite) {
      try {
        // Segno SEMPRE la pausa come lavorata, anche quando non si eroga niente: altrimenti
        // ogni notte si riesaminerebbe la stessa pausa per tre giorni di fila.
        await this.prisma.pauseRequest.update({
          where: { id: p.id },
          data: { rientroMenusAt: new Date() } as never,
        });
        if (p.refWeightKg == null) continue; // mai pesata: non c'è un riferimento da confrontare

        const ultima = (await this.prisma.measurement.findFirst({
          where: { clientId: p.clientId },
          orderBy: { date: 'desc' },
          select: { weightKg: true },
        })) as { weightKg: number } | null;
        if (!ultima || ultima.weightKg - p.refWeightKg < sogliaKg) continue;

        const quanti = await this.monitoring.generateRientroMenus(p.clientId);
        if (quanti <= 0) continue;
        const delta = Math.round((ultima.weightKg - p.refWeightKg) * 10) / 10;
        await this.notifications
          .notify({
            userId: p.clientId,
            type: 'pause_rientro_menus',
            title: 'Bentornata: ti ho preparato il rientro 🧰',
            body: `Sono +${delta} kg rispetto a quando sei partita, e capita a tutte. Trovi in app ${quanti} giornate scelte sul tuo storico — quelle che su di te hanno funzionato meglio. Sono incluse: di solito bastano 4-6 giorni.`,
          })
          .catch(() => undefined);
        erogati++;
      } catch {
        // Una pausa che va storta non deve fermare le altre.
      }
    }
    return erogati;
  }

  /** Task per la coach, idempotente su (cliente, tipo, pausa). */
  private async creaTaskCoach(
    clientId: string,
    pauseRequestId: string,
    title: string,
    description: string,
    dueDate: Date,
  ): Promise<void> {
    const esiste = await this.prisma.coachTask.findUnique({
      where: { clientId_kind_refId: { clientId, kind: 'pause_regain', refId: pauseRequestId } } as never,
      select: { id: true },
    });
    if (esiste) return;
    await this.prisma.coachTask
      .create({ data: { clientId, kind: 'pause_regain', refId: pauseRequestId, title, description, dueDate } })
      .catch(() => undefined);
  }

  /** Notifica in app a coach e nutrizionista assegnate. */
  private async avvisaStaffPausa(clientId: string, deltaKg: number, fine: Date): Promise<void> {
    const profile = await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { assignedCoachId: true, assignedNutritionistId: true, name: true },
    });
    if (!profile) return;
    // ⚠️ Ripiego sui capi se non c'è nessuno assegnato: il peso che sale durante una pausa è un
    // dato clinico, e una cliente scoperta è quella per cui conta di più (Simone, 12/8).
    const destinatari = await destinatariStaffDellaCliente(this.prisma, clientId);
    if (!destinatari.length) return;
    const chi = profile.name ?? 'Una cliente';
    for (const userId of destinatari) {
      await this.notifications
        .notify({
          userId,
          type: 'pause_regain',
          title: 'Peso in salita durante una pausa',
          body: `${chi}: +${deltaKg} kg dall'inizio della pausa, che finisce il ${fine.toLocaleDateString('it-IT')}. Vale una parola adesso.`,
          payload: { clientId, deltaKg },
        })
        .catch(() => undefined);
    }
  }

  // ---------- Meccanica ----------

  /**
   * Crea l'evento di pausa (sospende il menu nel periodo). Bypassa il cap 30gg
   * di EventsService perché qui la durata è già validata (≤90) ed eventualmente
   * approvata dallo staff.
   */
  private async createPauseEvent(clientId: string, startDate: Date, endDate: Date) {
    const lastMeasure = await this.prisma.measurement.findFirst({
      where: { clientId },
      orderBy: { date: 'desc' },
      select: { weightKg: true },
    });
    return this.prisma.event.create({
      data: {
        clientId,
        type: 'vacation' as never,
        label: 'Pausa (vacanza)',
        startDate,
        endDate,
        mode: 'pause_period' as never,
        planPhaseState: 'before',
        startWeightKg: lastMeasure?.weightKg ?? null,
      },
    });
  }

  /**
   * Fa slittare in avanti di `days` giorni la scadenza dell'abbonamento attivo.
   * Se non c'è scadenza impostata (abbonamento senza fine) non fa nulla.
   */
  private async freezeSubscription(clientId: string, days: number): Promise<Date | null> {
    /**
     * ⚠️ Non `orderBy createdAt desc`: quello prendeva la riga più RECENTE, che su una cliente con
     * un piano in coda è **la coda** — l'inizio è nel futuro perché è stata comprata dopo. I giorni
     * di pausa finivano sommati alla fine del piano sbagliato: concessi sulla carta, e mai ricevuti
     * da lei. La pausa deve allungare il piano che sta erogando ADESSO, che è la stessa riga che
     * `menu.service` usa per decidere fino a quando consegnare i menu.
     */
    /**
     * ⚠️ Anche i piani in coda (19/8, voce 258): `attivoInCorso` sceglie comunque quello che sta
     * erogando, e leggere i soli `active` faceva tornare `null` a chi ha una coda soltanto — i
     * giorni di pausa venivano concessi senza essere sommati a nessuna scadenza, cioè persi. Il caso
     * che conta è la coda con la partenza **già arrivata**: la promozione notturna è in ritardo, i
     * menu stanno arrivando, e quei giorni sono giorni veri.
     */
    const attivi = await this.prisma.subscription.findMany({
      where: { clientId, status: { in: STATI_CON_UN_PIANO as never } },
      select: { id: true, status: true, startDate: true, endDate: true },
    });
    const sub = attivoInCorso(attivi);
    if (!sub || !sub.endDate) return null;
    /**
     * ⚠️ **Un piano che non è ancora cominciato non si allunga.** Allungare la fine di un piano che
     * partirà fra due mesi vorrebbe dire regalare giorni per una pausa in cui lei non ha perso
     * niente: non c'era nessun menu da sospendere. Cosa debba fare una pausa chiesta prima della
     * partenza — spostare l'inizio? rifiutarla? — è una domanda di prodotto e non la decide questo
     * metodo: qui si dice che non si è fatto niente, e la si lascia a chi può rispondere.
     */
    if (sub.startDate && sub.startDate.getTime() > Date.now()) {
      this.logger.warn(
        `Pausa di ${days} giorni su ${clientId}: il piano comincia il ${sub.startDate.toISOString().slice(0, 10)} ` +
          'e non è ancora partito, quindi la scadenza non è stata spostata. Nessun giorno di menu è andato perso, ' +
          'ma se la pausa cade dentro il piano va rivista a mano.',
      );
      return null;
    }
    const newEnd = new Date(sub.endDate.getTime() + days * 86_400_000);

    /**
     * ⚠️ **E LA CODA SCORRE CON LUI** — decisione di Simone, 19/8 sera.
     *
     * Prima si allungava la fine del piano in corso e basta. Se dietro c'era una coda già pagata
     * quella restava dov'era, e cominciava **dentro** il piano appena allungato: `attivoInCorso` ne
     * sceglie **uno solo** — quello che finisce più tardi — e i giorni dell'altro scorrono senza che
     * la cliente riceva niente. ⛔ Cioè i giorni di pausa glieli davo con una mano e gliene toglievo
     * altrettanti con l'altra, e il conto non lo faceva vedere nessuno. È esattamente ciò che nel
     * caso Lorena ha portato il piano #2 al 01/09.
     *
     * ⚠️ **La pausa non si tocca**: è una promessa già fatta a voce quando arriva qui. Si sposta la
     * coda, che è anche lei sua — e spostandola non perde nemmeno un giorno di quello che ha pagato.
     * La regola (tutta la fila, inizio **e** fine, e le sovrapposizioni già autorizzate non si
     * disfano) sta in `coda-che-slitta.ts`, con scritto perché.
     *
     * ⚠️ **Una transazione sola.** Se l'allungamento passasse e lo spostamento no, resterebbe
     * scritto proprio lo stato che questo codice esiste per evitare — e nessuno lo saprebbe.
     */
    const slittano = codaCheSlitta(attivi as never, sub.id, sub.endDate, days);
    await this.prisma.$transaction([
      this.prisma.subscription.update({ where: { id: sub.id }, data: { endDate: newEnd } }),
      ...slittano.map((x) =>
        this.prisma.subscription.update({
          where: { id: x.id },
          data: { startDate: x.startDate, endDate: x.endDate },
        }),
      ),
    ] as never);
    if (slittano.length) {
      this.logger.log(
        `Pausa di ${days} giorni su ${clientId}: spostati in avanti anche ${slittano.length} piani in fila, ` +
          'inizio e fine, così non le scorrono sotto il piano allungato.',
      );
      await this.audit
        .log({
          action: 'pause.queue.shifted',
          entityType: 'subscription',
          entityId: sub.id,
          metadata: { clientId, giorni: days, spostati: slittano.map((x) => x.id) },
        })
        .catch(() => undefined);
    }
    return newEnd;
  }

  // ---------- Modalità viaggio (staff) ----------

  /**
   * ⛔ **LA MODALITÀ VIAGGIO ADESSO SOSPENDE DAVVERO** — decisione di Simone, 23/8.
   *
   * ## Cosa faceva prima, e perché era un equivoco
   *
   * La card «Modalità viaggio» in back office scriveva tre campi sul profilo
   * (`travel_state/start/end`) e **nient'altro**: nessun periodo di sospensione, nessun menu
   * fermato, nessuna scadenza spostata. Serviva solo a `DietAgentService` per scegliere piatti da
   * vacanza. Intanto l'app, quando una cliente è in un `pause_period` vero, le scrive **«Sei in
   * modalità viaggio»** — che è un'altra cosa, creata da un'altra porta.
   *
   * Due oggetti con lo stesso nome: chi metteva «In vacanza» dal back office credeva di aver
   * fermato i menu, e i menu continuavano ad arrivare.
   *
   * ## La regola nuova
   *
   * «In vacanza» con le date **crea una sospensione vera**: i menu si fermano, la sorveglianza del
   * peso parte, e la scadenza del piano slitta dei giorni sospesi — perché i giorni pagati non si
   * perdono, che è la stessa promessa della richiesta di pausa.
   *
   * ⚠️ **Non riapre il caso Gioia (11/8).** Quella decisione dice: *o ricevi menu, e allora le
   * misure valgono come per tutte; oppure sei in pausa, e allora non ricevi menu ma entri nel
   * protocollo di monitoraggio.* Questa è **esattamente** la seconda strada. La terza — menu che
   * arrivano e nessuno che chiede il peso — resta chiusa.
   *
   * ## `rientro` è il PRIMO GIORNO DI DIETA
   *
   * L'operatrice scrive «riprende il 24»; in tabella si salva il 23. La conversione la fa
   * `ultimoGiornoSospeso` e non questa funzione: vedi il riquadro in `giorno-di-rientro.ts`.
   */
  async sospendiPerViaggio(
    clientId: string,
    actorUserId: string,
    input: { start: Date; rientro: Date },
  ): Promise<{ giorni: number; giorniCongelati: number; nuovaScadenza: Date | null; avviso: string | null }> {
    const startDate = aGiorno(input.start);
    const endDate = ultimoGiornoSospeso(input.rientro);
    if (endDate.getTime() < startDate.getTime()) {
      throw new BadRequestException(
        'Il rientro deve essere almeno il giorno dopo la partenza: una vacanza di zero giorni non sospende niente.',
      );
    }
    const giorni = giorniSospesi({ startDate, endDate });
    /**
     * ⛔ **VENTI GIORNI, NON NOVANTA** (Simone, 23/8: «l'intervallo massimo previsto
     * dall'interfaccia resta di 20 giorni»). Venti è la soglia oltre la quale, su tutte le altre
     * porte, una sospensione vuole una seconda persona: da qui una coach può congelare venti
     * giorni; oltre, si passa dalla richiesta di pausa, che una collega approva.
     */
    if (giorni > FREEZE_AUTO_MAX_DAYS) {
      throw new BadRequestException(
        `Da qui una sospensione può durare al massimo ${FREEZE_AUTO_MAX_DAYS} giorni (questa ne dura ${giorni}). ` +
          'Per un periodo più lungo serve una richiesta di pausa approvata da una collega.',
      );
    }

    const oggi = aGiorno(new Date());
    const rientro = giornoDiRientro({ startDate, endDate });

    /**
     * ⛔ **UNA VACANZA GIÀ FINITA NON SI SOSPENDE** (aggiunto in revisione, 23/8).
     *
     * Sui profili c'è gente con `travel_state = 'in_vacanza'` e le date di **luglio**, mai
     * ripulite — è il caso che `stato-viaggio.ts` racconta di aver dovuto tappare con la scadenza
     * a trenta giorni. La card si precompila con quei valori: bastava che una coach aprisse la
     * scheda e premesse Salva per creare una sospensione retroattiva e allungare il piano di venti
     * giorni, per una vacanza in cui la cliente i menu li aveva ricevuti tutti.
     */
    if (rientro.getTime() < oggi.getTime()) {
      throw new BadRequestException(
        'Questa vacanza è già finita: la card serve a FERMARE i menu, e su un periodo passato non c\'è più niente da fermare. Svuota le date, oppure scrivi il rientro da oggi in avanti.',
      );
    }

    // La sospensione della card che tocca QUESTO periodo (anche già chiusa: si riusa e si riapre).
    const esistente = await this.sospensioneDaViaggio(clientId, startDate, endDate);

    /**
     * ⛔ **UNA SOLA MODALITÀ VIAGGIO APERTA PER VOLTA** (seconda revisione, 23/8).
     *
     * La prima stesura, davanti a una modalità viaggio aperta su ALTRE date, la **riscriveva** con
     * le date nuove: sembrava una comodità, ed era il buco peggiore — la memoria dei giorni già
     * concessi è legata al periodo, e spostare il periodo la azzerava. Vacanza di settembre messa
     * e pagata (+10 sulla scadenza), riscritta su ottobre: altri +5, nessun avviso, e la
     * sorveglianza che continua a trattare settembre come pausa. Qui ci si ferma: prima si toglie
     * quella (stato a «nessuna», che la chiude tenendo la memoria), poi si scrive la nuova.
     */
    const altraViaggio = (await this.prisma.event.findFirst({
      where: {
        clientId,
        mode: 'pause_period' as never,
        label: ETICHETTA_VIAGGIO,
        endDate: { gte: oggi },
        ...(esistente ? { id: { not: esistente.id } } : { id: { not: '' } }),
      } as never,
      select: { id: true, startDate: true, endDate: true },
    })) as { id: string; startDate: Date; endDate: Date } | null;
    if (altraViaggio && !esistente) {
      const da = altraViaggio.startDate.toLocaleDateString('it-IT', { timeZone: 'UTC' });
      const a = giornoDiRientro(altraViaggio).toLocaleDateString('it-IT', { timeZone: 'UTC' });
      throw new BadRequestException(
        `Questa cliente ha già una modalità viaggio dal ${da} (riprende il ${a}). Prima riporta lo stato a «— nessuna —» e salva (quella si chiude), poi scrivi le date nuove: così i giorni già aggiunti alla scadenza non si contano due volte.`,
      );
    }
    if (altraViaggio && esistente) {
      // Due periodi della card che si toccano entrambi con le date nuove: stato rotto, non si
      // indovina quale sia «quello vero».
      throw new BadRequestException(
        'Questa cliente ha DUE sospensioni della modalità viaggio che toccano queste date: va sistemato a mano prima di salvarne una terza.',
      );
    }

    /**
     * ⚠️ Una pausa nata da un'ALTRA porta (richiesta dall'app, Calendario) che si accavalla:
     * creare la seconda vorrebbe dire allungare il piano due volte per la stessa vacanza.
     */
    const accavallato = (await this.prisma.event.findFirst({
      where: {
        clientId,
        mode: 'pause_period' as never,
        startDate: { lte: endDate },
        endDate: { gte: startDate },
        NOT: { label: ETICHETTA_VIAGGIO },
      } as never,
      select: { id: true, startDate: true, endDate: true },
    })) as { id: string; startDate: Date; endDate: Date } | null;
    if (accavallato) {
      const da = accavallato.startDate.toLocaleDateString('it-IT', { timeZone: 'UTC' });
      const a = giornoDiRientro(accavallato).toLocaleDateString('it-IT', { timeZone: 'UTC' });
      throw new BadRequestException(
        `Questa cliente ha già una sospensione dal ${da} (riprende il ${a}), messa da un'altra strada — la richiesta di pausa dall'app o il suo Calendario. ` +
          'Non la sovrascrivo da qui: se le date sono sbagliate vanno corrette là, altrimenti il piano le si allungherebbe due volte per la stessa vacanza.',
      );
    }

    /**
     * ⚠️ **LA TREGUA QUI NON FERMA, AVVISA.** Il back office è l'attivazione a mano che la regola
     * dei quindici giorni prevede («va chiesto alla coach, che attiva lei»): bloccarla qui vorrebbe
     * dire non lasciare nessuna strada. Ma il numero si dice, perché il senso della tregua è che
     * qualcuno la guardi in faccia prima di concedere la seconda vacanza in un mese.
     */
    let avvisoTregua: string | null = null;
    if (!esistente) {
      const tregua = await treguaFraVacanze(this.prisma, (k, d) => this.configParams.getNumber(k, d), clientId, startDate);
      if (tregua.mancano > 0) {
        const rientroPrec = tregua.ultimoRientro?.toLocaleDateString('it-IT', { timeZone: 'UTC' }) ?? '?';
        avvisoTregua =
          `⚠️ Questa cliente è rientrata da un'altra sospensione il ${rientroPrec}: fra due vacanze devono passare ` +
          `${tregua.minimo} giorni e ne mancano ${tregua.mancano}. L'ho attivata lo stesso, perché dal back office ` +
          'la decisione è tua — ma resta scritta nel registro con il tuo nome.';
      }
    }

    /**
     * ⛔ **IL REGISTRO DEI GIORNI CONCESSI** — la memoria che la prima stesura non aveva.
     *
     * L'`event` dice quando i menu sono fermi, e si tronca o si cancella quando la vacanza si
     * chiude. La `pauseRequest` con l'etichetta della card è un'altra cosa: è il **registro di
     * quanto è già stato aggiunto alla scadenza**, e le sue date NON si riscrivono mai all'indietro
     * — `endDate` del registro è «fin dove ho già concesso». Senza questa separazione, togliere e
     * rimettere la vacanza azzerava la memoria e i giorni si regalavano una seconda volta.
     */
    const registro = (await this.prisma.pauseRequest.findFirst({
      where: {
        clientId,
        staffNote: ETICHETTA_VIAGGIO,
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      } as never,
      orderBy: { endDate: 'desc' },
      select: { id: true, startDate: true, endDate: true, days: true },
    })) as { id: string; startDate: Date; endDate: Date; days: number } | null;

    /**
     * ⛔ **SI CONCEDONO SOLO I GIORNI FUTURI E NON ANCORA COPERTI DAL REGISTRO.**
     *
     * «Futuri» perché un giorno già passato non è un giorno perso: fino a un istante fa la
     * sospensione non c'era, e i menu di quel giorno sono arrivati. «Non ancora coperti» perché
     * ogni salvataggio ripassa di qui: allungare una vacanza in corso deve aggiungere i giorni in
     * più e basta, e risalvarla uguale non deve aggiungere niente — nemmeno se nel frattempo la
     * vacanza è stata tolta e rimessa.
     */
    const daOggi = new Date(Math.max(giornoDelDato(startDate).getTime(), oggi.getTime()));
    const futuri = endDate.getTime() >= daOggi.getTime() ? giorniSospesi({ startDate: daOggi, endDate }) : 0;
    let coperti = 0;
    if (registro) {
      const da = new Date(Math.max(daOggi.getTime(), giornoDelDato(registro.startDate).getTime()));
      const a = new Date(Math.min(endDate.getTime(), giornoDelDato(registro.endDate).getTime()));
      coperti = a.getTime() >= da.getTime() ? giorniSospesi({ startDate: da, endDate: a }) : 0;
    }
    const nuovi = Math.max(0, futuri - coperti);
    const accorciata = registro ? endDate.getTime() < giornoDelDato(registro.endDate).getTime() : false;

    // Il peso di riferimento della sorveglianza vale per il periodo che sta per cominciare.
    const ultimaMisura = (await this.prisma.measurement.findFirst({
      where: { clientId },
      orderBy: { date: 'desc' },
      select: { weightKg: true },
    })) as { weightKg: number } | null;

    let eventoId: string;
    if (esistente) {
      await this.prisma.event.update({
        where: { id: esistente.id },
        data: { startDate, endDate, label: ETICHETTA_VIAGGIO, startWeightKg: ultimaMisura?.weightKg ?? null },
      });
      eventoId = esistente.id;
    } else {
      const evento = await this.createPauseEvent(clientId, startDate, endDate);
      await this.prisma.event.update({ where: { id: evento.id }, data: { label: ETICHETTA_VIAGGIO } });
      eventoId = evento.id;
    }

    let avviso: string | null = null;
    let nuovaScadenza: Date | null = null;
    let concessiOra = 0;
    if (nuovi > 0) {
      nuovaScadenza = await this.freezeSubscription(clientId, nuovi);
      /**
       * ⚠️ **`null` non vuol dire «fatto»**: `freezeSubscription` torna `null` anche quando il
       * piano non è ancora partito o non ha scadenza, e lì i giorni NON sono stati concessi — e
       * NON vanno scritti a registro, così un salvataggio futuro riprova invece di darli per dati.
       */
      if (nuovaScadenza) {
        concessiOra = nuovi;
      } else {
        avviso =
          'I menu si fermano, ma la scadenza del piano NON è stata spostata: il piano non è ancora partito ' +
          'o non ha una data di fine. Se i giorni vanno recuperati, va fatto a mano sul piano.';
      }
    }
    /**
     * ⚠️ Quando la sospensione si **accorcia** la scadenza NON si riporta indietro: `freezeSubscription`
     * sposta anche la fila dei piani in coda (`coda-che-slitta.ts`), e disfare quello spostamento
     * può ricreare le sovrapposizioni che quel file esiste per evitare. Si dice, e basta.
     */
    if (accorciata) {
      avviso = [
        avviso,
        'La vacanza è più corta di quella già concessa: la scadenza del piano NON è stata riportata indietro, i giorni già aggiunti restano alla cliente.',
      ].filter(Boolean).join(' ');
      this.logger.warn(`Modalità viaggio accorciata su ${clientId}: scadenza non riportata indietro.`);
    }

    /**
     * Il registro si aggiorna SOLO in avanti: `endDate` è «fin dove ho già concesso» e non torna
     * mai indietro, `days` è il totale concesso. Si scrive DOPO il congelamento: se
     * `freezeSubscription` esplode, il totale resta quello vecchio e risalvare riprova.
     */
    if (registro) {
      await this.prisma.pauseRequest.update({
        where: { id: registro.id },
        data: {
          startDate: new Date(Math.min(giornoDelDato(registro.startDate).getTime(), startDate.getTime())),
          endDate: new Date(Math.max(giornoDelDato(registro.endDate).getTime(), endDate.getTime())),
          days: (registro.days ?? 0) + concessiOra,
          status: 'auto_approved',
          eventId: eventoId,
          refWeightKg: ultimaMisura?.weightKg ?? null,
          decidedByStaffId: actorUserId,
          decidedAt: new Date(),
        } as never,
      });
    } else {
      await this.prisma.pauseRequest.create({
        data: {
          clientId, startDate, endDate, days: concessiOra,
          status: 'auto_approved', eventId: eventoId,
          decidedByStaffId: actorUserId, decidedAt: new Date(),
          refWeightKg: ultimaMisura?.weightKg ?? null,
          staffNote: ETICHETTA_VIAGGIO,
        } as never,
      });
    }

    await this.audit.log({
      action: 'client.travel.suspend',
      actorId: actorUserId,
      entityType: 'user',
      entityId: clientId,
      metadata: {
        dal: startDate.toISOString().slice(0, 10),
        riprendeIl: rientro.toISOString().slice(0, 10),
        giorni,
        giorniAggiunti: concessiOra,
        nuovaScadenza: nuovaScadenza ? nuovaScadenza.toISOString().slice(0, 10) : null,
      } as never,
    });
    return {
      giorni,
      giorniCongelati: concessiOra,
      nuovaScadenza,
      avviso: [avvisoTregua, avviso].filter(Boolean).join(' ') || null,
    };
  }

  /**
   * Chiude la sospensione nata dalla modalità viaggio.
   *
   * ⛔ **L'evento si chiude, il registro NO** (seconda revisione, 23/8). Due oggetti, due sorti:
   *  - l'`event` (quello che ferma i menu): se la vacanza era **in corso** si tronca a ieri — è la
   *    verità, fino a ieri è stata sospesa, e il rientro vuole la sua pesata; se **non era ancora
   *    cominciata** si CANCELLA — troncarla a ieri fabbricava una pausa di un giorno mai esistita,
   *    che armava il cancello della pesata del rientro e faceva scattare la tregua dei quindici
   *    giorni su una vacanza mai fatta;
   *  - la `pauseRequest` (il registro dei giorni concessi): resta con le sue date, passa a
   *    `closed`. È la memoria che impedisce di regalare gli stessi giorni rimettendo la vacanza —
   *    e la riga che l'elenco in scheda continua a mostrare.
   */
  async togliSospensioneDaViaggio(
    clientId: string,
    actorUserId: string,
  ): Promise<{ tolta: boolean; eraInCorso: boolean; avviso: string | null }> {
    const oggi = aGiorno(new Date());
    const esistente = await this.sospensioneDaViaggio(clientId);
    if (!esistente) return { tolta: false, eraInCorso: false, avviso: null };
    const eraInCorso = giornoDelDato(esistente.startDate).getTime() <= oggi.getTime();

    if (eraInCorso) {
      const nuovaFine = new Date(oggi.getTime() - 86_400_000);
      await this.prisma.event.update({ where: { id: esistente.id }, data: { endDate: nuovaFine } });
    } else {
      await this.prisma.event.delete({ where: { id: esistente.id } });
    }
    // Il registro non si riscrive: si chiude soltanto, così la sorveglianza smette di trattarla
    // come in pausa e i giorni concessi restano scritti.
    await this.prisma.pauseRequest.updateMany({
      where: { eventId: esistente.id } as never,
      data: { status: 'closed' } as never,
    });
    await this.audit.log({
      action: 'client.travel.resume',
      actorId: actorUserId,
      entityType: 'user',
      entityId: clientId,
      metadata: {
        dal: giornoDelDato(esistente.startDate).toISOString().slice(0, 10),
        riprendeIl: giornoDiRientro(esistente).toISOString().slice(0, 10),
        chiusaIl: oggi.toISOString().slice(0, 10),
        eraInCorso,
      } as never,
    });
    return {
      tolta: true,
      eraInCorso,
      avviso: eraInCorso
        ? 'Ho chiuso la sospensione che era in corso: il menu riparte appena la cliente inserisce la pesata del rientro (gliela chiediamo noi). I giorni già aggiunti alla scadenza restano suoi.'
        : 'Sospensione annullata prima che cominciasse. I giorni eventualmente già aggiunti alla scadenza restano alla cliente.',
    };
  }

  /**
   * La sospensione della card: con le date, quella che **tocca quel periodo** (anche già chiusa —
   * riscriverla la riapre, e il registro impedisce il doppio conteggio); senza date, quella ancora
   * aperta (per toglierla).
   *
   * ⚠️ Si riconosce dall'etichetta e non da una colonna nuova: aggiungere `origine` a `event`
   * vorrebbe dire una migrazione su una tabella viva per una domanda che una stringa già risponde.
   */
  private async sospensioneDaViaggio(
    clientId: string,
    dal?: Date,
    al?: Date,
  ): Promise<{ id: string; startDate: Date; endDate: Date } | null> {
    const oggi = aGiorno(new Date());
    return (await this.prisma.event.findFirst({
      where: {
        clientId,
        mode: 'pause_period' as never,
        label: ETICHETTA_VIAGGIO,
        ...(dal && al
          ? { startDate: { lte: al }, endDate: { gte: dal } }
          : { endDate: { gte: oggi } }),
      } as never,
      orderBy: { startDate: 'desc' },
      select: { id: true, startDate: true, endDate: true },
    })) as { id: string; startDate: Date; endDate: Date } | null;
  }

  /** Avvisa coach e nutrizionista assegnate della richiesta in attesa. */
  private async notifyAssignedStaff(clientId: string, days: number): Promise<void> {
    const profile = await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { assignedCoachId: true, assignedNutritionistId: true, name: true },
    });
    if (!profile) return;
    /**
     * ⚠️ È IL PEGGIORE DEI TRE PUNTI dove c'era `if (staffIds.length === 0) return;`. Qui una
     * cliente chiede una pausa più lunga di venti giorni, la richiesta resta `pending` — e se non
     * le è ancora stato assegnato nessuno, **nessuno viene avvisato**. Lei aspetta una risposta che
     * non può arrivare, e nella coda di nessuno c'è una riga.
     */
    const destinatari = await destinatariStaffDellaCliente(this.prisma, clientId);
    if (!destinatari.length) return;
    const who = profile.name ?? 'Una cliente';
    for (const userId of destinatari) {
      await this.notifications
        .notify({
          userId,
          type: 'pause_request',
          title: 'Richiesta di pausa',
          body: `${who} chiede una pausa di ${days} giorni: va approvata o rifiutata.`,
          payload: { clientId, days },
        })
        .catch(() => undefined);
    }
  }
}
