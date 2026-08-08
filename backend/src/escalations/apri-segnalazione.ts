import { ESCALATION_CATEGORY_LABEL, ESCALATION_ROUTING, EscalationCategory } from './escalation-routing';

/**
 * Apre una segnalazione **e avvisa qualcuno**. Senza dipendenze da Nest, come `avanza-stato.ts`.
 *
 * ## Perché non basta il servizio che c'era
 *
 * `EscalationRoutingService` fa la cosa giusta, ma non lo usava nessuno dei due punti in cui
 * nascono le segnalazioni più gravi — `personal-base` e `menu` scrivevano la riga direttamente
 * a database. Non per distrazione: importare quel servizio dentro MenuModule chiude un anello
 * fra i moduli (Notifications → Menu → Notifications) e Nest non parte. Questa funzione riceve
 * il client Prisma e basta, quindi la può chiamare chiunque.
 *
 * ## E soprattutto: se non c'è nessuno assegnato, la segnalazione la vede il RESPONSABILE
 *
 * È il buco che è costato caro. Una cliente si iscrive il 20 luglio, dichiara una condizione
 * clinica e un'allergia, il motore non riesce a comporre un piano sicuro e apre tre
 * segnalazioni. Nessuna nutrizionista le era ancora stata assegnata, quindi le segnalazioni
 * restano **senza destinatario**: nessuna notifica, nessuna email, nessuno che le veda se non
 * andando a cercare l'elenco di sua iniziativa. Risultato: quattro giorni di menu senza pranzo
 * né cena, la prova gratuita scaduta il 30 luglio senza che nessuno l'abbia richiamata, e venti
 * giorni di silenzio. Tutto questo senza un solo errore da nessuna parte.
 *
 * Da qui la regola: se il ruolo che dovrebbe prenderla in carico non è assegnato, la
 * segnalazione va comunque a **chi risponde di quel ruolo** — capo nutrizionista o
 * coordinatrice coach. Una segnalazione senza destinatario non è una segnalazione.
 *
 * ⚠️ Le notifiche qui si scrivono direttamente in tabella (canale in-app). Il push e il
 * rispetto delle preferenze passano da `NotificationsService`, che qui non è raggiungibile:
 * chi PUÒ importarlo — `EscalationRoutingService` — continua a usarlo e ha il giro completo.
 * Meglio una campanella che accende un pallino che il silenzio di prima.
 */

/** Il minimo del client Prisma che serve: così è testabile con un oggetto finto. */
export interface PrismaPerSegnalazione {
  escalation: {
    findFirst(args: unknown): Promise<{ id: string } | null>;
    create(args: unknown): Promise<{ id: string }>;
  };
  clientProfile: {
    findUnique(args: unknown): Promise<{
      assignedCoachId: string | null;
      assignedNutritionistId: string | null;
      name: string | null;
    } | null>;
  };
  staff: {
    findMany(args: unknown): Promise<{ id: string; userId: string }[]>;
    findFirst(args: unknown): Promise<{ id: string; userId: string } | null>;
  };
  notification: { create(args: unknown): Promise<unknown> };
}

export interface SegnalazioneInput {
  clientId: string;
  category: EscalationCategory;
  reason: string;
  source?: 'engine' | 'coach' | 'screening';
  /** Se ne esiste già una APERTA della stessa categoria non se ne crea un'altra. */
  dedupe?: boolean;
}

/** Ruolo utente che risponde quando il ruolo primario non è assegnato a nessuno. */
const RESPONSABILE_DI = {
  nutritionist: 'head_nutritionist',
  coach: 'coach_coordinator',
} as const;

export async function apriSegnalazione(
  prisma: PrismaPerSegnalazione,
  input: SegnalazioneInput,
): Promise<{ id: string } | null> {
  try {
    if (input.dedupe !== false) {
      const esistente = await prisma.escalation.findFirst({
        where: {
          clientId: input.clientId,
          category: input.category as never,
          status: { in: ['open', 'in_progress'] as never },
        },
        select: { id: true },
      });
      if (esistente) return esistente;
    }

    const routing = ESCALATION_ROUTING[input.category];
    const profilo = await prisma.clientProfile.findUnique({
      where: { userId: input.clientId },
      select: { assignedCoachId: true, assignedNutritionistId: true, name: true },
    });
    const assegnato =
      routing.primary === 'nutritionist' ? profilo?.assignedNutritionistId : profilo?.assignedCoachId;

    // Nessuno assegnato per quel ruolo → si cerca chi ne risponde. È la differenza fra una
    // segnalazione che qualcuno legge e una che resta lì.
    let ripiego: { id: string; userId: string } | null = null;
    if (!assegnato) {
      ripiego = await prisma.staff.findFirst({
        where: { user: { role: RESPONSABILE_DI[routing.primary] } },
        select: { id: true, userId: true },
      });
    }

    const created = await prisma.escalation.create({
      data: {
        clientId: input.clientId,
        reason: input.reason,
        source: (input.source ?? 'engine') as never,
        category: input.category as never,
        // Se prende in carico il responsabile lo si scrive: una segnalazione «non assegnata a
        // nessuno» in elenco è esattamente quella che nessuno guarda.
        assignedToId: assegnato ?? ripiego?.id ?? undefined,
      },
    });

    // Chi avvisare: coach e nutrizionista assegnate, più il responsabile se è stato coinvolto.
    const staffIds = [profilo?.assignedCoachId, profilo?.assignedNutritionistId].filter(
      (v): v is string => !!v,
    );
    const destinatari = new Set<string>();
    if (staffIds.length) {
      const staff = await prisma.staff.findMany({ where: { id: { in: staffIds } }, select: { id: true, userId: true } });
      for (const s of staff) destinatari.add(s.userId);
    }
    if (ripiego) destinatari.add(ripiego.userId);

    const chi = profilo?.name ?? 'una cliente';
    const etichetta = ESCALATION_CATEGORY_LABEL[input.category];
    for (const userId of destinatari) {
      await prisma.notification
        .create({
          data: {
            userId,
            type: `escalation_${input.category}`,
            scheduledFor: new Date(),
            sentAt: new Date(),
            payload: {
              title: etichetta,
              body: `${etichetta} · ${chi}${input.reason ? `: ${input.reason}` : ''}`,
              clientId: input.clientId,
              escalationId: created.id,
              category: input.category,
              // `nonAssegnata` dice che è arrivata al responsabile perché non c'era nessun
              // altro: è un'informazione da leggere, non un dettaglio tecnico.
              nonAssegnata: !assegnato,
            } as never,
          },
        })
        .catch(() => undefined);
    }
    return created;
  } catch {
    /* una segnalazione che non riesce a nascere non deve far cadere l'erogazione del menu */
    return null;
  }
}
