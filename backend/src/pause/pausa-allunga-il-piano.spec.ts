import { PauseService } from './pause.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * I GIORNI DI PAUSA SI SOMMANO AL PIANO CHE LEI HA COMPRATO — anche se comincia lunedì.
 *
 * ⚠️ `freezeSubscription` è il punto in cui una pausa concessa diventa giorni veri sulla scadenza, e
 * non aveva nessun test. Da quando la coda si scrive `queued` (voce 258, 19/8), leggendo i soli
 * `active` una cliente il cui unico piano è in coda non aveva nessuna riga da allungare: la pausa
 * risultava approvata, il messaggio le diceva che la scadenza slitta in avanti, e la scadenza non si
 * muoveva di un giorno. Un regalo che esiste solo nel messaggio è peggio di un regalo negato:
 * nessuno se ne accorge finché non è lei a contare i giorni.
 *
 * ⚠️ Il finto Prisma qui **filtra come il database vero**: senza, il test passerebbe anche leggendo i
 * soli `active`, cioè non verificherebbe niente.
 */
describe('PauseService — la pausa allunga il piano comprato', () => {
  const giorno = (n: number) => new Date(Date.now() + n * 86_400_000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  /**
   * Una coda con la partenza **già arrivata**: la promozione notturna è in ritardo, lo stato dice
   * ancora «in coda» e intanto l'erogazione le sta consegnando i menu. È il caso in cui i giorni di
   * pausa sono giorni veri.
   */
  const CODA_ARRIVATA = { id: 'sub-coda', status: 'queued', startDate: giorno(-10), endDate: giorno(80) };

  const crea = (righe: Record<string, unknown>[] | Record<string, unknown> = CODA_ARRIVATA) => {
    const tutte = Array.isArray(righe) ? righe : [righe];
    const prisma = {
      /**
       * ⚠️ `Promise.all`, non `mockResolvedValue([])`. La transazione di Prisma nella forma a
       * elenco **esegue** le operazioni: un finto che risponde `[]` senza eseguirle farebbe passare
       * il test anche se le scritture non partissero — cioè verificherebbe il contrario di quello
       * che c'è scritto sopra.
       */
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops as Promise<unknown>[])),
      pauseRequest: {
        findFirst: jest.fn().mockResolvedValue(null), // nessuna richiesta già in attesa
        create: jest.fn().mockResolvedValue({ id: 'req-1', status: 'auto_approved' }),
      },
      measurement: { findFirst: jest.fn().mockResolvedValue({ weightKg: 70 }) },
      // ⚠️ `findFirst` serve alla tregua fra due vacanze (23/8): nessuna pausa precedente.
      /**
       * ⚠️ `findMany` aggiunto il 25/8 con la guardia sulle sovrapposizioni: `requestPause` legge i
       * periodi della cliente per rifiutare quelli che si accavallano. Qui la cliente non ne ha
       * nessuno — è quello che questi test presuppongono, e adesso lo **dicono** invece di lasciarlo
       * decidere a un finto che non c'era.
       */
      event: {
        create: jest.fn().mockResolvedValue({ id: 'ev-1' }),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
      subscription: {
        findMany: jest.fn(({ where }: { where: { status?: unknown } }) => {
          const ammessi: string[] = (where.status as { in?: string[] })?.in ?? [where.status as string];
          return Promise.resolve(tutte.filter((s) => ammessi.includes((s as { status: string }).status)));
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      clientProfile: { findUnique: jest.fn().mockResolvedValue({ assignedCoachId: null, assignedNutritionistId: null }) },
      staff: { findUnique: jest.fn().mockResolvedValue(null), findFirst: jest.fn().mockResolvedValue(null) },
      notification: { create: jest.fn().mockResolvedValue({}), findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new PauseService(
      prisma as unknown as PrismaService,
      { log: jest.fn().mockResolvedValue(undefined) } as never,
      { notify: jest.fn().mockResolvedValue(undefined), notifyOncePerDay: jest.fn().mockResolvedValue(undefined) } as never,
      { getNumber: jest.fn(async (_k: string, d?: number) => d ?? 0) } as never,
      {} as never,
    );
    return { service, prisma };
  };

  it('⚠️ con il solo piano IN CODA già partito, i sette giorni finiscono sulla sua scadenza', async () => {
    const { service, prisma } = crea();
    // Sette giorni: sotto il tetto dell'approvazione automatica, così la pausa si congela subito.
    await service.requestPause('c1', { startDate: iso(giorno(3)), endDate: iso(giorno(9)) });

    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sub-coda' },
        data: { endDate: new Date(CODA_ARRIVATA.endDate.getTime() + 7 * 86_400_000) },
      }),
    );
  });

  /**
   * ⚠️ MA UN PIANO CHE NON È ANCORA COMINCIATO NON SI ALLUNGA. Regalare giorni per una pausa in cui
   * non c'era nessun menu da sospendere sarebbe un numero inventato sulla scadenza. Cosa debba fare
   * una pausa chiesta prima della partenza — spostare l'inizio? rifiutarla? — è una domanda di
   * prodotto: qui non si decide, si dice che non si è fatto niente.
   */
  it('⚠️ ma un piano che comincia fra due mesi non si allunga: non ha perso nessun giorno', async () => {
    const { service, prisma } = crea({ id: 'sub-futura', status: 'queued', startDate: giorno(60), endDate: giorno(150) });
    await service.requestPause('c1', { startDate: iso(giorno(3)), endDate: iso(giorno(9)) });
    expect(prisma.subscription.update).not.toHaveBeenCalled();
  });

  /**
   * ⚠️ LA CODA SCORRE CON IL PIANO ALLUNGATO — decisione di Simone, 19/8 sera.
   *
   * Prima si allungava la fine del piano in corso e basta. Se dietro c'era una coda già pagata,
   * quella restava dov'era e cominciava **dentro** il piano appena allungato: l'erogazione ne
   * sceglie **uno solo** — quello che finisce più tardi — e i giorni dell'altro scorrono senza che
   * la cliente riceva niente. ⛔ I giorni di pausa glieli davamo con una mano e gliene toglievamo
   * altrettanti con l'altra, e il conto non lo faceva vedere nessuno.
   */
  describe('⚠️ e la coda dietro scorre con lui', () => {
    const IN_CORSO = { id: 'sub-uno', status: 'active', startDate: giorno(-60), endDate: giorno(10) };
    const CODA_DIETRO = { id: 'sub-due', status: 'queued', startDate: giorno(10), endDate: giorno(100) };

    it('⚠️ il piano in coda si sposta in avanti degli stessi giorni, inizio E fine', async () => {
      const { service, prisma } = crea([IN_CORSO, CODA_DIETRO]);
      await service.requestPause('c1', { startDate: iso(giorno(1)), endDate: iso(giorno(7)) });

      const spostamento = prisma.subscription.update.mock.calls.find((c: any) => c[0].where.id === 'sub-due');
      expect(spostamento).toBeDefined();
      expect(spostamento[0].data.startDate).toEqual(new Date(CODA_DIETRO.startDate.getTime() + 7 * 86_400_000));
      // ⚠️ Anche la fine: spostare solo l'inizio le accorcerebbe il piano di sette giorni.
      expect(spostamento[0].data.endDate).toEqual(new Date(CODA_DIETRO.endDate.getTime() + 7 * 86_400_000));
    });

    /**
     * ⚠️ **In una transazione sola.** Se l'allungamento passasse e lo spostamento no, resterebbe
     * scritto proprio lo stato che questo codice esiste per evitare — e nessuno lo saprebbe.
     */
    it('⚠️ allungamento e spostamento stanno nella stessa transazione', async () => {
      const { service, prisma } = crea([IN_CORSO, CODA_DIETRO]);
      await service.requestPause('c1', { startDate: iso(giorno(1)), endDate: iso(giorno(7)) });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.$transaction.mock.calls[0][0]).toHaveLength(2);
    });

    /** Senza niente dietro, non si sposta nessuno: una transazione con la sola riga allungata. */
    it('senza coda dietro non si sposta nessuno', async () => {
      const { service, prisma } = crea([IN_CORSO]);
      await service.requestPause('c1', { startDate: iso(giorno(1)), endDate: iso(giorno(7)) });
      expect(prisma.$transaction.mock.calls[0][0]).toHaveLength(1);
      expect(prisma.subscription.update).toHaveBeenCalledTimes(1);
    });
  });
});
