import { statoSupervisione, type ProfiloDaSupervisionare } from '../clients/via-libera-clinico';
import { mancaMisuraDiPartenza } from './misura-di-partenza';
import { attivoInCorso } from '../commerce/abbonamento-in-corso';
import { STATI_CON_UN_PIANO } from '../commerce/stati-abbonamento';
import { toDateOnly } from '../common/date-only';

/**
 * «PERCHÉ IL MOTORE NON COMPONE I MENU DI QUESTA CLIENTE?» — una domanda, una porta.
 *
 * ⛔ **Serve prima di cancellare, e serve dopo.** Prima: cancellare la coda a una cliente che il
 * motore non serve più le toglierebbe il menu **per sempre** — il caso della visita clinica
 * scaduta, trovato in revisione il 24/8 prima che quello script girasse. Dopo: quando si cancella
 * per far ricomporre e non ricompone niente, questa è l'unica domanda che dice **perché**, invece
 * di lasciare due clienti con lo schermo vuoto e nessuno che sappia il motivo.
 *
 * ⚠️ **Estratta l'1/9 da `prisma/rifai-giorni-non-sicuri.ts`**, dove viveva come funzione privata.
 * È stata estratta il giorno in cui è servita a un secondo script: la seconda copia sarebbe nata
 * lì, e sarebbe stata quella sbagliata — la meno guardata.
 *
 * ⛔ **L'ordine dei cancelli è quello di `deliverIfEligible`**, e non è un dettaglio estetico: chi
 * legge la risposta deve leggere il **primo** motivo per cui il motore si ferma, non uno qualunque
 * dei motivi veri. «Piano fermato dalla nutrizionista» e «visita scaduta» insieme sono due cose da
 * fare in ordine, e dire la seconda manderebbe qualcuno a prenotare una visita che non sblocca
 * niente.
 *
 * ⚠️ Torna `null` quando **non c'è nessun motivo noto**: se in quel caso i menu non ci sono lo
 * stesso, il problema è altrove ed è una notizia — non un silenzio.
 */

export interface ProfiloPerRicomporre {
  userId: string;
  planStartDate: Date | null;
  planHeldAt: Date | null;
  screeningFlag: boolean | null;
  idoneita: string | null;
  idoneitaVisitaEntro: Date | null;
}

/** ⚠️ I campi che servono a decidere, scritti una volta sola: un `select` monco è un motivo perso. */
export const CAMPI_PER_RICOMPORRE = {
  userId: true,
  planStartDate: true,
  planHeldAt: true,
  screeningFlag: true,
  idoneita: true,
  idoneitaVisitaEntro: true,
} as const;

/** Il minimo di Prisma che serve: così la porta la può chiamare anche uno script fuori da Nest. */
export interface PrismaPerRicomporre {
  subscription: { findMany(args: unknown): Promise<unknown[]> };
  event: { findFirst(args: unknown): Promise<unknown | null> };
  measurement: { findFirst(args: unknown): Promise<unknown | null> };
}

export async function perchePotrebbeNonRicomporre(
  prisma: PrismaPerRicomporre,
  p: ProfiloPerRicomporre,
  oggi: Date = new Date(),
  /** Quanti giorni prima della partenza il menu diventa visibile (`menu_visible_days_before_start`). */
  giorniDiVisibilita = 0,
): Promise<string | null> {
  if (!p.planStartDate) return 'nessuna data di inizio piano';
  if (p.planHeldAt) return 'piano fermato dalla nutrizionista';
  /**
   * ⛔ **La visita scaduta è il PRIMO cancello del motore** (`menu.service.ts`, `deliverIfEligible`).
   * La prima stesura dello script che cancella le code non se la chiedeva nemmeno: toglieva il menu
   * a una cliente che il motore non serve più finché non rifà la visita — cioè per sempre.
   */
  if (statoSupervisione(p as unknown as ProfiloDaSupervisionare).motivo === 'visita_scaduta') return 'visita clinica scaduta';

  const attivi = (await prisma.subscription.findMany({
    where: { clientId: p.userId, status: { in: [...STATI_CON_UN_PIANO] } as never },
    select: { id: true, status: true, startDate: true, endDate: true, plan: { select: { period: true } } },
  })) as { id: string; status: string; startDate: Date | null; endDate: Date | null; plan: { period: string | null } | null }[];
  const piano = attivoInCorso(attivi as never, oggi) as (typeof attivi)[number] | null;
  if (!piano) return 'nessun piano attivo o in coda';
  if (piano.plan?.period === 'monitoring') return 'è in monitoraggio (il motore non compone)';
  /**
   * ⚠️ `toDateOnly()` e non l'ISTANTE: `endDate` è mezzanotte, e confrontarla con `new Date()`
   * dichiara «concluso» un piano che **nell'ultimo giorno sta ancora erogando**.
   *
   * ⚠️ `toDateOnly()` non accetta una data: prende sempre **oggi**. `oggi` serve a `attivoInCorso`,
   * che invece la accetta — e le due cose restano separate invece di far finta che siano una.
   */
  if (piano.endDate && piano.endDate.getTime() < toDateOnly().getTime()) return 'piano già concluso (fine passata)';
  /**
   * ⚠️ **Questa query è una COPIA di `EventsService.activePausePeriod`** (`calendar/events.service.ts`),
   * ed è dichiarata invece che nascosta: uno script `prisma/` gira fuori da Nest e non può iniettare
   * il servizio. ⛔ Il giorno che la regola della pausa cambia, cambia in due posti.
   */
  const pausa = await prisma.event.findFirst({
    where: { clientId: p.userId, mode: 'pause_period', startDate: { lte: toDateOnly() }, endDate: { gte: toDateOnly() } } as never,
    select: { id: true },
  });
  if (pausa) return 'sospensione in corso';

  /**
   * ⛔ **I DUE CANCELLI CHE MANCAVANO, e sono quelli che tengono ferme le persone vere — 1/9.**
   *
   * La prima stesura di questa porta si fermava alla sospensione, e il tabulato rispondeva «nessun
   * motivo noto» su cinque clienti: due che non avevano **mai** ricevuto un menu, tre ferme da
   * giorni. ⚠️ «Nessun motivo noto» su una persona che paga è la risposta peggiore possibile —
   * manda a cercare un difetto dove non c'è, mentre il motore sta facendo esattamente quello che
   * gli è stato chiesto e aspetta una cosa che nessuno le ha detto di fare.
   *
   * ⚠️ Sono **richieste alla cliente**, non guasti: finché non arriva la misura, il menu resta
   * fermo di proposito. La differenza per chi legge il tabulato è enorme: non si apre un difetto,
   * si telefona.
   */
  const inizio = piano.startDate ?? p.planStartDate;
  if (await mancaMisuraDiPartenza(prisma as never, p.userId, inizio, giorniDiVisibilita)) {
    return 'aspetta la MISURA DI PARTENZA di questo piano (gliela stiamo chiedendo)';
  }

  /**
   * ⚠️ **La finestra di visibilità si misura sulla partenza del piano CHE EROGA**, non su
   * `planStartDate`: su chi ha comprato un rinnovo in coda le due date sono diverse, e usare la
   * seconda direbbe «troppo presto» a una cliente che sta ricevendo da mesi. È la stessa correzione
   * del 19/8 dentro `deliverIfEligible`.
   */
  if (inizio) {
    const visibileDal = new Date(toDateOnly(inizio.toISOString()).getTime() - giorniDiVisibilita * 86_400_000);
    if (toDateOnly().getTime() < visibileDal.getTime()) {
      return `il piano non è ancora visibile (parte il ${inizio.toISOString().slice(0, 10)})`;
    }
  }

  /**
   * ⚠️ **LA PESATA DEL RIENTRO NON È QUI, ED È UNA SCELTA.** Il motore, dopo una pausa, trattiene i
   * menu finché non arriva una pesata **del rientro** — e il giorno del rientro lo calcola da tre
   * rami diversi (pausa in corso, pausa appena finita, anticipo configurato). Rifare quel conto qui
   * vorrebbe dire farne una seconda copia, della cosa più delicata che c'è in mezzo.
   *
   * ⛔ Quindi su una cliente appena rientrata da una pausa questa porta può rispondere «nessun
   * motivo noto» mentre un motivo c'è: è la pesata che le è stata chiesta e non è arrivata. Chi
   * legge il tabulato e vede una rientrata guardi lì prima di aprire un difetto.
   */
  return null;
}
