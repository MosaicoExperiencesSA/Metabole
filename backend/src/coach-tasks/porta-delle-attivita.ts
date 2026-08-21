import type { PushMinimo } from '../notifications/notifica-utente';
import type { PrismaService } from '../prisma/prisma.service';
import { avvisaAttivitaNuova } from './avvisi-attivita';

/**
 * ⚠️ **LA PORTA DA CUI NASCE UN'ATTIVITÀ DELLA COACH.**
 *
 * `avvisi-attivita.ts` diceva, in testa a `avvisaAttivitaNuova`: «Chiamata da `ensureTask`, l'unico
 * punto in cui nasce ogni attività: **nessun tipo può sfuggire**». ⛔ Non era vero, e la revisione
 * del 20/8 ha trovato i due che sfuggivano:
 *
 *  - **`measures_missing`** («Misure non inserite: il menu è fermo»), scritta a mano dentro il
 *    sollecito misure in `notifications.service.ts`. Alla cliente arrivava la sua notifica; alla
 *    coach **niente**. L'attività compariva in elenco e basta — cioè la coach scopriva che a una
 *    cliente il menu era fermo solo se apriva la lista. È esattamente il caso Giusy del 13/8;
 *  - **`pause_regain`** (peso in salita durante una pausa), scritta a mano in `pause.service.ts`.
 *    Quella però **non è silenziosa**: due righe sotto `avvisaStaffPausa` avvisa coach *e*
 *    nutrizionista, e se la cliente non ha nessuno assegnato ripiega sui capi — cioè copre più di
 *    quanto coprirebbe la push dell'attività, che senza coach tace. Resta dov'è, dichiarata.
 *
 * ⚠️ Il commento sbagliato è la parte che costa: la regola «nessuno può sfuggire» era scritta, e
 * chi la leggeva non aveva ragione di controllare. Adesso c'è una funzione sola che crea e avvisa
 * insieme — non si può fare l'una senza l'altra — e un test che guarda il sorgente
 * (`una-porta-per-le-attivita.spec.ts`) perché il difetto vive nei chiamanti, dove le mutazioni non
 * arrivano.
 *
 * Funzione libera con `prisma` e `push` come `notificaUtente`: la usa il servizio e la usa chi ha
 * solo le due dipendenze di base, così il comportamento è uno e non può divergere.
 */
export interface AttivitaDaAprire {
  clientId: string;
  kind: string;
  /** Il riferimento che rende l'attività unica per quel cliente (piano, pausa, ciclo di misure). */
  refId: string;
  title: string;
  description: string;
  dueDate: Date;
}

/**
 * Crea l'attività se non c'è già, e in quel caso avvisa la coach. Non lancia mai: chi chiama sta
 * facendo il lavoro vero (il giro notturno, un sollecito) e un avviso che non parte non deve
 * fermarlo.
 *
 * Ritorna `'creata'` o `'gia-presente'` — **non un booleano**. Con un booleano chi chiama traduce
 * `false` in «non è riuscita» e lo dice a chi ha appena deciso, mentre vuol dire che c'era già,
 * cioè che è tutto a posto (trovato il 18/8).
 */
export async function apriAttivitaCoach(
  prisma: PrismaService,
  push: PushMinimo,
  dati: AttivitaDaAprire,
): Promise<'creata' | 'gia-presente'> {
  const esiste = await prisma.coachTask.findUnique({
    where: { clientId_kind_refId: { clientId: dati.clientId, kind: dati.kind, refId: dati.refId } } as never,
    select: { id: true },
  });
  if (esiste) return 'gia-presente';

  const creata = (await prisma.coachTask.create({
    data: {
      clientId: dati.clientId,
      kind: dati.kind,
      refId: dati.refId,
      title: dati.title,
      description: dati.description,
      dueDate: dati.dueDate,
    },
  })) as unknown as { id: string };

  await avvisaAttivitaNuova(prisma, push, {
    id: creata.id,
    clientId: dati.clientId,
    // ⚠️ **Il `kind` passa di qui**: è quello che decide se l'avviso deve raggiungere anche la
    // nutrizionista (`TIPI_DELLA_NUTRIZIONISTA`). Senza, le sue attività la aspettavano in elenco.
    kind: dati.kind,
    title: dati.title,
    description: dati.description,
    dueDate: dati.dueDate,
  });
  return 'creata';
}
