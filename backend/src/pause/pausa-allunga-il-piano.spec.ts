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

  const crea = (riga: Record<string, unknown> = CODA_ARRIVATA) => {
    const prisma = {
      pauseRequest: {
        findFirst: jest.fn().mockResolvedValue(null), // nessuna richiesta già in attesa
        create: jest.fn().mockResolvedValue({ id: 'req-1', status: 'auto_approved' }),
      },
      measurement: { findFirst: jest.fn().mockResolvedValue({ weightKg: 70 }) },
      event: { create: jest.fn().mockResolvedValue({ id: 'ev-1' }) },
      subscription: {
        findMany: jest.fn(({ where }: { where: { status?: unknown } }) => {
          const ammessi: string[] = (where.status as { in?: string[] })?.in ?? [where.status as string];
          return Promise.resolve([riga].filter((s) => ammessi.includes((s as { status: string }).status)));
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
});
