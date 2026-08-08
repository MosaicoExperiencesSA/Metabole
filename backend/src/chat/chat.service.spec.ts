import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AiService } from '../ai/ai.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { SostituzioneChatService } from '../menu/sostituzione-chat.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChatService } from './chat.service';

const client: AuthUser = { sub: 'client-1', email: 'c@m.eu', role: 'client' };
const coach: AuthUser = { sub: 'coach-user', email: 'co@m.eu', role: 'coach' };
const nutri: AuthUser = { sub: 'nutri-user', email: 'n@m.eu', role: 'nutritionist' };
const admin: AuthUser = { sub: 'admin-user', email: 'a@m.eu', role: 'admin' };

describe('ChatService', () => {
  let service: ChatService;
  let prisma: any;
  let notifications: { notifyOncePerDay: jest.Mock };
  let sostituzione: {
    apri: jest.Mock;
    apriDaTesto: jest.Mock;
    avanza: jest.Mock;
    sostituzioniDiChat: jest.Mock;
  };

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
        // Lo stato del dialogo di sostituzione vive nel meta dell'ultimo messaggio di Gaia:
        // null = nessun dialogo in corso.
        findFirst: jest.fn().mockResolvedValue(null),
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
    sostituzione = {
      apri: jest.fn().mockResolvedValue({ testo: 'Quale alimento?', stato: { passo: 'cibo', tentativi: 0 }, esito: 'aperto' }),
      apriDaTesto: jest.fn().mockResolvedValue({ testo: 'Quale alimento?', stato: { passo: 'cibo', tentativi: 0 }, esito: 'aperto' }),
      avanza: jest.fn().mockResolvedValue({ testo: 'Perché?', stato: { passo: 'motivo', tentativi: 0 }, esito: 'in_corso' }),
      sostituzioniDiChat: jest.fn().mockResolvedValue([]),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: AiService, useValue: { assistantEnabled: jest.fn().mockResolvedValue(false), assistantReply: jest.fn().mockResolvedValue(null) } },
        { provide: SostituzioneChatService, useValue: sostituzione },
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

  // ---------- Il ponte col menu (PROGETTO_gaia-cambio-menu, punti 1 e 2) ----------

  describe('cambio piatto concordato in chat', () => {
    beforeEach(() => {
      prisma.chatThread.findUnique.mockResolvedValue({ id: 't-ai', clientId: 'client-1', counterpart: 'ai' });
    });

    it('il pulsante dell\'app apre il dialogo con un messaggio di Gaia', async () => {
      const res: any = await service.avviaSostituzione('client-1');
      expect(sostituzione.apri).toHaveBeenCalledWith('client-1');
      expect(res.message.senderRole).toBe('ai');
      expect(res.message.meta.sost.passo).toBe('cibo');
    });

    it('«vorrei sostituire le carote» apre il dialogo dal testo', async () => {
      const res: any = await service.postMessage(client, 't-ai', 'vorrei sostituire le carote');
      expect(sostituzione.apriDaTesto).toHaveBeenCalledWith('client-1', 'vorrei sostituire le carote');
      expect(res.aiReply.meta.sost.passo).toBe('cibo');
      expect(res.aiReply.meta.kind).toBe('sostituzione');
    });

    it('con un dialogo in corso la risposta lo fa avanzare, non riparte da zero', async () => {
      prisma.message.findFirst.mockResolvedValue({
        meta: { sost: { passo: 'cibo', tentativi: 0 } },
        sentAt: new Date(),
      });
      const res: any = await service.postMessage(client, 't-ai', 'le carote');
      expect(sostituzione.avanza).toHaveBeenCalledWith('client-1', { passo: 'cibo', tentativi: 0 }, 'le carote');
      expect(sostituzione.apriDaTesto).not.toHaveBeenCalled();
      expect(res.aiReply.meta.sost.passo).toBe('motivo');
    });

    /**
     * Il caso che il ponte non deve rompere: un dialogo lasciato a metà ieri non è un dialogo
     * in corso, e «le carote» scritto stamattina non deve rientrare dentro quel flusso.
     */
    it('un dialogo scaduto non risuscita', async () => {
      prisma.message.findFirst.mockResolvedValue({
        meta: { sost: { passo: 'motivo', tentativi: 0 } },
        sentAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
      });
      await service.postMessage(client, 't-ai', 'ciao, come va?');
      expect(sostituzione.avanza).not.toHaveBeenCalled();
      expect(sostituzione.apriDaTesto).not.toHaveBeenCalled();
    });

    /**
     * La regola che non si scavalca: la sicurezza viene prima del ponte. Un messaggio che parla
     * di sostituzioni MA contiene un tema sensibile va all'escalation, non a un dialogo di
     * grammature — anche se il flusso è già aperto.
     */
    it('un tema sensibile ha la precedenza sul dialogo di sostituzione', async () => {
      prisma.message.findFirst.mockResolvedValue({
        meta: { sost: { passo: 'motivo', tentativi: 0 } },
        sentAt: new Date(),
      });
      const res: any = await service.postMessage(client, 't-ai', 'mi sento svenire, vorrei sostituire il pane');
      expect(sostituzione.avanza).not.toHaveBeenCalled();
      expect(prisma.escalation.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ category: 'clinical' }) }),
      );
      expect(res.aiReply.body).toContain('nutrizionista');
    });

    it('una conversazione normale non entra nel dialogo', async () => {
      await service.postMessage(client, 't-ai', 'mi dai una carica per oggi?');
      expect(sostituzione.apriDaTesto).not.toHaveBeenCalled();
      expect(sostituzione.avanza).not.toHaveBeenCalled();
    });

    /**
     * Il dialogo si apre col solo tocco del pulsante e resta aperto un'ora. Se la cliente cambia
     * idea e fa una domanda vera, quella domanda deve avere la sua risposta: prima riceveva
     * «non lo trovo fra gli ingredienti di oggi», con la FAQ giusta a un centimetro di distanza,
     * e alla seconda domanda il dialogo si arrendeva girandola alla coach.
     */
    it('una FAQ vera non viene dirottata dal dialogo aperto', async () => {
      prisma.message.findFirst.mockResolvedValue({
        meta: { sost: { passo: 'cibo', tentativi: 0 } },
        sentAt: new Date(),
      });
      const res: any = await service.postMessage(client, 't-ai', 'quando si sblocca il nuovo menu?');
      expect(sostituzione.avanza).not.toHaveBeenCalled();
      expect(res.aiReply.meta.matchedFaq).toBe('menu_sblocco');
    });

    it('ma al passo del motivo la risposta resta nel dialogo', async () => {
      prisma.message.findFirst.mockResolvedValue({
        meta: { sost: { passo: 'motivo', tentativi: 0 } },
        sentAt: new Date(),
      });
      await service.postMessage(client, 't-ai', 'non mi piace');
      expect(sostituzione.avanza).toHaveBeenCalled();
    });

    it('quando il flusso passa la mano, il messaggio finisce nel thread giusto', async () => {
      prisma.message.findFirst.mockResolvedValue({
        meta: { sost: { passo: 'cibo', tentativi: 1 } },
        sentAt: new Date(),
      });
      sostituzione.avanza.mockResolvedValue({
        testo: 'Ho girato la richiesta alla tua nutrizionista.',
        inoltraA: 'nutritionist',
        esito: 'rifiutata',
      });
      const res: any = await service.postMessage(client, 't-ai', 'il branzino');
      const inoltrato = prisma.message.create.mock.calls.find(
        (c: any) => c[0].data.meta?.forwardedFrom === 'ai',
      );
      expect(inoltrato[0].data.threadId).toBe('th-nutritionist');
      expect(notifications.notifyOncePerDay).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'nutri-user' }),
      );
      // Flusso chiuso: nessuno stato da riprendere al messaggio successivo.
      expect(res.aiReply.meta.sost).toBeUndefined();
    });
  });

  // ---------- Il thread di Gaia in scheda cliente (punto 2) ----------

  describe('lettura del thread con Gaia da parte dello staff', () => {
    it('la coach assegnata LEGGE il thread con Gaia', async () => {
      prisma.chatThread.findUnique.mockResolvedValue({ id: 't-ai', clientId: 'client-1', counterpart: 'ai' });
      await expect(service.listMessages(coach, 't-ai')).resolves.toBeDefined();
    });

    it('la nutrizionista assegnata LEGGE il thread con Gaia', async () => {
      prisma.chatThread.findUnique.mockResolvedValue({ id: 't-ai', clientId: 'client-1', counterpart: 'ai' });
      await expect(service.listMessages(nutri, 't-ai')).resolves.toBeDefined();
    });

    it('una coach non assegnata NON legge il thread con Gaia', async () => {
      prisma.chatThread.findUnique.mockResolvedValue({ id: 't-ai', clientId: 'client-1', counterpart: 'ai' });
      prisma.clientProfile.findUnique.mockResolvedValue({ assignedCoachId: 'staff-ALTRO', assignedNutritionistId: 'staff-ALTRO' });
      await expect(service.listMessages(coach, 't-ai')).rejects.toThrow(ForbiddenException);
    });

    /**
     * Leggere sì, scrivere no: in quel thread la voce è quella di Gaia, e una risposta dello
     * staff travestita da assistente ingannerebbe la cliente. Per parlarle c'è il thread proprio.
     */
    it('lo staff NON scrive nel thread con Gaia', async () => {
      prisma.chatThread.findUnique.mockResolvedValue({ id: 't-ai', clientId: 'client-1', counterpart: 'ai' });
      await expect(service.postMessage(coach, 't-ai', 'ciao')).rejects.toThrow(ForbiddenException);
      await expect(service.postMessage(nutri, 't-ai', 'ciao')).rejects.toThrow(ForbiddenException);
    });

    it('la scheda cliente elenca solo i thread che quel ruolo può leggere', async () => {
      prisma.chatThread.findMany.mockResolvedValue([
        { id: 't-ai', counterpart: 'ai', lastMessageAt: null, _count: { messages: 4 } },
        { id: 't-coach', counterpart: 'coach', lastMessageAt: null, _count: { messages: 2 } },
        { id: 't-nutri', counterpart: 'nutritionist', lastMessageAt: null, _count: { messages: 1 } },
      ]);
      const perCoach = await service.threadsDiUnCliente(coach, 'client-1');
      expect(perCoach.map((t) => t.counterpart)).toEqual(['ai', 'coach']);
      const perNutri = await service.threadsDiUnCliente(nutri, 'client-1');
      expect(perNutri.map((t) => t.counterpart)).toEqual(['ai', 'nutritionist']);
      expect(perCoach[0].messageCount).toBe(4);
    });

    /**
     * L'admin no, e non è una dimenticanza: `pages.ts` gli nega `health_documents` con la nota
     * «note cliniche riservate», e nel thread con Gaia c'è esattamente quel materiale — sintomi,
     * gravidanza, farmaci: tutto quello che il filtro marca come sensibile resta scritto lì.
     * Un permesso amministrativo non è un permesso clinico.
     */
    it('l\'admin NON legge il thread con Gaia', async () => {
      prisma.chatThread.findUnique.mockResolvedValue({ id: 't-ai', clientId: 'client-1', counterpart: 'ai' });
      await expect(service.listMessages(admin, 't-ai')).rejects.toThrow(ForbiddenException);
      prisma.chatThread.findMany.mockResolvedValue([
        { id: 't-ai', counterpart: 'ai', lastMessageAt: null, _count: { messages: 4 } },
      ]);
      await expect(service.threadsDiUnCliente(admin, 'client-1')).resolves.toEqual([]);
    });
  });

  // ---------- L'elenco dei cambi: serve un controllo di APPARTENENZA ----------

  describe('elenco dei cambi concordati in chat', () => {
    beforeEach(() => {
      prisma.chatThread.findUnique.mockResolvedValue({ id: 't-ai', clientId: 'client-1', counterpart: 'ai' });
    });

    it('la nutrizionista assegnata lo legge', async () => {
      await expect(service.sostituzioniDiChatPerStaff(nutri, 'client-1')).resolves.toEqual([]);
      expect(sostituzione.sostituzioniDiChat).toHaveBeenCalledWith('client-1');
    });

    /**
     * Il difetto che la revisione ha trovato: `@RequirePage('clients')` controlla la matrice
     * ruolo×pagina, non la PORTATA. Senza questo controllo bastava una coach per leggersi
     * giorno, piatto, grammature e il **motivo dichiarato** di una cliente non sua — e «mi resta
     * sullo stomaco» è un dato sanitario.
     */
    it('una coach NON assegnata non lo legge', async () => {
      prisma.clientProfile.findUnique.mockResolvedValue({
        assignedCoachId: 'staff-ALTRO',
        assignedNutritionistId: 'staff-ALTRO',
      });
      await expect(service.sostituzioniDiChatPerStaff(coach, 'client-1')).rejects.toThrow(ForbiddenException);
      expect(sostituzione.sostituzioniDiChat).not.toHaveBeenCalled();
    });

    it('senza thread con Gaia la portata si verifica comunque', async () => {
      prisma.chatThread.findUnique.mockResolvedValue(null);
      prisma.clientProfile.findUnique.mockResolvedValue({
        assignedCoachId: 'staff-ALTRO',
        assignedNutritionistId: 'staff-ALTRO',
      });
      await expect(service.sostituzioniDiChatPerStaff(coach, 'client-1')).rejects.toThrow(ForbiddenException);
    });
  });
});
