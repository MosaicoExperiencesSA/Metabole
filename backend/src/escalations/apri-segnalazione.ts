import { ESCALATION_CATEGORY_LABEL, ESCALATION_ROUTING, EscalationCategory } from './escalation-routing';
import { decidiRiapertura } from './riapertura';

/**
 * La tregua di default dopo una «risolta», quando chi chiama non passa il valore letto da
 * `config_param` (`escalation_reopen_days`). Due settimane: abbastanza perché una decisione clinica
 * valga qualcosa, abbastanza poco perché un problema che non si è risolto torni a farsi sentire.
 */
export const FINESTRA_RIAPERTURA_DEFAULT = 14;

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
    findFirst(args: unknown): Promise<{
      id: string;
      status?: string;
      severity?: number | null;
      resolvedAt?: Date | null;
      updatedAt?: Date | null;
    } | null>;
    create(args: unknown): Promise<{ id: string }>;
    /** Serve solo a `statoNonAvviso`: facoltativa, così i test con un finto minimo restano validi. */
    update?(args: unknown): Promise<unknown>;
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
  /**
   * Quanto è GRAVE, se questa segnalazione ha un «quanto» (es. kg/settimana di calo). Si scrive
   * sulla riga e serve a decidere se riaprirla quando peggiora: vedi `riapertura.ts`.
   */
  gravita?: number | null;
  /**
   * La regola «se ha risolto, basta fino a nuova segnalazione» (11/8). Quando c'è, il controllo non
   * guarda solo le segnalazioni aperte ma anche l'ultima **risolta**: dentro la tregua non si
   * riapre, a meno che la cosa non sia peggiorata oltre la soglia.
   *
   * Chi chiama passa i valori letti da `config_param` (`escalation_reopen_days` e la soglia di
   * peggioramento del suo caso): questa funzione non legge la configurazione perché riceve solo il
   * client Prisma — è la ragione per cui la possono chiamare anche i moduli che non arrivano ai
   * servizi di Nest.
   */
  riapertura?: { finestraGiorni: number; peggioramentoMinimo?: number | null; adesso?: Date };
  /**
   * ⛔ **QUESTA SEGNALAZIONE È UNO STATO, NON UN AVVISO** — e la tregua non deve poterla zittire.
   *
   * La tregua dell'11/8 è giusta per gli allarmi clinici: «se ha risolto, basta fino a nuova
   * segnalazione», perché lì la riga è un **avviso a una persona**, e un avviso che ritorna da solo
   * insegna a chiuderlo senza leggerlo.
   *
   * Per «Piano bloccato» la stessa riga è un'altra cosa: è **lo stato che l'app mostra alla
   * cliente** (`dietBlock` → `menuStatus: 'blocked'`). Zittirla non toglie un fastidio, toglie il
   * cartello: la cliente continua a non ricevere menu e l'app le scrive «Menu in preparazione,
   * arriverà a breve», che è falso. Per quattordici giorni, e senza nessuna riga in elenco.
   *
   * Con questo flag, dentro la tregua non si crea una riga nuova — quello sarebbe il rumore che la
   * tregua evita, giustamente — ma si **riapre quella risolta**, riscrivendoci il motivo di adesso.
   * Nessun doppione, e lo stato torna a esistere. ⚠️ Se la nutrizionista la richiude e il motore
   * ancora non compone, si riaprirà: è vero, ed è il punto. Il rimedio è far comporre il motore,
   * non spegnere l'unica cosa che lo dice.
   */
  statoNonAvviso?: boolean;
  /** Chiamata quando NON si apre, col perché: serve a chi vuole scriverlo nei log. */
  alSilenzio?: (motivo: string) => void;
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
      /**
       * Non è più «ce n'è una aperta?» ma «va aperta?», e la differenza è tutta nelle segnalazioni
       * **risolte**: il controllo di prima guardava solo il presente, quindi appena la nutrizionista
       * metteva «risolta» la stessa segnalazione tornava, perché la condizione clinica non era
       * cambiata. Vedi `riapertura.ts` per la regola e per il perché il peggioramento resta
       * un'eccezione.
       */
      const decisione = await decidiRiapertura(prisma as never, {
        clientId: input.clientId,
        category: input.category,
        gravita: input.gravita,
        finestraGiorni: input.riapertura?.finestraGiorni ?? FINESTRA_RIAPERTURA_DEFAULT,
        peggioramentoMinimo: input.riapertura?.peggioramentoMinimo,
        adesso: input.riapertura?.adesso,
      });
      if (!decisione.apri) {
        input.alSilenzio?.(decisione.motivo);
        const prec = decisione.precedente;
        // Solo se la riga era CHIUSA: se è già aperta non c'è niente da riaprire, e riscriverle
        // il motivo mentre qualcuno la sta lavorando sarebbe un dispetto.
        if (input.statoNonAvviso && prec && prec.status === 'resolved' && prisma.escalation.update) {
          await prisma.escalation.update({
            where: { id: prec.id },
            data: { status: 'open', resolvedAt: null, reason: input.reason },
          });
          /**
           * ⛔ **E LA SI AVVISA — 31/8. Questa riga mancava, ed è il caso che conta di più.**
           *
           * La riapertura dentro la tregua non passa dalla `create` qui sotto, quindi tornava
           * `open` **in silenzio**: la nutrizionista aveva messo «risolta» credendo di aver
           * sistemato, il motore continuava a non comporre, la riga si riapriva da sé e lei non lo
           * sapeva. ⚠️ Il silenzio era proprio sullo scenario peggiore — quello in cui **qualcuno
           * si è già occupato** del problema e crede che sia finito.
           *
           * ⚠️ Non è la tregua che si sta bucando: la tregua evita il **doppione**, cioè una riga
           * nuova per una cosa già in elenco, e continua a farlo. Qui la riga è **tornata da
           * chiusa ad aperta**, che è un fatto nuovo — e per uno stato che tiene ferma
           * un'erogazione, un fatto nuovo si dice.
           *
           * Best effort come il resto degli avvisi: lo stato è già scritto, e un avviso che non
           * parte non deve far fallire la riapertura.
           */
          try {
            const aChi = await decidiDestinatari(prisma, input.clientId, input.category);
            if (aChi) {
              await avvisaSegnalazione(prisma, aChi, {
                clientId: input.clientId,
                category: input.category,
                reason: input.reason,
                escalationId: prec.id,
              });
            }
          } catch {
            /* la riga è aperta lo stesso: è quella che tiene lo stato, l'avviso è il di più */
          }
        }
        return prec ? { id: prec.id } : null;
      }
    }

    /**
     * ⚠️ L'ORDINE QUI È UNA SCELTA, e per un momento l'avevo sbagliata.
     *
     * Decidere il destinatario richiede tre letture in più (profilo, staff, responsabile). Se una
     * di quelle fallisce, **la segnalazione deve nascere comunque**: una riga senza destinatario si
     * ripara (`npm run fix:segnalazioni`), una riga che non esiste è un allarme clinico perduto per
     * sempre. Estraendo `decidiDestinatari` l'avevo messa *prima* della `create` senza protezione,
     * e sette test sono diventati rossi mostrando esattamente questo: mock senza `staff` → nessuna
     * segnalazione. In produzione sarebbe stato un intoppo del database al posto di un allarme.
     *
     * Quindi: la decisione può fallire e si va avanti; la `create` no.
     */
    let decisione: DecisioneSegnalazione | null = null;
    try {
      decisione = await decidiDestinatari(prisma, input.clientId, input.category);
    } catch {
      /* senza instradamento la segnalazione nasce orfana: brutto, ma esiste e si può riparare */
    }

    const created = await prisma.escalation.create({
      data: {
        clientId: input.clientId,
        reason: input.reason,
        source: (input.source ?? 'engine') as never,
        category: input.category as never,
        // La gravità di ADESSO: è quella con cui si confronterà il prossimo controllo per capire se
        // la cosa è peggiorata (e quindi se vale la pena disturbare di nuovo).
        ...(typeof input.gravita === 'number' ? { severity: input.gravita } : {}),
        // Se prende in carico il responsabile lo si scrive: una segnalazione «non assegnata a
        // nessuno» in elenco è esattamente quella che nessuno guarda.
        assignedToId: decisione?.assegnato ?? decisione?.ripiego?.id ?? undefined,
      },
    });

    if (decisione) {
      await avvisaSegnalazione(prisma, decisione, {
        clientId: input.clientId,
        category: input.category,
        reason: input.reason,
        escalationId: created.id,
      });
    }
    return created;
  } catch {
    /* una segnalazione che non riesce a nascere non deve far cadere l'erogazione del menu */
    return null;
  }
}

/** Chi prende in carico la segnalazione e chi va avvisato. Nessuna scrittura: solo la decisione. */
export interface DecisioneSegnalazione {
  /** Staff assegnato per il ruolo primario della categoria (null se non c'è). */
  assegnato: string | null;
  /** Chi risponde di quel ruolo, cercato solo se `assegnato` è vuoto. */
  ripiego: { id: string; userId: string } | null;
  /** `userId` di tutti quelli da avvisare. */
  destinatari: string[];
  /** `userId` della coach assegnata, per riconoscerla fra i destinatari. */
  coachUserId: string | null;
  /** Nome della cliente, per i testi. */
  nomeCliente: string | null;
  /** Il ruolo primario è il nutrizionista e non c'è nessuno: la palla passa alla coach. */
  serveNutrizionista: boolean;
}

/**
 * Decide destinatari e presa in carico. Estratta da `apriSegnalazione` per poterla riusare sulle
 * segnalazioni **già aperte** (`prisma/fix-segnalazioni-orfane.ts`): quelle nate prima che
 * l'instradamento esistesse sono rimaste senza destinatario, e ripararle a mano vorrebbe dire
 * riscrivere questa logica una seconda volta — cioè farla divergere.
 */
export async function decidiDestinatari(
  prisma: PrismaPerSegnalazione,
  clientId: string,
  category: EscalationCategory,
): Promise<DecisioneSegnalazione> {
  const routing = ESCALATION_ROUTING[category];
  const profilo = await prisma.clientProfile.findUnique({
    where: { userId: clientId },
    select: { assignedCoachId: true, assignedNutritionistId: true, name: true },
  });
  const assegnato =
    (routing.primary === 'nutritionist' ? profilo?.assignedNutritionistId : profilo?.assignedCoachId) ?? null;

  // Nessuno assegnato per quel ruolo → si cerca chi ne risponde. È la differenza fra una
  // segnalazione che qualcuno legge e una che resta lì.
  let ripiego: { id: string; userId: string } | null = null;
  if (!assegnato) {
    ripiego = await prisma.staff.findFirst({
      where: { user: { role: RESPONSABILE_DI[routing.primary] } },
      select: { id: true, userId: true },
    });
  }

  const staffIds = [profilo?.assignedCoachId, profilo?.assignedNutritionistId].filter(
    (v): v is string => !!v,
  );
  const destinatari = new Set<string>();
  let coachUserId: string | null = null;
  if (staffIds.length) {
    const staff = await prisma.staff.findMany({ where: { id: { in: staffIds } }, select: { id: true, userId: true } });
    for (const s of staff) {
      destinatari.add(s.userId);
      if (profilo?.assignedCoachId && s.id === profilo.assignedCoachId) coachUserId = s.userId;
    }
  }
  if (ripiego) destinatari.add(ripiego.userId);

  return {
    assegnato,
    ripiego,
    destinatari: [...destinatari],
    coachUserId,
    nomeCliente: profilo?.name ?? null,
    serveNutrizionista: routing.primary === 'nutritionist' && !assegnato,
  };
}

/**
 * Scrive le notifiche di una segnalazione (canale in-app).
 *
 * «NUTRIZIONISTA RICHIESTO» — regola operativa di Simone (8/8): oggi c'è **un solo** nutrizionista
 * (il capo) e le clienti non ne hanno una assegnata. Quindi quando serve il nutrizionista
 * «segnaliamo alla coach con "nutrizionista richiesto" così aiutano nella gestione».
 * La coach una notifica la riceveva già, ma col titolo della categoria («Sicurezza clinica»), che le
 * dice cosa è successo e non **di chi è la palla**.
 */
export async function avvisaSegnalazione(
  prisma: PrismaPerSegnalazione,
  decisione: DecisioneSegnalazione,
  input: { clientId: string; category: EscalationCategory; reason?: string; escalationId: string },
): Promise<void> {
  const chi = decisione.nomeCliente ?? 'una cliente';
  const etichetta = ESCALATION_CATEGORY_LABEL[input.category];
  for (const userId of decisione.destinatari) {
    const perLaCoach = decisione.serveNutrizionista && userId === decisione.coachUserId;
    await prisma.notification
      .create({
        data: {
          userId,
          type: `escalation_${input.category}`,
          scheduledFor: new Date(),
          sentAt: new Date(),
          payload: {
            title: perLaCoach ? 'Nutrizionista richiesto' : etichetta,
            body: perLaCoach
              ? `Serve il nutrizionista per ${chi}${input.reason ? `: ${input.reason}` : ''}. ` +
                'Nessuna nutrizionista è assegnata: intanto seguila tu e tieni la segnalazione aperta.'
              : `${etichetta} · ${chi}${input.reason ? `: ${input.reason}` : ''}`,
            clientId: input.clientId,
            escalationId: input.escalationId,
            category: input.category,
            // `nonAssegnata` dice che è arrivata al responsabile perché non c'era nessun altro:
            // è un'informazione da leggere, non un dettaglio tecnico.
            nonAssegnata: !decisione.assegnato,
            // Lo leggono backoffice e app staff per mostrare l'etichetta giusta in elenco.
            nutrizionistaRichiesto: perLaCoach,
          } as never,
        },
      })
      .catch(() => undefined);
  }
}
