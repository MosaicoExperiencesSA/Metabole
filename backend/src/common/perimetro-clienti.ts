/**
 * «LE CLIENTI DELLA MIA RETE» — una definizione sola, per tutte le pagine che la usano.
 *
 * Nasce dalla richiesta di Simone dell'11/8: «la tabella acquisti voglio renderla visibile alle
 * coach, ma devono vedere solo le clienti nella loro rete». La regola esisteva già, scritta dentro
 * `ClientsService` come metodo privato: aprire una seconda pagina allo stesso perimetro voleva dire
 * copiarla, e un perimetro copiato è un perimetro che prima o poi divergerà — con la differenza che
 * qui la divergenza non è un difetto grafico, è una coach che vede i pagamenti delle clienti di
 * un'altra.
 *
 * ## Le tre risposte possibili
 *
 * - `null` — **nessun limite**. Non vuol dire «nessun accesso»: vuol dire che chi guarda non ha un
 *   perimetro (admin, responsabile commerciale, capo nutrizioniste). Chi può entrare in una pagina
 *   l'ha già deciso la guardia dei ruoli del controller; questo modulo risponde solo a «quanto vede».
 * - `{ field: 'assignedCoachId', staffIds }` — la coach vede le sue clienti; la coordinatrice le sue
 *   più quelle delle coach del suo team (`coachTeamScope`).
 * - `{ field: 'assignedNutritionistId', staffIds }` — la nutrizionista vede le sue.
 *
 * ## Il dettaglio che rende sicuro il ripiego
 *
 * Se un membro dello staff non ha una scheda `Staff`, il perimetro NON diventa «tutto»: diventa un id
 * impossibile, quindi zero clienti. È la scelta giusta in una funzione che decide chi vede i dati di
 * chi: sbagliare per difetto si vede subito e si aggiusta, sbagliare per eccesso non si vede affatto.
 */
import type { PrismaService } from '../prisma/prisma.service';
import { coachTeamScope, isCoachLike } from './coach-team';

/** Id usato quando lo staff non ha una scheda: non corrisponde a nessuno, di proposito. */
const NESSUNO = '00000000-0000-0000-0000-000000000000';

export interface PerimetroClienti {
  /** Il campo di `ClientProfile` su cui filtrare. */
  field: 'assignedCoachId' | 'assignedNutritionistId';
  /** Gli staff id ammessi (già comprensivi del team, per la coordinatrice). */
  staffIds: string[];
}

/**
 * Il vincolo da applicare per far vedere a `actorUserId` solo le sue clienti.
 * `null` = nessun vincolo (chi guarda non ha un perimetro).
 */
export async function perimetroClienti(
  prisma: PrismaService,
  actorUserId: string | null | undefined,
): Promise<PerimetroClienti | null> {
  if (!actorUserId) return null;
  const actor = (await prisma.user.findUnique({
    where: { id: actorUserId },
    select: { role: true },
  })) as { role: string } | null;
  const role = actor?.role;

  if (isCoachLike(role)) {
    // Coach → le sue; coordinatrice → sue + quelle delle coach del suo team.
    const ids = (await coachTeamScope(prisma, actorUserId)) ?? [];
    return { field: 'assignedCoachId', staffIds: ids.length ? ids : [NESSUNO] };
  }
  if (role !== 'nutritionist') return null;
  const staff = (await prisma.staff.findUnique({
    where: { userId: actorUserId },
    select: { id: true },
  })) as { id: string } | null;
  return { field: 'assignedNutritionistId', staffIds: [staff?.id ?? NESSUNO] };
}

/**
 * La condizione Prisma per filtrare una tabella che punta alla **cliente** (`clientId` verso `User`)
 * sul perimetro di chi guarda: `{}` quando non c'è perimetro, così si può sempre fare lo spread
 * dentro un `where` senza rami condizionali nel chiamante.
 */
export function filtroPerimetroSuCliente(perimetro: PerimetroClienti | null): Record<string, unknown> {
  if (!perimetro) return {};
  return { client: { clientProfile: { [perimetro.field]: { in: perimetro.staffIds } } } };
}

/**
 * true se quella cliente è nel perimetro. Serve alle azioni su UNA riga (scaricare una ricevuta):
 * filtrare l'elenco non basta, perché l'id di una riga fuori elenco si può sempre chiedere a mano.
 */
export async function clienteNelPerimetro(
  prisma: PrismaService,
  perimetro: PerimetroClienti | null,
  clientUserId: string | null | undefined,
): Promise<boolean> {
  if (!perimetro) return true;
  if (!clientUserId) return false;
  const profilo = (await prisma.clientProfile.findUnique({
    where: { userId: clientUserId },
    select: { assignedCoachId: true, assignedNutritionistId: true },
  })) as { assignedCoachId: string | null; assignedNutritionistId: string | null } | null;
  const assegnato = profilo?.[perimetro.field] ?? null;
  return !!assegnato && perimetro.staffIds.includes(assegnato);
}
