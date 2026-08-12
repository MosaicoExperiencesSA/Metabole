/**
 * L'ELENCO DELLE CHAT DELLO STAFF — le tre richieste di Simone del 12/8:
 *
 *   «la notifica di un messaggio in chat, se ci clicca il nutrizionista o la coach, deve venir
 *    portata nella chat della persona»
 *   «nella pagina chat metti un pallino rosso in piccolo se il cliente ha scritto dall'ultima
 *    visita nella pagina»
 *   «porta sempre in alto le ultime chat arrivate»
 */
import { Test } from '@nestjs/testing';
import { AiService } from '../ai/ai.service';
import { AuditService } from '../audit/audit.service';
import { DataInizioChatService } from '../menu/data-inizio-chat.service';
import { SostituzioneChatService } from '../menu/sostituzione-chat.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ValoriNutrizionaliService } from '../nutrient-facts/valori-nutrizionali.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChatService } from './chat.service';

const nutri: any = { sub: 'u-nutri', role: 'nutritionist' };
const cliente: any = { sub: 'c-1', role: 'client' };

const ORA = new Date('2026-08-12T10:00:00Z');
const IERI = new Date('2026-08-11T10:00:00Z');

function creaServizio(tocca?: (prisma: any) => void) {
  const prisma: any = {
    staff: {
      findUnique: jest.fn().mockResolvedValue({ id: 'staff-n' }),
      // `copreQuestoStaff` (la rete a tre livelli) risale l'albero: senza questa, il controllo di
      // accesso esplode prima di ogni asserzione.
      findMany: jest.fn().mockResolvedValue([]),
    },
    chatThread: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'th-1', clientId: 'c-1', counterpart: 'nutritionist', lastMessageAt: ORA },
        { id: 'th-2', clientId: 'c-2', counterpart: 'nutritionist', lastMessageAt: IERI },
      ]),
      findUnique: jest.fn().mockResolvedValue({ id: 'th-1', clientId: 'c-1', counterpart: 'nutritionist' }),
    },
    chatRead: {
      findMany: jest.fn().mockResolvedValue([{ threadId: 'th-2', readAt: ORA }]),
      upsert: jest.fn().mockResolvedValue({}),
    },
    message: {
      groupBy: jest.fn().mockResolvedValue([
        { threadId: 'th-1', _max: { sentAt: ORA } },
        { threadId: 'th-2', _max: { sentAt: IERI } },
      ]),
      findMany: jest.fn().mockResolvedValue([]),
    },
    // `capiNutrizionisti` cerca qui i destinatari di riserva.
    user: { findMany: jest.fn().mockResolvedValue([]) },
    clientProfile: {
      findUnique: jest.fn().mockResolvedValue({
        name: 'Patrizia',
        // `assignedNutritionistId` è la scheda staff, `assignedNutritionist.userId` è l'utenza:
        // il primo decide chi può leggere il thread, il secondo a chi arriva la notifica.
        assignedNutritionistId: 'staff-n',
        assignedCoachId: 'staff-c',
        assignedNutritionist: { userId: 'u-nutri' },
        assignedCoach: { userId: 'u-coach' },
      }),
    },
  };
  if (tocca) tocca(prisma);
  const notifications: any = { notifyOncePerDay: jest.fn().mockResolvedValue(true), notify: jest.fn() };
  const moduleRef = Test.createTestingModule({
    providers: [
      ChatService,
      { provide: PrismaService, useValue: prisma },
      { provide: AuditService, useValue: { log: jest.fn().mockResolvedValue(undefined) } },
      { provide: NotificationsService, useValue: notifications },
      { provide: AiService, useValue: {} },
      { provide: SostituzioneChatService, useValue: {} },
      { provide: DataInizioChatService, useValue: {} },
      { provide: ValoriNutrizionaliService, useValue: {} },
    ],
  }).compile();
  return { moduleRef, prisma, notifications };
}

async function servizio(tocca?: (prisma: any) => void) {
  const { moduleRef, prisma, notifications } = creaServizio(tocca);
  const m = await moduleRef;
  return { service: m.get(ChatService) as ChatService, prisma, notifications };
}

describe('⚠️ le ultime chat arrivate stanno in alto', () => {
  it('⚠️ le conversazioni mai iniziate NON vanno in cima', async () => {
    // In Postgres `ORDER BY x DESC` mette i null PER PRIMI: senza `nulls: 'last'` una chat mai
    // aperta stava sopra a chi aveva appena scritto. È tutta qui, la richiesta di Simone.
    const { service, prisma } = await servizio();
    await service.staffThreads(nutri);
    expect(prisma.chatThread.findMany.mock.calls[0][0].orderBy).toEqual({
      lastMessageAt: { sort: 'desc', nulls: 'last' },
    });
  });
});

describe('⚠️ il pallino rosso', () => {
  it('c\'è dove la cliente ha scritto dopo l\'ultima apertura', async () => {
    const { service } = await servizio();
    const out = (await service.staffThreads(nutri)) as { id: string; daLeggere: boolean }[];
    // th-1: mai letta → pallino. th-2: letta stamattina, ultimo messaggio di ieri → niente.
    expect(out.find((t) => t.id === 'th-1')!.daLeggere).toBe(true);
    expect(out.find((t) => t.id === 'th-2')!.daLeggere).toBe(false);
  });

  it('⚠️ mai letta vuol dire pallino acceso', async () => {
    // Nessuna riga in `chat_read` = mai aperta. Un pallino di troppo costa un tocco; un pallino
    // mancante è un messaggio che nessuno legge più.
    const { service } = await servizio((p) => p.chatRead.findMany.mockResolvedValue([]));
    const out = (await service.staffThreads(nutri)) as { daLeggere: boolean }[];
    expect(out.every((t) => t.daLeggere)).toBe(true);
  });

  it('⚠️ la PROPRIA risposta non riaccende il pallino', async () => {
    // Il conto guarda solo `senderRole: 'client'`: senza quel filtro, rispondere aggiornerebbe
    // l'ultimo messaggio del thread e il pallino tornerebbe da sé un istante dopo averlo spento.
    const { service, prisma } = await servizio();
    await service.staffThreads(nutri);
    expect(prisma.message.groupBy.mock.calls[0][0].where.senderRole).toBe('client');
    expect(prisma.message.groupBy.mock.calls[0][0].where.deletedAt).toBeNull();
  });

  it('aprire la conversazione lo spegne', async () => {
    const { service, prisma } = await servizio();
    await service.listMessages(nutri, 'th-1');
    expect(prisma.chatRead.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId_threadId: { userId: 'u-nutri', threadId: 'th-1' } } }),
    );
  });

  it('⚠️ la cliente che rilegge la sua chat non scrive niente in quella tabella', async () => {
    // È lo stato di lettura dello STAFF: il pallino della cliente è un'altra cosa.
    const { service, prisma } = await servizio();
    await service.listMessages(cliente, 'th-1');
    expect(prisma.chatRead.upsert).not.toHaveBeenCalled();
  });

  it('⚠️ se il conto del pallino fallisce, l\'elenco si apre lo stesso', async () => {
    const { service } = await servizio((p) => p.message.groupBy.mockRejectedValue(new Error('db giù')));
    const out = (await service.staffThreads(nutri)) as { daLeggere: boolean }[];
    expect(out).toHaveLength(2);
    expect(out.every((t) => t.daLeggere === false)).toBe(true);
  });

  it('⚠️ se segnare «letto» fallisce, i messaggi si leggono lo stesso', async () => {
    const { service } = await servizio((p) => p.chatRead.upsert.mockRejectedValue(new Error('db giù')));
    await expect(service.listMessages(nutri, 'th-1')).resolves.toEqual([]);
  });
});

describe('⚠️ la notifica porta nella chat, non nella cartella', () => {
  it('il payload contiene il threadId della conversazione giusta', async () => {
    const { service, prisma, notifications } = await servizio();
    prisma.chatThread.findUnique.mockResolvedValue({ id: 'th-nutri', clientId: 'c-1', counterpart: 'nutritionist' });
    prisma.chatThread.update = jest.fn().mockResolvedValue({});
    prisma.message.create = jest.fn().mockResolvedValue({ id: 'm1', sentAt: ORA });

    await service.postMessage(cliente, 'th-nutri', 'ciao, ho una domanda');

    const avviso = notifications.notifyOncePerDay.mock.calls[0][0];
    expect(avviso.userId).toBe('u-nutri');
    expect(avviso.payload.threadId).toBe('th-nutri');
    // Il clientId resta: se il thread non ci fosse, il tocco ricade sulla scheda.
    expect(avviso.payload.clientId).toBe('c-1');
  });

  it('⚠️ SENZA nutrizionista assegnata l\'avviso va ai CAPI, non nel vuoto', async () => {
    // Qui c'era un `return` muto: il messaggio veniva salvato e nessuno lo sapeva — non la
    // nutrizionista, che non c'è, e non il capo, a cui nessuno lo diceva. È la stessa lezione di
    // luglio: tre segnalazioni gravi rimaste senza destinatario per venti giorni.
    const { service, prisma, notifications } = await servizio();
    prisma.clientProfile.findUnique.mockResolvedValue({
      name: 'Patrizia', assignedNutritionistId: 'staff-n', assignedCoachId: 'staff-c',
      assignedNutritionist: null, assignedCoach: null,
    });
    prisma.user.findMany.mockResolvedValue([{ id: 'u-capo1' }, { id: 'u-capo2' }]);
    prisma.chatThread.update = jest.fn().mockResolvedValue({});
    prisma.message.create = jest.fn().mockResolvedValue({ id: 'm1', sentAt: ORA });

    await service.postMessage(cliente, 'th-nutri', 'ciao, ho un problema');

    const destinatari = notifications.notifyOncePerDay.mock.calls.map((c: any) => c[0].userId);
    expect(destinatari).toEqual(['u-capo1', 'u-capo2']);
    // ⚠️ E il titolo dice com'è andata: «una tua cliente» al capo sarebbe falso, e lo manderebbe a
    // cercarla fra le proprie.
    expect(notifications.notifyOncePerDay.mock.calls[0][0].title).toContain('non ha una nutrizionista assegnata');
  });

  it('⚠️ senza COACH assegnata non si ripiega su nessuno, e va bene così', async () => {
    // Nessun altro ruolo può scrivere nel thread «Coach»: un messaggio della nutrizionista
    // comparirebbe alla cliente come se fosse della sua coach. Meglio il log che un avviso a chi
    // non può nemmeno aprire la conversazione.
    const { service, prisma, notifications } = await servizio();
    prisma.chatThread.findUnique.mockResolvedValue({ id: 'th-coach', clientId: 'c-1', counterpart: 'coach' });
    prisma.clientProfile.findUnique.mockResolvedValue({
      name: 'Patrizia', assignedCoachId: 'staff-c', assignedNutritionistId: 'staff-n',
      assignedCoach: null, assignedNutritionist: null,
    });
    prisma.user.findMany.mockResolvedValue([{ id: 'u-capo1' }]);
    prisma.chatThread.update = jest.fn().mockResolvedValue({});
    prisma.message.create = jest.fn().mockResolvedValue({ id: 'm1', sentAt: ORA });

    await service.postMessage(cliente, 'th-coach', 'ciao');
    expect(notifications.notifyOncePerDay).not.toHaveBeenCalled();
  });

  it('⚠️ senza thread la notifica parte lo stesso, solo senza scorciatoia', async () => {
    const { service, prisma, notifications } = await servizio();
    prisma.chatThread.findUnique.mockImplementation(({ where }: any) =>
      Promise.resolve(where.id ? { id: 'th-nutri', clientId: 'c-1', counterpart: 'nutritionist' } : null),
    );
    prisma.chatThread.update = jest.fn().mockResolvedValue({});
    prisma.message.create = jest.fn().mockResolvedValue({ id: 'm1', sentAt: ORA });

    await service.postMessage(cliente, 'th-nutri', 'ciao');
    const avviso = notifications.notifyOncePerDay.mock.calls[0][0];
    expect(avviso.payload.threadId).toBeUndefined();
    expect(avviso.payload.clientId).toBe('c-1');
  });
});
