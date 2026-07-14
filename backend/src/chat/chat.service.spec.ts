import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AiService } from '../ai/ai.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChatService } from './chat.service';

const client: AuthUser = { sub: 'client-1', email: 'c@m.eu', role: 'client' };
const coach: AuthUser = { sub: 'coach-user', email: 'co@m.eu', role: 'coach' };
const nutri: AuthUser = { sub: 'nutri-user', email: 'n@m.eu', role: 'nutritionist' };

describe('ChatService', () => {
  let service: ChatService;
  let prisma: any;
  let notifications: { notifyOncePerDay: jest.Mock };

  beforeEach(async () => {
    prisma = {
      chatThread: {
        upsert: jest.fn().mockImplementation(({ create }: any) => Promise.resolve({ id: 'th-' + create.counterpart, ...create })),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      message: {
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'm1', ...data })),
        findMany: jest.fn().mockResolvedValue([]),
      },
      clientProfile: {
        findUnique: jest.fn().mockResolvedValue({
          assignedCoachId: 'staff-c',
          assignedNutritionistId: 'staff-n',
          assignedCoach: { userId: 'coach-user', displayName: 'Marta' },
          assignedNutritionist: { userId: 'nutri-user', displayName: 'Dr.ssa Bini' },
        }),
      },
      staff: {
        findUnique: jest.fn().mockImplementation(({ where }: any) =>
          Promise.resolve(
            where.userId === 'coach-user' ? { id: 'staff-c' } : where.userId === 'nutri-user' ? { id: 'staff-n' } : null,
          ),
        ),
      },
      escalation: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
    };
    notifications = { notifyOncePerDay: jest.fn().mockResolvedValue(true) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: AiService, useValue: { assistantEnabled: jest.fn().mockResolvedValue(false), assistantReply: jest.fn().mockResolvedValue(null) } },
      ],
    }).compile();
    service = moduleRef.get(ChatService);
  });

  it('myThreads crea i tre thread (AI + coach + nutrizionista assegnate)', async () => {
    await service.myThreads('client-1');
    expect(prisma.chatThread.upsert).toHaveBeenCalledTimes(3);
  });

  it('una cliente non entra nel thread di un\'altra', async () => {
    prisma.chatThread.findUnique.mockResolvedValue({ id: 't1', clientId: 'ALTRA', counterpart: 'ai' });
    await expect(service.listMessages(client, 't1')).rejects.toThrow(ForbiddenException);
  });

  it('la coach entra solo nei thread coach delle proprie clienti', async () => {
    prisma.chatThread.findUnique.mockResolvedValue({ id: 't1', clientId: 'client-1', counterpart: 'coach' });
    await expect(service.listMessages(coach, 't1')).resolves.toBeDefined();
    // thread nutrizionista → vietato
    prisma.chatThread.findUnique.mockResolvedValue({ id: 't2', clientId: 'client-1', counterpart: 'nutritionist' });
    await expect(service.listMessages(coach, 't2')).rejects.toThrow(ForbiddenException);
    // cliente non sua → vietato
    prisma.chatThread.findUnique.mockResolvedValue({ id: 't3', clientId: 'client-1', counterpart: 'coach' });
    prisma.clientProfile.findUnique.mockResolvedValue({ assignedCoachId: 'staff-ALTRO' });
    await expect(service.listMessages(coach, 't3')).rejects.toThrow(ForbiddenException);
  });

  it('messaggio FAQ all\'AI → risposta immediata con meta.matchedFaq', async () => {
    prisma.chatThread.findUnique.mockResolvedValue({ id: 't-ai', clientId: 'client-1', counterpart: 'ai' });
    const result: any = await service.postMessage(client, 't-ai', 'quando si sblocca il nuovo menu?');
    expect(result.aiReply.senderRole).toBe('ai');
    expect(result.aiReply.meta.matchedFaq).toBe('menu_sblocco');
    expect(prisma.escalation.create).not.toHaveBeenCalled();
  });

  it('tema sensibile MEDICO all\'AI → escalation clinica + notifica alla nutrizionista', async () => {
    prisma.chatThread.findUnique.mockResolvedValue({ id: 't-ai', clientId: 'client-1', counterpart: 'ai' });
    const result: any = await service.postMessage(client, 't-ai', 'stamattina sono quasi svenuta');
    expect(prisma.escalation.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ category: 'clinical', assignedToId: 'staff-n' }) }),
    );
    expect(notifications.notifyOncePerDay).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'nutri-user', type: 'chat_sensitive_alert' }),
    );
    expect(result.aiReply.body).toContain('nutrizionista');
  });

  it('tema sensibile EMOTIVO all\'AI → escalation mood_risk + notifica alla COACH (primo filtro)', async () => {
    prisma.chatThread.findUnique.mockResolvedValue({ id: 't-ai', clientId: 'client-1', counterpart: 'ai' });
    const result: any = await service.postMessage(client, 't-ai', 'mi faccio vomitare dopo i pasti');
    expect(prisma.escalation.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ category: 'mood_risk', assignedToId: 'staff-c' }) }),
    );
    expect(notifications.notifyOncePerDay).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'coach-user', type: 'chat_sensitive_alert' }),
    );
    expect(result.aiReply.body).toContain('coach');
  });

  it('domanda generica all\'AI → inoltrata nel thread coach + notifica', async () => {
    prisma.chatThread.findUnique.mockResolvedValue({ id: 't-ai', clientId: 'client-1', counterpart: 'ai' });
    const result: any = await service.postMessage(client, 't-ai', 'mi dai una carica per oggi?');
    // messaggio inoltrato nel thread coach
    const forwarded = prisma.message.create.mock.calls.find(
      (c: any) => c[0].data.meta?.forwardedFrom === 'ai',
    );
    expect(forwarded[0].data.threadId).toBe('th-coach');
    expect(notifications.notifyOncePerDay).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'coach-user' }),
    );
    expect(result.aiReply.meta.routedTo).toBe('coach');
  });

  it('risposta della nutrizionista nel suo thread → notifica alla cliente', async () => {
    prisma.chatThread.findUnique.mockResolvedValue({ id: 't-n', clientId: 'client-1', counterpart: 'nutritionist' });
    await service.postMessage(nutri, 't-n', 'Ciao Giulia, ho visto le analisi: tutto ok.');
    expect(notifications.notifyOncePerDay).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'client-1', type: 'chat_reply_nutritionist' }),
    );
  });
});
