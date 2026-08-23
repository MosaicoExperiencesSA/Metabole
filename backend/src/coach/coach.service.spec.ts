import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { aGiorno } from '../common/date-only';
import { CoachService } from './coach.service';

const D = (iso: string) => new Date(iso + 'T00:00:00.000Z');

/**
 * ⛔ **UNA DATA CHE VUOL DIRE «FRA N GIORNI» NON SI SCRIVE A MANO** — 23/8.
 *
 * Tre fixture di questo file dicevano `2026-09-01` per intendere «un piano che sta erogando adesso
 * e scade fra poco». Il 2 settembre quel significato si sarebbe rovesciato da solo: il piano diventa
 * finito, `attivoInCorso` cade nel ramo dei piani scaduti, e i test diventano **rossi per sempre**.
 * ⚠️ Non è un rosso qualunque: una CI rossa per sempre è una CI che si smette di guardare, e allora
 * il primo difetto vero arriva in produzione in mezzo al rumore.
 *
 * ⛔ E uno di loro era **già** verde per la ragione sbagliata, dal primo agosto: `endDate:
 * D('2026-08-01')` con `planActive: true` atteso. Quel piano era finito — passava perché
 * `attivoInCorso`, quando non c'è più niente che eroga, rende comunque l'ultimo scaduto (di
 * proposito: farlo sparire dalla scheda sarebbe peggio). Cioè il test diceva «una cliente con un
 * piano attivo» e misurava il **ripiego** per una cliente senza. ⚠️ E siccome `planActive` è vero in
 * tutti e due i casi, spostare la data non basta a farlo mordere: adesso il test guarda anche la
 * **scadenza mostrata**, che è l'unica cosa che cambia fra i due mondi.
 *
 * ⚠️ Il giorno si conta **alla stessa porta del codice**: `aGiorno(new Date())` è il giorno di Roma,
 * ed è esattamente quello contro cui `staErogando` confronta `giornoDelDato(startDate)`.
 */
const fra = (giorni: number) => new Date(aGiorno(new Date()).getTime() + giorni * 86_400_000);
const isoFra = (giorni: number) => fra(giorni).toISOString().slice(0, 10);
const user = { sub: 'u-coach', role: 'coach' } as AuthUser;

function makeService(prisma: Record<string, unknown>, expiringDays = 14) {
  // ⚠️ `getNumber` risponde per CHIAVE: la lista clienti ne legge due (i giorni di scadenza e la
  // finestra della media mobile), e un finto che risponde sempre lo stesso numero darebbe una
  // finestra di 14 pesate — cioè un test che misura un mondo che non esiste.
  const config = {
    getNumber: jest.fn(async (key: string, def?: number) =>
      key === 'moving_average_window' ? 3 : (expiringDays ?? def),
    ),
  };
  return new CoachService(prisma as unknown as PrismaService, config as unknown as ConfigParamsService);
}

describe('CoachService.clients', () => {
  /**
   * ⚠️ LA PERCENTUALE CHE LEGGE LA COACH È QUELLA CHE LEGGONO IL MOTORE E LA CLIENTE — 19/8.
   *
   * In questa lista si calcolava sull'**ultima pesata**, mentre l'allarme di stallo e i progressi
   * della cliente usano la **media mobile**. Stessa persona, stessa domanda, due numeri: e quello
   * della coach era il più ballerino, perché due etti di ritenzione lo muovono tutto.
   *
   * Qui la cliente parte da 80 con traguardo 70 e le ultime tre pesate sono 76, 75, 76: sull'ultima
   * farebbe 40%, sulla media (75,67) fa 43,3 → **43**.
   */
  it('⚠️ la percentuale è sulla media mobile, non sull\'ultima pesata', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ role: 'coach' }),
        findMany: jest.fn().mockResolvedValue([{ id: 'c1', email: 'anna@t.it', phone: null }]),
      },
      staff: { findUnique: jest.fn().mockResolvedValue({ id: 'coach-1' }) },
      clientProfile: {
        findMany: jest.fn().mockResolvedValue([{ userId: 'c1', name: 'Anna', startWeightKg: 80, planStartDate: null }]),
      },
      subscription: { findMany: jest.fn().mockResolvedValue([]) },
      measurement: {
        findMany: jest.fn().mockResolvedValue([
          { clientId: 'c1', date: D('2026-07-01'), weightKg: 76 },
          { clientId: 'c1', date: D('2026-07-08'), weightKg: 75 },
          { clientId: 'c1', date: D('2026-07-15'), weightKg: 76 },
        ]),
      },
      alert: { findMany: jest.fn().mockResolvedValue([]) },
      objective: { findMany: jest.fn().mockResolvedValue([{ clientId: 'c1', targetWeightKg: 70 }]) },
    };
    const res = (await makeService(prisma).clients(user)) as {
      clients: { progressPct: number | null; lastWeightKg: number | null; weightDeltaKg: number | null }[];
    };
    expect(res.clients[0].progressPct).toBe(43.3);
    // ⚠️ «Ultima pesata» resta l'ultima pesata: quella è una misura, non una tendenza.
    expect(res.clients[0].lastWeightKg).toBe(76);
    // E i chili persi seguono la stessa regola della percentuale: 80 − 75,67.
    expect(res.clients[0].weightDeltaKg).toBe(4.3);
  });

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
      // ⚠️ Un piano che eroga DAVVERO: scade fra un mese. Vedi la nota su `fra`.
      subscription: { findMany: jest.fn().mockResolvedValue([{ clientId: 'c1', status: 'active', startDate: fra(-60), endDate: fra(30) }]) },
      measurement: { findMany: jest.fn().mockResolvedValue([{ clientId: 'c1', date: D('2026-07-10'), weightKg: 70 }]) },
      alert: { findMany: jest.fn().mockResolvedValue([{ clientId: 'c2' }, { clientId: 'c2' }]) },
      // La lista clienti porta anche l'obiettivo corrente di ognuna.
      objective: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const res = (await makeService(prisma).clients(user)) as {
      clients: { clientId: string; openAlerts: number; planActive: boolean; planEndDate: string | null }[];
    };
    expect(res.clients).toHaveLength(2);
    expect(res.clients[0].clientId).toBe('c2'); // più alert → primo
    expect(res.clients[0].openAlerts).toBe(2);
    const anna = res.clients.find((c) => c.clientId === 'c1')!;
    expect(anna.planActive).toBe(true);
    /**
     * ⚠️ **E la data, che è la parte che distingue.** `planActive` è vero anche per una cliente il
     * cui piano è finito — di proposito: `attivoInCorso` rende comunque l'ultimo scaduto, perché
     * farla sparire dalla scheda sarebbe peggio. Quindi `planActive` da solo non dice mai se il
     * piano **eroga**, e un test che si ferma lì è verde in tutti i casi. La scadenza mostrata sì.
     */
    expect(anna.planEndDate).toBe(isoFra(30));
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
      subscription: { findMany: jest.fn().mockResolvedValue([{ status: 'active', startDate: fra(-60), endDate: fra(10) }]) },
    };
    const res = (await makeService(prisma).clientAgenda('c1', false)) as { appointments: unknown[]; planEndDate: string | null };
    expect(res.planEndDate).toBe(isoFra(10));
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
          { status: 'queued', startDate: fra(11), endDate: fra(100) },
          { status: 'active', startDate: fra(-60), endDate: fra(10) },
        ]),
      },
    };
    const res = (await makeService(prisma).clientAgenda('c1', false)) as { planEndDate: string | null };
    expect(res.planEndDate).toBe(isoFra(10));
  });

  it('se l\'unico piano è in coda, la scadenza è la sua: la cliente NON è senza piano', async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ role: 'coach' }) },
      appointment: { findMany: jest.fn().mockResolvedValue([]) },
      visit: { findMany: jest.fn().mockResolvedValue([]) },
      staff: { findMany: jest.fn().mockResolvedValue([]) },
      subscription: {
        findMany: jest.fn().mockResolvedValue([{ status: 'queued', startDate: fra(11), endDate: fra(100) }]),
      },
    };
    const res = (await makeService(prisma).clientAgenda('c1', false)) as { planEndDate: string | null };
    expect(res.planEndDate).toBe(isoFra(100));
  });
});
