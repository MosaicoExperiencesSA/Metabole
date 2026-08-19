import { PrismaService } from '../prisma/prisma.service';
import { ProfileService } from './profile.service';

/**
 * LA DATA SCELTA IN FONDO AL QUESTIONARIO DECIDE ANCHE LO STATO DEL PIANO — voce 258, 19/8.
 *
 * Quando la cliente sceglie **per la prima volta** il giorno in cui vuole cominciare, l'abbonamento
 * le viene riallineato: date nuove e stato riscritto. ⚠️ Lo stato lo decide **la data**, non questo
 * punto: se comincia oggi il piano parte adesso, se comincia fra tre settimane va in coda.
 * Scrivendo sempre `active` — com'era fino al 18/8 — questo punto continuava a produrre la forma
 * ambigua (la stessa parola per «sta erogando» e per «comincia il 9 settembre»), e la produceva dal
 * percorso più battuto di tutti: il questionario.
 */
describe('ProfileService — la data d\'inizio scelta dalla cliente', () => {
  const fra = (giorni: number) => {
    const d = new Date();
    d.setDate(d.getDate() + giorni);
    return d.toISOString().slice(0, 10);
  };

  const crea = (statoIniziale: string) => {
    const prisma = {
      clientProfile: {
        // `planStartDate: null` = è la PRIMA volta che la sceglie, che è l'unico caso in cui
        // l'abbonamento si riallinea.
        findUnique: jest.fn().mockResolvedValue({ id: 'p1', userId: 'c1', planStartDate: null }),
        update: jest.fn().mockResolvedValue({ id: 'p1' }),
      },
      subscription: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'sub-1', status: statoIniziale, startDate: null, endDate: null, plan: { period: '3m' } },
        ]),
        update: jest.fn().mockResolvedValue({}),
      },
      user: { update: jest.fn().mockResolvedValue({}) },
      // Nessun menu erogato: la data d'inizio è ancora una preferenza, e si può ancora spostare.
      menuDay: { count: jest.fn().mockResolvedValue(0) },
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const service = new ProfileService(
      prisma as unknown as PrismaService,
      { getNumber: jest.fn() } as never,
      audit as never,
      {} as never,
    );
    return { service, prisma };
  };

  const statoScritto = (prisma: { subscription: { update: jest.Mock } }) =>
    prisma.subscription.update.mock.calls[0][0].data.status;

  it('⚠️ scegliendo una data futura l\'abbonamento va IN CODA, non «attivo»', async () => {
    const { service, prisma } = crea('active');
    await service.updateProfile('c1', { planStartDate: fra(21) } as never);
    expect(statoScritto(prisma)).toBe('queued');
  });

  /**
   * ⚠️ E VALE ANCHE QUANDO LA DATA C'ERA GIÀ — è il caso della cliente di ritorno (19/8, terza
   * revisione). Lei ha una `planStartDate` vecchia dal piano precedente, quindi dopo il pagamento
   * l'app le rimostra il calendario: prima questo allineamento scattava solo alla **prima**
   * scrittura, quindi la sua scelta finiva nel profilo e l'abbonamento restava dov'era — e i menu
   * partivano quando volevano loro.
   */
  it('⚠️ anche una cliente di ritorno, che la data ce l\'aveva già, la può spostare', async () => {
    const { service, prisma } = crea('active');
    prisma.clientProfile.findUnique.mockResolvedValue({
      id: 'p1',
      userId: 'c1',
      planStartDate: new Date('2026-01-10T00:00:00.000Z'), // il piano di prima
    });
    await service.updateProfile('c1', { planStartDate: fra(5) } as never);
    expect(prisma.subscription.update).toHaveBeenCalled();
    expect(prisma.subscription.update.mock.calls[0][0].data.status).toBe('queued');
  });

  /** ⚠️ Ma a menu già erogato non si tocca più niente: lì la data non è più una preferenza. */
  it('⚠️ a primo menu già ricevuto la data non sposta più l\'abbonamento', async () => {
    const { service, prisma } = crea('active');
    prisma.menuDay.count.mockResolvedValue(4);
    await service.updateProfile('c1', { planStartDate: fra(5) } as never);
    expect(prisma.subscription.update).not.toHaveBeenCalled();
  });

  /** ⚠️ E scegliendo OGGI parte adesso: non deve aspettare la passata notturna. */
  it('⚠️ scegliendo oggi il piano parte subito', async () => {
    const { service, prisma } = crea('expired');
    await service.updateProfile('c1', { planStartDate: fra(0) } as never);
    expect(statoScritto(prisma)).toBe('active');
  });
});
