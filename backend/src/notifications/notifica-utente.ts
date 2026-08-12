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
 */
export async function notificaUtente(
  prisma: PrismaService,
  push: PushMinimo,
  input: NotificaUtenteInput,
): Promise<void> {
  try {
    const recipient = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true, prefs: true },
    });
    if (!recipient) return;
    // Opt-out per tipo dello staff (tabella nel profilo). Le clienti non usano questo path.
    if (staffDisabledTypes(recipient.prefs).includes(input.type)) return;
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
    // ⚠️ `datiPush` e non `{ type }`: senza il resto, il tocco sulla push non sa dove portare.
    await push.sendToUser(input.userId, input.title, input.body, datiPush(input.type, input.payload));
  } catch {
    /* una notifica che non parte non deve far fallire l'operazione che l'ha generata */
  }
}
