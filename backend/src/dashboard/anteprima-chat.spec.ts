/**
 * IL MODULO CHAT DELLA DASHBOARD — pallino rosso e «con chi» (Simone, 12/8).
 *
 * Nasce da uno screenshot: nel modulo del capo nutrizionista comparivano cinque righe che
 * sembravano messaggi per lui, e in mezzo c'erano **conversazioni con Gaia** — dove lo staff legge
 * ma non può rispondere. Un pallino rosso su una di quelle sarebbe un allarme che insegna a
 * ignorare gli allarmi.
 */
import { DashboardService } from './dashboard.service';
import { MailboxService } from '../mailbox/mailbox.service';
import type { PrismaService } from '../prisma/prisma.service';

const ORA = new Date('2026-08-12T10:00:00Z');
const IERI = new Date('2026-08-11T10:00:00Z');

type Riga = { a: string; b?: string; sub?: string; daLeggere?: boolean; chi?: string };

function creaServizio(over: Record<string, unknown> = {}) {
  const vuoto = { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), findFirst: jest.fn().mockResolvedValue(null) };
  const prisma: any = {
    staff: { findUnique: jest.fn().mockResolvedValue({ id: 's-n' }), findMany: jest.fn().mockResolvedValue([]) },
    user: { ...vuoto },
    clientProfile: { ...vuoto },
    subscription: { ...vuoto },
    payment: { ...vuoto },
    escalation: { ...vuoto },
    visit: { ...vuoto },
    recipe: { ...vuoto },
    diet: { ...vuoto },
    order: { ...vuoto },
    crmRecord: { ...vuoto },
    coachTask: { ...vuoto },
    alert: { ...vuoto },
    document: { ...vuoto },
    protocol: { ...vuoto },
    chatThread: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'th-nutri', counterpart: 'nutritionist', lastMessageAt: ORA,
          client: { email: 'g@x.it', clientProfile: { name: 'Gioia' } },
          messages: [{ body: 'Sostituisci curry di ceci e spinaci' }],
        },
        {
          id: 'th-ai', counterpart: 'ai', lastMessageAt: ORA,
          client: { email: 'f@x.it', clientProfile: { name: 'Francesco' } },
          messages: [{ body: 'Perdonami Francesco, non ho capito.' }],
        },
      ]),
    },
    chatRead: { findMany: jest.fn().mockResolvedValue([]) },
    message: { groupBy: jest.fn().mockResolvedValue([{ threadId: 'th-nutri', _max: { sentAt: ORA } }]) },
    ...over,
  };
  const mailbox = { listInbox: jest.fn().mockResolvedValue([]) } as unknown as MailboxService;
  return { service: new DashboardService(prisma as unknown as PrismaService, mailbox), prisma };
}

const capo: any = { sub: 'u-capo', role: 'head_nutritionist' };

describe('anteprima Chat della dashboard', () => {
  it('⚠️ il pallino c\'è dove qualcuno aspetta una risposta', async () => {
    const { service } = await creaServizio();
    const righe = ((await service.previews(capo)).chat ?? []) as Riga[];
    expect(righe.find((r) => r.a === 'Gioia')!.daLeggere).toBe(true);
  });

  it('⚠️ MAI sul thread di Gaia: lì si legge e non si può rispondere', async () => {
    // Un pallino su una conversazione a cui nessuno deve rispondere è un allarme che insegna a
    // ignorare gli allarmi.
    const { service, prisma } = await creaServizio();
    const righe = ((await service.previews(capo)).chat ?? []) as Riga[];
    expect(righe.find((r) => r.a === 'Francesco')!.daLeggere).toBe(false);
    // E non lo si va nemmeno a contare.
    expect(prisma.chatRead.findMany.mock.calls[0][0].where.threadId.in).toEqual(['th-nutri']);
  });

  it('⚠️ dice CON CHI è la conversazione', async () => {
    // Nel modulo del capo i thread di Gaia stanno mescolati a quelli veri: senza l'etichetta
    // sembrano messaggi per lui.
    const { service } = await creaServizio();
    const righe = ((await service.previews(capo)).chat ?? []) as Riga[];
    expect(righe.find((r) => r.a === 'Francesco')!.chi).toBe('Gaia');
    expect(righe.find((r) => r.a === 'Gioia')!.chi).toBe('nutrizionista');
  });

  it('già letta: niente pallino', async () => {
    const { service } = await creaServizio({
      chatRead: { findMany: jest.fn().mockResolvedValue([{ threadId: 'th-nutri', readAt: ORA }]) },
      message: { groupBy: jest.fn().mockResolvedValue([{ threadId: 'th-nutri', _max: { sentAt: IERI } }]) },
    });
    const righe = ((await service.previews(capo)).chat ?? []) as Riga[];
    expect(righe.every((r) => !r.daLeggere)).toBe(true);
  });

  it('⚠️ se il conto del pallino fallisce, l\'anteprima si mostra lo stesso', async () => {
    const { service } = await creaServizio({
      message: { groupBy: jest.fn().mockRejectedValue(new Error('db giù')) },
    });
    const righe = ((await service.previews(capo)).chat ?? []) as Riga[];
    expect(righe).toHaveLength(2);
    expect(righe.every((r) => r.daLeggere === false)).toBe(true);
  });
});
