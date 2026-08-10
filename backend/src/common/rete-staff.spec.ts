import { copreQuestoStaff, copreUnoDi, reteSottoDiMe } from './rete-staff';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * LA RETE PERCORSA PER INTERO (11/8).
 *
 * «I permessi di lettura devono risalire la rete, quindi coach, coordinatrice, responsabile.» Prima
 * si scendeva di **un** livello: la responsabile vedeva le sue coordinatrici e non le clienti delle
 * coach sotto di loro, cioè era cieca esattamente sulle persone che il suo ruolo esiste per seguire.
 *
 * Il test che conta di più è quello sul CICLO: nessun vincolo del database impedisce che A risponda
 * a B e B ad A, e senza protezione questa funzione girerebbe per sempre portando giù il processo.
 */
const rete = (figli: Record<string, string[]>) => {
  const chiamate: unknown[] = [];
  const prisma = {
    staff: {
      findMany: jest.fn().mockImplementation(({ where }: any) => {
        chiamate.push(where);
        const chiesti: string[] = (where?.OR ?? []).flatMap((o: any) => o.managerId?.in ?? o.headNutritionistId?.in ?? []);
        return Promise.resolve(chiesti.flatMap((id) => (figli[id] ?? []).map((x) => ({ id: x }))));
      }),
    },
  } as unknown as PrismaService;
  return { prisma, chiamate };
};

/** coach → coordinatrice → responsabile, come la rete vera. */
const TRE_LIVELLI = { resp: ['coord1', 'coord2'], coord1: ['coachA', 'coachB'], coord2: ['coachC'] };

describe('reteSottoDiMe', () => {
  it('la responsabile copre coordinatrici E coach: due salti, non uno', async () => {
    const { prisma } = rete(TRE_LIVELLI);
    const out = await reteSottoDiMe(prisma, 'resp');
    expect(out.sort()).toEqual(['coachA', 'coachB', 'coachC', 'coord1', 'coord2', 'resp'].sort());
  });

  it('la coordinatrice copre solo il suo ramo', async () => {
    const { prisma } = rete(TRE_LIVELLI);
    expect((await reteSottoDiMe(prisma, 'coord1')).sort()).toEqual(['coachA', 'coachB', 'coord1'].sort());
  });

  it('una coach in fondo copre solo se stessa', async () => {
    const { prisma } = rete(TRE_LIVELLI);
    expect(await reteSottoDiMe(prisma, 'coachA')).toEqual(['coachA']);
  });

  it('scende a STRATI: una rete di tre livelli sono poche query, non una per persona', async () => {
    const { prisma, chiamate } = rete(TRE_LIVELLI);
    await reteSottoDiMe(prisma, 'resp');
    // Un giro per livello + quello che scopre la fine: mai una query per staff.
    expect(chiamate.length).toBeLessThanOrEqual(4);
  });

  it('un CICLO nei dati non manda in loop: A responsabile di B, B responsabile di A', async () => {
    const { prisma } = rete({ a: ['b'], b: ['a'] });
    const out = await reteSottoDiMe(prisma, 'a');
    expect(out.sort()).toEqual(['a', 'b']);
  });

  it('e nemmeno un ciclo più lungo', async () => {
    const { prisma } = rete({ a: ['b'], b: ['c'], c: ['a'] });
    expect((await reteSottoDiMe(prisma, 'a')).sort()).toEqual(['a', 'b', 'c']);
  });

  it('la profondità ha un tetto: una rete assurda non fa mille query', async () => {
    const catena: Record<string, string[]> = {};
    for (let i = 0; i < 50; i += 1) catena[`s${i}`] = [`s${i + 1}`];
    const { prisma, chiamate } = rete(catena);
    const out = await reteSottoDiMe(prisma, 's0', 5);
    expect(chiamate.length).toBe(5);
    expect(out.length).toBe(6); // se stessa + cinque livelli
  });

  it('segue ENTRAMBI gli archi: la catena delle coach e quella delle nutrizioniste', async () => {
    const { prisma, chiamate } = rete({ capo: ['nutri1'] });
    await reteSottoDiMe(prisma, 'capo');
    const primo = chiamate[0] as { OR: Record<string, unknown>[] };
    expect(primo.OR.some((o) => 'managerId' in o)).toBe(true);
    expect(primo.OR.some((o) => 'headNutritionistId' in o)).toBe(true);
  });
});

describe('copreQuestoStaff', () => {
  it('se stessa: sì, e senza interrogare la rete', async () => {
    const { prisma, chiamate } = rete(TRE_LIVELLI);
    expect(await copreQuestoStaff(prisma, 'coachA', 'coachA')).toBe(true);
    expect(chiamate.length).toBe(0);
  });

  it('chi sta sopra copre chi sta sotto, a qualunque distanza', async () => {
    const { prisma } = rete(TRE_LIVELLI);
    expect(await copreQuestoStaff(prisma, 'resp', 'coachC')).toBe(true);
    expect(await copreQuestoStaff(prisma, 'coord1', 'coachB')).toBe(true);
  });

  it('ma non il contrario, e non fra rami diversi: risalire non vuol dire vedere tutto', async () => {
    const { prisma } = rete(TRE_LIVELLI);
    expect(await copreQuestoStaff(prisma, 'coachA', 'resp')).toBe(false);
    expect(await copreQuestoStaff(prisma, 'coord1', 'coachC')).toBe(false);
  });

  it('in dubbio non si apre: id mancanti tornano falso', async () => {
    const { prisma } = rete(TRE_LIVELLI);
    expect(await copreQuestoStaff(prisma, null, 'coachA')).toBe(false);
    expect(await copreQuestoStaff(prisma, 'resp', null)).toBe(false);
    expect(await copreQuestoStaff(prisma, 'resp', undefined)).toBe(false);
  });
});

describe('copreUnoDi', () => {
  it('basta coprire uno dei due riferimenti della cliente (coach o nutrizionista)', async () => {
    const { prisma } = rete(TRE_LIVELLI);
    expect(await copreUnoDi(prisma, 'coord1', ['staff-ESTRANEO', 'coachA'])).toBe(true);
  });

  it('nessuno dei due: no', async () => {
    const { prisma } = rete(TRE_LIVELLI);
    expect(await copreUnoDi(prisma, 'coord1', ['staff-ESTRANEO', null])).toBe(false);
  });

  it('elenco vuoto: no, non «sì per mancanza di ostacoli»', async () => {
    const { prisma } = rete(TRE_LIVELLI);
    expect(await copreUnoDi(prisma, 'resp', [])).toBe(false);
    expect(await copreUnoDi(prisma, 'resp', [null, undefined])).toBe(false);
  });
});

/**
 * LA REGOLA VALE PER TUTTE LE PAGINE, NON SOLO PER LE CHAT (11/8).
 *
 * «Visto il problema avuto nella chat, verifica in tutte le funzioni che la rete venga risalita fino
 * in cima e non solo due livelli.» La verifica è stata fatta e il risultato è questo: quindici moduli
 * (clienti, acquisti, dashboard, pipeline, avvisi, report, compiti coach, CRM, analytics…) leggono la
 * portata da `coachTeamScope`, e quello ora risale tutta la rete. Questo test lo tiene fermo: se
 * qualcuno riporta lì una query a un livello, diventa rosso.
 */
describe('coachTeamScope — la portata risale la rete, non un livello', () => {
  it('la responsabile ha nella portata anche le coach delle sue coordinatrici', async () => {
    const { coachTeamScope } = await import('./coach-team');
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ role: 'coach_coordinator' }) },
      staff: {
        findUnique: jest.fn().mockResolvedValue({ id: 'resp' }),
        findMany: jest.fn().mockImplementation(({ where }: any) => {
          const chiesti: string[] = (where?.OR ?? []).flatMap((o: any) => o.managerId?.in ?? o.headNutritionistId?.in ?? []);
          const figli: Record<string, string[]> = { resp: ['coord1'], coord1: ['coachA', 'coachB'] };
          return Promise.resolve(chiesti.flatMap((id) => (figli[id] ?? []).map((x) => ({ id: x }))));
        }),
      },
    } as never;
    const portata = await coachTeamScope(prisma, 'resp-user');
    expect(portata?.sort()).toEqual(['coachA', 'coachB', 'coord1', 'resp'].sort());
  });

  it('una coach resta con le sue clienti: risalire non allarga chi sta in fondo', async () => {
    const { coachTeamScope } = await import('./coach-team');
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ role: 'coach' }) },
      staff: { findUnique: jest.fn().mockResolvedValue({ id: 'coachA' }), findMany: jest.fn().mockResolvedValue([]) },
    } as never;
    expect(await coachTeamScope(prisma, 'coach-user')).toEqual(['coachA']);
  });

  it('senza scheda staff non vede NIENTE, non tutto: in dubbio si chiude', async () => {
    const { coachTeamScope } = await import('./coach-team');
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ role: 'coach_coordinator' }) },
      staff: { findUnique: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
    } as never;
    const portata = await coachTeamScope(prisma, 'ignota');
    expect(portata).toEqual(['00000000-0000-0000-0000-000000000000']);
  });
});
