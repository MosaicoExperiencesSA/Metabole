import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { MonitoringService } from '../monitoring/monitoring.service';
import { NotificationsService } from '../notifications/notifications.service';
import { toDateOnly } from '../common/date-only';

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
const FREEZE_AUTO_MAX_DAYS = 20;
const FREEZE_ABS_MAX_DAYS = 90;

@Injectable()
export class PauseService {
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
    const oggi = new Date(now);
    oggi.setHours(0, 0, 0, 0);

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
    const staffIds = [profile.assignedCoachId, profile.assignedNutritionistId].filter(
      (v): v is string => !!v,
    );
    if (staffIds.length === 0) return;
    const staff = await this.prisma.staff.findMany({
      where: { id: { in: staffIds } },
      select: { userId: true },
    });
    const chi = profile.name ?? 'Una cliente';
    for (const s of staff) {
      await this.notifications
        .notify({
          userId: s.userId,
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
    const sub = await this.prisma.subscription.findFirst({
      where: { clientId, status: 'active' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, endDate: true },
    });
    if (!sub || !sub.endDate) return null;
    const newEnd = new Date(sub.endDate.getTime() + days * 86_400_000);
    await this.prisma.subscription.update({ where: { id: sub.id }, data: { endDate: newEnd } });
    return newEnd;
  }

  /** Avvisa coach e nutrizionista assegnate della richiesta in attesa. */
  private async notifyAssignedStaff(clientId: string, days: number): Promise<void> {
    const profile = await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { assignedCoachId: true, assignedNutritionistId: true, name: true },
    });
    if (!profile) return;
    const staffIds = [profile.assignedCoachId, profile.assignedNutritionistId].filter(
      (v): v is string => !!v,
    );
    if (staffIds.length === 0) return;
    const staff = await this.prisma.staff.findMany({
      where: { id: { in: staffIds } },
      select: { userId: true },
    });
    const who = profile.name ?? 'Una cliente';
    for (const s of staff) {
      await this.notifications
        .notify({
          userId: s.userId,
          type: 'pause_request',
          title: 'Richiesta di pausa',
          body: `${who} chiede una pausa di ${days} giorni: va approvata o rifiutata.`,
          payload: { clientId, days },
        })
        .catch(() => undefined);
    }
  }
}
