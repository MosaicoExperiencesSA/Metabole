import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Visite (spec sez. 11): la PRIMA visita è SEMPRE in presenza — il modulo
 * impedisce di prenotarla in telematica. La televisita vale solo per i controlli.
 * Dopo ogni visita l'obiettivo viene riconfermato (Objective.history).
 */
@Injectable()
export class VisitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Scheda staff + verifica che la cliente sia in carico (il capo vede tutte). */
  async assertPatientAccess(user: AuthUser, clientId: string) {
    const staff = await this.prisma.staff.findUnique({ where: { userId: user.sub } });
    if (!staff) throw new ForbiddenException('Nessuna scheda staff');
    if (user.role === 'head_nutritionist') return staff;
    const profile = await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { assignedNutritionistId: true },
    });
    if (!profile || profile.assignedNutritionistId !== staff.id) {
      throw new ForbiddenException('La cliente non è tra i tuoi pazienti');
    }
    return staff;
  }

  async listForClient(clientId: string) {
    return this.prisma.visit.findMany({
      where: { clientId },
      orderBy: { datetime: 'desc' },
      select: {
        id: true,
        type: true,
        datetime: true,
        status: true,
        videoRoomId: true,
        nutritionist: { select: { displayName: true } },
        // notes escluse: riservate allo staff sanitario
      },
    });
  }

  async agenda(user: AuthUser) {
    const staff = await this.prisma.staff.findUnique({ where: { userId: user.sub } });
    if (!staff) throw new ForbiddenException('Nessuna scheda staff');
    const where =
      user.role === 'head_nutritionist'
        ? { datetime: { gte: new Date(Date.now() - 86_400_000) } }
        : { nutritionistId: staff.id, datetime: { gte: new Date(Date.now() - 86_400_000) } };
    return this.prisma.visit.findMany({
      where,
      orderBy: { datetime: 'asc' },
      take: 100,
      include: {
        client: { select: { id: true, email: true, clientProfile: { select: { name: true } } } },
        nutritionist: { select: { displayName: true } },
      },
    });
  }

  async create(
    user: AuthUser,
    input: { clientId: string; type: 'in_person' | 'televisit'; datetime: string },
  ) {
    const staff = await this.assertPatientAccess(user, input.clientId);
    const when = new Date(input.datetime);
    if (Number.isNaN(when.getTime()) || when.getTime() < Date.now()) {
      throw new BadRequestException('Data/ora visita non valida o nel passato');
    }

    // VINCOLO NORMATIVO: prima visita sempre in presenza.
    const previousVisits = await this.prisma.visit.count({
      where: { clientId: input.clientId, status: { not: 'cancelled' } },
    });
    if (previousVisits === 0 && input.type === 'televisit') {
      throw new BadRequestException(
        'La prima visita deve essere in presenza (linee guida): la televisita vale solo per i controlli successivi.',
      );
    }

    const visit = await this.prisma.visit.create({
      data: {
        clientId: input.clientId,
        nutritionistId: staff.id,
        type: input.type as never,
        datetime: when,
      },
    });
    await this.audit.log({
      action: 'health.visit.create',
      actorId: user.sub,
      entityType: 'visit',
      entityId: visit.id,
      metadata: { clientId: input.clientId, type: input.type, first: previousVisits === 0 },
    });
    // Notifica alla nutrizionista dell'appuntamento fissato.
    const clientName = await this.clientName(input.clientId);
    const whenLabel = this.dateLabel(when);
    await this.notifications
      .notify({
        userId: user.sub,
        type: 'appointment_created',
        title: 'Appuntamento fissato',
        body: `${input.type === 'televisit' ? 'Televisita' : 'Visita'} con ${clientName} · ${whenLabel}`,
        payload: { visitId: visit.id, clientId: input.clientId },
      })
      .catch(() => undefined);
    return visit;
  }

  /** Avvio televisita: genera la stanza video (placeholder per il provider WebRTC). */
  async start(user: AuthUser, visitId: string) {
    const visit = await this.prisma.visit.findUnique({ where: { id: visitId } });
    if (!visit) throw new NotFoundException('Visita non trovata');
    await this.assertPatientAccess(user, visit.clientId);
    if (visit.type !== 'televisit') {
      throw new BadRequestException('Solo le televisite hanno una stanza video');
    }
    if (visit.status !== 'scheduled') {
      throw new BadRequestException('La visita non è prenotata');
    }
    const videoRoomId = visit.videoRoomId ?? `metabole-${randomBytes(8).toString('hex')}`;
    const updated = await this.prisma.visit.update({
      where: { id: visitId },
      data: { videoRoomId },
    });
    await this.audit.log({
      action: 'health.visit.start',
      actorId: user.sub,
      entityType: 'visit',
      entityId: visitId,
    });
    return { visit: updated, joinUrl: `https://meet.example.eu/${videoRoomId}` };
  }

  /** Chiusura visita: note riservate + riconferma obiettivo (spec sez. 8). */
  async complete(
    user: AuthUser,
    visitId: string,
    input: { notes?: string; confirmObjective?: boolean },
  ) {
    const visit = await this.prisma.visit.findUnique({ where: { id: visitId } });
    if (!visit) throw new NotFoundException('Visita non trovata');
    const staff = await this.assertPatientAccess(user, visit.clientId);
    if (visit.status !== 'scheduled') {
      throw new BadRequestException('La visita non è in stato prenotato');
    }

    const updated = await this.prisma.visit.update({
      where: { id: visitId },
      data: { status: 'done', ...(input.notes ? { notes: input.notes } : {}) },
    });

    let objectiveReconfirmed = false;
    if (input.confirmObjective) {
      const objective = await this.prisma.objective.findFirst({
        where: { clientId: visit.clientId },
        orderBy: { createdAt: 'desc' },
      });
      if (objective) {
        const history = Array.isArray(objective.history) ? [...(objective.history as unknown[])] : [];
        history.push({
          at: new Date().toISOString(),
          event: 'reconfirmed_after_visit',
          visitId,
          byStaffId: staff.id,
        });
        await this.prisma.objective.update({
          where: { id: objective.id },
          data: {
            status: 'confirmed',
            confirmedByNutritionistAt: new Date(),
            history: history as never,
          },
        });
        objectiveReconfirmed = true;
      }
    }

    // Nessun evento economico al completamento della visita: dall'11/8 il compenso a visita non
    // esiste più (deciso con Simone). Quello che la nutrizionista guadagna è la provvigione definita
    // sul piano, che viene accreditata all'acquisto — vedi il commento in `FinanceService`.

    await this.audit.log({
      action: 'health.visit.complete',
      actorId: user.sub,
      entityType: 'visit',
      entityId: visitId,
      metadata: { objectiveReconfirmed },
    });
    return { visit: updated, objectiveReconfirmed };
  }

  /** Nome leggibile della cliente per i testi delle notifiche. */
  private async clientName(clientId: string): Promise<string> {
    const profile = await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { name: true },
    });
    if (profile?.name) return profile.name;
    const u = await this.prisma.user.findUnique({
      where: { id: clientId },
      select: { firstName: true, lastName: true },
    });
    const full = [u?.firstName, u?.lastName].filter(Boolean).join(' ');
    return full || 'una cliente';
  }

  private dateLabel(d: Date): string {
    return d.toLocaleString('it-IT', {
      timeZone: 'Europe/Rome',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * PROMEMORIA POCO PRIMA DELL'APPUNTAMENTO — chiamato dal cron ogni ~10 minuti.
   *
   * §16.7, Simone (12/8): «notifica push ad **entrambi** 20 minuti prima». Prima ne riceveva uno
   * solo il nutrizionista: la persona che l'appuntamento ce l'ha in agenda tutto il giorno, e che
   * quindi è quella che se lo dimentica di meno. Chi rischia di perdere la visita è la cliente, che
   * l'ha fissata due settimane fa dal telefono.
   *
   * ⚠️ **La finestra è 25 minuti, non 20.** Il cron gira ogni 10: con una finestra di 20 esatti, un
   * appuntamento a 21 minuti non verrebbe preso adesso e alla passata dopo ne mancherebbero 11 — il
   * promemoria arriverebbe sistematicamente in ritardo rispetto a quanto promesso. Con 25 l'avviso
   * cade fra i 15 e i 25 minuti prima: mai dopo l'inizio, mai mezz'ora prima.
   *
   * ⚠️ **Il dedup è per destinatario.** Prima cercava «esiste una notifica con questo visitId?»
   * senza guardare a chi: aggiungendo la cliente, la sua notifica avrebbe fatto saltare quella del
   * nutrizionista (o viceversa, a seconda dell'ordine) e uno dei due non avrebbe ricevuto niente,
   * senza nessun errore da nessuna parte.
   */
  async sendUpcomingReminders(): Promise<{ sent: number }> {
    const now = new Date();
    const until = new Date(now.getTime() + 25 * 60 * 1000);
    const visits = await this.prisma.visit.findMany({
      where: { status: 'scheduled', datetime: { gte: now, lte: until } },
      select: {
        id: true,
        datetime: true,
        type: true,
        clientId: true,
        nutritionist: { select: { userId: true, displayName: true } },
      },
    });
    let sent = 0;
    for (const v of visits) {
      const teleVisita = v.type === 'televisit';
      const clientName = await this.clientName(v.clientId);
      const destinatari: { userId: string | null; type: string; title: string; body: string }[] = [
        {
          userId: v.nutritionist?.userId ?? null,
          type: 'appointment_reminder',
          title: 'Promemoria appuntamento',
          body: `Tra poco: ${teleVisita ? 'televisita' : 'visita'} con ${clientName} · ${this.dateLabel(v.datetime)}`,
        },
        {
          userId: v.clientId,
          type: 'visit_imminent',
          title: 'Fra poco la tua visita',
          body:
            `Alle ${this.oraLabel(v.datetime)} hai la ${teleVisita ? 'televisita' : 'visita'}` +
            `${v.nutritionist?.displayName ? ` con ${v.nutritionist.displayName}` : ''}. ` +
            `${teleVisita ? 'Il collegamento si apre dall\'app.' : 'Ci vediamo in studio.'} 💚`,
        },
      ];

      for (const d of destinatari) {
        if (!d.userId) continue;
        const already = await this.prisma.notification.findFirst({
          where: { userId: d.userId, type: d.type, payload: { path: ['visitId'], equals: v.id } },
          select: { id: true },
        });
        if (already) continue;
        await this.notifications
          .notify({
            userId: d.userId,
            type: d.type,
            title: d.title,
            body: d.body,
            payload: { visitId: v.id, clientId: v.clientId },
          })
          .catch(() => undefined);
        sent++;
      }
    }
    return { sent };
  }

  private oraLabel(d: Date): string {
    return d.toLocaleString('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' });
  }
}
