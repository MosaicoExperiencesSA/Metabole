/**
 * CHI PRENDE IN CARICO UNA CLIENTE NUOVA, FINCHÉ LA NUTRIZIONISTA È UNA SOLA.
 *
 * ## Il fatto (21/8)
 *
 * Sonia ha finito il questionario il 7/8 con sei allergie dichiarate. `diag:cliente`, il 21/8:
 * **«Nutrizionista: — nessuna —»**. Le sue segnalazioni cliniche — screening, «serve la visita»,
 * piano bloccato — sono nate assegnate a `nutritionistId ?? undefined`, cioè **a nessuno**: in
 * elenco ci sono, ma nessuno le riceve. È lo stesso buco descritto in `apri-segnalazione.ts`
 * («una segnalazione senza destinatario non è una segnalazione»), che lì è stato chiuso per le
 * segnalazioni e qui, a monte, era rimasto aperto per le **clienti**.
 *
 * Il commento nel questionario diceva: «coach e nutrizionista NON si assegnano in automatico — li
 * assegna il responsabile dal backoffice». È una regola sensata **quando c'è più di una
 * nutrizionista**: distribuire i pazienti è una decisione. Con una sola, non è una decisione: è un
 * passaggio a mano che qualche volta non viene fatto, e quando non viene fatto la cliente resta
 * senza nessuno che risponda di lei.
 *
 * ## La regola
 *
 * Finché il parametro `assign_head_nutritionist_by_default` è acceso, chi finisce il questionario
 * **senza** una nutrizionista sul lead viene assegnata al **capo nutrizionista** — la stessa
 * persona che `apri-segnalazione.ts` già sceglie come destinatario quando il ruolo non è assegnato.
 * Le due strade dicono così la stessa cosa.
 *
 * ⚠️ **Non sovrascrive mai niente**: se il lead ha già una nutrizionista (ref code, assegnazione dal
 * CRM), vince quella. Qui si riempie solo il vuoto.
 *
 * ⚠️ **E si spegne da sé quando smette di avere senso.** Quando in squadra c'è più di una
 * nutrizionista, questa funzione continua a rispondere ma lo **dice a chi chiama** (`altre`), così
 * il richiamo compare nei log e nel backoffice invece di restare una regola dimenticata accesa. Il
 * momento di spegnere il parametro è quello, e non prima.
 */

/** Il minimo del client Prisma che serve: così è testabile con un oggetto finto. */
export interface PrismaPerRiferimento {
  staff: {
    findMany(args: unknown): Promise<{ id: string; userId: string; user?: { role?: string | null } | null }[]>;
  };
}

export interface NutrizionistaDiRiferimento {
  /** Lo `Staff.id` da scrivere in `ClientProfile.assignedNutritionistId`. */
  staffId: string;
  userId: string;
  /** Quante ALTRE nutrizioniste esistono oltre al capo. Se > 0 la regola ha fatto il suo tempo. */
  altre: number;
}

export const PARAM_CAPO_PREDEFINITO = 'assign_head_nutritionist_by_default';

/**
 * Il capo nutrizionista, se c'è. `null` quando non esiste nessuno con quel ruolo: in quel caso
 * chi chiama lascia il campo vuoto com'era — inventarsi un destinatario sarebbe peggio.
 */
export async function nutrizionistaDiRiferimento(
  prisma: PrismaPerRiferimento,
): Promise<NutrizionistaDiRiferimento | null> {
  const righe = await prisma.staff.findMany({
    where: { user: { role: { in: ['head_nutritionist', 'nutritionist'] } } },
    select: { id: true, userId: true, user: { select: { role: true } } },
  });
  const capo = righe.find((s) => s.user?.role === 'head_nutritionist');
  if (!capo) return null;
  return { staffId: capo.id, userId: capo.userId, altre: righe.filter((s) => s.id !== capo.id).length };
}
