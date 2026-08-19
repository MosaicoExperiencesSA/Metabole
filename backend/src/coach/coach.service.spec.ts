import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { CoachService } from './coach.service';

const D = (iso: string) => new Date(iso + 'T00:00:00.000Z');
const user = { sub: 'u-coach', role: 'coach' } as AuthUser;

function makeService(prisma: Record<string, unknown>, expiringDays = 14) {
  const config = { getNumber: jest.fn().mockResolvedValue(expiringDays) };
  return new CoachService(prisma as unknown as PrismaService, config as unknown as ConfigParamsService);
}

describe('CoachService.clients', () => {
  it('elenca solo le clienti della coach con riepilogo e ordina per alert', async () => {
    const prisma = {
      // `coachTeamScope` (rete coach a tre livelli) legge il RUOLO da prisma.user: senza
      // questo il finto Prisma non ha `user` e la chiamata esplode prima di ogni asserzione.
      user: {
        findUnique: jest.fn().mockResolvedValue({ role: 'coach' }),
        // La lista clienti porta anche email e telefono, che stanno su User.
        findMany: jest.fn().mockResolvedValue([{ id: 'c1', email: 'anna@t.it', phone: null }, { id: 'c2', email: 'bea@t.it', phone: null }]),
      },
      staff: { findUnique: jest.fn().mockResolvedValue({ id: 'coach-1' }) },
      clientProfile: {
        findMany: jest.fn().mockResolvedValue([
          { userId: 'c1', name: 'Anna', planStartDate: D('2026-07-01') },
          { userId: 'c2', name: 'Bea', planStartDate: null },
        ]),
      },
      subscription: { findMany: jest.fn().mockResolvedValue([{ clientId: 'c1', status: 'active', endDate: D('2026-08-01') }]) },
      measurement: { findMany: jest.fn().mockResolvedValue([{ clientId: 'c1', date: D('2026-07-10'), weightKg: 70 }]) },
      alert: { findMany: jest.fn().mockResolvedValue([{ clientId: 'c2' }, { clientId: 'c2' }]) },
      // La lista clienti porta anche l'obiettivo corrente di ognuna.
      objective: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const res = (await makeService(prisma).clients(user)) as { clients: { clientId: string; openAlerts: number; planActive: boolean }[] };
    expect(res.clients).toHaveLength(2);
    expect(res.clients[0].clientId).toBe('c2'); // più alert → primo
    expect(res.clients[0].openAlerts).toBe(2);
    const anna = res.clients.find((c) => c.clientId === 'c1')!;
    expect(anna.planActive).toBe(true);
  });

  it('nessuno staff → lista vuota', async () => {
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue({ role: 'coach' }) }, staff: { findUnique: jest.fn().mockResolvedValue(null) } };
    const res = await makeService(prisma).clients(user);
    expect(res).toEqual({ clients: [] });
  });
});

describe('CoachService.dashboard', () => {
  it('compone conteggi, piani in scadenza e guadagni', async () => {
    const prisma = {
      // `coachTeamScope` (rete coach a tre livelli) legge il RUOLO da prisma.user: senza
      // questo il finto Prisma non ha `user` e la chiamata esplode prima di ogni asserzione.
      user: { findUnique: jest.fn().mockResolvedValue({ role: 'coach' }) },
      staff: { findUnique: jest.fn().mockResolvedValue({ id: 'coach-1' }) },
      clientProfile: { count: jest.fn().mockResolvedValue(5) },
      subscription: {
        findMany: jest.fn().mockResolvedValue([
          { clientId: 'c1', endDate: D('2026-07-20'), client: { clientProfile: { name: 'Anna' } } },
        ]),
      },
      alert: { count: jest.fn().mockResolvedValue(3) },
      ledgerEntry: {
        aggregate: jest
          .fn()
          .mockResolvedValueOnce({ _sum: { amountCents: 1000 } }) // mese
          .mockResolvedValueOnce({ _sum: { amountCents: 5000 } }), // totale
      },
    };
    const res = (await makeService(prisma).dashboard(user)) as {
      isCoach: boolean;
      clientsCount: number;
      openAlerts: number;
      earningsMonthCents: number;
      earningsTotalCents: number;
      expiringPlans: unknown[];
    };
    expect(res.isCoach).toBe(true);
    expect(res.clientsCount).toBe(5);
    expect(res.openAlerts).toBe(3);
    expect(res.earningsMonthCents).toBe(1000);
    expect(res.earningsTotalCents).toBe(5000);
    expect(res.expiringPlans).toHaveLength(1);
  });

  /**
   * ⚠️ ANCHE I PIANI IN CODA NELLE SCADENZE IN ARRIVO (19/8, voce 258). Una cliente il cui piano
   * scade fra due settimane va richiamata adesso, e che quel piano sia già cominciato o cominci
   * lunedì non cambia niente per chi deve prendere il telefono. Leggendo i soli `active` la coda
   * spariva dall'elenco — e la coach perdeva proprio le clienti che hanno comprato di recente.
   *
   * ⚠️ Il finto Prisma qui **filtra come il database vero**: senza, il test passerebbe anche
   * leggendo i soli `active`.
   */
  it('⚠️ le scadenze in arrivo comprendono i piani in coda', async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ role: 'coach' }) },
      staff: { findUnique: jest.fn().mockResolvedValue({ id: 'coach-1' }) },
      clientProfile: { count: jest.fn().mockResolvedValue(1) },
      subscription: {
        findMany: jest.fn(({ where }: any) => {
          const ammessi: string[] = where?.status?.in ?? [where?.status];
          return Promise.resolve(
            ammessi.includes('queued')
              ? [{ clientId: 'c1', endDate: D('2026-07-20'), client: { clientProfile: { name: 'Anna' } } }]
              : [],
          );
        }),
      },
      alert: { count: jest.fn().mockResolvedValue(0) },
      ledgerEntry: { aggregate: jest.fn().mockResolvedValue({ _sum: { amountCents: 0 } }) },
    };
    const res = (await makeService(prisma).dashboard(user)) as { expiringPlans: unknown[] };
    expect(res.expiringPlans).toHaveLength(1);
  });

  it('nessuno staff → isCoach false', async () => {
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue({ role: 'coach' }) }, staff: { findUnique: jest.fn().mockResolvedValue(null) } };
    const res = await makeService(prisma).dashboard(user);
    expect(res).toEqual({ isCoach: false });
  });
});

const futureIso = () => new Date(Date.now() + 86_400_000).toISOString();

describe('CoachService — agenda/appuntamenti', () => {
  it('coachAgenda: mostra appuntamenti delle clienti con flag editable', async () => {
    const prisma = {
      // `coachTeamScope` (rete coach a tre livelli) legge il RUOLO da prisma.user: senza
      // questo il finto Prisma non ha `user` e la chiamata esplode prima di ogni asserzione.
      user: { findUnique: jest.fn().mockResolvedValue({ role: 'coach' }) },
      staff: {
        findUnique: jest.fn().mockResolvedValue({ id: 'coach-1' }),
        findMany: jest.fn().mockResolvedValue([
          { id: 'coach-1', displayName: 'Coach Uno' },
          { id: 'nut-1', displayName: 'Nutri' },
        ]),
      },
      clientProfile: { findMany: jest.fn().mockResolvedValue([{ userId: 'c1', name: 'Anna' }]) },
      // §16.7: il calendario della coach legge anche le VISITE, che stanno in un'altra tabella.
      visit: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'vis1', clientId: 'c1', nutritionistId: 'nut-1', type: 'in_person',
            datetime: new Date(Date.now() + 86_400_000), endsAt: null, videoRoomId: null,
            nutritionist: { displayName: 'Nutri' },
          },
        ]),
      },
      appointment: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'ap1', clientId: 'c1', staffId: 'coach-1', staffRole: 'coach', type: 'call', datetime: new Date(), status: 'scheduled', note: null },
          { id: 'ap2', clientId: 'c1', staffId: 'nut-1', staffRole: 'nutritionist', type: 'televisit', datetime: new Date(), status: 'scheduled', note: null },
        ]),
      },
    };
    const res = (await makeService(prisma).coachAgenda(user)) as { appointments: { id: string; editable: boolean }[] };
    // ⚠️ Tre, non due: la visita col nutrizionista è la richiesta di Simone del 12/8. Senza, la
    // coach vedrebbe libero un giorno in cui la cliente è già dalla nutrizionista.
    expect(res.appointments).toHaveLength(3);
    expect(res.appointments.find((a) => a.id === 'vis1')).toBeDefined();
    expect(res.appointments.find((a) => a.id === 'ap1')!.editable).toBe(true);
    expect(res.appointments.find((a) => a.id === 'ap2')!.editable).toBe(false);
    // Le vede tutte, ma tocca solo le proprie: la visita clinica non la sposta lei.
    expect(res.appointments.find((a) => a.id === 'vis1')!.editable).toBe(false);
  });

  it('createAppointment: coach per la propria cliente → crea', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'ap1' });
    const prisma = {
      // `coachTeamScope` (rete coach a tre livelli) legge il RUOLO da prisma.user: senza
      // questo il finto Prisma non ha `user` e la chiamata esplode prima di ogni asserzione.
      user: { findUnique: jest.fn().mockResolvedValue({ role: 'coach' }) },
      staff: { findUnique: jest.fn().mockResolvedValue({ id: 'coach-1' }) },
      clientProfile: { findUnique: jest.fn().mockResolvedValue({ assignedCoachId: 'coach-1', assignedNutritionistId: 'nut-1' }) },
      appointment: { create },
    };
    await makeService(prisma).createAppointment(user, { clientId: 'c1', type: 'call', datetime: futureIso() });
    expect(create).toHaveBeenCalled();
    expect(create.mock.calls[0][0].data.staffRole).toBe('coach');
  });

  it('createAppointment: cliente non assegnata → Forbidden', async () => {
    const prisma = {
      // `coachTeamScope` (rete coach a tre livelli) legge il RUOLO da prisma.user: senza
      // questo il finto Prisma non ha `user` e la chiamata esplode prima di ogni asserzione.
      user: { findUnique: jest.fn().mockResolvedValue({ role: 'coach' }) },
      staff: { findUnique: jest.fn().mockResolvedValue({ id: 'coach-1' }) },
      clientProfile: { findUnique: jest.fn().mockResolvedValue({ assignedCoachId: 'coach-2', assignedNutritionistId: null }) },
      appointment: { create: jest.fn() },
    };
    await expect(
      makeService(prisma).createAppointment(user, { clientId: 'c1', type: 'call', datetime: futureIso() }),
    ).rejects.toThrow();
  });

  it('createAppointment: data passata → BadRequest', async () => {
    const prisma = {
      // `coachTeamScope` (rete coach a tre livelli) legge il RUOLO da prisma.user: senza
      // questo il finto Prisma non ha `user` e la chiamata esplode prima di ogni asserzione.
      user: { findUnique: jest.fn().mockResolvedValue({ role: 'coach' }) },
      staff: { findUnique: jest.fn().mockResolvedValue({ id: 'coach-1' }) },
      clientProfile: { findUnique: jest.fn() },
      appointment: { create: jest.fn() },
    };
    await expect(
      makeService(prisma).createAppointment(user, { clientId: 'c1', type: 'call', datetime: '2020-01-01T10:00:00.000Z' }),
    ).rejects.toThrow();
  });

  it('updateAppointment: solo il proprietario può modificare', async () => {
    const prisma = {
      // `coachTeamScope` (rete coach a tre livelli) legge il RUOLO da prisma.user: senza
      // questo il finto Prisma non ha `user` e la chiamata esplode prima di ogni asserzione.
      user: { findUnique: jest.fn().mockResolvedValue({ role: 'coach' }) },
      staff: { findUnique: jest.fn().mockResolvedValue({ id: 'coach-2' }) },
      appointment: { findUnique: jest.fn().mockResolvedValue({ id: 'ap1', staffId: 'coach-1' }), update: jest.fn() },
    };
    await expect(makeService(prisma).updateAppointment(user, 'ap1', { status: 'cancelled' })).rejects.toThrow();
  });

  it('clientAgenda next=1: ritorna solo il prossimo', async () => {
    const prisma = {
      // `coachTeamScope` (rete coach a tre livelli) legge il RUOLO da prisma.user: senza
      // questo il finto Prisma non ha `user` e la chiamata esplode prima di ogni asserzione.
      user: { findUnique: jest.fn().mockResolvedValue({ role: 'coach' }) },
      appointment: { findMany: jest.fn().mockResolvedValue([{ id: 'ap1', clientId: 'c1', staffId: 's1', staffRole: 'coach', type: 'call', datetime: new Date(Date.now() + 172_800_000), status: 'scheduled', note: null }]) },
      // §16.7: la visita che si è prenotata da sola sta in `Visit`, e per lei «il prossimo
      // appuntamento» è quello — non la chiamata di dopodomani.
      visit: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'vis1', clientId: 'c1', nutritionistId: 'nut-1', type: 'in_person',
            datetime: new Date(Date.now() + 86_400_000), endsAt: null, videoRoomId: null,
            nutritionist: { displayName: 'Nutri' },
          },
        ]),
      },
      staff: { findMany: jest.fn().mockResolvedValue([{ id: 's1', displayName: 'Coach' }]) },
      subscription: { findFirst: jest.fn() },
    };
    const res = (await makeService(prisma).clientAgenda('c1', true)) as { next: { id: string } | null };
    expect(res.next!.id).toBe('vis1');
    expect(prisma.subscription.findFirst).not.toHaveBeenCalled();
  });

  it('clientAgenda completa: appuntamenti + scadenza piano', async () => {
    const prisma = {
      // `coachTeamScope` (rete coach a tre livelli) legge il RUOLO da prisma.user: senza
      // questo il finto Prisma non ha `user` e la chiamata esplode prima di ogni asserzione.
      user: { findUnique: jest.fn().mockResolvedValue({ role: 'coach' }) },
      appointment: { findMany: jest.fn().mockResolvedValue([]) },
      visit: { findMany: jest.fn().mockResolvedValue([]) },
      staff: { findMany: jest.fn().mockResolvedValue([]) },
      // ⚠️ `findMany` e non più `findFirst` (voce 258): la scelta fra le righe la fa
      // `attivoInCorso`, perché ora la lista comprende anche i piani in coda.
      subscription: { findMany: jest.fn().mockResolvedValue([{ status: 'active', startDate: D('2026-07-01'), endDate: D('2026-09-01') }]) },
    };
    const res = (await makeService(prisma).clientAgenda('c1', false)) as { appointments: unknown[]; planEndDate: string | null };
    expect(res.planEndDate).toBe('2026-09-01');
    expect(res.appointments).toEqual([]);
  });

  it('⚠️ la scadenza mostrata è quella del piano CHE EROGA, non di quello in coda', async () => {
    // Il difetto del caso Lorena in miniatura: qui c'era un `findFirst` senza `orderBy`, e con
    // due righe la data mostrata dipendeva dall'ordine in cui il database le tirava fuori.
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ role: 'coach' }) },
      appointment: { findMany: jest.fn().mockResolvedValue([]) },
      visit: { findMany: jest.fn().mockResolvedValue([]) },
      staff: { findMany: jest.fn().mockResolvedValue([]) },
      subscription: {
        findMany: jest.fn().mockResolvedValue([
          { status: 'queued', startDate: D('2026-09-02'), endDate: D('2026-11-01') },
          { status: 'active', startDate: D('2026-07-01'), endDate: D('2026-09-01') },
        ]),
      },
    };
    const res = (await makeService(prisma).clientAgenda('c1', false)) as { planEndDate: string | null };
    expect(res.planEndDate).toBe('2026-09-01');
  });

  it('se l\'unico piano è in coda, la scadenza è la sua: la cliente NON è senza piano', async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ role: 'coach' }) },
      appointment: { findMany: jest.fn().mockResolvedValue([]) },
      visit: { findMany: jest.fn().mockResolvedValue([]) },
      staff: { findMany: jest.fn().mockResolvedValue([]) },
      subscription: {
        findMany: jest.fn().mockResolvedValue([{ status: 'queued', startDate: D('2026-09-02'), endDate: D('2026-11-01') }]),
      },
    };
    const res = (await makeService(prisma).clientAgenda('c1', false)) as { planEndDate: string | null };
    expect(res.planEndDate).toBe('2026-11-01');
  });
});
