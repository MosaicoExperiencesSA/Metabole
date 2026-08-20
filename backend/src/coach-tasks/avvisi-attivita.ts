/**
 * GLI AVVISI DELLE ATTIVITÀ COACH — la push alla creazione e l'escalation alla manager.
 *
 * Richieste di Simone del 14/8 (decisione in `progetto/NOTA_Attivita_Coach_Push_Escalation.md`):
 * «queste notifiche arrivano alla coach anche via push?» — non arrivavano: le attività nascevano
 * dal cron e comparivano solo in pagina — «e se la coach non le chiude vanno mandate alla manager
 * delle coach, dopo 24 ore, da quando andava fatta».
 *
 * Funzioni libere che ricevono `prisma` e `push`, come `notifica-utente.ts` e `avvisa-capo.ts`:
 * si provano con un finto e non trascinano moduli. ⚠️ Nessuna delle due lancia mai — chi chiama
 * sta creando attività dentro il giro del cron, e un avviso che non parte non deve fermarlo.
 */
import { Logger } from '@nestjs/common';
import { destinatariManagerCoach } from '../common/avvisa-manager-coach';
import { notificaUtente, PushMinimo } from '../notifications/notifica-utente';
import { aGiorno } from '../common/date-only';
import type { PrismaService } from '../prisma/prisma.service';

const logger = new Logger('AvvisiAttivitaCoach');

/**
 * ⚠️ Il tetto per giro: al primo lancio le attività scadute accumulate possono essere decine, e
 * un'inondazione di push insegna alla manager a spegnerle. Oltre il tetto si dice quante restano
 * (mai un taglio muto) e si continua al giro dopo.
 */
export const MAX_ESCALATION_PER_GIRO = 20;

export interface AttivitaAppenaCreata {
  id: string;
  clientId: string;
  title: string;
  description?: string | null;
  dueDate: Date;
}

/**
 * LA PUSH ALLA CREAZIONE. Senza coach assegnata non si manda niente — la vede il responsabile in
 * pagina, come già per «piano in scadenza».
 *
 * ⚠️ **Qui c'era scritto «chiamata da `ensureTask`, l'unico punto in cui nasce ogni attività:
 * nessun tipo può sfuggire». Non era vero** (trovato il 20/8): `measures_missing` nasceva da un
 * `coachTask.create` scritto a mano dentro il sollecito misure, e alla coach non arrivava niente —
 * «a questa cliente il menu è fermo» compariva solo in elenco. La riga sbagliata è la parte che è
 * costata: la regola era scritta, quindi chi la leggeva non aveva ragione di controllare.
 *
 * Adesso creare e avvisare sono la **stessa** funzione (`apriAttivitaCoach` in
 * `porta-delle-attivita.ts`): non si può più fare l'una senza l'altra. E la regola non è più solo
 * scritta — la tiene ferma `una-porta-per-le-attivita.spec.ts`, che guarda il sorgente.
 */
export async function avvisaAttivitaNuova(
  prisma: PrismaService,
  push: PushMinimo,
  attivita: AttivitaAppenaCreata,
): Promise<void> {
  try {
    const profilo = (await prisma.clientProfile.findUnique({
      where: { userId: attivita.clientId },
      select: { name: true, assignedCoach: { select: { userId: true } } },
    })) as { name: string | null; assignedCoach: { userId: string } | null } | null;
    const coachUserId = profilo?.assignedCoach?.userId ?? null;
    if (!coachUserId) return;

    const cliente = profilo?.name ?? 'una tua cliente';
    const scadenza = attivita.dueDate.toLocaleDateString('it-IT');
    await notificaUtente(prisma, push, {
      userId: coachUserId,
      type: 'coach_task_new',
      title: 'Nuova attività per te 📋',
      body: `${attivita.title} — ${cliente} (entro il ${scadenza}). La trovi in Dashboard.`,
      payload: { taskId: attivita.id, clientId: attivita.clientId },
    });
  } catch (err) {
    logger.warn(`Avviso attività nuova non mandato (task=${attivita?.id}): ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * L'ESCALATION: le attività ancora «da fare» con la scadenza di IERI o prima — cioè al primo giro
 * del giorno dopo quello in cui andavano fatte («24 ore da quando andava fatta») — vanno alla
 * manager delle coach (ruolo `sales`; admin di riserva: un avviso senza destinatario non è un
 * avviso).
 *
 * ⚠️ UNA VOLTA SOLA per attività, senza colonna nuova: l'idempotenza è la notifica stessa —
 * se esiste già una `coach_task_escalation` con quel `payload.taskId`, non si rimanda.
 * (Niente migrazione di proposito: `schema.prisma` è un file conteso, decisione nella NOTA.)
 */
export async function escalateAttivitaScadute(
  prisma: PrismaService,
  push: PushMinimo,
): Promise<{ avvisate: number; rimaste: number }> {
  try {
    // ⚠️ Il giorno di **Roma**: era `setHours(0,0,0,0)`, cioè UTC su Render. L'escalation guarda le
    // attività con la scadenza di IERI o prima, e con il giorno spostato mandava alla manager —
    // nelle due ore dopo mezzanotte — attività che in Italia scadevano *oggi*.
    const oggi = aGiorno(new Date());

    const scadute = (await prisma.coachTask.findMany({
      where: { status: 'todo', dueDate: { lt: oggi } } as never,
      orderBy: { dueDate: 'asc' },
      take: 300,
      include: {
        client: {
          select: {
            firstName: true,
            lastName: true,
            clientProfile: { select: { name: true, assignedCoach: { select: { displayName: true, userId: true } } } },
          },
        },
      },
    })) as {
      id: string; clientId: string; title: string; dueDate: Date;
      client: {
        firstName: string | null; lastName: string | null;
        clientProfile: { name: string | null; assignedCoach: { displayName: string | null; userId: string } | null } | null;
      } | null;
    }[];
    if (!scadute.length) return { avvisate: 0, rimaste: 0 };

    const destinatari = await destinatariManagerCoach(prisma);
    if (!destinatari.length) {
      logger.warn(`Escalation attività: ${scadute.length} scadute ma NESSUN destinatario (né sales né admin attivi).`);
      return { avvisate: 0, rimaste: scadute.length };
    }

    let avvisate = 0;
    let daFare = 0;
    for (const t of scadute) {
      if (avvisate >= MAX_ESCALATION_PER_GIRO) { daFare++; continue; }
      // La notifica già mandata È la memoria: una per attività, per sempre.
      const giaMandata = await prisma.notification.findFirst({
        where: { type: 'coach_task_escalation', payload: { path: ['taskId'], equals: t.id } } as never,
        select: { id: true },
      });
      if (giaMandata) continue;

      const coach = t.client?.clientProfile?.assignedCoach?.displayName ?? 'coach non assegnata';
      const cliente = t.client?.clientProfile?.name
        ?? [t.client?.firstName, t.client?.lastName].filter(Boolean).join(' ')
        ?? 'una cliente';
      const scadenza = t.dueDate.toLocaleDateString('it-IT');
      for (const userId of destinatari) {
        await notificaUtente(prisma, push, {
          userId,
          type: 'coach_task_escalation',
          title: 'Attività coach rimasta aperta ⏰',
          body: `${coach}: «${t.title}» per ${cliente} scadeva il ${scadenza} ed è ancora da fare.`,
          payload: { taskId: t.id, clientId: t.clientId },
        });
      }
      avvisate++;
    }
    if (daFare > 0) {
      logger.warn(`Escalation attività: tetto di ${MAX_ESCALATION_PER_GIRO} per giro raggiunto, ${daFare} rimandate al prossimo.`);
    }
    return { avvisate, rimaste: daFare };
  } catch (err) {
    logger.warn(`Escalation attività non riuscita: ${err instanceof Error ? err.message : String(err)}`);
    return { avvisate: 0, rimaste: 0 };
  }
}
