import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AiService } from '../ai/ai.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { DataInizioChatService } from '../menu/data-inizio-chat.service';
import { SostituzioneChatService } from '../menu/sostituzione-chat.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ValoriNutrizionaliService } from '../nutrient-facts/valori-nutrizionali.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChatService } from './chat.service';

const client: AuthUser = { sub: 'client-1', email: 'c@m.eu', role: 'client' };
const coach: AuthUser = { sub: 'coach-user', email: 'co@m.eu', role: 'coach' };
const nutri: AuthUser = { sub: 'nutri-user', email: 'n@m.eu', role: 'nutritionist' };
const admin: AuthUser = { sub: 'admin-user', email: 'a@m.eu', role: 'admin' };
/** La rete sopra la coach: coordinatrice e responsabile (11/8, «i permessi di lettura risalgono»). */
const coordinatrice: AuthUser = { sub: 'coord-user', email: 'coord@m.eu', role: 'coach_coordinator' };
const responsabile: AuthUser = { sub: 'resp-user', email: 'resp@m.eu', role: 'coach_coordinator' };

describe('ChatService', () => {
  let service: ChatService;
  let prisma: any;
  let notifications: { notifyOncePerDay: jest.Mock; notify: jest.Mock };
  /** Serve nei test della tracciatura: chi apre la conversazione di una cliente lascia una riga. */
  let audit: { log: jest.Mock };
  let sostituzione: {
    apri: jest.Mock;
    apriDaTesto: jest.Mock;
    avanza: jest.Mock;
    sostituzioniDiChat: jest.Mock;
    correggiCambioInChat: jest.Mock;
  };
  /** L'altro dialogo guidato di Gaia: spostare la data di inizio del piano (10/8). */
  let dataInizio: { apriDaTesto: jest.Mock; avanza: jest.Mock };

  beforeEach(async () => {
    audit = { log: jest.fn().mockResolvedValue(undefined) };
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
            where.userId === 'coach-user' ? { id: 'staff-c' }
              : where.userId === 'nutri-user' ? { id: 'staff-n' }
              : where.userId === 'coord-user' ? { id: 'staff-coord' }
              : where.userId === 'resp-user' ? { id: 'staff-resp' }
              : null,
          ),
        ),
        /**
         * LA RETE, a tre livelli come quella vera: la coach `staff-c` risponde alla coordinatrice
         * `staff-coord`, che risponde alla responsabile `staff-resp`. Serve a `reteSottoDiMe`, e non è
         * un finto qualunque: è il motivo per cui i test qui sotto provano davvero la risalita invece
         * di limitarsi a non esplodere (11/8).
         */
        findMany: jest.fn().mockImplementation(({ where }: any) => {
          const chiesti: string[] = (where?.OR ?? []).flatMap((o: any) => o.managerId?.in ?? o.headNutritionistId?.in ?? []);
          const figli: Record<string, string[]> = { 'staff-resp': ['staff-coord'], 'staff-coord': ['staff-c'] };
          return Promise.resolve(chiesti.flatMap((id) => (figli[id] ?? []).map((x) => ({ id: x }))));
        }),
      },
      escalation: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
    };
    notifications = {
      notifyOncePerDay: jest.fn().mockResolvedValue(true),
      notify: jest.fn().mockResolvedValue(undefined),
    };
    sostituzione = {
      apri: jest.fn().mockResolvedValue({ testo: 'Quale alimento?', stato: { passo: 'cibo', tentativi: 0 }, esito: 'aperto' }),
      apriDaTesto: jest.fn().mockResolvedValue({ testo: 'Quale alimento?', stato: { passo: 'cibo', tentativi: 0 }, esito: 'aperto' }),
      avanza: jest.fn().mockResolvedValue({ testo: 'Perché?', stato: { passo: 'motivo', tentativi: 0 }, esito: 'in_corso' }),
      sostituzioniDiChat: jest.fn().mockResolvedValue([]),
      correggiCambioInChat: jest.fn().mockResolvedValue({ stato: 'corretta', descrizione: 'Sostituzione corretta.' }),
    };
    dataInizio = {
      apriDaTesto: jest.fn().mockResolvedValue({
        testo: 'Da quando vuoi partire?',
        stato: { passo: 'data', tentativi: 0 },
        esito: 'aperto',
      }),
      avanza: jest.fn().mockResolvedValue({ testo: 'Confermi?', stato: { passo: 'conferma', tentativi: 0 }, esito: 'in_corso' }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
        { provide: AuditService, useValue: audit },
        { provide: AiService, useValue: { assistantEnabled: jest.fn().mockResolvedValue(false), assistantReply: jest.fn().mockResolvedValue(null) } },
        { provide: SostituzioneChatService, useValue: sostituzione },
        { provide: DataInizioChatService, useValue: dataInizio },
        /**
         * La banca dati nutrizionale (11/8). Di default risponde «nessun alimento trovato»: la
         * grande maggioranza di questi test non parla di cibo, e un finto che trova sempre qualcosa
         * cambierebbe il comportamento di tutta la suite.
         */
        {
          provide: ValoriNutrizionaliService,
          useValue: {
            schedaPerRisposta: jest.fn().mockResolvedValue({ trovati: [], righe: [], numeriAmmessi: [], fonti: [], mancanti: [] }),
            registraMancante: jest.fn().mockResolvedValue(undefined),
          },
        },
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

  // ---------- L'altro dialogo guidato: la DATA DI INIZIO (richiesta del 10/8) ----------

  /**
   * In dashboard, chi ha comprato con una data futura legge «se vuoi cambiare la data di inizio,
   * chiedi a Gaia in chat». Questi test tengono ferma la parte di cablaggio: che la frase apra il
   * dialogo giusto, che lo stato si riprenda, e che i due dialoghi guidati non si rubino i turni.
   */
  describe('data di inizio piano concordata in chat', () => {
    beforeEach(() => {
      prisma.chatThread.findUnique.mockResolvedValue({ id: 't-ai', clientId: 'client-1', counterpart: 'ai' });
    });

    it('«posso cambiare la data di inizio?» apre il dialogo della data', async () => {
      const res: any = await service.postMessage(client, 't-ai', 'posso cambiare la data di inizio?');
      expect(dataInizio.apriDaTesto).toHaveBeenCalledWith('client-1', 'posso cambiare la data di inizio?');
      expect(sostituzione.apriDaTesto).not.toHaveBeenCalled();
      expect(res.aiReply.meta.kind).toBe('data_inizio');
      expect(res.aiReply.meta.dataInizio.passo).toBe('data');
    });

    it('con il dialogo aperto la risposta lo fa avanzare', async () => {
      prisma.message.findFirst.mockResolvedValue({
        meta: { dataInizio: { passo: 'data', tentativi: 0 } },
        sentAt: new Date(),
      });
      const res: any = await service.postMessage(client, 't-ai', 'lunedì');
      expect(dataInizio.avanza).toHaveBeenCalledWith('client-1', { passo: 'data', tentativi: 0 }, 'lunedì');
      expect(res.aiReply.meta.dataInizio.passo).toBe('conferma');
    });

    /**
     * I due dialoghi guidati non si rubano i turni: se è aperto quello della sostituzione, la
     * cliente sta rispondendo a un'altra domanda — e una frase che *somiglia* a un intento sulla
     * data non deve buttare via il dialogo a metà.
     */
    it('con la sostituzione aperta il dialogo della data non si apre', async () => {
      prisma.message.findFirst.mockResolvedValue({
        meta: { sost: { passo: 'motivo', tentativi: 0 } },
        sentAt: new Date(),
      });
      await service.postMessage(client, 't-ai', 'vorrei spostare la data di inizio');
      expect(dataInizio.apriDaTesto).not.toHaveBeenCalled();
      expect(sostituzione.avanza).toHaveBeenCalled();
    });

    it('un dialogo della data lasciato a metà ieri non risuscita', async () => {
      prisma.message.findFirst.mockResolvedValue({
        meta: { dataInizio: { passo: 'conferma', data: '2026-09-15' } },
        sentAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
      });
      await service.postMessage(client, 't-ai', 'sì');
      expect(dataInizio.avanza).not.toHaveBeenCalled();
    });

    it('a piano già partito il messaggio finisce nel thread della coach', async () => {
      dataInizio.apriDaTesto.mockResolvedValue({
        testo: 'Il tuo piano è già cominciato…',
        inoltraA: 'coach',
        esito: 'arresa',
      });
      const res: any = await service.postMessage(client, 't-ai', 'posso cambiare la data di inizio?');
      const inoltrato = prisma.message.create.mock.calls.find((c: any) => c[0].data.meta?.forwardedFrom === 'ai');
      expect(inoltrato[0].data.threadId).toBe('th-coach');
      expect(inoltrato[0].data.meta.motivo).toBe('data_inizio');
      expect(res.aiReply.meta.dataInizio).toBeUndefined();
    });

    it('quando la data viene applicata resta una riga di tracciatura', async () => {
      prisma.message.findFirst.mockResolvedValue({
        meta: { dataInizio: { passo: 'conferma', data: '2026-09-15' } },
        sentAt: new Date(),
      });
      dataInizio.avanza.mockResolvedValue({
        testo: 'Fatto: si parte martedì 15 settembre.',
        esito: 'applicata',
        applicata: { da: '2026-09-01', a: '2026-09-15', subscriptionId: 'sub-1' },
      });
      await service.postMessage(client, 't-ai', 'sì');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'chat.data_inizio_applicata',
          metadata: expect.objectContaining({ a: '2026-09-15' }),
        }),
      );
    });

    it('una FAQ vera non viene dirottata dal dialogo della data aperto', async () => {
      prisma.message.findFirst.mockResolvedValue({
        meta: { dataInizio: { passo: 'data', tentativi: 0 } },
        sentAt: new Date(),
      });
      const res: any = await service.postMessage(client, 't-ai', 'quando si sblocca il nuovo menu?');
      expect(dataInizio.avanza).not.toHaveBeenCalled();
      expect(res.aiReply.meta.matchedFaq).toBe('menu_sblocco');
    });

    it('una conversazione normale non entra nel dialogo della data', async () => {
      await service.postMessage(client, 't-ai', 'quando inizio a vedere i risultati?');
      expect(dataInizio.apriDaTesto).not.toHaveBeenCalled();
      expect(dataInizio.avanza).not.toHaveBeenCalled();
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
     * LA LETTURA RISALE LA RETE (11/8). «Perché la responsabile delle coach non vede le chat? I
     * permessi di lettura devono risalire la rete, quindi coach, coordinatrice, responsabile.»
     *
     * Prima il controllo pretendeva che l'attore fosse **la coach assegnata**, cosa che una
     * coordinatrice non è mai: su ogni cliente della sua rete leggeva «il tuo ruolo non può leggere
     * le conversazioni di questa cliente». Il ruolo era nell'elenco, la condizione era sbagliata.
     */
    it('la COORDINATRICE legge il thread di una cliente della coach sotto di lei', async () => {
      prisma.chatThread.findUnique.mockResolvedValue({ id: 't-ai', clientId: 'client-1', counterpart: 'ai' });
      await expect(service.listMessages(coordinatrice, 't-ai')).resolves.toBeDefined();
    });

    it('e la RESPONSABILE anche: la rete si risale per intero, non un livello solo', async () => {
      // `staff-resp` → `staff-coord` → `staff-c`: due salti. Col vecchio codice (un livello) la
      // responsabile era cieca proprio sulle clienti che il suo ruolo esiste per seguire.
      prisma.chatThread.findUnique.mockResolvedValue({ id: 't-ai', clientId: 'client-1', counterpart: 'ai' });
      await expect(service.listMessages(responsabile, 't-ai')).resolves.toBeDefined();
    });

    it('la coordinatrice legge anche il thread con la COACH della sua rete', async () => {
      prisma.chatThread.findUnique.mockResolvedValue({ id: 't-coach', clientId: 'client-1', counterpart: 'coach' });
      await expect(service.listMessages(coordinatrice, 't-coach')).resolves.toBeDefined();
    });

    it('ma NON legge una cliente fuori dalla sua rete: risalire non vuol dire vedere tutto', async () => {
      prisma.chatThread.findUnique.mockResolvedValue({ id: 't-ai', clientId: 'client-1', counterpart: 'ai' });
      prisma.clientProfile.findUnique.mockResolvedValue({ assignedCoachId: 'staff-ESTRANEO', assignedNutritionistId: null });
      await expect(service.listMessages(coordinatrice, 't-ai')).rejects.toThrow(ForbiddenException);
    });

    /**
     * E QUI IL LIMITE: risale la **lettura**, non la scrittura. Una coordinatrice che scrive nel
     * thread «Coach» farebbe comparire alla cliente un messaggio che sembra della sua coach.
     */
    it('la coordinatrice NON scrive nel thread coach di una cliente che non è sua', async () => {
      prisma.chatThread.findUnique.mockResolvedValue({ id: 't-coach', clientId: 'client-1', counterpart: 'coach' });
      await expect(service.postMessage(coordinatrice, 't-coach', 'ciao')).rejects.toThrow(ForbiddenException);
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
     * L'ADMIN LEGGE TUTTO — deciso da Simone l'8/8 vedendo «Nessuna conversazione visibile per il
     * tuo ruolo» nella scheda mentre era admin.
     *
     * Qui prima c'era il test opposto, e la ragione era buona: `pages.ts` nega all'admin
     * `health_documents` con la nota «note cliniche riservate», e nel thread con Gaia c'è
     * esattamente quel materiale. Ma il difetto era più grande della sola scelta clinica: l'admin
     * non era gestito affatto e cadeva sul «Nessuna scheda staff», quindi non vedeva NEMMENO le
     * conversazioni con la coach. Restano due limiti, e questi test li tengono fermi: l'admin
     * **legge e non scrive**, e la manager delle coach resta fuori dal clinico.
     */
    it('l\'admin LEGGE il thread con Gaia', async () => {
      prisma.chatThread.findUnique.mockResolvedValue({ id: 't-ai', clientId: 'client-1', counterpart: 'ai' });
      await expect(service.listMessages(admin, 't-ai')).resolves.toBeDefined();
    });

    it('l\'admin vede TUTTI i thread in scheda, anche quelli di una cliente che non è sua', async () => {
      // Nessuna assegnazione che lo riguardi: per l'admin non conta, e il vecchio codice si fermava
      // prima ancora di arrivare a guardarla.
      prisma.clientProfile.findUnique.mockResolvedValue({ assignedCoachId: 'staff-ALTRO', assignedNutritionistId: 'staff-ALTRO' });
      prisma.chatThread.findMany.mockResolvedValue([
        { id: 't-ai', counterpart: 'ai', lastMessageAt: null, _count: { messages: 4 } },
        { id: 't-coach', counterpart: 'coach', lastMessageAt: null, _count: { messages: 2 } },
        { id: 't-nutri', counterpart: 'nutritionist', lastMessageAt: null, _count: { messages: 1 } },
      ]);
      const perAdmin = await service.threadsDiUnCliente(admin, 'client-1');
      expect(perAdmin.map((t) => t.counterpart)).toEqual(['ai', 'coach', 'nutritionist']);
    });

    it('l\'admin NON scrive: leggere è sorveglianza, scrivere sarebbe impersonare', async () => {
      // Un messaggio dell'admin nel thread della coach arriverebbe alla cliente come se fosse
      // della sua coach. Per parlare come qualcun altro c'è l'impersonazione, che è dichiarata.
      prisma.chatThread.findUnique.mockResolvedValue({ id: 't-coach', clientId: 'client-1', counterpart: 'coach' });
      await expect(service.postMessage(admin, 't-coach', 'ciao')).rejects.toThrow(ForbiddenException);
    });

    it('ogni lettura dello staff lascia una traccia; quella della cliente no', async () => {
      // È la contropartita dell'accesso ampio: se l'admin può leggere tutto, si deve poter sapere
      // che l'ha fatto. La cliente che rilegge la propria chat non va tracciata: sarebbe rumore.
      prisma.chatThread.findUnique.mockResolvedValue({ id: 't-ai', clientId: 'client-1', counterpart: 'ai' });
      audit.log.mockClear();
      await service.listMessages(admin, 't-ai');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'chat.staff_read_messages', actorId: admin.sub }),
      );
      audit.log.mockClear();
      await service.listMessages({ sub: 'client-1', role: 'client' } as never, 't-ai');
      expect(audit.log).not.toHaveBeenCalled();
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

  /**
   * LA VERIFICA di un cambio nato in chat. I due cancelli sono diversi da quelli della lettura, e
   * la differenza è il punto: la coach questi cambi li **legge** — le servono per capire come sta
   * andando — ma non li tocca, perché la grammatura di un piatto è materia clinica e la decide chi
   * se ne prende la responsabilità.
   */
  describe('la nutrizionista verifica un cambio nato in chat', () => {
    const CORREZIONE = {
      data: '2026-08-10',
      slot: 'lunch',
      tipo: 'ingrediente' as const,
      from: 'carote',
      stato: 'corretta' as const,
      to: 'spinaci',
      nota: 'Più ferro.',
    };

    beforeEach(() => {
      prisma.chatThread.findUnique.mockResolvedValue({ id: 't-ai', clientId: 'client-1', counterpart: 'ai' });
    });

    it('la nutrizionista assegnata corregge, e la cliente viene avvisata', async () => {
      const esito = await service.correggiCambioInChatPerStaff(nutri, 'client-1', CORREZIONE);
      expect(esito.stato).toBe('corretta');
      expect(sostituzione.correggiCambioInChat).toHaveBeenCalledWith('client-1', 'nutri-user', CORREZIONE);
      // La cliente aveva concordato qualcosa con Gaia: se il piatto non è quello, lo deve sapere
      // da noi e non scoprirlo aprendo il menu.
      expect(notifications.notify).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'client-1', type: 'menu_cambio_verificato' }),
      );
    });

    it('la COACH non tocca un cambio, nemmeno delle sue clienti', async () => {
      await expect(service.correggiCambioInChatPerStaff(coach, 'client-1', CORREZIONE)).rejects.toThrow(
        ForbiddenException,
      );
      expect(sostituzione.correggiCambioInChat).not.toHaveBeenCalled();
    });

    /**
     * Il secondo cancello: il ruolo giusto non basta, serve anche che la cliente sia sua. Senza
     * questo, una nutrizionista qualunque potrebbe riscrivere i grammi di una paziente non sua.
     */
    it('una nutrizionista di un\'altra cliente non passa', async () => {
      prisma.clientProfile.findUnique.mockResolvedValue({ assignedNutritionistId: 'staff-ALTRO' });
      await expect(service.correggiCambioInChatPerStaff(nutri, 'client-1', CORREZIONE)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('l\'admin può, e resta la riga di tracciatura', async () => {
      await service.correggiCambioInChatPerStaff(admin, 'client-1', CORREZIONE);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'chat.cambio_verificato' }),
      );
    });

    /** «Va bene così» non è una notizia: notificarla insegnerebbe a ignorare queste notifiche. */
    it('la semplice conferma non disturba la cliente', async () => {
      await service.correggiCambioInChatPerStaff(nutri, 'client-1', { ...CORREZIONE, stato: 'verificata' });
      expect(notifications.notify).not.toHaveBeenCalled();
    });
  });

});

/**
 * LA GUARDIA IN USCITA, DENTRO IL GIRO VERO (basmati, 11/8).
 *
 * `guardia-risposta-ai.spec.ts` prova la funzione; qui si prova che **serve a qualcosa**: la
 * risposta del modello non arriva alla cliente, la domanda parte verso la NUTRIZIONISTA (non la
 * coach, che è dove finiscono le domande generiche) e la frase scartata resta scritta nel `meta`,
 * altrimenti non sapremmo mai quante volte è scattata né perché.
 */
describe('ChatService — quando Gaia inventa un dato nutrizionale', () => {
  const FRASE_DEL_BASMATI =
    "Il riso basmati è più raffinato e ha un indice glicemico più alto rispetto all'integrale, quindi sazia meno.";

  const monta = async (rispostaAi: string) => {
    const prisma: any = {
      chatThread: {
        upsert: jest.fn().mockImplementation(({ create }: any) => Promise.resolve({ id: 'th-' + create.counterpart, ...create })),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue({ id: 't-ai', clientId: 'client-1', counterpart: 'ai' }),
        update: jest.fn(),
      },
      message: {
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'm1', ...data })),
        findMany: jest.fn().mockResolvedValue([]),
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
          Promise.resolve(where.userId === 'coach-user' ? { id: 'staff-c' } : { id: 'staff-n' }),
        ),
        findMany: jest.fn().mockResolvedValue([]),
      },
      user: { findUnique: jest.fn().mockResolvedValue({ locale: 'it' }) },
      escalation: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
    };
    const notifications = { notifyOncePerDay: jest.fn().mockResolvedValue(true), notify: jest.fn().mockResolvedValue(undefined) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
        { provide: AuditService, useValue: { log: jest.fn().mockResolvedValue(undefined) } },
        {
          provide: AiService,
          useValue: {
            assistantEnabled: jest.fn().mockResolvedValue(true),
            assistantReply: jest.fn().mockResolvedValue(rispostaAi),
          },
        },
        {
          provide: SostituzioneChatService,
          useValue: {
            apri: jest.fn(), apriDaTesto: jest.fn(), avanza: jest.fn(),
            sostituzioniDiChat: jest.fn().mockResolvedValue([]), correggiCambioInChat: jest.fn(),
          },
        },
        { provide: DataInizioChatService, useValue: { apriDaTesto: jest.fn(), avanza: jest.fn() } },
        {
          provide: ValoriNutrizionaliService,
          useValue: {
            schedaPerRisposta: jest.fn().mockResolvedValue({ trovati: [], righe: [], numeriAmmessi: [], fonti: [], mancanti: [] }),
            registraMancante: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();
    return { service: moduleRef.get(ChatService), prisma, notifications };
  };

  it('la frase inventata NON arriva alla cliente', async () => {
    const { service } = await monta(FRASE_DEL_BASMATI);
    const r: any = await service.postMessage(client, 't-ai', 'mi dai una carica per oggi?');
    expect(r.aiReply.body).not.toContain('indice glicemico');
    expect(r.aiReply.body).toContain('nutrizionista');
  });

  it('la domanda va alla NUTRIZIONISTA, non alla coach', async () => {
    const { service, prisma, notifications } = await monta(FRASE_DEL_BASMATI);
    const r: any = await service.postMessage(client, 't-ai', 'mi dai una carica per oggi?');
    expect(r.aiReply.meta.routedTo).toBe('nutritionist');
    const inoltrato = prisma.message.create.mock.calls.find((c: any) => c[0].data.meta?.forwardedFrom === 'ai');
    expect(inoltrato[0].data.threadId).toBe('th-nutritionist');
    expect(notifications.notifyOncePerDay).toHaveBeenCalledWith(expect.objectContaining({ userId: 'nutri-user' }));
  });

  it('resta la traccia di cosa è stato scartato e perché', async () => {
    const { service } = await monta(FRASE_DEL_BASMATI);
    const r: any = await service.postMessage(client, 't-ai', 'mi dai una carica per oggi?');
    expect(r.aiReply.meta.composer).toBe('guardia');
    expect(r.aiReply.meta.aiScartata.testo).toContain('basmati');
    expect(r.aiReply.meta.aiScartata.motivo).toBeTruthy();
  });

  it('una risposta pulita passa come sempre: la guardia non spegne Gaia', async () => {
    const { service, prisma } = await monta('Trovi il menu di domani nella sezione Menu, si apre la sera prima.');
    const r: any = await service.postMessage(client, 't-ai', 'mi dai una carica per oggi?');
    expect(r.aiReply.body).toContain('sezione Menu');
    expect(r.aiReply.meta.composer).toBe('ai');
    expect(r.aiReply.meta.routedTo).toBeUndefined();
    expect(prisma.message.create.mock.calls.find((c: any) => c[0].data.meta?.forwardedFrom === 'ai')).toBeUndefined();
  });
});

/**
 * LA DOMANDA DEL BASMATI, RIFATTA CON I DATI (11/8, seconda decisione).
 *
 * Il 1° agosto la cliente ha chiesto «posso sostituire il riso integrale con basmati?» e Gaia ha
 * risposto a memoria, sbagliando il verso del confronto. Questo test rifà la stessa domanda con la
 * banca dati collegata, e verifica le tre cose che devono succedere: i dati si cercano PRIMA di far
 * parlare il modello, gli vengono messi davanti, e la risposta passa solo se contiene quei numeri.
 */
describe('ChatService — la domanda nutrizionale con la banca dati', () => {
  const SCHEDA = {
    trovati: [{ name: 'riso basmati' }, { name: 'riso integrale' }],
    righe: [
      "l'indice glicemico del/della riso basmati sta fra 57 e 67 [International Tables 2008]",
      "l'indice glicemico del/della riso integrale sta fra 50 e 68 [International Tables 2021]",
    ],
    numeriAmmessi: [57, 67, 50, 68],
    fonti: ['International Tables 2008', 'International Tables 2021'],
    mancanti: [],
  };

  const monta = async (rispostaAi: string, scheda: unknown = SCHEDA) => {
    const prisma: any = {
      chatThread: {
        upsert: jest.fn().mockImplementation(({ create }: any) => Promise.resolve({ id: 'th-' + create.counterpart, ...create })),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue({ id: 't-ai', clientId: 'client-1', counterpart: 'ai' }),
        update: jest.fn(),
      },
      message: {
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'm1', ...data })),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      clientProfile: {
        findUnique: jest.fn().mockResolvedValue({
          assignedCoachId: 'staff-c', assignedNutritionistId: 'staff-n',
          assignedCoach: { userId: 'coach-user', displayName: 'Marta' },
          assignedNutritionist: { userId: 'nutri-user', displayName: 'Dr.ssa Bini' },
        }),
      },
      staff: { findUnique: jest.fn().mockResolvedValue({ id: 'staff-n' }), findMany: jest.fn().mockResolvedValue([]) },
      user: { findUnique: jest.fn().mockResolvedValue({ locale: 'it' }) },
      escalation: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
    };
    const ai = {
      assistantEnabled: jest.fn().mockResolvedValue(true),
      assistantReply: jest.fn().mockResolvedValue(rispostaAi),
    };
    const valori = {
      schedaPerRisposta: jest.fn().mockResolvedValue(scheda),
      registraMancante: jest.fn().mockResolvedValue(undefined),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: { notifyOncePerDay: jest.fn().mockResolvedValue(true), notify: jest.fn().mockResolvedValue(undefined) } },
        { provide: AuditService, useValue: { log: jest.fn().mockResolvedValue(undefined) } },
        { provide: AiService, useValue: ai },
        { provide: SostituzioneChatService, useValue: { apri: jest.fn(), apriDaTesto: jest.fn(), avanza: jest.fn(), sostituzioniDiChat: jest.fn().mockResolvedValue([]), correggiCambioInChat: jest.fn() } },
        { provide: DataInizioChatService, useValue: { apriDaTesto: jest.fn(), avanza: jest.fn() } },
        { provide: ValoriNutrizionaliService, useValue: valori },
      ],
    }).compile();
    return { service: moduleRef.get(ChatService), ai, valori, prisma };
  };

  /** Una domanda nutrizionale che NON è una richiesta di sostituzione (quella apre il dialogo guidato). */
  const DOMANDA = 'il riso basmati ha un indice glicemico più basso del riso integrale?';

  it('i dati si cercano prima, e finiscono davanti al modello', async () => {
    const { service, ai, valori } = await monta('L\'indice glicemico del basmati sta fra 57 e 67, quello dell\'integrale fra 50 e 68: sono vicini.');
    await service.postMessage(client, 't-ai', DOMANDA);
    expect(valori.schedaPerRisposta).toHaveBeenCalledWith(DOMANDA);
    // Terzo argomento: la scheda. Senza, il modello risponderebbe a memoria come il 1° agosto.
    expect(ai.assistantReply).toHaveBeenCalledWith(DOMANDA, 'it', expect.objectContaining({ righe: expect.any(Array) }));
  });

  it('la risposta fondata arriva alla cliente, con le fonti tracciate nel meta', async () => {
    const buona = 'Secondo le tabelle internazionali il basmati sta fra 57 e 67 e l\'integrale fra 50 e 68: sono vicini.';
    const { service } = await monta(buona);
    const r: any = await service.postMessage(client, 't-ai', DOMANDA);
    expect(r.aiReply.body).toBe(buona);
    expect(r.aiReply.meta.composer).toBe('ai');
    expect(r.aiReply.meta.datiNutrizionali.fonti.length).toBe(2);
  });

  it('se il modello aggiunge un numero suo, la risposta NON parte', async () => {
    // 58 non è fra i numeri della scheda: è tornato a ricordare invece di citare.
    const { service } = await monta('L\'indice glicemico del basmati è 58, più basso dell\'integrale.');
    const r: any = await service.postMessage(client, 't-ai', DOMANDA);
    expect(r.aiReply.body).toContain('nutrizionista');
    expect(r.aiReply.meta.composer).toBe('guardia');
    expect(r.aiReply.meta.aiScartata.motivo).toContain('non presenti nei dati forniti');
  });

  it('alimento che non abbiamo: si registra fra i mancanti e la domanda va alla nutrizionista', async () => {
    const vuota = { trovati: [], righe: [], numeriAmmessi: [], fonti: [], mancanti: [] };
    const { service, valori, ai } = await monta('Il tempeh ha circa 190 kcal.', vuota);
    const r: any = await service.postMessage(client, 't-ai', 'quante calorie ha il tempeh?');
    // È così che la tabella cresce: guidata dalle domande vere.
    expect(valori.registraMancante).toHaveBeenCalled();
    // Senza dati il modello NON riceve la scheda, e la sua risposta con numeri viene fermata.
    expect(ai.assistantReply).toHaveBeenCalledWith('quante calorie ha il tempeh?', 'it', null);
    expect(r.aiReply.meta.composer).toBe('guardia');
    expect(r.aiReply.meta.routedTo).toBe('nutritionist');
  });

  it('una domanda che non è nutrizionale non va a leggere la banca dati', async () => {
    const { service, valori } = await monta('Il menu di domani si apre stasera.');
    await service.postMessage(client, 't-ai', 'quando arriva il menu di domani?');
    expect(valori.schedaPerRisposta).not.toHaveBeenCalled();
  });
});

/**
 * «Chi scrive il messaggio deve poterlo cancellare» (Simone, 11/8).
 *
 * Il test guarda DUE cose: chi può (solo l'autore) e cosa resta (la riga, che non viene distrutta).
 * La seconda è la parte che si perde per prima quando qualcuno, un domani, "semplificherà" questa
 * funzione in un `delete`.
 */
describe('ChatService.eliminaMessaggio', () => {
  const montaConMessaggio = async (msg: Record<string, unknown>) => {
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const prisma: any = {
      chatThread: { findUnique: jest.fn().mockResolvedValue({ id: 'th-1', clientId: 'client-1', counterpart: 'nutritionist' }) },
      message: { findUnique: jest.fn().mockResolvedValue(msg), update: jest.fn().mockResolvedValue({}) },
      clientProfile: {
        findUnique: jest.fn().mockResolvedValue({
          assignedCoachId: 'staff-c', assignedNutritionistId: 'staff-n',
          assignedCoach: { userId: 'coach-user', displayName: 'Marta' },
          assignedNutritionist: { userId: 'nutri-user', displayName: 'Dr.ssa Bini' },
        }),
      },
      // La nutrizionista dei test È quella assegnata: senza questo la scheda staff manca e
      // `assertThreadAccess` ferma tutto prima ancora di arrivare alla regola che si vuole provare.
      staff: {
        findUnique: jest.fn().mockResolvedValue({ id: 'staff-n', userId: 'nutri-user' }),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const mod = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: prisma },
        { provide: AiService, useValue: { chat: jest.fn() } },
        { provide: AuditService, useValue: audit },
        { provide: NotificationsService, useValue: { notifyOncePerDay: jest.fn(), notify: jest.fn() } },
        { provide: SostituzioneChatService, useValue: {} },
        { provide: DataInizioChatService, useValue: {} },
        { provide: ValoriNutrizionaliService, useValue: {} },
      ],
    }).compile();
    return { service: mod.get(ChatService), prisma, audit };
  };

  it('l’autore cancella il suo: nessun DELETE, solo deletedAt e chi è stato', async () => {
    const { service, prisma, audit } = await montaConMessaggio({
      id: 'm1', threadId: 'th-1', senderUserId: 'nutri-user', deletedAt: null,
    });
    const res = await service.eliminaMessaggio(nutri, 'th-1', 'm1');
    expect(res).toEqual({ ok: true, giaCancellato: false });
    // Morbida: la conversazione clinica non si distrugge, si nasconde.
    expect(prisma.message.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'm1' }, data: expect.objectContaining({ deletedById: 'nutri-user' }) }),
    );
    expect((prisma.message.update as jest.Mock).mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'chat.message_deleted' }));
  });

  it('il messaggio di un ALTRO non si tocca — nemmeno dall’admin', async () => {
    const { service, prisma } = await montaConMessaggio({
      id: 'm1', threadId: 'th-1', senderUserId: 'nutri-user', deletedAt: null,
    });
    // Moderare quello che ha scritto una collega è un'altra funzione, con altre conseguenze.
    await expect(service.eliminaMessaggio(admin, 'th-1', 'm1')).rejects.toThrow(ForbiddenException);
    expect(prisma.message.update).not.toHaveBeenCalled();
  });

  it('cancellare due volte non è un errore: chi ha cliccato due volte voleva la stessa cosa', async () => {
    const { service, prisma } = await montaConMessaggio({
      id: 'm1', threadId: 'th-1', senderUserId: 'nutri-user', deletedAt: new Date(),
    });
    expect(await service.eliminaMessaggio(nutri, 'th-1', 'm1')).toEqual({ ok: true, giaCancellato: true });
    expect(prisma.message.update).not.toHaveBeenCalled();
  });

  it('un messaggio di un altro thread non si cancella passando dall’id sbagliato', async () => {
    const { service } = await montaConMessaggio({
      id: 'm1', threadId: 'th-ALTRO', senderUserId: 'nutri-user', deletedAt: null,
    });
    await expect(service.eliminaMessaggio(nutri, 'th-1', 'm1')).rejects.toThrow('non trovato');
  });

  it('le letture NON mostrano i cancellati: sparisce per tutti, non solo per chi l’ha scritto', async () => {
    const { service, prisma } = await montaConMessaggio({ id: 'm1', threadId: 'th-1', senderUserId: 'x', deletedAt: null });
    prisma.message.findMany = jest.fn().mockResolvedValue([]);
    await service.listMessages(nutri, 'th-1');
    expect((prisma.message.findMany as jest.Mock).mock.calls[0][0].where).toMatchObject({ deletedAt: null });
  });
});
