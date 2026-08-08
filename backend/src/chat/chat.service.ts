import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import {
  SCADENZA_FLUSSO_MS,
  StatoSostituzione,
  rilevaIntentoSostituzione,
} from '../menu/sostituzione-chat';
import { EsitoSostituzione, SostituzioneChatService } from '../menu/sostituzione-chat.service';
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
    private readonly sostituzione: SostituzioneChatService,
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

  /**
   * Chi può leggere/scrivere in un thread.
   *
   * La distinzione fra `read` e `write` esiste per il thread con Gaia. Coach e nutrizionista
   * devono poter LEGGERE la conversazione con l'assistente — è dove la cliente dice cosa non
   * digerisce e cosa non ha tempo di cucinare, e dove concorda i cambi di menu che il
   * nutrizionista deve verificare (punto 2 di `progetto/PROGETTO_gaia-cambio-menu.md`).
   * SCRIVERCI no: in quel thread la voce è quella di Gaia, e una risposta dello staff
   * travestita da assistente ingannerebbe la cliente. Per parlarle c'è il thread proprio.
   */
  private async assertThreadAccess(
    user: AuthUser,
    thread: { clientId: string; counterpart: string },
    mode: 'read' | 'write' = 'write',
  ) {
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
    const eLaSuaCoach = profile?.assignedCoachId === staff.id;
    const eLaSuaNutrizionista = profile?.assignedNutritionistId === staff.id;

    if ((user.role === 'coach' || user.role === 'coach_coordinator') && thread.counterpart === 'coach' && eLaSuaCoach) return;
    if (user.role === 'nutritionist' && thread.counterpart === 'nutritionist' && eLaSuaNutrizionista) return;
    if (user.role === 'head_nutritionist' && thread.counterpart === 'nutritionist') return;

    // Il thread con Gaia: SOLO le due persone che seguono la cliente, e il capo nutrizionista
    // che risponde di loro. **L'admin no**, per la stessa ragione per cui `pages.ts` gli nega
    // `health_documents`: là dentro ci sono sintomi, gravidanza, farmaci — tutto quello che il
    // filtro classifica come sensibile resta scritto nel thread. Un permesso amministrativo non
    // è un permesso clinico.
    if (thread.counterpart === 'ai' && mode === 'read') {
      if ((user.role === 'coach' || user.role === 'coach_coordinator') && eLaSuaCoach) return;
      if (user.role === 'nutritionist' && eLaSuaNutrizionista) return;
      if (user.role === 'head_nutritionist') return;
    }
    throw new ForbiddenException('Non hai accesso a questo thread');
  }

  async listMessages(user: AuthUser, threadId: string) {
    const thread = await this.getThread(threadId);
    await this.assertThreadAccess(user, thread, 'read');
    return this.prisma.message.findMany({
      where: { threadId },
      orderBy: { sentAt: 'asc' },
      take: 200,
    });
  }

  /**
   * Le conversazioni di UNA cliente per la scheda in backoffice, thread con Gaia compreso.
   * `/staff/threads` non basta: è filtrato per ruolo sul `counterpart` e non accetta un
   * cliente, quindi la scheda non aveva modo di chiedere «le chat di questa persona».
   */
  async threadsDiUnCliente(user: AuthUser, clientId: string) {
    const threads = await this.prisma.chatThread.findMany({
      where: { clientId },
      orderBy: { counterpart: 'asc' },
      include: { _count: { select: { messages: true } } },
    });
    const nomi: Record<string, string> = {
      ai: 'Gaia (assistente)',
      coach: 'Coach',
      nutritionist: 'Nutrizionista',
    };
    const visibili: {
      id: string;
      counterpart: string;
      counterpartName: string;
      lastMessageAt: Date | null;
      messageCount: number;
    }[] = [];
    for (const t of threads) {
      try {
        await this.assertThreadAccess(user, t, 'read');
      } catch {
        continue; // un thread non leggibile da questo ruolo semplicemente non compare
      }
      visibili.push({
        id: t.id,
        counterpart: t.counterpart,
        counterpartName: nomi[t.counterpart] ?? t.counterpart,
        lastMessageAt: t.lastMessageAt,
        messageCount: t._count.messages,
      });
    }
    if (visibili.length) {
      await this.audit.log({
        action: 'chat.staff_read_client_threads',
        actorId: user.sub,
        entityType: 'user',
        entityId: clientId,
        metadata: { threads: visibili.map((v) => v.counterpart) },
      });
    }
    return visibili;
  }

  /**
   * I cambi di menu concordati in chat, per la scheda cliente.
   *
   * Passa da qui e non diretto al servizio del menu perché **serve un controllo di
   * appartenenza**, e questo è il posto che ce l'ha. Senza, una coach sarebbe bastata a
   * chiedere `GET /staff/clients/<id di una cliente non sua>/sostituzioni-chat` e a leggersi
   * giorno, piatto, grammature e il **motivo dichiarato** — dove «mi resta sullo stomaco» è un
   * dato sanitario. `@RequirePage('clients')` controlla la matrice ruolo×pagina, non la portata:
   * è la stessa distinzione per cui `clients.service` ha `assertClientAccess`.
   *
   * Il permesso richiesto è esattamente quello del thread con Gaia: questi cambi nascono là.
   */
  async sostituzioniDiChatPerStaff(user: AuthUser, clientId: string) {
    const thread = await this.prisma.chatThread.findUnique({
      where: { clientId_counterpart: { clientId, counterpart: 'ai' as never } },
    });
    // Nessun thread con Gaia = nessuna conversazione, quindi nessun cambio. Si verifica comunque
    // la portata su una controparte finta, per non rispondere «vuoto» a chi non deve chiedere.
    await this.assertThreadAccess(user, thread ?? { clientId, counterpart: 'ai' }, 'read');
    return this.sostituzione.sostituzioniDiChat(clientId);
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

    // --- Il ponte col menu: cambio piatto concordato in chat ---
    // Dopo il filtro dei temi sensibili — la sicurezza non si scavalca mai — e prima di tutto
    // il resto: una conversazione di sostituzione già aperta ha la precedenza sull'inoltro
    // alla coach, altrimenti la risposta «le carote» finirebbe in un thread umano a metà
    // dialogo, e la cliente resterebbe senza il cambio e senza risposta.
    if (result.kind !== 'sensitive') {
      const daSostituzione = await this.gestisciSostituzione(clientId, threadId, body, result.kind);
      if (daSostituzione) return daSostituzione;
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

  // ---------- Cambio piatto in chat (ponte col menu) ----------

  /**
   * Apertura dal pulsante «Sostituisci un ingrediente» dell'app: Gaia scrive il primo
   * messaggio del dialogo, senza che la cliente debba spiegare da capo cosa vuole fare.
   */
  async avviaSostituzione(clientId: string) {
    const thread = await this.prisma.chatThread.upsert({
      where: { clientId_counterpart: { clientId, counterpart: 'ai' as never } },
      create: { clientId, counterpart: 'ai' as never },
      update: {},
    });
    const esito = await this.sostituzione.apri(clientId);
    const message = await this.scriviEsitoSostituzione(clientId, thread.id, null, esito);
    return { threadId: thread.id, message };
  }

  /**
   * Se c'è un dialogo di sostituzione in corso lo fa avanzare; se non c'è, lo apre solo
   * quando il testo dice esplicitamente di volerne una. Restituisce `null` quando non c'entra
   * niente, e la chat continua come sempre.
   */
  private async gestisciSostituzione(
    clientId: string,
    threadId: string,
    body: string,
    kind: string,
  ) {
    let esito: EsitoSostituzione;
    const stato = await this.statoSostituzione(threadId);
    if (stato) {
      // Il dialogo si apre col solo tocco del pulsante, e resta aperto un'ora: se la cliente
      // cambia idea e fa una domanda vera, quella domanda deve avere la sua risposta. Senza
      // questa uscita, «quando si sblocca il prossimo menu?» al passo dell'alimento riceveva
      // «non lo trovo fra gli ingredienti di oggi» — con la FAQ giusta a un centimetro di
      // distanza — e alla seconda domanda il dialogo si arrendeva girandola alla coach.
      // Vale solo al primo passo: dopo, le risposte sono brevi e non somigliano a domande.
      if (kind === 'faq' && stato.passo === 'cibo') return null;
      esito = await this.sostituzione.avanza(clientId, stato, body);
    } else if (rilevaIntentoSostituzione(body)) {
      esito = await this.sostituzione.apriDaTesto(clientId, body);
    } else {
      return null;
    }
    return this.scriviEsitoSostituzione(clientId, threadId, body, esito);
  }

  /**
   * Stato del dialogo, letto dal `meta` dell'ULTIMO messaggio di Gaia: nessuna tabella nuova,
   * nessuna migrazione. Guardare solo l'ultimo, e non il più recente che ne abbia uno, è
   * quello che impedisce a un dialogo abbandonato di risuscitare tre messaggi dopo.
   */
  private async statoSostituzione(threadId: string): Promise<StatoSostituzione | null> {
    const ultimo = await this.prisma.message.findFirst({
      where: { threadId, senderRole: 'ai' },
      orderBy: { sentAt: 'desc' },
      select: { meta: true, sentAt: true },
    });
    if (!ultimo) return null;
    const stato = (ultimo.meta as { sost?: StatoSostituzione } | null)?.sost;
    if (!stato?.passo) return null;
    // Una conversazione lasciata a metà ieri non è una conversazione in corso.
    if (Date.now() - ultimo.sentAt.getTime() > SCADENZA_FLUSSO_MS) return null;
    return stato;
  }

  /** Scrive la risposta di Gaia, con lo stato del dialogo nel `meta`, e gestisce le uscite. */
  private async scriviEsitoSostituzione(
    clientId: string,
    threadId: string,
    body: string | null,
    esito: EsitoSostituzione,
  ) {
    const meta: Record<string, unknown> = { kind: 'sostituzione', esitoSostituzione: esito.esito };
    if (esito.stato) meta.sost = esito.stato;
    if (esito.applicata) meta.applicata = esito.applicata;

    // Il flusso si è arreso o ha passato la mano: il messaggio della cliente va nel thread
    // della persona giusta, così lo staff lo trova nel proprio contesto invece di doverlo
    // andare a cercare nella chat con l'assistente.
    if (esito.inoltraA && body) {
      meta.routedTo = esito.inoltraA;
      const target = await this.prisma.chatThread.upsert({
        where: { clientId_counterpart: { clientId, counterpart: esito.inoltraA as never } },
        create: { clientId, counterpart: esito.inoltraA as never },
        update: { lastMessageAt: new Date() },
      });
      await this.prisma.message.create({
        data: {
          threadId: target.id,
          senderRole: 'client',
          senderUserId: clientId,
          body,
          meta: { forwardedFrom: 'ai', motivo: 'cambio_piatto' } as never,
        },
      });
      await this.notifyCounterpartStaff(clientId, esito.inoltraA);
    }

    const message = await this.prisma.message.create({
      data: { threadId, senderRole: 'ai', body: esito.testo, meta: meta as never },
    });
    await this.prisma.chatThread.update({
      where: { id: threadId },
      data: { lastMessageAt: new Date() },
    });
    if (esito.esito === 'applicata') {
      await this.audit.log({
        action: 'chat.sostituzione_applicata',
        actorId: clientId,
        entityType: 'chat_thread',
        entityId: threadId,
        metadata: { ...esito.applicata, messageId: message.id },
      });
    }
    return message;
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
