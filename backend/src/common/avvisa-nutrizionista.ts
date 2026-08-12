/**
 * AVVISARE LA NUTRIZIONISTA — e, se non ce n'è una, chi risponde di quel ruolo.
 *
 * Richiesta di Simone dell'11/8: «quando si creano sostituzioni nuove o equivalenze nuove mandiamo
 * una notifica al nutrizionista».
 *
 * ## Il buco che chiude
 *
 * Ogni cambio concordato in chat nasce `stato: 'da_verificare'`, ed è la cosa giusta: la
 * grammatura di un piatto è materia clinica e va guardata da chi se ne prende la responsabilità.
 * Solo che finora **nessuno lo diceva a nessuno**. La coda della verifica si riempiva in silenzio, e
 * l'unico modo di accorgersene era aprire la scheda della cliente di propria iniziativa. Un cambio
 * concordato con Gaia e mai verificato non è un cambio in attesa: è un cambio approvato da nessuno
 * che la cliente sta già mangiando.
 *
 * L'unica eccezione era il motivo clinico («mi resta sullo stomaco»), che apre una segnalazione. Ma
 * la maggior parte dei cambi non è clinica al momento della richiesta — lo diventa dopo, quando si
 * guarda quanti sono e su cosa.
 *
 * ## La regola del destinatario, imparata a caro prezzo
 *
 * Se alla cliente non è assegnata nessuna nutrizionista, l'avviso **non si butta via**: va al capo
 * nutrizionista. È la stessa lezione di `escalations/apri-segnalazione.ts` — a luglio tre
 * segnalazioni gravi sono rimaste senza destinatario perché nessuno era ancora assegnato, e sono
 * passati venti giorni. Un avviso senza destinatario non è un avviso.
 *
 * Come `avvisa-coach.ts`: **non fallisce mai**. Chi chiama sta applicando un cambio al menu di
 * domani; un avviso che non parte non deve far tornare indietro il lavoro vero.
 */
import type { PrismaService } from '../prisma/prisma.service';

/**
 * Il minimo che serve a questa funzione, così la si può usare da qualunque servizio.
 *
 * È **opzionale**: dentro `MenuModule` il `NotificationsService` non è raggiungibile (importarlo
 * chiude l'anello Notifications → Menu → Notifications e Nest non parte, vedi il commento in
 * `escalations/apri-segnalazione.ts`). Quando manca, la notifica si scrive direttamente in tabella
 * sul canale in-app: si perde il push e il rispetto delle preferenze per tipo, ma una campanella che
 * accende un pallino vale infinitamente più del silenzio di prima.
 */
interface Notificatore {
  notify(input: {
    userId: string;
    type: string;
    title: string;
    body: string;
    payload?: Record<string, unknown>;
  }): Promise<unknown>;
}

export interface AvvisoNutrizionista {
  type: string;
  title: string;
  body: string;
  payload?: Record<string, unknown>;
}

/**
 * Gli utenti da avvisare per una CLIENTE: la sua nutrizionista, o i capi se non ce n'è una.
 * Esportata perché serve anche a chi vuole sapere *se* c'è qualcuno prima di comporre il testo.
 */
export async function destinatariNutrizionista(
  prisma: PrismaService,
  clientId: string,
): Promise<string[]> {
  const profilo = (await prisma.clientProfile.findUnique({
    where: { userId: clientId },
    select: { assignedNutritionistId: true },
  })) as { assignedNutritionistId: string | null } | null;

  if (profilo?.assignedNutritionistId) {
    const staff = (await prisma.staff.findUnique({
      where: { id: profilo.assignedNutritionistId },
      select: { userId: true },
    })) as { userId: string } | null;
    if (staff) return [staff.userId];
  }
  return capiNutrizionisti(prisma);
}

/** I capi nutrizionisti: il destinatario di riserva, e l'unico possibile per il catalogo. */
export async function capiNutrizionisti(prisma: PrismaService): Promise<string[]> {
  const capi = (await prisma.user.findMany({
    where: { role: 'head_nutritionist', deletedAt: null } as never,
    select: { id: true },
  })) as { id: string }[];
  return capi.map((c) => c.id);
}

/**
 * LE UTENZE DI CHI SEGUE UNA CLIENTE — coach e nutrizionista assegnate, **o i capi se non ce n'è
 * nessuna**.
 *
 * Regola generale di Simone (12/8): «per qualsiasi cosa, se il nutrizionista non è assegnato va
 * ripiegato sul nutrizionista capo».
 *
 * Nasce da tre punti che facevano tutti la stessa cosa, ognuno per conto suo:
 *
 *   `if (staffIds.length === 0) return;`
 *
 * — nelle segnalazioni, nell'avviso «il peso sale durante la pausa» e nella **richiesta di pausa da
 * approvare**. Quest'ultimo è il peggiore dei tre: una cliente chiede una pausa più lunga di venti
 * giorni, la richiesta resta `pending`, e se non le è ancora stata assegnata nessuno **nessuno viene
 * avvisato**. Lei aspetta una risposta che non può arrivare, e nella coda di nessuno c'è una riga.
 *
 * Tre copie della stessa riga vogliono dire tre posti da correggere e uno che si dimentica. Qui è
 * una sola.
 *
 * ⚠️ Il ripiego sono i **capi nutrizionisti** anche quando a mancare è la coach, e non è una svista:
 * il capo nutrizionista è l'unico ruolo che può prendere in carico una cliente scoperta. Le
 * conversazioni sono l'eccezione — lì il destinatario deve poter *aprire quel thread*, e la regola
 * sta in `chat.service` per quel motivo.
 */
export async function destinatariStaffDellaCliente(
  prisma: PrismaService,
  clientId: string,
): Promise<string[]> {
  try {
    const profilo = (await prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { assignedCoachId: true, assignedNutritionistId: true },
    })) as { assignedCoachId: string | null; assignedNutritionistId: string | null } | null;
    if (!profilo) return [];

    const staffIds = [profilo.assignedCoachId, profilo.assignedNutritionistId].filter(
      (v): v is string => !!v,
    );
    if (staffIds.length) {
      const staff = (await prisma.staff.findMany({
        where: { id: { in: staffIds } },
        select: { userId: true },
      })) as { userId: string }[];
      const utenze = [...new Set(staff.map((s) => s.userId))];
      if (utenze.length) return utenze;
    }
    // Nessuno assegnato (o schede senza utenza): l'avviso non si butta via.
    return capiNutrizionisti(prisma);
  } catch {
    return [];
  }
}

/** Manda una notifica, col servizio se c'è, scrivendola in tabella se non c'è. */
async function manda(
  prisma: PrismaService,
  notifications: Notificatore | null,
  userId: string,
  avviso: AvvisoNutrizionista,
  payloadExtra: Record<string, unknown> = {},
): Promise<boolean> {
  const payload = { ...(avviso.payload ?? {}), ...payloadExtra };
  try {
    if (notifications) {
      await notifications.notify({ userId, type: avviso.type, title: avviso.title, body: avviso.body, payload });
      return true;
    }
    await prisma.notification.create({
      data: {
        userId,
        type: avviso.type,
        channel: 'inapp',
        scheduledFor: new Date(),
        sentAt: new Date(),
        payload: { title: avviso.title, body: avviso.body, ...payload } as never,
      } as never,
    });
    return true;
  } catch {
    return false;
  }
}

/** Avvisa la nutrizionista di una cliente (o i capi). Ritorna quante notifiche sono partite. */
export async function avvisaNutrizionistaDellaCliente(
  prisma: PrismaService,
  notifications: Notificatore | null,
  clientId: string,
  avviso: AvvisoNutrizionista,
): Promise<number> {
  try {
    const destinatari = await destinatariNutrizionista(prisma, clientId);
    let inviate = 0;
    for (const userId of destinatari) {
      if (await manda(prisma, notifications, userId, avviso, { clientId })) inviate += 1;
    }
    return inviate;
  } catch {
    // Vedi il commento in testa: un avviso che non parte non fa fallire il lavoro di chi chiama.
    return 0;
  }
}

/**
 * Avvisa **chi segue la cliente giorno per giorno**: la sua coach, e se non ce l'ha la
 * nutrizionista.
 *
 * Nasce dall'invito a riflettere sui cambi troppo frequenti (12/8): il messaggio dice alla cliente
 * «parlane con la tua coach», e una frase così ha senso solo se dall'altra parte qualcuno sa di
 * cosa parlerà. Il ripiego sulla nutrizionista non è un dettaglio: senza coach assegnata l'avviso
 * sparirebbe proprio per le clienti più scoperte.
 */
export async function avvisaCoachDellaCliente(
  prisma: PrismaService,
  notifications: Notificatore | null,
  clientId: string,
  avviso: AvvisoNutrizionista,
): Promise<number> {
  try {
    const profilo = (await prisma.clientProfile.findUnique({
      where: { userId: clientId },
      select: { assignedCoach: { select: { userId: true } } },
    })) as { assignedCoach: { userId: string } | null } | null;
    const coachUserId = profilo?.assignedCoach?.userId ?? null;
    if (!coachUserId) return avvisaNutrizionistaDellaCliente(prisma, notifications, clientId, avviso);
    return (await manda(prisma, notifications, coachUserId, avviso, { clientId })) ? 1 : 0;
  } catch {
    return 0;
  }
}

/**
 * Avvisa i capi nutrizionisti di una cosa che riguarda il CATALOGO e non una cliente (un gruppo di
 * equivalenza nuovo, per esempio). `esclusoUserId` evita l'avviso a chi l'ha appena fatto: dire a
 * qualcuno quello che ha fatto lui trenta secondi prima è il modo più rapido per insegnargli a
 * ignorare le notifiche.
 */
export async function avvisaCapiNutrizionisti(
  prisma: PrismaService,
  notifications: Notificatore | null,
  avviso: AvvisoNutrizionista,
  esclusoUserId?: string | null,
): Promise<number> {
  try {
    const destinatari = (await capiNutrizionisti(prisma)).filter((id) => id !== esclusoUserId);
    let inviate = 0;
    for (const userId of destinatari) {
      if (await manda(prisma, notifications, userId, avviso)) inviate += 1;
    }
    return inviate;
  } catch {
    return 0;
  }
}
