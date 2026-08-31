import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { StatoAllergie } from './allergie-chat';
import { AllergieChatService, EsitoAllergie } from './allergie-chat.service';
import { rilevaIntentoAltroPiatto } from '../menu/cambio-piatto';
import { StatoDataInizio, rilevaIntentoDataInizio } from '../menu/data-inizio-chat';
import { DataInizioChatService, EsitoDataInizio } from '../menu/data-inizio-chat.service';
import {
  SCADENZA_FLUSSO_MS,
  StatoSostituzione,
  rilevaIntentoSostituzione,
} from '../menu/sostituzione-chat';
import {
  GIORNI_ALL_INDIETRO,
  ORE_DI_SILENZIO,
  testoChiusuraPerSilenzio,
  vaChiusa,
} from '../menu/conversazione-lasciata-a-meta';
import { ConfigParamsService } from '../config-params/config-params.service';
import {
  CorrezioneCambio,
  EsitoSostituzione,
  SostituzioneChatService,
} from '../menu/sostituzione-chat.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { copreQuestoStaff } from '../common/rete-staff';
import { ValoriNutrizionaliService } from '../nutrient-facts/valori-nutrizionali.service';
import { ruoloPuo } from '../permissions/permesso-di-ruolo';
import { capiNutrizionisti } from '../common/avvisa-nutrizionista';
import { diagnosiAvvisoChat } from './diagnosi-avviso-chat';
import { imparaDalNutrizionista } from '../food-swaps/impara-dal-nutrizionista';
import { classifyMessage } from './ai-filter';
import { RISPOSTA_FERMATA, verificaRispostaGaia } from './guardia-risposta-ai';
import { domandaNutrizionale, terminiAlimentoCandidati } from './domanda-nutrizionale';
import { giornoLocale } from '../common/date-only';
import { contestoPerLoStaff } from '../menu/sostituzione-chat';

type Counterpart = 'ai' | 'coach' | 'nutritionist';

/**
 * Quante conversazioni lasciate a metà si chiudono in un giro. Non è un limite di prestazioni: è
 * che il primo giro dopo il rilascio trova tutto l'arretrato, e cento messaggi di Gaia nello stesso
 * minuto sono un evento, non una chiusura. Le altre le prende il giro di domani.
 */
const MASSIMO_CHIUSURE_PER_GIRO = 100;

/**
 * Chat (spec sez. 5): un thread per controparte. L'assistente AI risponde
 * subito da filtro deterministico; coach e nutrizionista rispondono nei loro
 * thread. Temi sensibili → escalation automatica al nutrizionista.
 */
/**
 * I passi del dialogo di sostituzione in cui una FAQ vera **non** viene dirottata: sono quelli in
 * cui Gaia ha appena fatto una domanda lunga, e la cliente può ancora cambiare argomento senza che
 * sembri una risposta. Vedi il commento nel punto che la legge.
 */
const PASSI_CON_USCITA_FAQ = new Set(['giorno', 'pasto', 'cibo']);

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly ai: AiService,
    private readonly sostituzione: SostituzioneChatService,
    private readonly dataInizio: DataInizioChatService,
    /** La ri-domanda sulle allergie: §7 dell'handoff, campagna del 13/8. */
    private readonly allergie: AllergieChatService,
    /** La banca dati nutrizionale: i numeri che Gaia può dire vengono da qui (11/8). */
    private readonly valori: ValoriNutrizionaliService,
    /** Le soglie non si scrivono nel codice: `chat_chiusura_silenzio_ore` sta in `config_param`. */
    private readonly configParams: ConfigParamsService,
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
    const thread = (await this.prisma.chatThread.findMany({
      where: where as never,
      /**
       * ⚠️ `nulls: 'last'`, e non è pignoleria. In Postgres `ORDER BY x DESC` mette i **null per
       * primi**: le conversazioni mai iniziate finivano in cima, sopra a chi aveva appena scritto.
       * «Porta sempre in alto le ultime chat arrivate» (Simone, 12/8) è questa riga.
       */
      orderBy: { lastMessageAt: { sort: 'desc', nulls: 'last' } },
      include: {
        client: { select: { id: true, email: true, clientProfile: { select: { name: true } } } },
      },
      take: 100,
    })) as { id: string; lastMessageAt: Date | null }[];

    const daLeggere = await this.daLeggerePerThread(user.sub, thread.map((t) => t.id));
    return thread.map((t) => ({ ...t, daLeggere: daLeggere.has(t.id) }));
  }

  /**
   * IL PALLINO ROSSO — in quali conversazioni la cliente ha scritto dopo l'ultima volta che questa
   * persona le ha aperte.
   *
   * Richiesta di Simone (12/8). ⚠️ Conta **solo quello che ha scritto la cliente**: la propria
   * risposta non è una cosa da leggere, e senza questo filtro il pallino si riaccenderebbe da sé
   * ogni volta che si risponde.
   *
   * ⚠️ Nessuna riga in `chat_read` = **mai letta**, quindi il pallino c'è. È il verso giusto in cui
   * sbagliare: un pallino di troppo costa un tocco, un pallino mancante è un messaggio che nessuno
   * legge più.
   */
  private async daLeggerePerThread(userId: string, threadIds: string[]): Promise<Set<string>> {
    const fuori = new Set<string>();
    if (!threadIds.length) return fuori;
    try {
      const [letture, ultimi] = await Promise.all([
        this.prisma.chatRead.findMany({
          where: { userId, threadId: { in: threadIds } },
          select: { threadId: true, readAt: true },
        }) as Promise<{ threadId: string; readAt: Date }[]>,
        this.prisma.message.groupBy({
          by: ['threadId'],
          where: { threadId: { in: threadIds }, senderRole: 'client', deletedAt: null },
          _max: { sentAt: true },
        }) as unknown as Promise<{ threadId: string; _max: { sentAt: Date | null } }[]>,
      ]);
      const lettoIl = new Map(letture.map((l) => [l.threadId, l.readAt.getTime()]));
      for (const u of ultimi) {
        const quando = u._max.sentAt?.getTime();
        if (!quando) continue;
        if (quando > (lettoIl.get(u.threadId) ?? 0)) fuori.add(u.threadId);
      }
      return fuori;
    } catch {
      // Il pallino è un di più: se questo conto non riesce, l'elenco delle chat si apre lo stesso.
      return fuori;
    }
  }

  /**
   * Segna «letto fino a adesso». Chiamata quando lo staff apre una conversazione.
   *
   * ⚠️ Non lancia mai: leggere i messaggi è la cosa necessaria, ricordarsi che sono stati letti è
   * la cosa utile.
   */
  private async segnaLetto(userId: string, threadId: string): Promise<void> {
    try {
      const adesso = new Date();
      await this.prisma.chatRead.upsert({
        where: { userId_threadId: { userId, threadId } },
        create: { userId, threadId, readAt: adesso },
        update: { readAt: adesso },
      });
    } catch {
      /* il pallino resterà acceso una volta di troppo: è il verso giusto in cui sbagliare */
    }
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
    // L'ADMIN LEGGE TUTTO (decisione di Simone, 8/8). Va PRIMA della ricerca della scheda staff:
    // un admin può non averne una, e senza questo ramo lo fermava il «Nessuna scheda staff» qui
    // sotto — quindi in scheda cliente non vedeva NESSUNA conversazione, nemmeno quelle con la
    // coach, e leggeva «Nessuna conversazione visibile per il tuo ruolo».
    //
    // Resta legato a `mode === 'read'`: **legge, non scrive**. Scrivere nel thread di una coach
    // farebbe comparire alla cliente un messaggio che sembra della sua coach; per parlare come
    // qualcun altro c'è l'impersonazione, che è dichiarata e tracciata.
    //
    // Nota per chi legge fra un anno: qui c'era il ragionamento opposto — l'admin fuori dal thread
    // con Gaia, per la stessa ragione per cui `pages.ts` gli nega `health_documents` (un permesso
    // amministrativo non è un permesso clinico). Ha deciso Simone, e la contropartita è la traccia:
    // ogni apertura di un thread da parte dello staff finisce nell'audit.
    if (user.role === 'admin' && mode === 'read') return;
    const staff = await this.prisma.staff.findUnique({ where: { userId: user.sub } });
    if (!staff) throw new ForbiddenException('Nessuna scheda staff');
    const profile = await this.prisma.clientProfile.findUnique({
      where: { userId: thread.clientId },
      select: { assignedCoachId: true, assignedNutritionistId: true },
    });
    const eLaSuaCoach = profile?.assignedCoachId === staff.id;
    const eLaSuaNutrizionista = profile?.assignedNutritionistId === staff.id;

    /**
     * LA LETTURA RISALE LA RETE (11/8). «Perché la responsabile delle coach non vede le chat? I
     * permessi di lettura devono risalire la rete, quindi coach, coordinatrice, responsabile.»
     *
     * Prima qui si chiedeva che l'attore fosse **la coach assegnata** — cosa che una coordinatrice
     * non è mai — quindi su ogni cliente della sua rete leggeva «il tuo ruolo non può leggere le
     * conversazioni di questa cliente». Il ruolo era nell'elenco, la condizione era quella sbagliata.
     *
     * Ora vale anche per chi sta **sopra** la coach assegnata, a qualunque distanza. Solo in
     * lettura: scrivere resta di chi segue la cliente — una coordinatrice che scrive nel thread
     * «Coach» farebbe comparire alla cliente un messaggio che sembra della sua coach.
     */
    const copreLaCoach =
      mode === 'read' && (await copreQuestoStaff(this.prisma, staff.id, profile?.assignedCoachId ?? null));
    const copreLaNutrizionista =
      mode === 'read' && (await copreQuestoStaff(this.prisma, staff.id, profile?.assignedNutritionistId ?? null));

    if ((user.role === 'coach' || user.role === 'coach_coordinator') && thread.counterpart === 'coach' && (eLaSuaCoach || copreLaCoach)) return;
    if (user.role === 'nutritionist' && thread.counterpart === 'nutritionist' && (eLaSuaNutrizionista || copreLaNutrizionista)) return;
    if (user.role === 'head_nutritionist' && thread.counterpart === 'nutritionist') return;

    // Il thread con Gaia: le due persone che seguono la cliente, il capo nutrizionista che risponde
    // di loro, e l'admin (gestito sopra). Nessun altro: là dentro ci sono sintomi, gravidanza,
    // farmaci — tutto quello che il filtro classifica come sensibile resta scritto nel thread.
    // In particolare la manager delle coach (`sales`) NON entra qui: vede lead, contatti e metriche,
    // non il clinico.
    if (thread.counterpart === 'ai' && mode === 'read') {
      // Anche qui la rete si risale: chi risponde di quella coach legge quello che la cliente ha
      // scritto a Gaia, perché è lì che dice cosa non le piace e cosa non digerisce.
      if ((user.role === 'coach' || user.role === 'coach_coordinator') && (eLaSuaCoach || copreLaCoach)) return;
      if (user.role === 'nutritionist' && (eLaSuaNutrizionista || copreLaNutrizionista)) return;
      if (user.role === 'head_nutritionist') return;
    }
    throw new ForbiddenException('Non hai accesso a questo thread');
  }

  async listMessages(user: AuthUser, threadId: string) {
    const thread = await this.getThread(threadId);
    await this.assertThreadAccess(user, thread, 'read');
    // Traccia di CHI ha aperto la conversazione di una cliente. La cliente che rilegge la propria
    // non si registra: sarebbe rumore che nasconde le righe che contano.
    // È la contropartita dell'aver aperto all'admin anche il thread con Gaia (8/8): un accesso
    // ampio è accettabile se lascia una traccia, non se è invisibile. Un errore dell'audit non
    // deve impedire la lettura — meglio un messaggio letto senza riga che una scheda che non apre.
    if (user.role !== 'client') {
      await this.audit
        .log({
          action: 'chat.staff_read_messages',
          actorId: user.sub,
          entityType: 'chat_thread',
          entityId: threadId,
          metadata: { counterpart: thread.counterpart, clientId: thread.clientId, role: user.role },
        })
        .catch(() => undefined);
    }
    /**
     * ⚠️ APRIRE LA CONVERSAZIONE È AVERLA LETTA — è il momento in cui il pallino rosso si spegne
     * (Simone, 12/8: «se il cliente ha scritto dall'ultima visita nella pagina»).
     *
     * Si segna qui e non con una chiamata a parte dal telefono, perché una chiamata in più è una
     * chiamata che si può dimenticare di fare: chiunque apra una conversazione, da qualunque
     * schermata, l'ha aperta. La cliente no: il suo pallino è un'altra cosa e questa tabella non
     * la riguarda.
     */
    if (user.role !== 'client') await this.segnaLetto(user.sub, threadId);
    // `deletedAt: null` — i messaggi cancellati dal loro autore spariscono da TUTTE le letture,
    // cliente e staff. Restano in tabella (vedi `model Message`): non si vedono, non si perdono.
    return this.prisma.message.findMany({
      where: { threadId, deletedAt: null },
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
      // Il contatore conta quello che si vede: un thread con 23 messaggi di cui 3 cancellati ne ha 20.
      include: { _count: { select: { messages: { where: { deletedAt: null } } } } },
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

  /**
   * LA VERIFICA della nutrizionista su un cambio nato in chat: conferma, correggi, annulla.
   *
   * Due cancelli, e sono diversi da quelli della lettura:
   * - **il permesso**: `manage` su «Conversazioni della cliente» (`client_conversations`), che di
   *   default hanno nutrizionista, capo nutrizionista e admin — la coach questi cambi li **legge**
   *   (le servono per capire come sta andando) ma non li tocca, perché la grammatura di un piatto è
   *   materia clinica. Di *default*: dall'11/8 la decisione è di Simone in pagina Permessi e non di
   *   un elenco di ruoli scritto qui dentro, che si poteva solo cambiare con un rilascio;
   * - **la portata**: la solita, sulla cliente. Riusa `assertThreadAccess`, che è il posto dove
   *   quel controllo vive già.
   *
   * E una cosa che non è un cancello ma conta di più: **la cliente viene avvisata**. Aveva
   * concordato qualcosa con Gaia; se il piatto di domani non è quello, deve saperlo da noi e non
   * scoprirlo aprendo il menu.
   */
  async correggiCambioInChatPerStaff(user: AuthUser, clientId: string, input: CorrezioneCambio) {
    if (!(await ruoloPuo(this.prisma, user.role, 'client_conversations', 'manage'))) {
      throw new ForbiddenException(
        'Il tuo ruolo non può verificare un cambio concordato in chat: serve la gestione su «Conversazioni della cliente» (pagina Permessi).',
      );
    }
    const thread = await this.prisma.chatThread.findUnique({
      where: { clientId_counterpart: { clientId, counterpart: 'ai' as never } },
    });
    await this.assertThreadAccess(user, thread ?? { clientId, counterpart: 'ai' }, 'read');

    const esito = await this.sostituzione.correggiCambioInChat(clientId, user.sub, input);

    // Solo se qualcosa è **cambiato**: una conferma («va bene così») non è una notizia, e
    // notificare anche quella insegnerebbe alla cliente a ignorare queste notifiche.
    if (input.stato !== 'verificata') {
      await this.notifications
        .notify({
          userId: clientId,
          type: 'menu_cambio_verificato',
          title: 'La tua nutrizionista ha guardato il tuo cambio',
          body: input.nota ? `${esito.descrizione} ${input.nota}` : esito.descrizione,
          payload: { kind: 'menu_cambio_verificato', data: input.data, slot: input.slot },
        })
        .catch(() => undefined);
    }
    await this.audit.log({
      action: 'chat.cambio_verificato',
      actorId: user.sub,
      entityType: 'user',
      entityId: clientId,
      metadata: { ...input },
    });
    return esito;
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

    /**
     * ⚠️ GAIA IMPARA ANCHE DA QUI. Richiesta di Simone (12/8): «Gaia dovrebbe leggere anche le chat
     * del nutrizionista ed apprendere anche da lì le sostituzioni».
     *
     * Prima, una sostituzione concessa per iscritto dalla nutrizionista restava dentro la
     * conversazione — che nessun altro pezzo del sistema legge — e la settimana dopo Gaia
     * rispondeva «devo chiedere alla tua nutrizionista» su una cosa già concessa.
     *
     * La funzione decide da sé se il ruolo di chi scrive vale come istruzione clinica, e **non
     * lancia mai**: il messaggio è la cosa necessaria, la memoria è la cosa utile. Si aspetta
     * invece di lasciarla correre da sola — costa un paio di query e in cambio è osservabile: una
     * scrittura sganciata dalla richiesta è una scrittura che nessun test può controllare.
     */
    await imparaDalNutrizionista(this.prisma, {
      clientId: thread.clientId,
      autoreRuolo: user.role,
      autoreId: user.sub,
      testo: body,
      quando: message.sentAt,
    });

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

  /**
   * CANCELLA UN MESSAGGIO — solo il suo autore.
   *
   * Richiesta di Simone (11/8): «chi scrive il messaggio deve poterlo cancellare».
   *
   * **Solo l'autore, e nessun'altra regola.** Non il capo, non l'admin: il senso della cosa è
   * rimediare a quello che si è scritto per sbaglio, non moderare quello che ha scritto un altro.
   * Un capo che cancella il messaggio di una collega dentro la conversazione con una paziente è una
   * funzione diversa, con conseguenze diverse, e non è questa.
   *
   * **Morbida e non definitiva** (vedi `model Message`): sparisce da tutte le letture, resta in
   * tabella. In una conversazione clinica quello che è stato detto è stato detto, e la cliente può
   * averlo già letto: se un domani si deve ricostruire cosa le è stato consigliato, la riga serve.
   */
  async eliminaMessaggio(user: AuthUser, threadId: string, messageId: string) {
    const thread = await this.getThread(threadId);
    // Lo stesso cancello della lettura: non si cancella dentro un thread a cui non si ha accesso.
    await this.assertThreadAccess(user, thread, 'read');

    const msg = (await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, threadId: true, senderUserId: true, deletedAt: true },
    })) as { id: string; threadId: string; senderUserId: string | null; deletedAt: Date | null } | null;
    if (!msg || msg.threadId !== threadId) throw new NotFoundException('Messaggio non trovato');
    // Già cancellato: si risponde ok invece che con un errore. Chi ha cliccato due volte voleva la
    // stessa cosa tutte e due le volte, e un errore qui sembrerebbe che la prima non sia riuscita.
    if (msg.deletedAt) return { ok: true, giaCancellato: true };
    if (!msg.senderUserId || msg.senderUserId !== user.sub) {
      throw new ForbiddenException('Si può cancellare solo un messaggio scritto da sé.');
    }

    await this.prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date(), deletedById: user.sub } as never,
    });
    await this.audit
      .log({
        action: 'chat.message_deleted',
        actorId: user.sub,
        entityType: 'message',
        entityId: messageId,
        metadata: { threadId, clientId: thread.clientId, counterpart: thread.counterpart },
      })
      .catch(() => undefined);
    return { ok: true, giaCancellato: false };
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
      await this.notifyCounterpartStaff(clientId, toNutritionist ? 'nutritionist' : 'coach', 'chat_sensitive_alert');
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
      // I flussi aperti si leggono UNA volta: stanno tutti nel `meta` dello stesso messaggio (il
      // più recente di Gaia), e due letture della stessa riga sono due query per niente.
      const flussi = await this.flussiAperti(threadId);
      /**
       * ⚠️ LE ALLERGIE PER PRIME, fra i tre.
       *
       * Non è una gerarchia di importanza, è una questione di fraintendimenti: la risposta a «hai
       * qualche allergia?» è un elenco di alimenti — «i latticini», «le noci» — e un elenco di
       * alimenti somiglia moltissimo alla richiesta di sostituirne uno. Messa dopo, la risposta
       * «il latte» aprirebbe un dialogo di sostituzione e l'allergia non verrebbe mai registrata,
       * senza che niente segnali un errore.
       *
       * Aperto ne resta comunque **uno solo alla volta**: lo stato di tutti e tre vive nel `meta`
       * dello stesso messaggio, e ogni risposta di Gaia lo riscrive da zero.
       */
      const daAllergie = await this.gestisciAllergie(clientId, threadId, body, flussi, result.kind);
      if (daAllergie) return daAllergie;
      // La data di inizio prima della sostituzione: sono due flussi che non possono essere aperti
      // insieme (lo stato vive nello stesso messaggio, e ne scrive uno solo), quindi l'ordine
      // conta solo per l'APERTURA da testo libero — e «vorrei spostare l'inizio del piano» non
      // somiglia a «vorrei sostituire un ingrediente».
      const daDataInizio = await this.gestisciDataInizio(clientId, threadId, body, flussi, result.kind);
      if (daDataInizio) return daDataInizio;
      const daSostituzione = await this.gestisciSostituzione(clientId, threadId, body, result.kind, flussi.sost);
      if (daSostituzione) return daSostituzione;
    }

    if (result.kind === 'faq') meta.matchedFaq = result.faqKey;

    // Risposta generativa (Claude) per messaggi generici o FAQ, se l'AI è abilitata.
    // I temi sensibili/sanitari NON passano dall'AI: restano gestiti sopra e instradati.
    let replyText: string = result.reply;
    let aiAnswered = false;
    // Alcune risposte NON si fanno riformulare: quella sui dati personali dice «non ho accesso ai
    // tuoi dati», ed è una garanzia. Un modello che la riscrive potrebbe rispondere *come se* quei
    // dati li avesse — il danno non è di stile. Vedi `senzaAi` in `ai-filter.ts`.
    const senzaAi = result.kind === 'route_coach' && result.senzaAi === true;
    if (result.kind === 'route_coach' && result.reason) meta.reason = result.reason;
    /**
     * Vero quando la risposta del modello è stata FERMATA dalla guardia in uscita: la domanda va
     * alla nutrizionista qualunque cosa avesse deciso il filtro in entrata. Vedi
     * `guardia-risposta-ai.ts` — è nato dal basmati, l'11/8.
     */
    let fermataDallaGuardia = false;
    if (!senzaAi && (result.kind === 'faq' || result.kind === 'route_coach') && (await this.ai.assistantEnabled())) {
      const u = await this.prisma.user.findUnique({ where: { id: clientId }, select: { locale: true } });
      /**
       * I DATI PRIMA DELLA RISPOSTA (11/8, seconda decisione di Simone sullo stesso caso).
       *
       * Se il messaggio è una domanda su un alimento, si cercano i valori nella nostra banca dati
       * **prima** di far parlare il modello. Trovati: si mettono davanti a lui e la risposta può
       * contenere quei numeri e nessun altro. Non trovati: il modello risponde senza numeri e la
       * guardia lo tiene onesto, mentre l'alimento chiesto finisce nella lista dei mancanti — è così
       * che la tabella cresce guidata dalle domande vere.
       */
      let scheda: { righe: string[]; fonti: string[]; numeriAmmessi: number[] } | null = null;
      if (domandaNutrizionale(body)) {
        scheda = await this.valori.schedaPerRisposta(body).catch(() => null);
        if (scheda && scheda.righe.length === 0) {
          for (const t of terminiAlimentoCandidati(body)) await this.valori.registraMancante(t);
          scheda = null;
        }
        if (scheda) meta.datiNutrizionali = { fonti: scheda.fonti, righe: scheda.righe.length };
      }
      const aiText = await this.ai.assistantReply(body, u?.locale === 'en' ? 'en' : 'it', scheda);
      if (aiText) {
        const guardia = verificaRispostaGaia(aiText, scheda ? { numeriAmmessi: scheda.numeriAmmessi } : null);
        if (guardia.ok) {
          replyText = aiText;
          aiAnswered = true;
          meta.composer = 'ai';
        } else {
          // La risposta NON si manda. Resta però scritta nel `meta`: senza, il difetto sarebbe
          // invisibile — nessuno saprebbe mai quante volte la guardia ha fermato qualcosa, né cosa.
          replyText = RISPOSTA_FERMATA;
          fermataDallaGuardia = true;
          meta.composer = 'guardia';
          meta.aiScartata = { motivo: guardia.motivo, testo: aiText.slice(0, 500) };
        }
      }
    }

    if (
      !aiAnswered &&
      (fermataDallaGuardia || result.kind === 'route_coach' || result.kind === 'route_nutritionist')
    ) {
      // Fermata dalla guardia = era una domanda di merito sull'alimentazione: va alla nutrizionista,
      // non alla coach, anche se il filtro in entrata l'aveva letta come generica.
      const target: Counterpart = fermataDallaGuardia
        ? 'nutritionist'
        : result.kind === 'route_coach'
          ? 'coach'
          : 'nutritionist';
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
  async avviaSostituzione(clientId: string, data?: string | null) {
    const thread = await this.prisma.chatThread.upsert({
      where: { clientId_counterpart: { clientId, counterpart: 'ai' as never } },
      create: { clientId, counterpart: 'ai' as never },
      update: {},
    });
    // `?? null` e non `data` così com'è: «nessuna giornata» deve avere UNA sola forma, o due
    // chiamate identiche sembrano diverse a chiunque le legga (test compresi).
    const esito = await this.sostituzione.apri(clientId, data ?? null);
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
    stato: StatoSostituzione | null,
  ) {
    let esito: EsitoSostituzione;
    if (stato) {
      // Il dialogo si apre col solo tocco del pulsante, e resta aperto un'ora: se la cliente
      // cambia idea e fa una domanda vera, quella domanda deve avere la sua risposta. Senza
      // questa uscita, «quando si sblocca il prossimo menu?» al passo dell'alimento riceveva
      // «non lo trovo fra gli ingredienti di oggi» — con la FAQ giusta a un centimetro di
      // distanza — e alla seconda domanda il dialogo si arrendeva girandola alla coach.
      // Vale solo ai PRIMI passi: dopo, le risposte sono brevi e non somigliano a domande.
      //
      // ⛔ Dal 24/8 i primi passi sono TRE — il dialogo comincia da «su quale menu vuoi lavorare?»
      // e passa da «di quale pasto parliamo?». Restando appesa al solo `cibo`, questa valvola si era
      // spenta proprio dove serve di più: la cliente tocca «Sostituisci», cambia idea, chiede
      // «quando si sblocca il prossimo menu?» e si sentiva rispondere «non ho capito, la mia domanda
      // è…». Trovato in revisione il 25/8, insieme al test che la copriva e che cablava `'cibo'`.
      if (kind === 'faq' && PASSI_CON_USCITA_FAQ.has(stato.passo)) return null;
      esito = await this.sostituzione.avanza(clientId, stato, body);
    } else if (rilevaIntentoSostituzione(body)) {
      esito = await this.sostituzione.apriDaTesto(clientId, body);
    } else if (rilevaIntentoAltroPiatto(body)) {
      // «Voglio una colazione proteica» senza nessun dialogo aperto. Va DOPO la sostituzione:
      // «vorrei sostituire il burro» è una richiesta di cambiare un ingrediente, e va trattata
      // come tale — l'ordine di questi due rami è la differenza fra capire e fraintendere.
      esito = await this.sostituzione.proponiAltroPiatto(clientId, body);
    } else {
      return null;
    }
    return this.scriviEsitoSostituzione(clientId, threadId, body, esito);
  }

  /**
   * TUTTI i dialoghi guidati aperti, letti dal `meta` dell'ULTIMO messaggio di Gaia: nessuna
   * tabella nuova, nessuna migrazione. Guardare solo l'ultimo, e non il più recente che ne abbia
   * uno, è quello che impedisce a un dialogo abbandonato di risuscitare tre messaggi dopo.
   *
   * Sono tre — la sostituzione (`sost`), la data di inizio (`dataInizio`) e la ri-domanda sulle
   * allergie (`allergie`) — e può essere aperto solo uno alla volta, perché ogni risposta di Gaia
   * riscrive quel `meta` da zero.
   *
   * ⚠️ **Scade dopo un'ora** (`SCADENZA_FLUSSO_MS`). Per le allergie conta più che per gli altri
   * due: la cliente apre la notifica quando le va, magari il giorno dopo, e a quel punto il
   * dialogo **si riapre da capo** — non riprende da dove era. È il motivo per cui l'apertura
   * rilegge il motivo dal profilo invece di fidarsi di quello che c'era scritto nella notifica.
   */
  private async flussiAperti(
    threadId: string,
  ): Promise<{ sost: StatoSostituzione | null; dataInizio: StatoDataInizio | null; allergie: StatoAllergie | null }> {
    const vuoto = { sost: null, dataInizio: null, allergie: null };
    const ultimo = await this.prisma.message.findFirst({
      where: { threadId, senderRole: 'ai' },
      orderBy: { sentAt: 'desc' },
      select: { meta: true, sentAt: true },
    });
    if (!ultimo) return vuoto;
    // Una conversazione lasciata a metà ieri non è una conversazione in corso.
    if (Date.now() - ultimo.sentAt.getTime() > SCADENZA_FLUSSO_MS) return vuoto;
    const meta = (ultimo.meta ?? {}) as {
      sost?: StatoSostituzione;
      dataInizio?: StatoDataInizio;
      allergie?: StatoAllergie;
    };
    return {
      sost: meta.sost?.passo ? meta.sost : null,
      dataInizio: meta.dataInizio?.passo ? meta.dataInizio : null,
      allergie: meta.allergie?.passo ? meta.allergie : null,
    };
  }

  /**
   * CHIUDE LE CONVERSAZIONI LASCIATE A META'. Passo notturno, richiesta di Simone del 18/8.
   *
   * Il caso: nella chat di una cliente, tre volte di fila «Certo Patricia, vediamo insieme. Quale
   * alimento vuoi cambiare?» e in mezzo nessuna risposta. Non era Gaia che insisteva — erano tre
   * tocchi del pulsante «Sostituisci», e ogni tocco riparte da zero perché il dialogo scade dopo
   * un'ora e non sa di aver già chiesto. Ora la domanda rimasta senza risposta la chiude Gaia.
   *
   * ⚠️ Chiude il TEMPO, non un altro tocco: dire «capisco che non ti interessa più» nell'istante in
   * cui la cliente sta toccando il pulsante sarebbe il contrario di quello che serve. E chiudendo a
   * tempo la seconda domanda identica non arriva nemmeno.
   *
   * ⚠️ Non azzera nessuno stato a mano: il messaggio di chiusura diventa l'ultimo messaggio di
   * Gaia e non porta `meta.sost`, quindi `flussiAperti` non trova più niente. Ed è anche il
   * marcatore che impedisce di richiudere la stessa conversazione la notte dopo — la riga è il
   * marcatore, come per la campagna allergie.
   */
  async chiudiSostituzioniLasciateAMeta(adesso: Date = new Date()) {
    const ore = await this.configParams
      .getNumber('chat_chiusura_silenzio_ore', ORE_DI_SILENZIO)
      .catch(() => ORE_DI_SILENZIO);
    const finestra = GIORNI_ALL_INDIETRO * 24 * 3_600_000;
    /**
     * ⚠️ `lastMessageAt` è solo un PRE-FILTRO grossolano, per non leggere l'ultimo messaggio di
     * ogni thread della banca dati. La decisione la prende `vaChiusa` sul messaggio vero: se i due
     * non combaciassero (un ultimo messaggio cancellato, per esempio) vince il messaggio.
     */
    const thread = await this.prisma.chatThread.findMany({
      where: {
        counterpart: 'ai' as never,
        lastMessageAt: {
          gte: new Date(adesso.getTime() - finestra),
          lte: new Date(adesso.getTime() - ore * 3_600_000),
        },
      },
      select: { id: true, clientId: true },
      orderBy: { lastMessageAt: 'asc' },
      take: MASSIMO_CHIUSURE_PER_GIRO + 1,
    });
    // ⚠️ Se il tetto viene toccato lo si DICE: un tetto silenzioso fa sembrare «tutto chiuso» un
    // giro che ne ha lasciate indietro un centinaio. Le altre le prende il giro di domani.
    const troncato = thread.length > MASSIMO_CHIUSURE_PER_GIRO;
    const daGuardare = troncato ? thread.slice(0, MASSIMO_CHIUSURE_PER_GIRO) : thread;

    let chiuse = 0;
    for (const th of daGuardare) {
      try {
        const ultimo = await this.prisma.message.findFirst({
          where: { threadId: th.id, deletedAt: null },
          orderBy: { sentAt: 'desc' },
          select: { senderRole: true, sentAt: true, meta: true },
        });
        if (!vaChiusa(ultimo, adesso, ore).chiudere) continue;
        const nome = await this.nomeCliente(th.clientId);
        await this.prisma.message.create({
          data: {
            threadId: th.id,
            senderRole: 'ai',
            body: testoChiusuraPerSilenzio(nome),
            meta: { kind: 'sostituzione', esitoSostituzione: 'chiusa_per_silenzio' } as never,
          },
        });
        await this.prisma.chatThread.update({
          where: { id: th.id },
          data: { lastMessageAt: new Date() },
        });
        chiuse += 1;
      } catch (e) {
        // Una conversazione che non si chiude non deve fermare le altre: è la regola del cron.
        this.logger.warn(`chiusura per silenzio NON riuscita su thread ${th.id}: ${String(e)}`);
      }
    }
    return { esaminate: daGuardare.length, chiuse, oreDiSilenzio: ore, troncato };
  }

  /** Il nome con cui Gaia si rivolge alla cliente. Una gentilezza, non un requisito: se non si
   *  legge, la frase esce senza nome (`appellativo` tiene la maiuscola al posto giusto). */
  private async nomeCliente(clientId: string): Promise<string | null> {
    try {
      const [profilo, utente] = await Promise.all([
        this.prisma.clientProfile.findUnique({ where: { userId: clientId }, select: { name: true } }),
        this.prisma.user.findUnique({ where: { id: clientId }, select: { firstName: true } }),
      ]);
      return (profilo?.name ?? null) || (utente?.firstName ?? null);
    } catch {
      return null;
    }
  }

  // ---------- La ri-domanda sulle allergie (§7 dell'handoff) ----------

  /**
   * Apertura dalla notifica «allergie_conferma»: Gaia fa la domanda, così la cliente trova la
   * conversazione già cominciata invece di un campo di testo vuoto e il dubbio su cosa scrivere.
   *
   * POST e non GET perché scrive un messaggio. Chiamarlo due volte ripete solo la domanda — e chi
   * non ha più niente da dichiarare si sente rispondere che è tutto a posto, non una domanda a cui
   * ha già risposto.
   */
  async avviaAllergie(clientId: string) {
    const thread = await this.prisma.chatThread.upsert({
      where: { clientId_counterpart: { clientId, counterpart: 'ai' as never } },
      create: { clientId, counterpart: 'ai' as never },
      update: {},
    });
    const esito = await this.allergie.apri(clientId);
    const message = await this.scriviEsitoAllergie(clientId, thread.id, null, esito);
    return { threadId: thread.id, message, esito: esito.esito };
  }

  /**
   * Fa avanzare il dialogo sulle allergie, se ce n'è uno aperto. Non si apre mai da testo libero:
   * questa domanda la facciamo noi, e la facciamo a chi serve (`common/da-ricontattare.ts`).
   */
  private async gestisciAllergie(
    clientId: string,
    threadId: string,
    body: string,
    flussi: { allergie: StatoAllergie | null },
    kind: string,
  ) {
    if (!flussi.allergie) return null;
    // Stessa uscita degli altri due dialoghi: una domanda vera, fatta mentre aspettiamo un elenco
    // di alimenti, deve avere la sua risposta. Vale solo al primo passo — alla conferma la risposta
    // è «sì» o «no», e non somiglia a una domanda.
    if (kind === 'faq' && flussi.allergie.passo === 'risposta') return null;
    const esito = await this.allergie.avanza(clientId, flussi.allergie, body);
    return this.scriviEsitoAllergie(clientId, threadId, body, esito);
  }

  /** Scrive la risposta di Gaia con lo stato nel `meta`, e gestisce il passaggio alla persona. */
  private async scriviEsitoAllergie(
    clientId: string,
    threadId: string,
    body: string | null,
    esito: EsitoAllergie,
  ) {
    const meta: Record<string, unknown> = { kind: 'allergie', esitoAllergie: esito.esito };
    if (esito.stato) meta.allergie = esito.stato;
    if (esito.applicata) meta.applicata = esito.applicata;

    if (esito.inoltraA) {
      meta.routedTo = esito.inoltraA;
      const target = await this.prisma.chatThread.upsert({
        where: { clientId_counterpart: { clientId, counterpart: esito.inoltraA as never } },
        create: { clientId, counterpart: esito.inoltraA as never },
        update: { lastMessageAt: new Date() },
      });
      /**
       * ⚠️ Qui il messaggio inoltrato si scrive anche quando `body` è vuoto, a differenza degli
       * altri due flussi.
       *
       * Là il passaggio di mano nasce sempre da una frase della cliente. Qui può nascere
       * dall'apertura — «da noi risulta un'allergia che la tua risposta toglierebbe» — e in quel
       * caso non c'è nessuna frase sua da girare. Senza questa riga la nutrizionista riceverebbe
       * la notifica di un thread in cui non c'è scritto niente.
       */
      await this.prisma.message.create({
        data: {
          threadId: target.id,
          senderRole: 'client',
          senderUserId: clientId,
          body: body || 'Ha risposto alla domanda sulle allergie, ma serve una persona: vedi la chat con Gaia.',
          meta: { forwardedFrom: 'ai', motivo: 'allergie' } as never,
        },
      });
      await this.notifyCounterpartStaff(clientId, esito.inoltraA);
    }

    const message = await this.prisma.message.create({
      data: { threadId, senderRole: 'ai', body: esito.testo, meta: meta as never },
    });
    await this.prisma.chatThread.update({ where: { id: threadId }, data: { lastMessageAt: new Date() } });
    // ⚠️ Nessun audit qui: la riga la scrive `AllergieChatService`, **dentro la stessa transazione**
    // del profilo. Scriverne una seconda da qui vorrebbe dire due tracce per un fatto solo, e la
    // seconda sopravvivrebbe anche a una scrittura fallita.
    return message;
  }

  // ---------- Data di inizio piano in chat ----------

  /**
   * «Posso spostare l'inizio a lunedì?» — il flusso che rende vera la frase che la cliente legge
   * in dashboard («se vuoi cambiare la data di inizio, chiedi a Gaia in chat»).
   *
   * Restituisce `null` quando non c'entra niente, e la chat continua come sempre. Non si apre
   * mentre è aperto un dialogo di sostituzione: la cliente sta rispondendo a un'altra domanda.
   */
  private async gestisciDataInizio(
    clientId: string,
    threadId: string,
    body: string,
    flussi: { sost: StatoSostituzione | null; dataInizio: StatoDataInizio | null },
    kind: string,
  ) {
    let esito: EsitoDataInizio;
    if (flussi.dataInizio) {
      // Stessa uscita del dialogo di sostituzione: una domanda vera, fatta mentre aspettiamo una
      // data, deve avere la sua risposta. Senza, «quando si sblocca il menu?» si sentiva rispondere
      // «non ho capito la data» — con la FAQ giusta a un centimetro di distanza. Vale solo al primo
      // passo: alla conferma la risposta è «sì» o «no», e non somiglia a una domanda.
      if (kind === 'faq' && flussi.dataInizio.passo === 'data') return null;
      esito = await this.dataInizio.avanza(clientId, flussi.dataInizio, body);
    } else if (!flussi.sost && rilevaIntentoDataInizio(body)) {
      esito = await this.dataInizio.apriDaTesto(clientId, body);
    } else {
      return null;
    }
    return this.scriviEsitoDataInizio(clientId, threadId, body, esito);
  }

  /** Scrive la risposta di Gaia con lo stato nel `meta`, e gestisce l'inoltro alla coach. */
  private async scriviEsitoDataInizio(
    clientId: string,
    threadId: string,
    body: string | null,
    esito: EsitoDataInizio,
  ) {
    const meta: Record<string, unknown> = { kind: 'data_inizio', esitoDataInizio: esito.esito };
    if (esito.stato) meta.dataInizio = esito.stato;
    if (esito.applicata) meta.applicata = esito.applicata;

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
          meta: { forwardedFrom: 'ai', motivo: 'data_inizio' } as never,
        },
      });
      await this.notifyCounterpartStaff(clientId, esito.inoltraA);
    }

    const message = await this.prisma.message.create({
      data: { threadId, senderRole: 'ai', body: esito.testo, meta: meta as never },
    });
    await this.prisma.chatThread.update({ where: { id: threadId }, data: { lastMessageAt: new Date() } });
    if (esito.esito === 'applicata') {
      await this.audit.log({
        action: 'chat.data_inizio_applicata',
        actorId: clientId,
        entityType: 'chat_thread',
        entityId: threadId,
        metadata: { ...esito.applicata, messageId: message.id },
      });
    }
    return message;
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
      /**
       * ⛔ **IL CONTESTO VIAGGIA COL MESSAGGIO** (31/8, Simone). Nella chat con Gaia un «1» ha un
       * senso: la domanda è la riga sopra. Qui il messaggio arriva **nudo**, in un thread dove
       * quella domanda non c'è mai stata, e chi legge vede «1» e «2» senza sapere di cosa si
       * parli.
       *
       * ⚠️ La frase non si inventa: è composta dallo **stato del dialogo** — giorno, pasto, piatto,
       * l'alimento come l'ha scritto lei — e porta con sé la domanda di Gaia parola per parola.
       * Se lo stato non dice niente, non si scrive niente: meglio un numero nudo che una frase
       * plausibile e sbagliata.
       */
      const contesto = contestoPerLoStaff(esito.stato ?? esito.ultimoStato, giornoLocale(new Date()));
      await this.prisma.message.create({
        data: {
          threadId: target.id,
          senderRole: 'client',
          senderUserId: clientId,
          body,
          meta: { forwardedFrom: 'ai', motivo: 'cambio_piatto', ...(contesto ? { contesto } : {}) } as never,
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

  /**
   * Perché non è arrivata la notifica del messaggio, per questa cliente. Vedi
   * `diagnosi-avviso-chat.ts`: sei gradini, e si dice il PRIMO rotto.
   */
  diagnosiAvviso(clientId: string, controparte: 'coach' | 'nutritionist') {
    return diagnosiAvvisoChat(this.prisma, clientId, controparte);
  }

  private async notifyCounterpartStaff(
    clientId: string,
    counterpart: Counterpart,
    type = `chat_message_${counterpart}`,
  ) {
    if (counterpart === 'ai') return;
    const profile = await this.prisma.clientProfile.findUnique({
      where: { userId: clientId },
      include: {
        assignedCoach: { select: { userId: true } },
        assignedNutritionist: { select: { userId: true } },
      },
    });
    const assegnata =
      counterpart === 'coach' ? profile?.assignedCoach?.userId : profile?.assignedNutritionist?.userId;

    /**
     * ⚠️ UN AVVISO SENZA DESTINATARIO NON È UN AVVISO.
     *
     * Qui c'era un `return` muto: se alla cliente non è assegnata una nutrizionista, il messaggio
     * veniva salvato e **nessuno lo sapeva** — non la nutrizionista, che non c'è, e non il capo, a
     * cui nessuno lo diceva. La cliente scriveva nel vuoto senza che niente, da nessuna parte, lo
     * segnalasse.
     *
     * È la stessa lezione di `escalations/apri-segnalazione.ts`: a luglio tre segnalazioni gravi
     * sono rimaste senza destinatario perché nessuno era ancora assegnato, e sono passati venti
     * giorni. Il ripiego è il capo nutrizionista, che **può leggere e rispondere** in quel thread
     * (vedi `assertThreadAccess`): mandare l'avviso a chi non può nemmeno aprire la conversazione
     * sarebbe solo un modo più elegante di perderlo.
     *
     * ⚠️ Per la COACH non c'è ripiego, e non è una dimenticanza: nessun altro ruolo può scrivere
     * nel thread «Coach» — un messaggio della nutrizionista comparirebbe alla cliente come se fosse
     * della sua coach. Lì resta il log, che almeno rende visibile il buco.
     */
    let destinatari: string[] = assegnata ? [assegnata] : [];
    if (!destinatari.length) {
      if (counterpart === 'nutritionist') destinatari = await capiNutrizionisti(this.prisma);
      this.logger.warn(
        `Messaggio in chat senza ${counterpart} assegnata (cliente=${clientId}): ` +
          (destinatari.length ? `avviso ai capi nutrizionisti (${destinatari.length})` : 'nessun destinatario possibile'),
      );
    }
    if (!destinatari.length) return;
    /**
     * ⚠️ Il thread si cerca **qui** e non lo passa chi chiama: metà delle chiamate arrivano da
     * un'escalation, dove la conversazione di partenza è quella con Gaia e quella di destinazione è
     * un'altra. Portare la nutrizionista nel thread da cui è partito il messaggio la porterebbe
     * dentro la chat con Gaia, dove per giunta non può rispondere.
     * Se non c'è ancora, `threadId` resta fuori e il tocco ricade sulla scheda della cliente.
     */
    const thread = (await this.prisma.chatThread.findUnique({
      where: { clientId_counterpart: { clientId, counterpart: counterpart as never } },
      select: { id: true },
    })) as { id: string } | null;
    const threadId = thread?.id;
    /**
     * UNA NOTIFICA PER OGNI CLIENTE CHE SCRIVE (11/8: «se una cliente scrive in chat alla coach
     * mandiamo la notifica nella dashboard e via push»).
     *
     * Il difetto era nel dedup: `notifyOncePerDay` senza finestra vuol dire **una al giorno per
     * tipo**, e il tipo qui è uno solo per tutte le clienti. Quindi la prima che scriveva generava la
     * notifica e tutte le altre, quel giorno, no. Per una coach con quaranta clienti è una notifica su
     * quaranta: la chat sembrava silenziosa mentre si riempiva.
     *
     * Ora il dedup guarda anche il `clientId`, quindi è per **cliente**, con la stessa anti-raffica di
     * tre minuti che usa la direzione opposta (staff → cliente): se scrive tre messaggi di fila resta
     * una notifica, se scrivono tre clienti diverse ne arrivano tre.
     *
     * Il nome nel titolo non è cortesia: senza, la coach deve aprire la scheda per sapere chi le ha
     * scritto. Il testo NON riporta il messaggio — nell'anteprima di una notifica push non ci va
     * niente che possa essere sanitario.
     */
    const nome = (profile as { name?: string | null } | null)?.name?.trim() || 'Una tua cliente';
    // Quando i destinatari sono i capi (nessuna assegnata), il titolo lo dice: «una tua cliente»
    // sarebbe falso, e chi legge perderebbe tempo a cercarla fra le proprie.
    const titolo = assegnata ? `${nome} ti ha scritto` : `${nome} ha scritto e non ha una nutrizionista assegnata`;
    for (const userId of destinatari) {
      await this.notifications.notifyOncePerDay({
        userId,
        type,
        title: titolo,
        body: 'Apri la chat per leggere il messaggio.',
      /**
       * ⚠️ `threadId` serve al tocco sulla notifica. Richiesta di Simone (12/8): «la notifica di un
       * messaggio in chat, se ci clicca il nutrizionista o la coach, deve portarli nella chat della
       * persona». Prima portava alla SCHEDA della cliente: da lì la chat è un altro tocco, e chi
       * apre una notifica di chat vuole leggere il messaggio, non consultare una cartella.
       */
        payload: { clientId, ...(threadId ? { threadId } : {}), kind: 'chat_message_staff' },
        dedupeWindowMs: 3 * 60_000,
        dedupeSuPayload: { clientId },
      });
    }
  }
}
