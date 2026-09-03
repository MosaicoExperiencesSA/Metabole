/**
 * ⛔ **QUANDO COMINCIA «QUESTO MOMENTO» PER UNA CLIENTE — e vuol dire UN RIENTRO DA UNA SOSPENSIONE,
 * niente altro.**
 *
 * La regola di Simone del 3/9 — *«quando uno **rientra** noi consideriamo sempre il peso del giorno
 * prima dell'inizio di quel momento e non dei piani precedenti»* — ha bisogno di una data.
 *
 * ## ⛔ Quello che questa data NON è, e perché la prima stesura sbagliava
 *
 * La prima stesura metteva **anche `ClientProfile.planStartDate`** alla pari di un rientro. Una
 * revisione avversariale l'ha smontata, e aveva ragione due volte:
 *
 * · `planStartDate` **si riscrive a ogni rinnovo dalla coda** (`planStartOrigine: 'coda'`). Quindi
 *   la regola si sarebbe accesa su **ogni cliente in rinnovo continuo**, che non ha rientrato da
 *   niente — cioè su quasi tutte, e per un motivo che Simone non ha nominato.
 * · Quel campo contiene **due cose diverse** — un giorno scelto da qualcuno, oppure un **istante**
 *   (la scadenza del piano in corso) — e `planStartOrigine` esiste apposta perché dal valore non si
 *   distinguono. Con l'origine `coda` una pesata di quel giorno (mezzanotte) cade **prima**
 *   dell'istante, cioè nel periodo vecchio: il commento che diceva «il confine è incluso nel
 *   periodo nuovo» sarebbe stato falso proprio lì.
 *
 * ⚠️ *Un rinnovo non è un rientro.* Simone ha risposto a una voce che parla di **chi sospende e
 * torna**; allargare la stessa regola a «ogni momento nuovo» era una mia estensione, non la sua.
 *
 * ## Cos'è, allora
 *
 * Il giorno **dopo** la fine dell'ultima sospensione vera: `Event` con `mode: 'pause_period'` **e**
 * `type: 'vacation'`. ⛔ Il filtro sul tipo non è pignoleria — è una lezione già pagata e scritta in
 * `pause.service.ts`: *«`pause_period` non vuol dire vacanza: dal Calendario una cliente può segnare
 * un matrimonio, una cena, un "Altro" — e un ricovero segnato come "Altro" sarebbe diventato un
 * rientro dalle vacanze»*.
 *
 * ⛔ **E una pausa ANNULLATA non è una pausa finita**: togliendo una sospensione in corso l'evento
 * non si cancella, si **accorcia a ieri** — cioè da fuori somiglia a una appena finita. Senza questo
 * controllo, la coach che si accorge di un errore e lo corregge cambierebbe il fabbisogno della
 * cliente. Stessa guardia di `pause.service.ts`, stessa ragione.
 *
 * ⚠️ **Una data nel futuro non conta**, e per costruzione l'ultimo giorno di una pausa dà «domani»:
 * la regola comincia a valere dal giorno dopo il rientro, non dal giorno stesso.
 *
 * ⛔ **`null` vuol dire «non lo so», e su «non lo so» non si taglia niente**: chi non ha mai sospeso
 * si comporta esattamente come prima di questa regola. Una prudenza che tagliasse lo stesso
 * toglierebbe dati a quasi tutte le clienti per servirne poche.
 */
import type { PrismaService } from '../prisma/prisma.service';

const GIORNO = 86_400_000;

/**
 * Il più recente fra i candidati, escluse le date future e quelle non valide.
 *
 * ⚠️ È la parte che si può sbagliare in silenzio — prendere la più vecchia, o lasciar passare una
 * data futura — quindi è pura e si prova da sola.
 */
export function ilPiuRecentePassato(
  candidati: readonly (Date | null | undefined)[],
  adesso: Date,
): Date | null {
  const buone = (candidati ?? [])
    .filter((d): d is Date => d instanceof Date && Number.isFinite(d.getTime()))
    .filter((d) => d.getTime() <= adesso.getTime());
  if (!buone.length) return null;
  return buone.reduce((a, b) => (a.getTime() >= b.getTime() ? a : b));
}

/**
 * Legge i due momenti dalla banca dati e rende quello che vale.
 *
 * ⚠️ Prende `PrismaService` intero, come `permesso-di-ruolo.ts`: una firma ricopiata a mano smette
 * di combaciare al primo cambio dello schema, e in sandbox (dove il client è uno stub) non combacia
 * già adesso.
 *
 * ⛔ **Se la lettura fallisce si rende `null`, cioè «non lo so», e chi chiama non taglia niente.**
 * Un errore di database non deve cambiare le calorie nel piatto di qualcuno: nel dubbio si torna al
 * comportamento di prima, che è quello che tutte hanno avuto fino a ieri.
 */
export async function inizioDelPeriodoDi(
  prisma: PrismaService,
  clientId: string,
  adesso: Date = new Date(),
  diCosaSiTratta?: (messaggio: string) => void,
): Promise<Date | null> {
  try {
    /**
     * ⚠️ **Una query sola, non due.** La prima stesura ne faceva due — questa e una rilettura di
     * `planStartDate` che il chiamante ha **già in memoria**. Su `tagliaPerIlCatalogo`, che chiama
     * `estimate` su centinaia di clienti in parallelo, erano migliaia di round-trip in più per un
     * dato già presente.
     */
    const pause = (await prisma.event.findMany({
      where: {
        clientId,
        mode: 'pause_period' as never,
        // ⛔ Il tipo: vedi il cappello. Un matrimonio in Calendario non è un rientro.
        type: 'vacation' as never,
        endDate: { lt: adesso } as never,
      } as never,
      orderBy: { endDate: 'desc' } as never,
      take: 5,
      select: { id: true, endDate: true },
    })) as { id: string; endDate: Date }[];
    if (!pause.length) return null;

    /** ⛔ Le annullate si scartano: da fuori somigliano a quelle appena finite. */
    for (const p of pause) {
      const annullata = await prisma.pauseRequest.findFirst({
        where: { eventId: p.id, status: 'closed' } as never,
        select: { id: true },
      });
      if (annullata) continue;
      /** ⚠️ Il periodo nuovo comincia il giorno DOPO la fine della pausa: `endDate` è ancora sospesa. */
      return ilPiuRecentePassato([new Date(p.endDate.getTime() + GIORNO)], adesso);
    }
    return null;
  } catch (e) {
    /**
     * ⛔ **Si torna al comportamento di prima, MA SI DICE.** La prima stesura aveva un `catch {}`
     * muto: se domani l'enum cambia o Prisma rifiuta il filtro — e ogni `where` qui è castato
     * `as never`, quindi TypeScript non controlla niente — la regola smetterebbe di applicarsi su
     * **tutte** le clienti, in silenzio, per sempre. La prudenza sul risultato è giusta; il silenzio
     * no.
     */
    diCosaSiTratta?.(`inizio del periodo non leggibile per ${clientId}: ${e instanceof Error ? e.message : e}`);
    return null;
  }
}
