import type { PrismaService } from '../prisma/prisma.service';
import { idDellaRiserva } from './coach-di-riserva-chiave';

/**
 * IL PONTE FRA LEAD E CLIENTE.
 *
 * Il CRM ragiona per lead (`CrmRecord.assignedCoachId`), tutto il resto del backoffice ragiona
 * per profilo (`ClientProfile.assignedCoachId`): liste clienti, chat, attività della coach,
 * provvigioni, pausa vacanza — tutte filtrano sul profilo. Finché i due campi non vengono
 * agganciati, per il CRM la cliente è di Gioia e per il backoffice non è di nessuno.
 *
 * Segnalazione di Simone del 6/8: la coach manda le credenziali dal lead assegnato a lei e
 * subito dopo non riesce più ad aprire la scheda della cliente («non assegnata a nessuno»).
 * L'aggancio esisteva in due soli punti — l'accettazione del lead e l'onboarding — e mancava
 * proprio dove il cliente NASCE. Da qui questa funzione unica: chiunque colleghi un lead a un
 * account la chiama, e il ponte non si può più dimenticare in un ramo solo.
 *
 * Due regole, entrambe volute:
 *
 * 1. **Non sovrascrive mai.** Se il profilo ha già una coach, quella decisione vince: qui si
 *    riempie solo il vuoto. Spostare una cliente da una coach all'altra resta un atto esplicito
 *    (Utenti → assegna), non un effetto collaterale di un invio di credenziali.
 * 2. **Crea il profilo se non esiste**, con i soli campi di assegnazione. È sicuro: `objective`
 *    ha un default a schema e `onboardingCompletedAt` resta null, e il gate dell'onboarding —
 *    lato app e lato cron — guarda `onboardingCompletedAt`, non l'esistenza del profilo.
 *    (Effetto voluto: da adesso queste clienti rientrano anche nell'email di ciclo di vita
 *    «profilo_incompleto», che prima le saltava perché il profilo non c'era proprio.)
 *
 * Ritorna cosa ha fatto, per l'audit e per lo script di riparazione.
 *
 * ## ⛔ Dal 4/9 «vuoto» comprende la COACH DI RISERVA (`common/coach-di-riserva.ts`)
 *
 * Chi resta senza coach viene scritta in scheda alla riserva — un segnaposto che vuol dire «nessuno,
 * per ora». Senza questa riga la regola 1 la tratterebbe come una coach scelta: la coach che
 * accetta il lead il giorno dopo troverebbe la scheda «già assegnata», non scriverebbe niente, e
 * per il CRM la cliente sarebbe sua mentre per il backoffice resta di Giusy — cioè **lo stesso
 * difetto del 6/8 che questo ponte esiste per chiudere**, riaperto dalla riserva. Una revisione
 * avversariale l'ha visto prima che uscisse. ⚠️ Vale solo per la riserva: una coach vera in scheda
 * non si sovrascrive mai, come prima.
 *
 * ## ⛔ Dal 5/11 l'eccezione `sovrascriviCoach` — SOLO per l'accettazione del lead
 *
 * Caso Jessica: riassegnata in Gestione lead da MariaStella a Daniela, Daniela accetta, il CRM dice
 * «Daniela · accettato» e la scheda resta di MariaStella — la regola 1 aveva risposto «già
 * assegnato». Ma una riassegnazione fatta da un responsabile e accettata dalla coach È l'atto
 * esplicito di cui parla la regola 1: in `accept()` arrivano solo assegnazioni manuali
 * (`assignCoach` / `assignCoachMany`; il ref code nasce già «accepted» e non ci passa). Perciò
 * `accept()` passa `sovrascriviCoach: true`. ⚠️ Nessun altro chiamante deve passarlo: credenziali,
 * onboarding, invito Gaia e referral restano «riempi solo il vuoto».
 */
export type EsitoAggancio = 'creato' | 'completato' | 'gia_assegnato' | 'niente_da_fare';

export async function agganciaAssegnazioneAlProfilo(
  prisma: PrismaService,
  userId: string,
  rec: { name?: string | null; assignedCoachId: string | null; assignedNutritionistId?: string | null },
  opzioni: { sovrascriviCoach?: boolean } = {},
): Promise<EsitoAggancio> {
  const coachId = rec.assignedCoachId ?? null;
  const nutriId = rec.assignedNutritionistId ?? null;
  if (!coachId && !nutriId) return 'niente_da_fare';

  const prof = (await prisma.clientProfile.findUnique({
    where: { userId },
    select: { assignedCoachId: true, assignedNutritionistId: true },
  })) as { assignedCoachId: string | null; assignedNutritionistId: string | null } | null;

  if (!prof) {
    await prisma.clientProfile.create({
      data: {
        userId,
        name: rec.name?.trim() || null,
        assignedCoachId: coachId,
        assignedNutritionistId: nutriId,
      },
    });
    return 'creato';
  }

  const patch: { assignedCoachId?: string; assignedNutritionistId?: string } = {};
  const riservaId = coachId && prof.assignedCoachId && prof.assignedCoachId !== coachId ? await idDellaRiserva(prisma) : null;
  const coachSostituibile =
    opzioni.sovrascriviCoach === true || !prof.assignedCoachId || (riservaId !== null && prof.assignedCoachId === riservaId);
  if (coachId && coachSostituibile && coachId !== prof.assignedCoachId) patch.assignedCoachId = coachId;
  if (nutriId && !prof.assignedNutritionistId) patch.assignedNutritionistId = nutriId;
  if (Object.keys(patch).length === 0) return 'gia_assegnato';

  await prisma.clientProfile.update({ where: { userId }, data: patch });
  return 'completato';
}
