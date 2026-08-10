/**
 * IL PERIMETRO DELLE CLIENTI — «devono vedere solo le clienti nella loro rete».
 *
 * Richiesta di Simone dell'11/8, aprendo la tabella Acquisti alle coach. Questi test non verificano
 * che il filtro «funzioni»: verificano che quando NON si sa, la risposta sia **zero clienti** e non
 * **tutte**. È l'unica proprietà che conta in una funzione che decide chi legge i dati di chi:
 * sbagliare per difetto lo segnala l'utente il giorno stesso, sbagliare per eccesso non lo segnala
 * nessuno.
 */
import { clienteNelPerimetro, filtroPerimetroSuCliente, perimetroClienti } from './perimetro-clienti';
import type { PrismaService } from '../prisma/prisma.service';

const NESSUNO = '00000000-0000-0000-0000-000000000000';

/** Prisma finto: un ruolo, una scheda staff, un team. */
function prismaFinto(opts: {
  role?: string;
  staffId?: string | null;
  team?: string[];
  profilo?: { assignedCoachId?: string | null; assignedNutritionistId?: string | null } | null;
}) {
  return {
    user: { findUnique: jest.fn().mockResolvedValue(opts.role ? { role: opts.role } : null) },
    staff: {
      findUnique: jest.fn().mockResolvedValue(opts.staffId === null ? null : { id: opts.staffId ?? 's-io' }),
      findMany: jest.fn().mockResolvedValue((opts.team ?? []).map((id) => ({ id }))),
    },
    clientProfile: { findUnique: jest.fn().mockResolvedValue(opts.profilo === undefined ? null : opts.profilo) },
  } as unknown as PrismaService;
}

describe('perimetroClienti', () => {
  it('la coach vede solo le sue', async () => {
    const p = await perimetroClienti(prismaFinto({ role: 'coach', staffId: 's-anna' }), 'u1');
    expect(p).toEqual({ field: 'assignedCoachId', staffIds: ['s-anna'] });
  });

  it('la coordinatrice vede sé stessa e le coach del suo team', async () => {
    const p = await perimetroClienti(prismaFinto({ role: 'coach_coordinator', staffId: 's-lucia', team: ['s-anna', 's-bea'] }), 'u1');
    expect(p?.staffIds).toEqual(['s-lucia', 's-anna', 's-bea']);
  });

  it('la nutrizionista vede le sue, sull\'altro campo', async () => {
    const p = await perimetroClienti(prismaFinto({ role: 'nutritionist', staffId: 's-nutri' }), 'u1');
    expect(p).toEqual({ field: 'assignedNutritionistId', staffIds: ['s-nutri'] });
  });

  it.each(['admin', 'sales', 'head_nutritionist', 'marketing'])('%s non ha perimetro (vede tutto)', async (role) => {
    expect(await perimetroClienti(prismaFinto({ role }), 'u1')).toBeNull();
  });

  /**
   * I due casi in cui «non si sa». La tentazione è restituire `null` — che vuol dire «nessun limite»
   * — perché è quello che fa passare il codice; il risultato sarebbe una coach senza scheda staff che
   * vede i pagamenti di tutta l'azienda.
   */
  it('coach SENZA scheda staff → zero clienti, non tutte', async () => {
    const p = await perimetroClienti(prismaFinto({ role: 'coach', staffId: null }), 'u1');
    expect(p).toEqual({ field: 'assignedCoachId', staffIds: [NESSUNO] });
  });

  it('nutrizionista SENZA scheda staff → zero clienti, non tutte', async () => {
    const p = await perimetroClienti(prismaFinto({ role: 'nutritionist', staffId: null }), 'u1');
    expect(p?.staffIds).toEqual([NESSUNO]);
  });

  it('senza attore non c\'è perimetro: sono le chiamate interne (cron, webhook)', async () => {
    expect(await perimetroClienti(prismaFinto({}), undefined)).toBeNull();
  });
});

describe('filtroPerimetroSuCliente', () => {
  it('senza perimetro il filtro è vuoto, così si può sempre fare lo spread nel where', () => {
    expect(filtroPerimetroSuCliente(null)).toEqual({});
  });

  it('con perimetro filtra sul profilo della cliente', () => {
    expect(filtroPerimetroSuCliente({ field: 'assignedCoachId', staffIds: ['s-anna'] })).toEqual({
      client: { clientProfile: { assignedCoachId: { in: ['s-anna'] } } },
    });
  });
});

describe('clienteNelPerimetro (le azioni su UNA riga)', () => {
  it('senza perimetro passa sempre', async () => {
    expect(await clienteNelPerimetro(prismaFinto({}), null, 'cli-1')).toBe(true);
  });

  it('la cliente assegnata a me passa', async () => {
    const prisma = prismaFinto({ profilo: { assignedCoachId: 's-anna' } });
    expect(await clienteNelPerimetro(prisma, { field: 'assignedCoachId', staffIds: ['s-anna'] }, 'cli-1')).toBe(true);
  });

  it('la cliente di un\'altra coach NON passa', async () => {
    const prisma = prismaFinto({ profilo: { assignedCoachId: 's-bea' } });
    expect(await clienteNelPerimetro(prisma, { field: 'assignedCoachId', staffIds: ['s-anna'] }, 'cli-1')).toBe(false);
  });

  /**
   * Una cliente senza coach assegnata non è «di tutti»: è di nessuno. Un `null` che passasse il
   * controllo renderebbe visibili a qualunque coach proprio le clienti appena arrivate.
   */
  it('la cliente SENZA coach non passa', async () => {
    const prisma = prismaFinto({ profilo: { assignedCoachId: null } });
    expect(await clienteNelPerimetro(prisma, { field: 'assignedCoachId', staffIds: ['s-anna'] }, 'cli-1')).toBe(false);
  });

  it('un profilo che non esiste non passa', async () => {
    const prisma = prismaFinto({ profilo: null });
    expect(await clienteNelPerimetro(prisma, { field: 'assignedCoachId', staffIds: ['s-anna'] }, 'cli-1')).toBe(false);
  });

  it('un pagamento senza cliente non passa', async () => {
    const prisma = prismaFinto({ profilo: { assignedCoachId: 's-anna' } });
    expect(await clienteNelPerimetro(prisma, { field: 'assignedCoachId', staffIds: ['s-anna'] }, null)).toBe(false);
  });
});
