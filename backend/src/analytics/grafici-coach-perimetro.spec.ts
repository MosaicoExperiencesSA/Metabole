/**
 * ⛔ **CHI VEDE LE BARRE DI CHI.** `barre-coach.spec.ts` verifica l'aritmetica; qui si verifica il
 * **perimetro**, che è la parte in cui sbagliare non si vede: una coordinatrice che si ritrova nel
 * grafico il fatturato e le provvigioni delle coach di un'altra rete non prende nessun errore, non
 * lo segnala nessuno, e la pagina sembra funzionare.
 *
 * Le tre cose fissate qui:
 *  · la **coordinatrice** interroga lo staff con il filtro sugli id della sua rete;
 *  · **admin** e **Responsabile Coach** senza filtro di id (vedono tutte le coach, come in ogni
 *    altra pagina: `RUOLI_CHE_VEDONO_TUTTE`);
 *  · in tutti e tre i casi il filtro sul **ruolo** c'è, perché `reteSottoDiMe` risale anche l'arco
 *    delle nutrizioniste e in un grafico «Fatturato coach» una nutrizionista è una barra che
 *    nessuno sa leggere.
 */
import { Test } from '@nestjs/testing';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from './analytics.service';

const utente = (role: string): AuthUser => ({ sub: 'u1', email: 'x@y.z', role } as AuthUser);

describe('AnalyticsService.graficiCoach — il perimetro «chi è collegato sotto di me»', () => {
  let service: AnalyticsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      staff: { findUnique: jest.fn().mockResolvedValue({ id: 'staff-io' }), findMany: jest.fn().mockResolvedValue([]) },
      payment: { findMany: jest.fn().mockResolvedValue([]) },
      ledgerEntry: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [AnalyticsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(AnalyticsService);
  });

  /** Il `where` con cui è stato chiesto l'elenco delle coach. */
  const whereDelloStaff = () => prisma.staff.findMany.mock.calls[0][0].where;

  it('la coordinatrice: solo gli id della sua rete, e solo i ruoli coach', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'coach_coordinator' });
    // `reteSottoDiMe` scende a strati: lei, poi le sue, poi niente.
    prisma.staff.findMany
      .mockResolvedValueOnce([{ id: 'staff-sotto-1' }, { id: 'staff-sotto-2' }])
      .mockResolvedValueOnce([])
      .mockResolvedValue([]);
    await service.graficiCoach(utente('coach_coordinator'));

    // La PRIMA chiamata è quella di `reteSottoDiMe`; quella dell'elenco coach è l'ultima.
    const chiamate = prisma.staff.findMany.mock.calls;
    const where = chiamate[chiamate.length - 1][0].where;
    expect(where.id).toEqual({ in: expect.arrayContaining(['staff-io', 'staff-sotto-1', 'staff-sotto-2']) });
    expect(where.user).toEqual({ role: { in: ['coach', 'coach_coordinator'] } });
  });

  it('⛔ senza scheda staff la coordinatrice NON vede tutte: vede zero', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'coach_coordinator' });
    prisma.staff.findUnique.mockResolvedValue(null);
    await service.graficiCoach(utente('coach_coordinator'));
    const where = whereDelloStaff();
    // L'id impossibile di `coachTeamScope`: un filtro c'è, e non corrisponde a nessuno.
    expect(where.id).toEqual({ in: ['00000000-0000-0000-0000-000000000000'] });
  });

  it.each(['admin', 'sales'])('%s: nessun filtro di id (tutte le coach), il filtro di ruolo resta', async (role) => {
    prisma.user.findUnique.mockResolvedValue({ role });
    await service.graficiCoach(utente(role));
    const where = whereDelloStaff();
    expect(where.id).toBeUndefined();
    expect(where.user).toEqual({ role: { in: ['coach', 'coach_coordinator'] } });
  });

  it('senza nessuna coach nella rete non si interroga né i pagamenti né il registro', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'admin' });
    prisma.staff.findMany.mockResolvedValue([]);
    const out = await service.graficiCoach(utente('admin'));
    expect(prisma.payment.findMany).not.toHaveBeenCalled();
    expect(prisma.ledgerEntry.findMany).not.toHaveBeenCalled();
    // La tendina c'è lo stesso: dodici mesi, tutti vuoti. Una pagina senza tendina sembra rotta.
    expect(out.periodi).toHaveLength(12);
    expect(out.perPeriodo[out.mesePredefinito]).toEqual([]);
  });

  it('⚠️ le provvigioni si chiedono al REGISTRO, con le categorie del portafoglio staff', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'admin' });
    prisma.staff.findMany.mockResolvedValue([{ id: 'staff-anna', displayName: 'Anna' }]);
    await service.graficiCoach(utente('admin'));
    const where = prisma.ledgerEntry.findMany.mock.calls[0][0].where;
    expect(where.type).toBe('expense');
    expect(where.category).toEqual({ in: ['sales_commission', 'visit_compensation'] });
    expect(where.staffId).toEqual({ in: ['staff-anna'] });
  });
});
