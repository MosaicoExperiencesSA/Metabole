/**
 * GLI AVVISI DELLE ATTIVITÀ COACH — la push alla creazione e l'escalation alla manager.
 *
 * Richieste di Simone del 14/8 (decisione in `progetto/NOTA_Attivita_Coach_Push_Escalation.md`):
 * «queste notifiche arrivano alla coach anche via push?» — non arrivavano: le attività nascevano
 * dal cron e comparivano solo in pagina — «e se la coach non le chiude vanno mandate alla manager
 * delle coach, dopo 24 ore, da quando andava fatta».
 *
 * Funzioni libere che ricevono `prisma` e `push`, come `notifica-utente.ts` e `avvisa-capo.ts`:
 * si provano con un finto e non trascinano moduli. ⚠️ Nessuna delle due lancia mai — chi chiama
 * sta creando attività dentro il giro del cron, e un avviso che non parte non deve fermarlo.
 */
import { Logger } from '@nestjs/common';
import { nutrizionistaDiRiferimento, type PrismaPerRiferimento } from '../common/nutrizionista-di-riferimento';
import { destinatariManagerCoach } from '../common/avvisa-manager-coach';
import { notificaUtente, PushMinimo } from '../notifications/notifica-utente';
import { aGiorno } from '../common/date-only';
/**
 * ⛔ **LE COSTANTI, NON LE STRINGHE** (corretto in revisione il 22/8, ed era già costato).
 * Vedi la nota su `TIPI_DELLA_NUTRIZIONISTA`.
 */
import { TIPO_DIGIUNO_ESTREMO, TIPO_FINESTRA_NON_TRADUCIBILE } from './verifica-digiuno';
import { TIPO_PASTI_NON_SERVITI } from './pasti-non-serviti';
import { TIPO_KCAL_CORTE } from './kcal-restano-corte';
import type { PrismaService } from '../prisma/prisma.service';

const logger = new Logger('AvvisiAttivitaCoach');

/**
 * ⚠️ Il tetto per giro: al primo lancio le attività scadute accumulate possono essere decine, e
 * un'inondazione di push insegna alla manager a spegnerle. Oltre il tetto si dice quante restano
 * (mai un taglio muto) e si continua al giro dopo.
 */
export const MAX_ESCALATION_PER_GIRO = 20;

export interface AttivitaAppenaCreata {
  id: string;
  clientId: string;
  /** ⚠️ Decide **a chi** arriva l'avviso: vedi `TIPI_DELLA_NUTRIZIONISTA`. */
  kind?: string | null;
  title: string;
  description?: string | null;
  dueDate: Date;
}

/**
 * ⛔ **LE ATTIVITÀ CHE SOLO LA NUTRIZIONISTA PUÒ CHIUDERE.**
 *
 * Tutte e quattro nascono dal digiuno, e tutte e quattro chiedono una cosa che la coach non può
 * fare: valutare una scelta clinica estrema, guardare una finestra che l'orologio non sapeva
 * riprodurre, generare una variante mancante a catalogo, decidere se una cliente che riceve il 70%
 * del suo target va spostata di livello.
 *
 * ⚠️ L'elenco sta **qui**, dove si decide chi avvisare, e non dentro i quattro moduli: la domanda
 * «di chi è questa attività» è una sola, e sparsa in quattro file diventa quattro risposte. Chi
 * aggiunge un quinto tipo della nutrizionista lo aggiunge qui — e se se ne dimentica, l'attività
 * nasce lo stesso e resta in elenco: si perde l'avviso, non il lavoro.
 *
 * ## ⛔ E questo elenco DA SOLO non basta — la porta era chiusa
 *
 * Qui si decide **a chi mandare la push**, non **chi può aprire la pagina**. Fino al 22/8 le due
 * cose non combaciavano: la push diceva «la trovi in Dashboard», e la Dashboard rispondeva **403**.
 * La nutrizionista non era fra i ruoli di `coach-tasks.controller.ts` e non aveva il permesso
 * `coach_tasks` in `permissions/pages.ts`. Cioè dal 21/8 abbiamo avvisato una persona mandandola
 * davanti a una porta chiusa — che è peggio di non avvisarla: lei sa che c'è qualcosa e non può
 * vederlo.
 *
 * ## ⛔ E UNA DELLE QUATTRO STRINGHE ERA SCRITTA AL CONTRARIO
 *
 * Fino al 22/8 qui c'era scritto `'finestra_digiuno_non_traducibile'`. Il tipo vero — quello che
 * `profile.service.ts` scrive in banca dati — è **`digiuno_finestra_non_traducibile`**: le prime due
 * parole erano scambiate. Quattro punti ricopiavano la stringa a mano invece di usare la costante, e
 * tutti e quattro la ricopiavano sbagliata, **compreso il test che doveva accorgersene**.
 *
 * ⚠️ Finché l'elenco decideva solo la push, costava un avviso mancato. Da quando decide anche **cosa
 * la nutrizionista vede in elenco** (`coach-tasks.service.ts`) costava molto di più: quell'attività
 * sparirebbe dalla sua pagina e `setStatus` le risponderebbe «è della coach, non tua». Invisibile e
 * inchiudibile per l'unica persona che può chiuderla.
 *
 * ⛔ Perciò l'insieme si costruisce dalle **costanti dei quattro moduli**, non da stringhe: una
 * parola scritta al contrario adesso non compila.
 *
 * ⚠️ `attivita-che-arrivano.spec.ts` guarda insieme le quattro condizioni che devono valere perché
 * un'attività arrivi davvero (tipo in elenco · ruolo nel controller · permesso di pagina · icona in
 * pagina). ⛔ **Non è però una rete automatica per un tipo NUOVO**: aggiungendone uno, l'unico test
 * che si accende è quello che conta i tipi, e si «aggiusta» aggiungendo una riga. Chi lo fa deve
 * ripassare le quattro condizioni a mano — sta scritto lì in testa, invece di essere lasciato
 * credere coperto.
 */
export const TIPI_DELLA_NUTRIZIONISTA = new Set<string>([
  TIPO_DIGIUNO_ESTREMO,
  TIPO_FINESTRA_NON_TRADUCIBILE,
  TIPO_PASTI_NON_SERVITI,
  TIPO_KCAL_CORTE,
]);

/**
 * LA PUSH ALLA CREAZIONE. Senza coach assegnata non si manda niente — la vede il responsabile in
 * pagina, come già per «piano in scadenza».
 *
 * ⚠️ **Qui c'era scritto «chiamata da `ensureTask`, l'unico punto in cui nasce ogni attività:
 * nessun tipo può sfuggire». Non era vero** (trovato il 20/8): `measures_missing` nasceva da un
 * `coachTask.create` scritto a mano dentro il sollecito misure, e alla coach non arrivava niente —
 * «a questa cliente il menu è fermo» compariva solo in elenco. La riga sbagliata è la parte che è
 * costata: la regola era scritta, quindi chi la leggeva non aveva ragione di controllare.
 *
 * Adesso creare e avvisare sono la **stessa** funzione (`apriAttivitaCoach` in
 * `porta-delle-attivita.ts`): non si può più fare l'una senza l'altra. E la regola non è più solo
 * scritta — la tiene ferma `una-porta-per-le-attivita.spec.ts`, che guarda il sorgente.
 */
export async function avvisaAttivitaNuova(
  prisma: PrismaService,
  push: PushMinimo,
  attivita: AttivitaAppenaCreata,
): Promise<void> {
  try {
    const profilo = (await prisma.clientProfile.findUnique({
      where: { userId: attivita.clientId },
      select: {
        name: true,
        assignedCoach: { select: { userId: true } },
        // ⚠️ Serve per le attività che solo lei può chiudere: vedi `TIPI_DELLA_NUTRIZIONISTA`.
        assignedNutritionist: { select: { userId: true } },
      },
    })) as {
      name: string | null;
      assignedCoach: { userId: string } | null;
      assignedNutritionist: { userId: string } | null;
    } | null;

    /**
     * ⛔ **A CHI ARRIVA L'AVVISO — e fino al 21/8 arrivava alla persona sbagliata.**
     *
     * Questa funzione avvisava **solo la coach**, per tutte le attività. Ma tre tipi sono nati
     * addosso alla **nutrizionista**: il digiuno estremo, la finestra che l'orologio non sapeva
     * riprodurre, e i pasti che il catalogo non serve. I loro testi dicono cose che solo lei può
     * fare — valutare una scelta clinica, generare una variante a catalogo — e la push andava a
     * qualcun altro. L'attività compariva in elenco e basta, cioè la nutrizionista la scopriva solo
     * se apriva la lista di sua iniziativa.
     *
     * ⚠️ **Si avvisano tutte e due**, non si sposta l'avviso: la coach è quella che parla con la
     * cliente tutti i giorni, ed è giusto che sappia che c'è qualcosa in corso su di lei. Quello che
     * non andava era che sapesse **solo** lei.
     *
     * ⚠️ Senza nutrizionista assegnata si ripiega sul **capo**, che è lo stesso destinatario che
     * `apri-segnalazione.ts` sceglie quando il ruolo non è assegnato: le due strade dicono la stessa
     * cosa. ⛔ E se non c'è nemmeno un capo non si inventa nessuno: l'avviso non parte, e resta
     * l'attività in elenco. Un avviso a un destinatario inventato è peggio di nessun avviso.
     */
    const perLaNutrizionista = TIPI_DELLA_NUTRIZIONISTA.has(attivita.kind ?? '');
    const nutriUserId = perLaNutrizionista
      ? profilo?.assignedNutritionist?.userId
        ?? (await nutrizionistaDiRiferimento(prisma as unknown as PrismaPerRiferimento))?.userId
        ?? null
      : null;

    const coachUserId = profilo?.assignedCoach?.userId ?? null;
    // ⚠️ Un `Set`: se per caso la nutrizionista fosse anche la coach di questa cliente, non le
    // arrivano due notifiche identiche a mezzo secondo di distanza.
    const destinatari = [...new Set([coachUserId, nutriUserId].filter((x): x is string => !!x))];
    if (destinatari.length === 0) return;

    const cliente = profilo?.name ?? 'una tua cliente';
    const scadenza = attivita.dueDate.toLocaleDateString('it-IT');
    /**
     * ⛔ **«LA TROVI IN DASHBOARD» TORNA A VALERE PER TUTTI** — 3/9, chiusa la voce
     * `attivita-nutrizionista-in-app`.
     *
     * Il 22/8 questa frase era stata **corretta al ribasso**: la coach lavora dall'app staff e lì
     * la Dashboard le attività ce le ha, la nutrizionista no — `NutriDashboard` chiamava
     * `/nutritionist/dashboard`, `validation-queue` ed `escalations`, e `/staff/coach-tasks` non lo
     * chiamava nessuno. Le mandavamo una notifica che indicava una schermata vuota: peggio di un
     * 403, perché non le diceva nemmeno che una porta esisteva. Finché la sezione non c'era, la
     * push mandava al **backoffice** — *se degradi, dillo* vale anche per una frase.
     *
     * ✅ Adesso la sezione «Le tue attività» c'è (`NutriDashboard.tsx`), col pallino sul tab, e la
     * frase torna una sola. ⚠️ **La frase e la schermata si sono mosse insieme**: rimetterla senza
     * la sezione — o fare la sezione lasciando la frase vecchia — rifà il difetto in uno dei due
     * versi, e una prova lo tiene fermo (`attivita-nutrizionista-in-app.spec.ts`).
     *
     * ⚠️ Il nome della costante era `perLaNutrizionista_dove` e mentiva: questa frase la leggono
     * **tutti** i destinatari, coach compresa. Un nome che dichiara una condizione inesistente è la
     * prossima modifica sbagliata.
     */
    const doveTrovarla = 'La trovi in Dashboard.';
    for (const userId of destinatari) {
      await notificaUtente(prisma, push, {
        userId,
        type: 'coach_task_new',
        title: 'Nuova attività per te 📋',
        /**
         * ⚠️ **Un solo «entro» per messaggio** (23/8). Il titolo della visita da fissare porta già la
         * scadenza CLINICA («…(entro il 30/09/2026)»), e qui si appendeva anche la scadenza
         * dell'ATTIVITÀ (domani): «…(entro il 30/09/2026) — Anna (entro il 24/08/2026)», due date con
         * due significati diversi e nessuna spiegazione. Se il titolo una scadenza ce l'ha già, è
         * quella che conta per chi legge: la data amministrativa dell'attività resta nell'elenco.
         */
        body: attivita.title.includes('(entro il ')
          ? `${attivita.title} — ${cliente}. ${doveTrovarla}`
          : `${attivita.title} — ${cliente} (entro il ${scadenza}). ${doveTrovarla}`,
        payload: { taskId: attivita.id, clientId: attivita.clientId },
      });
    }
  } catch (err) {
    logger.warn(`Avviso attività nuova non mandato (task=${attivita?.id}): ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * L'ESCALATION: le attività ancora «da fare» con la scadenza di IERI o prima — cioè al primo giro
 * del giorno dopo quello in cui andavano fatte («24 ore da quando andava fatta») — vanno alla
 * manager delle coach (ruolo `sales`; admin di riserva: un avviso senza destinatario non è un
 * avviso).
 *
 * ⚠️ UNA VOLTA SOLA per attività, senza colonna nuova: l'idempotenza è la notifica stessa —
 * se esiste già una `coach_task_escalation` con quel `payload.taskId`, non si rimanda.
 * (Niente migrazione di proposito: `schema.prisma` è un file conteso, decisione nella NOTA.)
 */
export async function escalateAttivitaScadute(
  prisma: PrismaService,
  push: PushMinimo,
): Promise<{ avvisate: number; rimaste: number }> {
  try {
    // ⚠️ Il giorno di **Roma**: era `setHours(0,0,0,0)`, cioè UTC su Render. L'escalation guarda le
    // attività con la scadenza di IERI o prima, e con il giorno spostato mandava alla manager —
    // nelle due ore dopo mezzanotte — attività che in Italia scadevano *oggi*.
    const oggi = aGiorno(new Date());

    const scadute = (await prisma.coachTask.findMany({
      where: { status: 'todo', dueDate: { lt: oggi } } as never,
      orderBy: { dueDate: 'asc' },
      take: 300,
      include: {
        client: {
          select: {
            firstName: true,
            lastName: true,
            clientProfile: {
              select: {
                name: true,
                assignedCoach: { select: { displayName: true, userId: true } },
                // ⚠️ Serve per l'attribuzione dei tipi della nutrizionista: vedi `A CHI SCADE`.
                assignedNutritionist: { select: { displayName: true, userId: true } },
              },
            },
          },
        },
      },
    })) as {
      id: string; clientId: string; kind: string | null; title: string; dueDate: Date;
      client: {
        firstName: string | null; lastName: string | null;
        clientProfile: {
          name: string | null;
          assignedCoach: { displayName: string | null; userId: string } | null;
          assignedNutritionist: { displayName: string | null; userId: string } | null;
        } | null;
      } | null;
    }[];
    if (!scadute.length) return { avvisate: 0, rimaste: 0 };

    const destinatari = await destinatariManagerCoach(prisma);
    if (!destinatari.length) {
      logger.warn(`Escalation attività: ${scadute.length} scadute ma NESSUN destinatario (né sales né admin attivi).`);
      return { avvisate: 0, rimaste: scadute.length };
    }

    /**
     * ⚠️ Il capo nutrizionista, una volta sola: serve solo se fra le scadute c'è un tipo suo, e non
     * dipende da quale. `null` se non esiste — e allora non si aggiunge nessuno.
     */
    const capoNutri = scadute.some((t) => TIPI_DELLA_NUTRIZIONISTA.has(t.kind ?? ''))
      ? (await nutrizionistaDiRiferimento(prisma as unknown as PrismaPerRiferimento))?.userId ?? null
      : null;

    let avvisate = 0;
    let daFare = 0;
    for (const t of scadute) {
      // La notifica già mandata È la memoria: una per attività, per sempre.
      const giaMandata = await prisma.notification.findFirst({
        where: { type: 'coach_task_escalation', payload: { path: ['taskId'], equals: t.id } } as never,
        select: { id: true },
      });
      if (giaMandata) continue;
      /**
       * ⚠️ **Il tetto si conta DOPO l'idempotenza** (corretto nella seconda revisione del 22/8).
       * Prima veniva prima, quindi `daFare` comprendeva anche attività già escalate che non
       * sarebbero partite mai: il messaggio «N rimandate al prossimo giro» prometteva invii che non
       * ci sarebbero stati, e al giro dopo li riprometteva uguali. *Niente tagli silenziosi* vale
       * anche per il numero con cui si dichiara il taglio.
       */
      if (avvisate >= MAX_ESCALATION_PER_GIRO) { daFare++; continue; }

      /**
       * ⛔ **A CHI SCADE — e per un mese sarebbe scaduta addosso alla persona sbagliata** (trovato in
       * revisione, 22/8).
       *
       * L'escalation non guardava il `kind`: dopo sette giorni un'attività della **nutrizionista**
       * arrivava alla **manager delle coach** con il corpo «*Laura*: "Maria: riceve il 68% del suo
       * fabbisogno" scadeva il 29/8 ed è ancora da fare» — dove Laura è una coach che quell'attività
       * non può chiuderla e che non è nemmeno mai stata avvisata. E per una cliente senza coach
       * usciva «coach non assegnata: …». *Una ragione falsa è peggio di un ordine sbagliato.*
       *
       * ⚠️ Finché i tipi della nutrizionista erano tre e rari si vedeva poco. Col quarto —
       * `kcal_restano_corte`, che è il più frequente — sarebbe diventata routine settimanale.
       *
       * ⚠️ Il destinatario resta la manager coach **più** il capo nutrizionista, non al posto suo:
       * chi sorveglia le scadenze le sorveglia tutte. Quello che cambia è **il nome davanti**, che
       * adesso è di chi quell'attività ce l'ha in mano.
       */
      const dellaNutrizionista = TIPI_DELLA_NUTRIZIONISTA.has(t.kind ?? '');
      const dichi = dellaNutrizionista
        ? t.client?.clientProfile?.assignedNutritionist?.displayName ?? 'nutrizionista non assegnata'
        : t.client?.clientProfile?.assignedCoach?.displayName ?? 'coach non assegnata';
      const cliente = t.client?.clientProfile?.name
        ?? [t.client?.firstName, t.client?.lastName].filter(Boolean).join(' ')
        ?? 'una cliente';
      const scadenza = t.dueDate.toLocaleDateString('it-IT');
      // ⚠️ Il capo nutrizionista si aggiunge solo per i suoi tipi, e solo se esiste: un avviso a un
      // destinatario inventato è peggio di nessun avviso (stessa regola di `avvisaAttivitaNuova`).
      // ⚠️ Letto UNA volta prima del ciclo: non dipende dall'attività, e qui dentro era una
      // `staff.findMany` ripetuta fino a venti volte per giro.
      const aChi = [...new Set([...destinatari, ...(dellaNutrizionista && capoNutri ? [capoNutri] : [])])];
      for (const userId of aChi) {
        await notificaUtente(prisma, push, {
          userId,
          type: 'coach_task_escalation',
          title: dellaNutrizionista ? 'Attività nutrizionista rimasta aperta ⏰' : 'Attività coach rimasta aperta ⏰',
          body: `${dichi}: «${t.title}» per ${cliente} scadeva il ${scadenza} ed è ancora da fare.`,
          payload: { taskId: t.id, clientId: t.clientId },
        });
      }
      avvisate++;
    }
    if (daFare > 0) {
      logger.warn(`Escalation attività: tetto di ${MAX_ESCALATION_PER_GIRO} per giro raggiunto, ${daFare} rimandate al prossimo.`);
    }
    return { avvisate, rimaste: daFare };
  } catch (err) {
    logger.warn(`Escalation attività non riuscita: ${err instanceof Error ? err.message : String(err)}`);
    return { avvisate: 0, rimaste: 0 };
  }
}
