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
