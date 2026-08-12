/**
 * PERCHÉ NON È ARRIVATA LA NOTIFICA DEL MESSAGGIO — la catena, gradino per gradino.
 *
 * Nasce da una segnalazione di Simone (12/8): «al nutrizionista continuano a non arrivare le
 * notifiche dei messaggi». Il percorso nel codice è corretto — il messaggio arriva, la riga si
 * scrive, la push parte — quindi quello che manca **non si vede leggendo il codice**: si vede nei
 * dati di quella cliente e di quella nutrizionista.
 *
 * Il problema di un avviso che non arriva è che non lascia niente dietro di sé. La catena ha sei
 * gradini e ognuno può rompersi in silenzio:
 *
 *   1. la cliente ha una nutrizionista assegnata?      → senza, non c'è destinatario
 *   2. quella scheda staff ha un'utenza?               → senza, non c'è a chi scrivere
 *   3. esiste la conversazione?                        → senza, la cliente non può scriverle
 *   4. la cliente ha davvero scritto lì?               → forse ha scritto a Gaia o alla coach
 *   5. la riga di notifica è stata creata?             → è quella che si vede nella campanella
 *   6. c'è un telefono registrato?                     → senza, la riga c'è ma la push no
 *
 * Chiedersi «funziona?» a bocce ferme non serve: serve sapere **quale dei sei** è quello rotto per
 * questa cliente. Stessa filosofia di `PushTestResult` in `push.service.ts`, e per lo stesso motivo:
 * finora l'unico modo di indagare era rifare la prova sperando di vederla fallire.
 *
 * ⚠️ Non manda niente e non scrive niente. È solo una lettura.
 */
import type { PrismaService } from '../prisma/prisma.service';
import { staffDisabledTypes } from '../notifications/notifica-utente';

export interface DiagnosiAvvisoChat {
  clientId: string;
  clienteNome: string | null;
  /** `coach` o `nutritionist`: la catena è la stessa, i destinatari no. */
  controparte: string;
  assegnata: { staffId: string; nome: string | null; userId: string | null } | null;
  threadId: string | null;
  ultimoMessaggioDellaCliente: string | null;
  /** Le notifiche di questo tipo scritte per quella persona negli ultimi 7 giorni. */
  notificheUltimi7Giorni: number;
  ultimaNotifica: string | null;
  /** Telefoni registrati: zero = la riga in app c'è, la push no. */
  dispositivi: number;
  /** Tipi che quella persona ha disattivato dal suo profilo. */
  disattivati: string[];
  /** La frase che dice cosa guardare adesso. */
  diagnosi: string;
}

const GIORNO_MS = 86_400_000;

export async function diagnosiAvvisoChat(
  prisma: PrismaService,
  clientId: string,
  controparte: 'coach' | 'nutritionist' = 'nutritionist',
): Promise<DiagnosiAvvisoChat> {
  const profilo = (await prisma.clientProfile.findUnique({
    where: { userId: clientId },
    select: {
      name: true,
      assignedCoach: { select: { id: true, displayName: true, userId: true } },
      assignedNutritionist: { select: { id: true, displayName: true, userId: true } },
    },
  })) as {
    name: string | null;
    assignedCoach: { id: string; displayName: string | null; userId: string | null } | null;
    assignedNutritionist: { id: string; displayName: string | null; userId: string | null } | null;
  } | null;

  const staff = controparte === 'coach' ? profilo?.assignedCoach : profilo?.assignedNutritionist;
  const assegnata = staff ? { staffId: staff.id, nome: staff.displayName, userId: staff.userId } : null;

  const thread = (await prisma.chatThread.findUnique({
    where: { clientId_counterpart: { clientId, counterpart: controparte as never } },
    select: { id: true },
  })) as { id: string } | null;

  const ultimoMessaggio = thread
    ? ((await prisma.message.findFirst({
        where: { threadId: thread.id, senderRole: 'client', deletedAt: null },
        orderBy: { sentAt: 'desc' },
        select: { sentAt: true },
      })) as { sentAt: Date } | null)
    : null;

  const tipo = `chat_message_${controparte}`;
  const dal = new Date(Date.now() - 7 * GIORNO_MS);
  const [notifiche, ultima, dispositivi, utente] = assegnata?.userId
    ? await Promise.all([
        prisma.notification.count({ where: { userId: assegnata.userId, type: tipo, scheduledFor: { gte: dal } } }),
        prisma.notification.findFirst({
          where: { userId: assegnata.userId, type: tipo },
          orderBy: { scheduledFor: 'desc' },
          select: { scheduledFor: true },
        }) as Promise<{ scheduledFor: Date } | null>,
        prisma.pushToken.count({ where: { userId: assegnata.userId } }),
        prisma.user.findUnique({ where: { id: assegnata.userId }, select: { prefs: true } }) as Promise<{ prefs: unknown } | null>,
      ])
    : [0, null, 0, null];

  const disattivati = staffDisabledTypes(utente?.prefs);

  return {
    clientId,
    clienteNome: profilo?.name ?? null,
    controparte,
    assegnata,
    threadId: thread?.id ?? null,
    ultimoMessaggioDellaCliente: ultimoMessaggio?.sentAt.toISOString() ?? null,
    notificheUltimi7Giorni: notifiche,
    ultimaNotifica: ultima?.scheduledFor.toISOString() ?? null,
    dispositivi,
    disattivati,
    diagnosi: frase({
      profiloEsiste: !!profilo,
      assegnata,
      thread: !!thread,
      haScritto: !!ultimoMessaggio,
      notifiche,
      dispositivi,
      controparte,
    }),
  };
}

/**
 * La frase, nell'ordine in cui la catena si rompe: si dice **il primo** gradino rotto, non l'ultimo.
 * Dire «non ci sono telefoni registrati» a una cliente che non ha una nutrizionista assegnata manda
 * a cercare nel posto sbagliato.
 */
function frase(s: {
  profiloEsiste: boolean;
  assegnata: { userId: string | null; nome: string | null } | null;
  thread: boolean;
  haScritto: boolean;
  notifiche: number;
  dispositivi: number;
  controparte: string;
}): string {
  const ruolo = s.controparte === 'coach' ? 'coach' : 'nutrizionista';
  if (!s.profiloEsiste) return 'Questa utenza non ha un profilo cliente: non c\'è nessuna conversazione da avvisare.';
  if (!s.assegnata) {
    return `Nessuna ${ruolo} assegnata a questa cliente. È il primo gradino: senza destinatario l'avviso non parte, e la cliente non vede nemmeno la conversazione. Si assegna dalla scheda cliente.`;
  }
  if (!s.assegnata.userId) {
    return `La scheda di ${s.assegnata.nome ?? 'quella persona'} non è collegata a nessuna utenza: non c'è un account a cui mandare l'avviso.`;
  }
  if (!s.thread) return 'La conversazione non è ancora stata aperta: si crea da sola quando la cliente entra in chat.';
  if (!s.haScritto) {
    return `La cliente non ha mai scritto in questa conversazione: probabilmente sta scrivendo a Gaia o alla coach. L'avviso alla ${ruolo} parte solo dai messaggi scritti QUI, o da un'escalation.`;
  }
  if (s.notifiche === 0) {
    return `La cliente ha scritto ma non risulta nessuna notifica negli ultimi 7 giorni: qui il problema è nella scrittura dell'avviso, non nella consegna. Da guardare nei log del server.`;
  }
  if (s.dispositivi === 0) {
    return `Gli avvisi vengono scritti (${s.notifiche} negli ultimi 7 giorni) e si vedono nella campanella, ma per ${s.assegnata.nome ?? 'questa persona'} non c'è nessun telefono registrato: la push non può arrivare. Serve aprire l'app sul telefono e accettare le notifiche.`;
  }
  return `La catena è completa: ${s.notifiche} avvisi negli ultimi 7 giorni e ${s.dispositivi} dispositiv${s.dispositivi === 1 ? 'o' : 'i'} registrat${s.dispositivi === 1 ? 'o' : 'i'}. Se non arrivano lo stesso, il gradino da guardare è Firebase (Push di prova) o le notifiche silenziate sul telefono.`;
}
