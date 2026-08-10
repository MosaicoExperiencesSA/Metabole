import type { PrismaService } from '../prisma/prisma.service';
import { reteSottoDiMe } from './rete-staff';

/**
 * Rete coach a tre livelli (coach → coordinatrice → manager): portata di
 * visibilità per i ruoli "coach-like".
 *
 * - coach              → SOLO le proprie clienti (il proprio staff id)
 * - coach_coordinator  → le proprie clienti + quelle di TUTTA la rete sotto di lei, a qualunque
 *                        livello (11/8: la rete è a tre livelli, e fermarsi al primo rendeva la
 *                        responsabile cieca sulle clienti delle coach delle sue coordinatrici)
 * - altri ruoli        → null = nessun filtro (vede tutto; la guardia ruoli del
 *                        controller ha già deciso chi può entrare)
 *
 * Senza scheda staff → id impossibile: non vede nulla, mai tutto per errore.
 */
export const COACH_LIKE_ROLES = ['coach', 'coach_coordinator'] as const;

export function isCoachLike(role: string | null | undefined): boolean {
  return role === 'coach' || role === 'coach_coordinator';
}

const NO_STAFF = '00000000-0000-0000-0000-000000000000';

export async function coachTeamScope(prisma: PrismaService, actorUserId?: string | null): Promise<string[] | null> {
  if (!actorUserId) return null;
  const u = (await prisma.user.findUnique({ where: { id: actorUserId }, select: { role: true } })) as { role: string } | null;
  if (!isCoachLike(u?.role)) return null;
  const staff = (await prisma.staff.findUnique({ where: { userId: actorUserId }, select: { id: true } })) as { id: string } | null;
  if (!staff) return [NO_STAFF];
  if (u?.role === 'coach') return [staff.id];
  /**
   * Coordinatrice e responsabile: lei **e tutta la rete sotto di lei**, per quanti livelli ha.
   *
   * Prima qui c'era un livello solo (`managerId = lei`), e la rete è a tre: coach → coordinatrice →
   * responsabile. Quindi la responsabile vedeva le sue coordinatrici e non le clienti delle coach
   * sotto di loro — cioè era cieca esattamente sulle persone che il suo ruolo esiste per seguire.
   * Segnalato l'11/8 partendo dalle chat: «i permessi di lettura devono risalire la rete, quindi
   * coach, coordinatrice, responsabile». Vedi `rete-staff.ts`.
   */
  return reteSottoDiMe(prisma, staff.id);
}
