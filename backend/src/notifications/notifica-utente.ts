/**
 * NOTIFICARE UN UTENTE (in app + push) — in un posto solo, senza passare da un servizio.
 *
 * È il corpo di `NotificationsService.notify`, estratto qui perché serviva a un chiamante che
 * **non può dipendere da `NotificationsService`**: `MenuService`. `NotificationsModule` importa
 * `MenuModule` (le notifiche leggono il menu del giorno), quindi la freccia opposta chiuderebbe un
 * cerchio — e un `forwardRef` messo lì per farlo tacere non è una soluzione, è un rinvio.
 *
 * La forma è la stessa di `avvisaCoachDellaCliente`: una funzione libera che riceve `prisma` e
 * `push`. Chi ha il servizio continua a usare il servizio (che ora delega qui); chi ha solo le due
 * dipendenze di base chiama direttamente questa. Il comportamento è uno, quindi non può divergere.
 */
import { datiPush } from './dati-push';
import type { PrismaService } from '../prisma/prisma.service';

/** Il minimo che serve: così la funzione si usa da qualunque servizio (e si prova con un finto). */
export interface PushMinimo {
  sendToUser(userId: string, title: string, body: string, data?: Record<string, string>): Promise<void>;
}

export interface NotificaUtenteInput {
  userId: string;
  type: string;
  title: string;
  body: string;
  payload?: Record<string, unknown>;
}

/** Legge i tipi disattivati dello staff da `User.prefs.notificationsDisabled`. */
export function staffDisabledTypes(prefs: unknown): string[] {
  const p = (prefs as Record<string, unknown> | null) ?? {};
  const raw = p['notificationsDisabled'];
  return Array.isArray(raw) ? (raw as unknown[]).filter((x): x is string => typeof x === 'string') : [];
}

/**
 * Crea la notifica in app e manda la push. Rispetta l'opt-out per tipo dello staff.
 *
 * Non lancia mai: chi chiama sta facendo il lavoro vero (attivare una prova, erogare un menu) e un
 * avviso che non parte non deve far tornare indietro quel lavoro.
 *
 * ⛔ **RENDE SE LA RIGA È STATA SCRITTA DAVVERO** — 9/9, trovato da una revisione avversariale.
 *
 * Rendeva `void`, e il `catch` qui sotto si mangia tutto: il destinatario che non esiste, l'opt-out,
 * il database che rifiuta. Chi chiamava non aveva modo di sapere se l'avviso era partito — e da
 * quando le porte di Vera riscrivono i menu che una cliente ha già in mano, la frase che la
 * nutrizionista legge dice «l'ho avvisata». Detta su un avviso mai scritto, manda a casa una persona
 * con la spesa vecchia e lascia chi lavora convinta che sia a posto: nessuno dei due lo scoprirà.
 *
 * ⚠️ **`false` non è un errore, è un fatto**: vale anche quando l'utente non c'è più o ha spento
 * quel tipo di avviso. La domanda a cui questo booleano risponde è una sola — *gliel'abbiamo
 * detto?* — e chi chiama decide cosa farne. ⚠️ La push non conta: è l'aggiunta, e un telefono senza
 * permesso è normale. Quello che conta è la riga che lei trova nella campanella.
 *
 * ⚠️ I chiamanti che l'esito non lo guardano continuano a valere: `Promise<boolean>` sta dove
 * stava `Promise<void>`.
 */
export async function notificaUtente(
  prisma: PrismaService,
  push: PushMinimo,
  input: NotificaUtenteInput,
): Promise<boolean> {
  try {
    const recipient = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true, prefs: true },
    });
    if (!recipient) return false;
    /**
     * Opt-out per tipo dello **staff** (tabella in `User.prefs`).
     *
     * ⚠️ **Dall'8/9 anche una CLIENTE passa di qui** — l'avviso «il menu di … è cambiato» — e la
     * riga di prima diceva «le clienti non usano questo path». Chi la leggeva concludeva che le
     * preferenze delle clienti (`clientProfile.notificationPrefs`) non servissero mai qui.
     *
     * ⛔ **Quell'avviso non si spegne, ed è una scelta**: dice a una persona che sta per cucinare o
     * ha appena fatto la spesa che il piatto è cambiato. Non è un promemoria da silenziare, e per
     * questo non è in `CLIENT_NOTIFICATION_TYPES`. Un tipo nuovo per le clienti che **non** abbia
     * questa natura non va aggiunto qui senza prima passare dalle loro preferenze.
     */
    if (staffDisabledTypes(recipient.prefs).includes(input.type)) return false;
    await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        payload: { title: input.title, body: input.body, ...(input.payload ?? {}) } as never,
        channel: 'inapp',
        scheduledFor: new Date(),
        sentAt: new Date(),
      },
    });
    /**
     * ⚠️ **La push si manda dopo, e se cade non cambia l'esito**: la riga in app c'è, e quella è
     * l'avviso. Un `false` qui manderebbe a telefonare a chi l'avviso ce l'ha già nella campanella.
     */
    try {
      // ⚠️ `datiPush` e non `{ type }`: senza il resto, il tocco sulla push non sa dove portare.
      await push.sendToUser(input.userId, input.title, input.body, datiPush(input.type, input.payload));
    } catch { /* il telefono può non esserci: la riga in app è già scritta */ }
    return true;
  } catch {
    /* una notifica che non parte non deve far fallire l'operazione che l'ha generata */
    return false;
  }
}
