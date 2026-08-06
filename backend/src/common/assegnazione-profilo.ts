import type { PrismaService } from '../prisma/prisma.service';

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
 */
export type EsitoAggancio = 'creato' | 'completato' | 'gia_assegnato' | 'niente_da_fare';

export async function agganciaAssegnazioneAlProfilo(
  prisma: PrismaService,
  userId: string,
  rec: { name?: string | null; assignedCoachId: string | null; assignedNutritionistId?: string | null },
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
  if (coachId && !prof.assignedCoachId) patch.assignedCoachId = coachId;
  if (nutriId && !prof.assignedNutritionistId) patch.assignedNutritionistId = nutriId;
  if (Object.keys(patch).length === 0) return 'gia_assegnato';

  await prisma.clientProfile.update({ where: { userId }, data: patch });
  return 'completato';
}
