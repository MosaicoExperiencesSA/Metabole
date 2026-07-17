import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';

const DAY = 86_400_000;
const MANAGER_ROLES = ['admin', 'head_nutritionist', 'sales'];

const dateOnly = (d: Date): Date => new Date(d.toISOString().slice(0, 10) + 'T00:00:00.000Z');

interface MsgRow {
  senderRole: string;
  body: string;
}

/**
 * Riassunti giornalieri delle conversazioni (Metabole_Backend_Operazioni §7):
 * ogni giorno "chiude" le conversazioni con messaggi e ne salva un riassunto con
 * titolo generato dall'AI. Mostrati in "Conversazioni passate" (cliente e staff).
 * Chat con la coach = NON sanitaria: la coach non vede i riassunti del nutrizionista.
 */
@Injectable()
export class ConversationSummaryService {
  private readonly logger = new Logger(ConversationSummaryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  /** Genera i riassunti per un giorno (default: ieri) per i thread con messaggi quel giorno. */
  async generateDailyBatch(day?: Date): Promise<{ threads: number; created: number; errors: number }> {
    const start = dateOnly(day ?? new Date(Date.now() - DAY));
    const end = new Date(start.getTime() + DAY);

    const messages = (await this.prisma.message.findMany({
      where: { sentAt: { gte: start, lt: end } },
      select: { threadId: true },
    })) as { threadId: string }[];
    const threadIds = [...new Set(messages.map((m) => m.threadId))];

    let created = 0;
    let errors = 0;
    for (const tid of threadIds) {
      try {
        if (await this.generateForThread(tid, start, end)) created++;
      } catch (err) {
        errors++;
        this.logger.error(`Riassunto thread ${tid} fallito`, err instanceof Error ? err.stack : String(err));
      }
    }
    return { threads: threadIds.length, created, errors };
  }

  private async generateForThread(threadId: string, dayStart: Date, dayEnd: Date): Promise<boolean> {
    const thread = (await this.prisma.chatThread.findUnique({
      where: { id: threadId },
      select: { clientId: true, counterpart: true },
    })) as { clientId: string; counterpart: string } | null;
    if (!thread) return false;

    const msgs = (await this.prisma.message.findMany({
      where: { threadId, sentAt: { gte: dayStart, lt: dayEnd } },
      orderBy: { sentAt: 'asc' },
      select: { senderRole: true, body: true },
    })) as MsgRow[];
    if (!msgs.length) return false;

    const transcript = msgs.map((m) => `${m.senderRole}: ${m.body}`).join('\n');
    const ai = await this.ai.summarizeConversation(transcript, 'it');
    const firstClient = msgs.find((m) => m.senderRole === 'client')?.body ?? msgs[0].body;
    const title = ai?.title ?? firstClient.slice(0, 60);
    const summary = ai?.summary ?? null;

    await this.prisma.conversationSummary.upsert({
      where: {
        clientId_counterpart_date: { clientId: thread.clientId, counterpart: thread.counterpart as never, date: dayStart },
      },
      create: {
        clientId: thread.clientId,
        counterpart: thread.counterpart as never,
        date: dayStart,
        title,
        summary,
        messageCount: msgs.length,
      },
      update: { title, summary, messageCount: msgs.length },
    });
    return true;
  }

  /** "Conversazioni passate" lato cliente. */
  async listForClient(clientId: string, counterpart: string) {
    return this.prisma.conversationSummary.findMany({
      where: { clientId, counterpart: counterpart as never },
      orderBy: { date: 'desc' },
      take: 60,
    });
  }

  /** "Conversazioni passate" lato staff: solo clienti assegnati; la coach NON vede il nutrizionista. */
  async listForStaff(user: AuthUser, clientId: string, counterpart: string) {
    if ((user.role === 'coach' || user.role === 'coach_coordinator') && counterpart === 'nutritionist') {
      throw new ForbiddenException('La coach non accede alle conversazioni col nutrizionista');
    }
    if (!MANAGER_ROLES.includes(user.role)) {
      const staff = await this.prisma.staff.findUnique({ where: { userId: user.sub }, select: { id: true } });
      const profile = await this.prisma.clientProfile.findUnique({
        where: { userId: clientId },
        select: { assignedCoachId: true, assignedNutritionistId: true },
      });
      const owns =
        ((user.role === 'coach' || user.role === 'coach_coordinator') && profile?.assignedCoachId === staff?.id) ||
        (user.role === 'nutritionist' && profile?.assignedNutritionistId === staff?.id);
      if (!staff || !profile || !owns) throw new ForbiddenException('Cliente non tra i tuoi assegnati');
    }
    return this.prisma.conversationSummary.findMany({
      where: { clientId, counterpart: counterpart as never },
      orderBy: { date: 'desc' },
      take: 60,
    });
  }
}
