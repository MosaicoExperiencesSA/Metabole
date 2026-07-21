import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { classifyMessage } from './ai-filter';

type Counterpart = 'ai' | 'coach' | 'nutritionist';

/**
 * Chat (spec sez. 5): un thread per controparte. L'assistente AI risponde
 * subito da filtro deterministico; coach e nutrizionista rispondono nei loro
 * thread. Temi sensibili → escalation automatica al nutrizionista.
 */
@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly ai: AiService,
  ) {}

  // ---------- Thread ----------

  /** Thread della cliente: li crea al primo accesso (coach/nutrizionista solo se assegnati). */
  async myThreads(clientId: string) {
    const profile = await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      include: {
        assignedCoach: { select: { displayName: true } },
        assignedNutritionist: { select: { displayName: true } },
      },
    });
    const counterparts: Counterpart[] = ['ai'];
    if (profile?.assignedCoach) counterparts.push('coach');
    if (profile?.assignedNutritionist) counterparts.push('nutritionist');

    for (const counterpart of counterparts) {
      await this.prisma.chatThread.upsert({
        where: { clientId_counterpart: { clientId, counterpart: counterpart as never } },
        create: { clientId, counterpart: counterpart as never },
        update: {},
      });
    }
    const threads = await this.prisma.chatThread.findMany({
      where: { clientId },
      orderBy: { counterpart: 'asc' },
    });
    const names: Record<string, string> = {
      ai: 'Assistente Metabole',
      coach: profile?.assignedCoach?.displayName ?? 'La tua coach',
      nutritionist: profile?.assignedNutritionist?.displayName ?? 'La tua nutrizionista',
    };
    return threads.map((t: { counterpart: string } & Record<string, unknown>) => ({
      ...t,
      counterpartName: names[t.counterpart],
    }));
  }

  /** Thread visibili a un membro dello staff (coach: proprie clienti; nutrizionista: propri pazienti; capo: tutti i thread nutrizionista). */
  async staffThreads(user: AuthUser) {
    const staff = await this.prisma.staff.findUnique({ where: { userId: user.sub } });
    if (!staff) throw new ForbiddenException('Nessuna scheda staff');

    let where: Record<string, unknown>;
    if (user.role === 'coach' || user.role === 'coach_coordinator') {
      where = { counterpart: 'coach', client: { clientProfile: { assignedCoachId: staff.id } } };
    } else if (user.role === 'nutritionist') {
      where = { counterpart: 'nutritionist', client: { clientProfile: { assignedNutritionistId: staff.id } } };
    } else if (user.role === 'head_nutritionist') {
      where = { counterpart: 'nutritionist' };
    } else {
      throw new ForbiddenException('Ruolo senza accesso alla chat staff');
    }
    return this.prisma.chatThread.findMany({
      where: where as never,
      orderBy: { lastMessageAt: 'desc' },
      include: {
        client: { select: { id: true, email: true, clientProfile: { select: { name: true } } } },
      },
      take: 100,
    });
  }

  // ---------- Accesso ----------

  private async getThread(threadId: string) {
    const thread = await this.prisma.chatThread.findUnique({ where: { id: threadId } });
    if (!thread) throw new NotFoundException('Thread non trovato');
    return thread;
  }

  /** Chi può leggere/scrivere in un thread. */
  private async assertThreadAccess(user: AuthUser, thread: { clientId: string; counterpart: string }) {
    if (user.role === 'client') {
      if (thread.clientId !== user.sub) throw new ForbiddenException('Non è un tuo thread');
      return;
    }
    const staff = await this.prisma.staff.findUnique({ where: { userId: user.sub } });
    if (!staff) throw new ForbiddenException('Nessuna scheda staff');
    const profile = await this.prisma.clientProfile.findUnique({
      where: { userId: thread.clientId },
      select: { assignedCoachId: true, assignedNutritionistId: true },
    });
    if ((user.role === 'coach' || user.role === 'coach_coordinator') && thread.counterpart === 'coach' && profile?.assignedCoachId === staff.id) return;
    if (user.role === 'nutritionist' && thread.counterpart === 'nutritionist' && profile?.assignedNutritionistId === staff.id) return;
    if (user.role === 'head_nutritionist' && thread.counterpart === 'nutritionist') return;
    throw new ForbiddenException('Non hai accesso a questo thread');
  }

  async listMessages(user: AuthUser, threadId: string) {
    const thread = await this.getThread(threadId);
    await this.assertThreadAccess(user, thread);
    return this.prisma.message.findMany({
      where: { threadId },
      orderBy: { sentAt: 'asc' },
      take: 200,
    });
  }

  // ---------- Invio ----------

  async postMessage(user: AuthUser, threadId: string, body: string) {
    const thread = await this.getThread(threadId);
    await this.assertThreadAccess(user, thread);

    const message = await this.prisma.message.create({
      data: { threadId, senderRole: user.role, senderUserId: user.sub, body },
    });
    await this.prisma.chatThread.update({
      where: { id: threadId },
      data: { lastMessageAt: new Date() },
    });

    if (user.role === 'client' && thread.counterpart === 'ai') {
      const aiReply = await this.handleAiMessage(thread.clientId, threadId, body);
      return { message, aiReply };
    }

    // Cliente → staff: notifica al destinatario. Staff → cliente: notifica (in-app + push)
    // la cliente a OGNI risposta, con anti-raffica di 3 minuti (più messaggi ravvicinati =
    // una sola notifica). Body generico: nessun contenuto sanitario nell'anteprima push.
    if (user.role === 'client') {
      await this.notifyCounterpartStaff(thread.clientId, thread.counterpart as Counterpart);
    } else {
      const isNutri = thread.counterpart === 'nutritionist';
      await this.notifications.notifyOncePerDay({
        userId: thread.clientId,
        type: `chat_reply_${thread.counterpart}`,
        title: isNutri ? 'La tua nutrizionista ti ha risposto' : 'La tua coach ti ha risposto',
        body: 'Apri la chat per leggere il messaggio.',
        payload: { kind: 'chat_reply', threadId, counterpart: thread.counterpart },
        dedupeWindowMs: 3 * 60_000,
      });
    }
    return { message };
  }

  /** Filtro AI: FAQ → risposta; sensibile → escalation; altro → inoltro a coach/nutrizionista. */
  private async handleAiMessage(clientId: string, threadId: string, body: string) {
    const result = classifyMessage(body);
    const meta: Record<string, unknown> = { kind: result.kind };

    if (result.kind === 'sensitive') {
      meta.reason = result.reason;
      meta.target = result.target;
      const profile = await this.prisma.clientProfile.findUnique({
        where: { userId: clientId },
        select: { assignedNutritionistId: true, assignedCoachId: true },
      });
      // Decisione socio 14/07: al nutrizionista SOLO i temi medici (mood/comportamento
      // → coach, primo filtro che inoltra se serve). Categoria: clinical vs mood_risk.
      const toNutritionist = result.target === 'nutritionist';
      const assignedToId = toNutritionist ? profile?.assignedNutritionistId : profile?.assignedCoachId;
      const open = await this.prisma.escalation.findFirst({
        where: { clientId, source: 'coach', status: 'open', reason: { contains: 'Chat' } },
      });
      if (!open) {
        await this.prisma.escalation.create({
          data: {
            clientId,
            reason: `Chat: tema sensibile rilevato dal filtro AI (${result.reason}). Messaggio da rivedere con urgenza.`,
            source: 'coach',
            category: (toNutritionist ? 'clinical' : 'mood_risk') as never,
            assignedToId,
          },
        });
      }
      await this.notifyCounterpartStaff(clientId, toNutritionist ? 'nutritionist' : 'coach', 'chat_sensitive_alert', 'chat_sensitive_alert');
      await this.audit.log({
        action: 'chat.sensitive_escalation',
        actorId: clientId,
        entityType: 'chat_thread',
        entityId: threadId,
        metadata: { reason: result.reason, target: result.target },
      });
    }

    if (result.kind === 'faq') meta.matchedFaq = result.faqKey;

    // Risposta generativa (Claude) per messaggi generici o FAQ, se l'AI è abilitata.
    // I temi sensibili/sanitari NON passano dall'AI: restano gestiti sopra e instradati.
    let replyText: string = result.reply;
    let aiAnswered = false;
    if ((result.kind === 'faq' || result.kind === 'route_coach') && (await this.ai.assistantEnabled())) {
      const u = await this.prisma.user.findUnique({ where: { id: clientId }, select: { locale: true } });
      const aiText = await this.ai.assistantReply(body, u?.locale === 'en' ? 'en' : 'it');
      if (aiText) { replyText = aiText; aiAnswered = true; meta.composer = 'ai'; }
    }

    if (!aiAnswered && (result.kind === 'route_coach' || result.kind === 'route_nutritionist')) {
      const target: Counterpart = result.kind === 'route_coach' ? 'coach' : 'nutritionist';
      meta.routedTo = target;
      // Inoltra il messaggio nel thread giusto, così lo staff lo trova nel suo contesto.
      const targetThread = await this.prisma.chatThread.upsert({
        where: { clientId_counterpart: { clientId, counterpart: target as never } },
        create: { clientId, counterpart: target as never },
        update: { lastMessageAt: new Date() },
      });
      await this.prisma.message.create({
        data: {
          threadId: targetThread.id,
          senderRole: 'client',
          senderUserId: clientId,
          body,
          meta: { forwardedFrom: 'ai' } as never,
        },
      });
      await this.notifyCounterpartStaff(clientId, target);
    }

    const aiMessage = await this.prisma.message.create({
      data: { threadId, senderRole: 'ai', body: replyText, meta: meta as never },
    });
    await this.prisma.chatThread.update({
      where: { id: threadId },
      data: { lastMessageAt: new Date() },
    });
    return aiMessage;
  }

  private async notifyCounterpartStaff(
    clientId: string,
    counterpart: Counterpart,
    type = `chat_message_${counterpart}`,
    messageKey = 'chat_message_staff',
  ) {
    if (counterpart === 'ai') return;
    const profile = await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      include: {
        assignedCoach: { select: { userId: true } },
        assignedNutritionist: { select: { userId: true } },
      },
    });
    const staffUserId =
      counterpart === 'coach' ? profile?.assignedCoach?.userId : profile?.assignedNutritionist?.userId;
    if (!staffUserId) return;
    await this.notifications.notifyOncePerDay({
      userId: staffUserId,
      type,
      messageKey,
      payload: { clientId },
    });
  }
}
