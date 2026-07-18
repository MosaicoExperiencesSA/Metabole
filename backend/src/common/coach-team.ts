import type { PrismaService } from '../prisma/prisma.service';

/**
 * Rete coach a tre livelli (coach → coordinatrice → manager): portata di
 * visibilità per i ruoli "coach-like".
 *
 * - coach              → SOLO le proprie clienti (il proprio staff id)
 * - coach_coordinator  → le proprie clienti + quelle delle coach del suo team
 *                        (staff con managerId = il suo staff id)
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
  // Coordinatrice: lei + le coach del suo team diretto.
  const team = (await prisma.staff.findMany({
    where: { managerId: staff.id, user: { role: { in: ['coach', 'coach_coordinator'] as never } } } as never,
    select: { id: true },
  })) as { id: string }[];
  return [staff.id, ...team.map((t) => t.id)];
}
