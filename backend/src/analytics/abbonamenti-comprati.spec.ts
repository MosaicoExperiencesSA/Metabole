import { AnalyticsService } from './analytics.service';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';

/**
 * «QUANTI ABBONAMENTI ATTIVI?» — UNA DOMANDA, UN NUMERO SOLO (voce 258, 19/8).
 *
 * ⚠️ Il contatore dei Grafici e quello della dashboard rispondono alla stessa domanda, e la
 * dashboard conta anche i piani in coda: chi ha comprato ha un piano, anche se comincia lunedì. Se
 * questo contasse i soli `active` i due numeri divergerebbero — e due conteggi della stessa cosa che
 * non coincidono sono peggio di un conteggio sbagliato: non si sa più quale guardare, e si smette di
 * guardarli tutti e due.
 */
describe('AnalyticsService.charts — gli abbonamenti comprati', () => {
  const admin: AuthUser = { sub: 'u-admin', email: 'a@b.it', role: 'admin' };

  const conStati = (stati: string[]) =>
    ({
      staff: { findUnique: jest.fn().mockResolvedValue(null) },
      user: {
        findMany: jest.fn().mockResolvedValue(
          stati.map((_, i) => ({ id: `c${i}`, createdAt: new Date('2026-01-01T00:00:00.000Z'), clientProfile: null })),
        ),
      },
      measurement: { findMany: jest.fn().mockResolvedValue([]) },
      payment: { findMany: jest.fn().mockResolvedValue([]) },
      subscription: {
        findMany: jest.fn().mockResolvedValue(
          stati.map((status) => ({ status, startDate: new Date('2026-08-01T00:00:00.000Z'), endDate: null })),
        ),
      },
    }) as unknown as PrismaService;

  it('⚠️ il piano IN CODA è un abbonamento comprato e va contato', async () => {
    const service = new AnalyticsService(conStati(['active', 'queued']));
    expect((await service.charts(admin)).activeSubscriptions).toBe(2);
  });

  it('scaduto, annullato e carrello non pagato invece no: quelli non sono un piano', async () => {
    const service = new AnalyticsService(conStati(['active', 'expired', 'cancelled', 'pending']));
    expect((await service.charts(admin)).activeSubscriptions).toBe(1);
  });
});
