import { ForbiddenException } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { ConversationSummaryService } from './conversation-summary.service';

function make(prisma: Record<string, unknown>, ai: { summarizeConversation: jest.Mock }) {
  return new ConversationSummaryService(prisma as unknown as PrismaService, ai as unknown as AiService);
}

describe('ConversationSummaryService', () => {
  it('genera il riassunto di un thread con titolo AI', async () => {
    const upsert = jest.fn().mockResolvedValue({});
    const prisma = {
      message: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([{ threadId: 't1' }]) // batch: thread con messaggi
          .mockResolvedValueOnce([
            { senderRole: 'client', body: 'Ho fame la sera' },
            { senderRole: 'ai', body: 'Prova uno spuntino proteico' },
          ]),
      },
      chatThread: { findUnique: jest.fn().mockResolvedValue({ clientId: 'c1', counterpart: 'ai' }) },
      conversationSummary: { upsert },
    };
    const ai = { summarizeConversation: jest.fn().mockResolvedValue({ title: 'Fame serale', summary: 'Consiglio spuntino.' }) };
    const res = await make(prisma, ai).generateDailyBatch(new Date('2026-07-12T10:00:00Z'));
    expect(res.created).toBe(1);
    expect(upsert.mock.calls[0][0].create.title).toBe('Fame serale');
    expect(upsert.mock.calls[0][0].create.messageCount).toBe(2);
  });

  it('fallback titolo dal primo messaggio cliente se l AI non è disponibile', async () => {
    const upsert = jest.fn().mockResolvedValue({});
    const prisma = {
      message: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([{ threadId: 't1' }])
          .mockResolvedValueOnce([{ senderRole: 'client', body: 'Come sostituisco il pane?' }]),
      },
      chatThread: { findUnique: jest.fn().mockResolvedValue({ clientId: 'c1', counterpart: 'coach' }) },
      conversationSummary: { upsert },
    };
    const ai = { summarizeConversation: jest.fn().mockResolvedValue(null) };
    await make(prisma, ai).generateDailyBatch(new Date('2026-07-12T10:00:00Z'));
    expect(upsert.mock.calls[0][0].create.title).toBe('Come sostituisco il pane?');
    expect(upsert.mock.calls[0][0].create.summary).toBeNull();
  });

  it('listForStaff: la coach non vede le conversazioni col nutrizionista', async () => {
    const prisma = { conversationSummary: { findMany: jest.fn() } };
    const ai = { summarizeConversation: jest.fn() };
    const coach = { sub: 'u', role: 'coach' } as AuthUser;
    await expect(make(prisma, ai).listForStaff(coach, 'c1', 'nutritionist')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('listForStaff: coach non proprietaria → Forbidden', async () => {
    const prisma = {
      staff: { findUnique: jest.fn().mockResolvedValue({ id: 'coach-1' }) },
      clientProfile: { findUnique: jest.fn().mockResolvedValue({ assignedCoachId: 'coach-2', assignedNutritionistId: null }) },
      conversationSummary: { findMany: jest.fn() },
    };
    const ai = { summarizeConversation: jest.fn() };
    const coach = { sub: 'u', role: 'coach' } as AuthUser;
    await expect(make(prisma, ai).listForStaff(coach, 'c1', 'coach')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
