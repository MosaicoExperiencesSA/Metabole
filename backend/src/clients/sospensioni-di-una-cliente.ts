/**
 * ⛔ **LE SOSPENSIONI DI UNA CLIENTE — una lettura sola, per la scheda e per la diagnostica.**
 *
 * ## Perché è uscita dal servizio (24/8)
 *
 * Il 23/8 una cliente vera è rimasta ferma per ore e `npm run diag:cliente` diceva «idonea»: le
 * **pause non le mostrava**, e il cancello era una richiesta di pausa 17→23/8 auto-approvata. La
 * diagnostica rispondeva a una domanda più stretta di quella che chi la lanciava si stava facendo.
 *
 * ⚠️ La risposta esisteva già, in `clients.service.sospensioni()`, dietro un controllo di permessi
 * che uno script da riga di comando non ha e non deve avere. Ricopiarla nello script sarebbe stata
 * **la seconda lettura della stessa cosa** — e due letture della stessa cosa un giorno divergono,
 * proprio mentre qualcuno le sta confrontando per capire perché una cliente non mangia. Quindi la
 * lettura sta qui, e i due chiamanti ci passano: il servizio ci mette il controllo dei permessi
 * davanti, lo script no.
 *
 * ## Le quattro cose, e perché restano quattro
 *
 *  1. `periodi` — i periodi VERI (`event` con `mode = pause_period`). **Sono questi che fermano
 *     l'erogazione**; gli altri tre no.
 *  2. `richieste` — le richieste di pausa, anche già decise: dicono chi ha approvato e quando.
 *  3. `viaggio` — lo storico della card, dal registro.
 *  4. `dichiarati` — i periodi scritti nel questionario. Non fermano niente e non l'hanno mai fatto.
 *
 * ⚠️ `riprendeIl` è ovunque il **primo giorno di dieta**, non l'ultimo di vacanza, e la conversione
 * la fa `giornoDiRientro` — mai una somma di 86.400.000 scritta a mano.
 */
import { ETICHETTA_PAUSA, ETICHETTA_VIAGGIO } from '../pause/pause.service';
import { giorniSospesi, giornoDiRientro } from '../pause/giorno-di-rientro';
import { primoGiornoUtile } from '../pause/primo-giorno-utile';
import { aGiorno, giornoDelDato, toDateOnly } from '../common/date-only';
import type { PrismaService } from '../prisma/prisma.service';

export async function sospensioniDiUnaCliente(prisma: PrismaService, userId: string) {
  const oggi = toDateOnly();

  const [eventi, richieste, profilo] = await Promise.all([
    prisma.event.findMany({
      where: { clientId: userId, mode: 'pause_period' as never } as never,
      orderBy: { startDate: 'desc' },
      take: 50,
      select: { id: true, startDate: true, endDate: true, label: true, note: true, createdAt: true },
    }) as Promise<{ id: string; startDate: Date; endDate: Date; label: string | null; note: string | null; createdAt: Date }[]>,
    prisma.pauseRequest.findMany({
      where: { clientId: userId } as never,
      orderBy: { startDate: 'desc' },
      take: 50,
      select: {
        id: true, startDate: true, endDate: true, days: true, status: true,
        eventId: true, decidedByStaffId: true, decidedAt: true, staffNote: true, createdAt: true,
      },
    }) as Promise<{
      id: string; startDate: Date; endDate: Date; days: number; status: string;
      eventId: string | null; decidedByStaffId: string | null; decidedAt: Date | null;
      staffNote: string | null; createdAt: Date;
    }[]>,
    prisma.clientProfile.findUnique({
      where: { userId },
      select: { consents: true, travelState: true, travelStart: true, travelEnd: true },
    }) as Promise<{ consents: unknown; travelState: string | null; travelStart: Date | null; travelEnd: Date | null } | null>,
  ]);

  /** Chi ha deciso: i nomi si leggono in blocco, non uno per riga. */
  const idsStaff = [...new Set(richieste.map((r) => r.decidedByStaffId).filter((x): x is string => Boolean(x)))];
  const nomi = new Map<string, string>();
  if (idsStaff.length) {
    const persone = (await prisma.user.findMany({
      where: { id: { in: idsStaff } },
      select: { id: true, email: true, firstName: true, lastName: true },
    })) as { id: string; email: string; firstName: string | null; lastName: string | null }[];
    for (const p of persone) {
      nomi.set(p.id, [p.firstName, p.lastName].filter(Boolean).join(' ') || p.email);
    }
  }
  const perEvento = new Map(richieste.filter((r) => r.eventId).map((r) => [r.eventId as string, r]));

  const giorno = (d: Date) => d.toISOString().slice(0, 10);
  const quandoSiamo = (dal: Date, ultimoSospeso: Date): 'futura' | 'in_corso' | 'passata' => {
    if (oggi.getTime() < giornoDelDato(dal).getTime()) return 'futura';
    return oggi.getTime() <= giornoDelDato(ultimoSospeso).getTime() ? 'in_corso' : 'passata';
  };

  /**
   * ⚠️ I periodi che **occupano ancora dei giorni**: quelli in corso oggi e quelli programmati. Sono
   * questi che spostano in avanti la prossima sospensione — su una vacanza già finita non c'è niente
   * da non sovrapporre.
   */
  const periodiVivi = eventi.filter(
    (e) => giornoDelDato(e.endDate).getTime() >= oggi.getTime(),
  ) as { startDate: Date; endDate: Date; label: string | null }[];

  const periodi = eventi.map((e) => ({
    id: e.id,
    dal: giorno(e.startDate),
    riprendeIl: giorno(giornoDiRientro(e)),
    giorni: giorniSospesi(e),
    stato: quandoSiamo(e.startDate, e.endDate),
    /**
     * Da dove è nata. ⚠️ Le tre porte non valgono uguale in €: la richiesta di pausa e la
     * modalità viaggio allungano la scadenza del piano, il Calendario in app **no** (difetto
     * aperto, segnalato a Simone il 23/8). Chi legge la scheda deve poterlo distinguere.
     */
    origine:
      e.label === ETICHETTA_VIAGGIO
        ? 'Modalità viaggio'
        : perEvento.has(e.id)
          ? 'Richiesta di pausa'
          : 'Calendario in app',
    /**
     * ⛔ Il MOTIVO scritto da chi l'ha inserita (24/8).
     *
     * ⚠️ `null` vuol dire «non gliel'abbiamo chiesto», non «non c'era un motivo» — e la scheda lo
     * scrive così. Restano senza: le sospensioni **scritte prima del 24/8**, e **quelle che nascono
     * dalle altre porte** — la richiesta di pausa dall'app, l'approvazione di una collega, il
     * Calendario. Il campo lo chiede solo la card, e quelle strade non sono state toccate. ⚠️ La
     * prima stesura dei commenti diceva «prima del 24/8» e basta: falso, e l'ha corretto la revisione.
     *
     * ✅ **Il Calendario in app un motivo però ce l'ha già**, e nessuno lo leggeva: la cliente ci
     * scrive un testo libero e finisce in `label`. Se non c'è `note` e l'etichetta non è una delle
     * due di sistema, quella è la sua motivazione — scritta da lei.
     */
    motivo: e.note ?? (e.label && e.label !== ETICHETTA_VIAGGIO && e.label !== ETICHETTA_PAUSA ? e.label : null),
    creataIl: e.createdAt,
  }));

  return {
    periodi,
    richieste: richieste.map((r) => ({
      id: r.id,
      dal: giorno(r.startDate),
      riprendeIl: giorno(giornoDiRientro(r)),
      giorni: r.days,
      stato: r.status,
      decisaDa: r.decidedByStaffId ? (nomi.get(r.decidedByStaffId) ?? null) : null,
      decisaIl: r.decidedAt,
      nota: r.staffNote,
      chiestaIl: r.createdAt,
    })),
    viaggio: await storicoModalitaViaggio(prisma, userId),
    /**
     * ⛔ **DA QUANDO PUÒ COMINCIARE LA PROSSIMA** — 25/8, richiesta di Simone: *«se c'è già una
     * sospensione in corso o programmata il sistema deve dare come data inizio della nuova
     * sospensione il primo giorno utile»*.
     *
     * ⚠️ La tregua qui è **zero**, e non è una dimenticanza: dalla card decide la coach, e Simone ha
     * scelto che lei le sospensioni le possa fare **continue** (*«il giorno di rientro in modo che la
     * coach (non la cliente) possa fare le sospensioni continue»*). Sulle porte della cliente lo
     * stesso conto gira con i quindici giorni.
     *
     * ⚠️ `null` quando non c'è niente che sposti la data: la card non scrive una riga che dice
     * «puoi cominciare da oggi», che è il comportamento normale e non è una notizia.
     */
    prossimaSospensione: (() => {
      const e = primoGiornoUtile(aGiorno(new Date()), periodiVivi, 0);
      return e.bloccante
        ? {
            primoGiornoUtile: giorno(e.giorno),
            bloccanteDal: giorno(e.bloccante.startDate),
            bloccanteRiprendeIl: giorno(giornoDiRientro(e.bloccante)),
            bloccanteEtichetta: e.bloccante.label ?? null,
          }
        : null;
    })(),
    /** Lo stato scritto adesso sul profilo, per far vedere la card e l'elenco d'accordo. */
    adesso: profilo
      ? {
          stato: profilo.travelState,
          dal: profilo.travelStart ? giorno(profilo.travelStart) : null,
          /**
           * ⚠️ **`giornoDiRientro`, non una somma a mano** (24/8). Qui c'era
           * `giornoDelDato(travelEnd) + 86_400_000`: la quarta copia della stessa conversione, in
           * un file che due righe sopra spiega che la conversione la fa una funzione sola. Il
           * risultato era lo stesso — finché qualcuno non cambia la regola in un posto solo.
           */
          riprendeIl: profilo.travelEnd ? giorno(giornoDiRientro({ startDate: profilo.travelEnd, endDate: profilo.travelEnd })) : null,
        }
      : null,
    dichiarati: Array.isArray((profilo?.consents as { pausePeriods?: unknown })?.pausePeriods)
      ? ((profilo?.consents as { pausePeriods: { start?: string; end?: string }[] }).pausePeriods).map((p) => ({
          dal: p.start ?? null,
          al: p.end ?? null,
        }))
      : [],
  };
}


/**
 * Lo storico della card «Modalità viaggio», dal registro.
 *
 * ⚠️ Le voci scritte **prima del 23/8** hanno `metadata: { state }` e basta: da quel giorno ci
 * finiscono anche `dal`, `riprendeIl` e i giorni sospesi. Le vecchie restano con le date a
 * `null` — che è la verità, e si vede — invece di essere riempite indovinando.
 */
export async function storicoModalitaViaggio(prisma: PrismaService, userId: string) {
  const righe = (await prisma.auditLog.findMany({
    where: {
      entityId: userId,
      action: { in: ['client.travel.update', 'client.travel.suspend', 'client.travel.resume'] },
    },
    orderBy: { createdAt: 'desc' },
    take: 30,
    include: { actor: { select: { email: true, firstName: true, lastName: true } } },
  })) as {
    id: string; action: string; createdAt: Date; metadata: unknown;
    actor: { email: string; firstName: string | null; lastName: string | null } | null;
  }[];
  return righe.map((r) => {
    const m = (r.metadata ?? {}) as {
      state?: string | null; dal?: string | null; riprendeIl?: string | null;
      giorni?: number | null; giorniSospesi?: number | null; motivo?: string | null;
    };
    return {
      id: r.id,
      azione: r.action,
      quando: r.createdAt,
      stato: m.state ?? null,
      /**
       * ⛔ **IL MOTIVO, che nel registro c'era e nessuno leggeva** — 25/8, richiesta di Simone:
       * *«dalla tabella storico togliamo stato e mettiamo motivo»*.
       *
       * `client.travel.update` lo scrive in `metadata.motivo` dal 24/8, ma questa funzione non lo
       * esponeva: la colonna «Stato» in pagina era tutta «—» da quando la tendina è stata tolta, e
       * accanto c'era il dato che risponde alla domanda per cui uno storico si guarda — **perché**.
       *
       * ⚠️ `stato` **resta nella risposta** anche se la pagina non lo disegna più: è il dato delle
       * voci vecchie, e toglierlo dalla API vorrebbe dire cancellare la storia invece di smettere di
       * mostrarla. Le righe di prima del 24/8 hanno `motivo: null`, che è la verità.
       */
      motivo: m.motivo ?? null,
      dal: m.dal ?? null,
      riprendeIl: m.riprendeIl ?? null,
      giorni: m.giorniSospesi ?? m.giorni ?? null,
      chi: r.actor
        ? [r.actor.firstName, r.actor.lastName].filter(Boolean).join(' ') || r.actor.email
        : null,
    };
  });
}

