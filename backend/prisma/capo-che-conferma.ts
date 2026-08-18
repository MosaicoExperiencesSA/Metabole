/**
 * CHI FIRMA UNA CONFERMA CLINICA — una domanda, una risposta.
 *
 * Il capo nutrizionista attivo, cioè la persona a cui si intesta un valore approvato. La regola era
 * già scritta dentro `importa-ig.ts` (Decisioni §10 del 13/8); dal 18/8 serve anche al seed dei
 * valori nutrizionali, e due copie della stessa ricerca sono due modi di scegliere un capo diverso
 * il giorno che ce ne sono due.
 *
 * ⚠️ Se i capi attivi sono più d'uno si prende **il più anziano** — deterministico, e il chiamante
 * lo dice a voce alta invece di sceglierne uno a caso a ogni giro.
 *
 * ⚠️ `null` = non c'è nessuno a cui intestare la firma. Chi chiama **non deve ripiegare** scrivendo
 * i valori senza conferma: una riga confermata da nessuno è una bugia scritta in una colonna che
 * dice «l'ha guardata una persona».
 */
export interface CapoCheConferma {
  /** L'id della riga `staff`, che è quello che va in `verifiedById`. */
  staffId: string;
  nome: string;
  /** Quanti capi attivi c'erano: > 1 va detto, perché la scelta è nostra e non sua. */
  quanti: number;
  /** Perché non si può firmare, quando `staffId` non c'è. */
  problema?: string;
}

type PrismaMinimo = {
  user: { findMany: (args: unknown) => Promise<unknown> };
  staff: { findUnique: (args: unknown) => Promise<unknown> };
};

export async function capoCheConferma(prisma: PrismaMinimo): Promise<CapoCheConferma | null> {
  const capi = (await prisma.user.findMany({
    where: { role: 'head_nutritionist', status: 'active', deletedAt: null },
    select: { id: true, email: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })) as { id: string; email: string }[];
  if (!capi.length) return null;

  const capo = capi[0];
  const staffCapo = (await prisma.staff.findUnique({
    where: { userId: capo.id },
    select: { id: true, displayName: true },
  })) as { id: string; displayName: string | null } | null;
  if (!staffCapo) return null;

  return { staffId: staffCapo.id, nome: staffCapo.displayName ?? capo.email, quanti: capi.length };
}
