import { PauseService } from './pause.service';

/**
 * IL GIRO DELLE PAUSE GUARDA IL GIORNO DI ROMA.
 *
 * `surveillanceTick` decide **quali pause sono in corso oggi** e **a chi tocca il menu di rientro**.
 * Il suo «oggi» era `setHours(0, 0, 0, 0)`, cioè il fuso del processo — UTC su Render: nelle due
 * ore dopo mezzanotte guardava ancora ieri, e chi la pausa l'aveva appena finita si vedeva
 * rimandare il rientro al giro dopo.
 *
 * ⚠️ Questo test guarda il `where` della query, non il risultato: è l'unico punto in cui quel
 * confine si vede: dentro la funzione «oggi» non esce mai. Senza, la correzione sarebbe una riga
 * cambiata che nessuno tiene ferma.
 */
describe('surveillanceTick — il giorno è quello di Roma', () => {
  it('all’una di notte del 19 cerca le pause del 19, non del 18', async () => {
    const pauseRequest = { findMany: jest.fn().mockResolvedValue([]) };
    const subscription = { findMany: jest.fn().mockResolvedValue([]) };
    const prisma = { pauseRequest, subscription } as never;
    const configParams = { getNumber: jest.fn(async (_k: string, d: number) => d) } as never;
    const service = new PauseService(prisma, {} as never, {} as never, configParams, {} as never);

    // Le 00:30 del 19 agosto a Roma = le 22:30 del 18 a Greenwich.
    jest.useFakeTimers().setSystemTime(new Date('2026-08-19T00:30:00+02:00'));
    try {
      await service.surveillanceTick();
    } finally {
      jest.useRealTimers();
    }

    const where = pauseRequest.findMany.mock.calls[0][0].where as {
      startDate: { lte: Date };
      endDate: { gte: Date };
    };
    expect(where.startDate.lte.toISOString()).toBe('2026-08-19T00:00:00.000Z');
    expect(where.endDate.gte.toISOString()).toBe('2026-08-19T00:00:00.000Z');

    // ⚠️ Il modo vecchio, scritto con `getUTC*` così vale anche lanciando i test da un Mac italiano:
    // `setHours(0,0,0,0)` su un processo a UTC avrebbe dato il 18.
    const adesso = new Date('2026-08-19T00:30:00+02:00');
    const vecchio = new Date(Date.UTC(adesso.getUTCFullYear(), adesso.getUTCMonth(), adesso.getUTCDate()));
    expect(vecchio.toISOString()).toBe('2026-08-18T00:00:00.000Z');
  });
});
