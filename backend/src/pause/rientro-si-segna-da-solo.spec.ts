import { PauseService } from './pause.service';

/**
 * ⛔ **IL RIENTRO SI SEGNA DA SOLO** — 24/8, insieme alla tendina «Stato» tolta dalla card
 * (Simone: «va tolto il campo stato che crea confusione»).
 *
 * L'evento `travel_return` non è un dettaglio di archivio: accende la **campagna di rientro** del
 * marketing (`lifecycle.service.ts`) e il tono «bentornata» di Gaia (`DietAgentService`). Fino a
 * ieri nasceva in un punto solo — qualcuno tornava sulla scheda giorni dopo e sceglieva
 * «Rientrato/a» in una tendina — quindi dipendeva dalla memoria di una coach, e per le sospensioni
 * nate dall'app o dal Calendario non nasceva **mai**.
 *
 * ⚠️ Questi test guardano le tre reti che rendono sicuro l'automatismo: la finestra, la seconda
 * pausa attaccata, e l'evento che non si riscrive.
 */
function conEventi(finite: { id?: string; clientId: string; endDate: Date }[], opzioni: {
  ancoraSospesa?: boolean;
  giaSegnato?: boolean;
  annullata?: boolean;
} = {}) {
  const analyticsEvent = {
    findFirst: jest.fn().mockResolvedValue(opzioni.giaSegnato ? { id: 'a1' } : null),
    create: jest.fn().mockResolvedValue({}),
  };
  const event = {
    findMany: jest.fn(async (args: { where?: { endDate?: { lt?: Date } } }) =>
      // La prima `findMany` è quella del passo 3-bis (pesata del rientro): non è questo il test.
      args?.where?.endDate?.lt ? finite : []),
    findFirst: jest.fn().mockResolvedValue(opzioni.ancoraSospesa ? { id: 'e-viva' } : null),
  };
  const clientProfile = { updateMany: jest.fn().mockResolvedValue({ count: 1 }) };
  const pauseRequest = {
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn().mockResolvedValue(opzioni.annullata ? { id: 'pr-chiusa' } : null),
  };
  const prisma = {
    pauseRequest,
    subscription: { findMany: jest.fn().mockResolvedValue([]) },
    event,
    analyticsEvent,
    clientProfile,
    // ⚠️ La spazzata del rientro (passo 4-ter) chiede le schede parcheggiate: qui nessuna.
    crmRecord: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() },
    pipelineStage: { findUnique: jest.fn().mockResolvedValue({ order: 5 }) },
  } as never;
  const configParams = { getNumber: jest.fn(async (_k: string, d: number) => d) } as never;
  const service = new PauseService(prisma, {} as never, {} as never, configParams, {} as never);
  return { service, analyticsEvent, clientProfile, event, pauseRequest };
}

const ieri = () => new Date(Date.now() - 86_400_000);

describe('il rientro lo segna il giro notturno', () => {
  it('una pausa finita ieri scrive il `travel_return`: è quello che accende la campagna di rientro', async () => {
    const { service, analyticsEvent } = conEventi([{ clientId: 'cli-1', endDate: ieri() }]);
    const esito = await service.surveillanceTick();
    expect(analyticsEvent.create).toHaveBeenCalledTimes(1);
    expect(analyticsEvent.create.mock.calls[0][0].data).toMatchObject({ name: 'travel_return', userId: 'cli-1' });
    expect(esito.rientriSegnati).toBe(1);
  });

  /**
   * ⚠️ E spegne lo stato sul profilo **date comprese**, ma solo per il viaggio che è finito
   * davvero: chi ha una modalità viaggio già programmata per la settimana prossima non deve
   * vedersela cancellare da una pausa di ieri nata da un'altra porta.
   */
  it('⚠️ spegne lo stato e azzera le date, solo per il viaggio davvero finito', async () => {
    const fine = ieri();
    const { service, clientProfile } = conEventi([{ clientId: 'cli-1', endDate: fine }]);
    await service.surveillanceTick();
    expect(clientProfile.updateMany).toHaveBeenCalledTimes(1);
    const chiamata = clientProfile.updateMany.mock.calls[0][0];
    expect(chiamata.where).toMatchObject({
      userId: 'cli-1',
      travelState: { in: ['in_partenza', 'in_vacanza'] },
      travelEnd: { lte: fine },
    });
    // ⛔ Le date si azzerano: se restassero, la card si precompilerebbe con la vacanza di agosto
    // per sempre e ogni Salva finirebbe contro «questa vacanza è già finita».
    expect(chiamata.data).toEqual({ travelState: 'rientrato', travelStart: null, travelEnd: null });
  });

  /**
   * ⛔ **`pause_period` NON vuol dire «vacanza»**: dal Calendario in app una cliente segna anche
   * matrimoni, cene e «Altro» — e un ricovero segnato come «Altro» sarebbe diventato un rientro
   * dalle vacanze, con la mail «Bentornata, ripartiamo con dolcezza» il giorno dopo.
   */
  it('⛔ guarda solo i periodi di tipo «vacation»', async () => {
    const { service, event } = conEventi([]);
    await service.surveillanceTick();
    const where = event.findMany.mock.calls.map((c: unknown[]) => (c[0] as { where: Record<string, unknown> }).where)
      .find((w: Record<string, unknown>) => (w.endDate as { lt?: Date })?.lt) as Record<string, unknown>;
    expect(where).toMatchObject({ mode: 'pause_period', type: 'vacation' });
  });

  /**
   * ⛔ **UNA PAUSA ANNULLATA NON È UNA PAUSA FINITA.** Togliendo una sospensione in corso l'evento
   * non si cancella: si accorcia a **ieri** — quindi cade dentro questa finestra. Senza questo
   * controllo, la coach che si accorge di un errore e lo corregge farebbe partire la notte dopo la
   * mail di rientro da una vacanza che non c'è mai stata.
   */
  it('⛔ una sospensione ANNULLATA (accorciata a ieri) non è un rientro', async () => {
    const { service, analyticsEvent, pauseRequest } = conEventi(
      [{ id: 'ev-1', clientId: 'cli-1', endDate: ieri() }],
      { annullata: true },
    );
    await service.surveillanceTick();
    expect(analyticsEvent.create).not.toHaveBeenCalled();
    expect(pauseRequest.findFirst.mock.calls[0][0].where).toMatchObject({ eventId: 'ev-1', status: 'closed' });
  });

  /**
   * ⛔ **LE PAUSE ATTACCATE ESISTONO** — una vacanza che finisce e una seconda che comincia il
   * giorno dopo. «Bentornata, riprendiamo» in mezzo alla seconda vacanza è un messaggio che dice il
   * falso, e la campagna di rientro partirebbe verso chi i menu non li sta ancora ricevendo.
   */
  it('⛔ se un\'altra sospensione è ancora in corso, non è rientrata: niente evento', async () => {
    const { service, analyticsEvent } = conEventi([{ clientId: 'cli-1', endDate: ieri() }], { ancoraSospesa: true });
    const esito = await service.surveillanceTick();
    expect(analyticsEvent.create).not.toHaveBeenCalled();
    expect(esito.rientriSegnati).toBe(0);
  });

  /**
   * ⚠️ La finestra di tre giorni riprende le pause finite mentre il cron era fermo, quindi lo stesso
   * rientro passa di qui **tre notti di fila**. Senza questo controllo, Gaia ricomincerebbe ogni
   * notte a contare i giorni dal rientro — e direbbe «bentornata» per una settimana.
   */
  it('⚠️ l\'evento non si riscrive se ce n\'è già uno dopo la fine di quella pausa', async () => {
    const { service, analyticsEvent } = conEventi([{ clientId: 'cli-1', endDate: ieri() }], { giaSegnato: true });
    await service.surveillanceTick();
    expect(analyticsEvent.create).not.toHaveBeenCalled();
    expect(analyticsEvent.findFirst.mock.calls[0][0].where).toMatchObject({ name: 'travel_return', userId: 'cli-1' });
  });

  it('⚠️ e la ricerca guarda solo le pause finite negli ultimi tre giorni, non quelle di mesi fa', async () => {
    const { service, event } = conEventi([]);
    await service.surveillanceTick();
    const where = event.findMany.mock.calls.map((c: unknown[]) => (c[0] as { where: Record<string, unknown> }).where)
      .find((w: Record<string, unknown>) => (w.endDate as { lt?: Date })?.lt) as { endDate: { gte: Date; lt: Date } };
    const giorni = Math.round((where.endDate.lt.getTime() - where.endDate.gte.getTime()) / 86_400_000);
    expect(giorni).toBe(3);
  });
});

/**
 * ⛔ **E LA PIPELINE SEGUE LA SOSPENSIONE** — Simone, 24/8: «un nuovo stato "In sospensione" dove
 * sostiamo i clienti durante la sospensione e li riportiamo in Acquisto una volta che riprendono».
 * Qui si guarda che il giro notturno chiami davvero le due porte: parcheggio per chi è ferma oggi,
 * ritorno per chi ha appena finito. La logica delle due sta in `sospensione-in-pipeline.spec.ts`.
 */
describe('il giro notturno muove anche le schede', () => {
  function conSospese(
    inCorso: { clientId: string }[],
    finite: { id?: string; clientId: string; endDate: Date }[] = [],
    parcheggiate: { clientId: string }[] = [],
  ) {
    const crmRecord = {
      findUnique: jest.fn().mockResolvedValue({ stage: 'paid', stageDates: {}, stagePrimaSospensione: null }),
      update: jest.fn().mockResolvedValue({}),
      // Le schede attualmente parcheggiate, per la spazzata del rientro (passo 4-ter).
      findMany: jest.fn().mockResolvedValue(parcheggiate),
    };
    const event = {
      findMany: jest.fn(async (args: { where?: { endDate?: { lt?: Date }; startDate?: unknown } }) => {
        if (args?.where?.endDate?.lt) return finite;           // pause appena finite (passo 5)
        if (args?.where?.startDate) return inCorso;            // sospensioni in corso oggi (passo 4-bis)
        return [];
      }),
      // ⚠️ La spazzata del rientro chiede «c'è ancora una sospensione in corso?»: rispondo di sì
      // quando quella cliente è anche fra le sospese di oggi.
      findFirst: jest.fn(async (args: { where?: { clientId?: string } }) =>
        (inCorso.some((x) => x.clientId === args?.where?.clientId) ? { id: 'ev-viva' } : null)),
    };
    const prisma = {
      pauseRequest: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
      subscription: { findMany: jest.fn().mockResolvedValue([]) },
      event,
      analyticsEvent: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
      clientProfile: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      crmRecord,
      pipelineStage: { findUnique: jest.fn(async ({ where }: { where: { key: string } }) => ({ order: where.key === 'paid' ? 4 : 5 })) },
    } as never;
    const configParams = { getNumber: jest.fn(async (_k: string, d: number) => d) } as never;
    return { service: new PauseService(prisma, {} as never, {} as never, configParams, {} as never), crmRecord };
  }

  it('chi è sospesa oggi finisce in «In sospensione»', async () => {
    const { service, crmRecord } = conSospese([{ clientId: 'cli-1' }]);
    const esito = await service.surveillanceTick();
    expect(esito.parcheggiate).toBe(1);
    expect(crmRecord.update.mock.calls[0][0].data.stage).toBe('in_sospensione');
  });

  /**
   * ⚠️ **Ogni notte, non solo la prima**: una cliente già parcheggiata non si tocca (lo dice
   * `parcheggiaInSospensione`), ma il giro ripassa lo stesso — è quello che ripara da solo la notte
   * in cui il cron non gira, e che copre le pause create prima di questa consegna.
   */
  it('⚠️ e la stessa cliente non si conta due volte se è già parcheggiata', async () => {
    const { service, crmRecord } = conSospese([{ clientId: 'cli-1' }, { clientId: 'cli-1' }]);
    await service.surveillanceTick();
    expect(crmRecord.update).toHaveBeenCalledTimes(1);
  });

  /**
   * ⛔ **IL RIENTRO SI RIPARA DA SOLO, come il parcheggio** — rilievo della revisione del 25/8, il
   * più grave. Prima il ritorno era attaccato al passo del `travel_return`, cioè **dopo** tre
   * controlli scritti per il marketing: lo script `sblocca:sospensione`, la cliente che si cancella
   * l'evento dall'app e un cron fermo tre giorni lasciavano la scheda parcheggiata **per sempre** —
   * e chi apriva la board vedeva ferma una che i menu li stava ricevendo da settimane. Adesso la
   * domanda è una sola, e non dipende da come è finita la pausa: c'è ancora una sospensione oggi?
   */
  /**
   * ⚠️ **E chi è ancora ferma resta ferma.** La spazzata gira su TUTTE le schede parcheggiate ogni
   * notte: senza questo controllo riporterebbe indietro anche chi è in vacanza da tre giorni, e la
   * colonna si svuoterebbe da sola la notte dopo essere stata riempita.
   */
  it('⚠️ una scheda parcheggiata con la sospensione ANCORA in corso non si tocca', async () => {
    const { service, crmRecord } = conSospese([{ clientId: 'cli-3' }], [], [{ clientId: 'cli-3' }]);
    crmRecord.findUnique.mockResolvedValue({ stage: 'in_sospensione', stageDates: {}, stagePrimaSospensione: 'paid' });
    const esito = await service.surveillanceTick();
    expect(esito.riportate).toBe(0);
    // ⚠️ `parcheggiate` resta 0 perché è già parcheggiata: l'unica scrittura possibile sarebbe il
    // ritorno, e non deve avvenire.
    expect(crmRecord.update).not.toHaveBeenCalled();
  });

  it('⛔ una scheda parcheggiata SENZA nessuna sospensione in corso torna dov\'era', async () => {
    const { service, crmRecord } = conSospese([], [], [{ clientId: 'cli-2' }]);
    crmRecord.findUnique.mockResolvedValue({ stage: 'in_sospensione', stageDates: {}, stagePrimaSospensione: 'first_visit' });
    const esito = await service.surveillanceTick();
    expect(esito.riportate).toBe(1);
    expect(crmRecord.update.mock.calls.at(-1)![0].data).toMatchObject({ stage: 'first_visit', stagePrimaSospensione: null });
  });
});
