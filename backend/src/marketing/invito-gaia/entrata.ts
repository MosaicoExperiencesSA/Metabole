import type { PrismaService } from '../../prisma/prisma.service';
import { destinatariManagerCoach } from '../../common/avvisa-manager-coach';
import { nomeCortese } from './regole';

/**
 * «Va mandata una notifica alla coach se fanno login dopo la mail, e se non hanno coach alla
 * manager» — Simone, 16/9.
 *
 * Si chiama a ogni accesso e a ogni registrazione di una cliente (`AuthService`). Non fa niente se
 * la persona non ha ricevuto l'invito a Gaia, o se l'avviso è già partito: `enteredAt` si scrive
 * con una `updateMany` condizionata, quindi due accessi quasi contemporanei avvisano UNA volta.
 *
 * Il destinatario:
 * - la coach della cliente (quella del profilo, altrimenti quella della scheda CRM), se è attiva;
 * - altrimenti la manager delle coach (o gli admin, se non ce n'è una): stessa regola di
 *   «hai un nuovo lead da assegnare», un avviso senza destinatario non è un avviso.
 *
 * ⛔ Non lancia mai: chi chiama sta facendo entrare una persona nell'app.
 */
export const TIPO_ENTRATA_INVITO = 'invito_gaia_entrata';

/** Il minimo del servizio notifiche: `false` = la riga non è stata scritta (opt-out, utente sparito). */
export interface NotificatoreEntrata {
  notify(input: { userId: string; type: string; title: string; body: string; payload?: Record<string, unknown> }): Promise<boolean | void>;
}

export async function segnaEntrataInvitoGaia(
  prisma: PrismaService,
  notificatore: NotificatoreEntrata | null | undefined,
  userId: string,
  log: { warn(m: string): void } = console,
  adesso: Date = new Date(),
): Promise<number> {
  try {
    const campi = {
      id: true,
      name: true,
      firstName: true,
      email: true,
      assignedCoachId: true,
      assignmentStatus: true,
      gaiaInvite: { select: { id: true, sentAt: true, enteredAt: true } },
    } as const;
    type Rec = {
      id: string;
      name: string | null;
      firstName: string | null;
      email: string | null;
      assignedCoachId: string | null;
      assignmentStatus: string | null;
      gaiaInvite: { id: string; sentAt: Date | null; enteredAt: Date | null } | null;
    };
    let rec = (await prisma.crmRecord.findUnique({ where: { clientId: userId }, select: campi })) as Rec | null;
    /**
     * ⚠️ Chi si registra dall'app invece di usare il link può finire collegata a un'ALTRA scheda con
     * lo stesso indirizzo (le liste storiche hanno doppioni): l'invito allora si cerca per indirizzo.
     * Anche quando la scheda collegata HA una riga, ma senza invio: è la doppiona scartata.
     */
    if (!rec?.gaiaInvite?.sentAt) {
      const utente = (await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })) as { email: string } | null;
      const email = utente?.email?.trim().toLowerCase();
      const perIndirizzo = email
        ? ((await prisma.gaiaInvite.findUnique({ where: { email }, select: { crmRecord: { select: campi } } })) as { crmRecord: Rec } | null)
        : null;
      if (perIndirizzo?.crmRecord) rec = perIndirizzo.crmRecord;
    }
    const invito = rec?.gaiaInvite;
    if (!rec || !invito || !invito.sentAt || invito.enteredAt) return 0;

    const presa = await prisma.gaiaInvite.updateMany({
      where: { id: invito.id, enteredAt: null },
      data: { enteredAt: adesso },
    });
    if (presa.count === 0) return 0;

    const profilo = (await prisma.clientProfile.findUnique({
      where: { userId },
      select: { assignedCoachId: true },
    })) as { assignedCoachId: string | null } | null;
    // La coach della scheda conta solo se ha ACCETTATO: una da accettare può ancora rifiutarla.
    const coachId = profilo?.assignedCoachId ?? (rec.assignmentStatus === 'accepted' ? rec.assignedCoachId : null) ?? null;
    const coach = coachId
      ? ((await prisma.staff.findUnique({
          where: { id: coachId },
          select: { userId: true, active: true, user: { select: { status: true, deletedAt: true } } },
        })) as { userId: string; active: boolean; user: { status: string; deletedAt: Date | null } | null } | null)
      : null;
    const coachAttiva = !!coach && coach.active && coach.user?.status === 'active' && !coach.user?.deletedAt;

    // Allo staff il nome intero (deve riconoscerla fra le sue schede), ripulito dalle maiuscole
    // delle liste storiche solo se manca del tutto.
    const chi = rec.name?.trim() || (nomeCortese(rec.firstName, null) !== 'Ciao' ? nomeCortese(rec.firstName, null) : '') || rec.email || 'Una lead';

    let destinatari: string[];
    let titolo: string;
    let testo: string;
    let payload: Record<string, unknown>;
    if (coachAttiva && coach) {
      destinatari = [coach.userId];
      titolo = 'Una tua lead è entrata grazie a Gaia';
      testo = `${chi} è entrata nell'app dopo l'email di invito a Gaia. È il momento buono per scriverle.`;
      payload = { clientId: userId, recordId: rec.id };
    } else {
      destinatari = await destinatariManagerCoach(prisma);
      titolo = 'Lead entrata con l’invito a Gaia, senza coach';
      testo = `${chi} è entrata nell'app dopo l'email di invito a Gaia e non ha ancora una coach: assegnala adesso, finché è curiosa.`;
      payload = { url: '/crm/da-assegnare', clientId: userId, recordId: rec.id };
    }

    let avvisati = 0;
    for (const d of destinatari) {
      if (!notificatore) break;
      const scritta = await notificatore.notify({ userId: d, type: TIPO_ENTRATA_INVITO, title: titolo, body: testo, payload });
      if (scritta !== false) avvisati += 1;
    }
    if (!avvisati) log.warn(`[invito-gaia] ${userId} è entrata dopo l'invito, ma nessun avviso è partito (destinatari: ${destinatari.length}).`);
    return avvisati;
  } catch (e) {
    log.warn(`[invito-gaia] avviso di entrata non riuscito per ${userId}: ${e instanceof Error ? e.message : String(e)}`);
    return 0;
  }
}
