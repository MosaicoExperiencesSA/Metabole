import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { DietAgentService } from './diet-agent.service';

function make(prisma: Record<string, unknown>) {
  // Default config: pre/post 3, plateau 2, comfortMax 3, reentry 3 (i default reali).
  const config = { getNumber: jest.fn((_k: string, d?: number) => Promise.resolve(d ?? 0)) };
  return new DietAgentService(prisma as unknown as PrismaService, config as unknown as ConfigParamsService);
}

const DAY = 86_400_000;
const ago = (n: number) => new Date(Date.now() - n * DAY);

const base = (over: Record<string, unknown> = {}) => ({
  event: { findFirst: jest.fn().mockResolvedValue(null) },
  /**
   * ⚠️ Il plateau si legge dalle PESATE, non più dai cicli (decisione di Simone, 13/8: «tre pesi
   * registrati consecutivi»). Di default: nessuna misura → nessun plateau.
   */
  measurement: { findMany: jest.fn().mockResolvedValue([]) },
  dailyCheckin: { findMany: jest.fn().mockResolvedValue([]) },
  // Modalità viaggio: di default nessuna. `clientProfile` va sempre presente, perché
  // `stateFor` lo legge per primo — senza, ogni test morirebbe prima di arrivare al suo caso.
  clientProfile: { findUnique: jest.fn().mockResolvedValue({ travelState: null, travelStart: null, travelEnd: null }) },
  analyticsEvent: { findFirst: jest.fn().mockResolvedValue(null) },
  ...over,
});

/** Profilo in modalità viaggio, con le date che l'operatrice avrebbe inserito. */
const viaggio = (state: string, over: { start?: Date | null; end?: Date | null } = {}) => ({
  clientProfile: {
    findUnique: jest.fn().mockResolvedValue({
      travelState: state,
      travelStart: over.start ?? ago(3),
      travelEnd: over.end === undefined ? new Date(Date.now() + 5 * DAY) : over.end,
    }),
  },
});

describe('DietAgentService.stateFor', () => {
  it('pre_evento: evento in arrivo', async () => {
    const prisma = base({ event: { findFirst: jest.fn().mockResolvedValue({ id: 'e1' }) } });
    expect(await make(prisma).stateFor('c1')).toBe('pre_evento');
  });

  it('post_evento: evento concluso di recente (pre-evento assente)', async () => {
    // 1a findFirst (pre-evento) → null, 2a (post-evento) → evento concluso.
    const prisma = base({
      event: { findFirst: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'e2' }) },
    });
    expect(await make(prisma).stateFor('c1')).toBe('post_evento');
  });

  it('plateau: tre pesate senza calo (prima erano i cicli)', async () => {
    const prisma = base({
      measurement: { findMany: jest.fn().mockResolvedValue([{ weightKg: 70 }, { weightKg: 70 }, { weightKg: 69.8 }]) },
    });
    expect(await make(prisma).stateFor('c1')).toBe('plateau');
  });

  /**
   * LA DECISIONE DEL 13/8, in tre casi.
   *
   * Simone: «se abbiamo un problema di umore vincono le 5 stelle, se il problema è il peso che non
   * scende vince l'efficacia» — e quando ci sono tutti e due, vince l'efficacia con un giorno di
   * conforto a settimana.
   */
  it('⚠️ peso fermo E umore basso → plateau_conforto, non conforto', async () => {
    // È il caso che prima non esisteva: il plateau tornava prima ancora di guardare l'umore, e
    // «peso fermo» e «peso fermo mentre sta male» erano indistinguibili.
    const prisma = base({
      measurement: { findMany: jest.fn().mockResolvedValue([{ weightKg: 70 }, { weightKg: 70 }, { weightKg: 70 }]) },
      dailyCheckin: { findMany: jest.fn().mockResolvedValue([{ mood: 'hard', date: ago(0) }]) },
    });
    expect(await make(prisma).stateFor('c1')).toBe('plateau_conforto');
  });

  it('⚠️ il guardrail del conforto lungo resta davanti: niente giorno di stelle', async () => {
    // Se sta giù da troppi giorni si spinge comunque l'efficacia, e senza il giorno di conforto:
    // il guardrail esiste proprio per non lasciarla ferma nei menu amati.
    const prisma = base({
      measurement: { findMany: jest.fn().mockResolvedValue([{ weightKg: 70 }, { weightKg: 70 }, { weightKg: 70 }]) },
      dailyCheckin: {
        findMany: jest.fn().mockResolvedValue([
          { mood: 'hard', date: ago(0) }, { mood: 'hard', date: ago(1) },
          { mood: 'hard', date: ago(2) }, { mood: 'hard', date: ago(3) },
        ]),
      },
    });
    expect(await make(prisma).stateFor('c1')).toBe('rientro');
  });

  it('peso che scende e umore basso → conforto, come prima', async () => {
    const prisma = base({
      measurement: { findMany: jest.fn().mockResolvedValue([{ weightKg: 69 }, { weightKg: 70 }, { weightKg: 71 }]) },
      dailyCheckin: { findMany: jest.fn().mockResolvedValue([{ mood: 'hard', date: ago(0) }]) },
    });
    expect(await make(prisma).stateFor('c1')).toBe('conforto');
  });

  it('conforto: umore basso recente sotto la soglia del guardrail', async () => {
    const prisma = base({
      dailyCheckin: { findMany: jest.fn().mockResolvedValue([{ mood: 'hard', date: ago(0) }, { mood: 'hard', date: ago(1) }]) },
    });
    expect(await make(prisma).stateFor('c1')).toBe('conforto');
  });

  it('rientro (guardrail): troppi giorni di conforto di fila → si spinge l\'efficacia', async () => {
    // 4 giorni "difficili" consecutivi > comfortMax (3) → rientro.
    const prisma = base({
      dailyCheckin: {
        findMany: jest.fn().mockResolvedValue([
          { mood: 'hard', date: ago(0) },
          { mood: 'stressed', date: ago(1) },
          { mood: 'hard', date: ago(2) },
          { mood: 'hard', date: ago(3) },
        ]),
      },
    });
    expect(await make(prisma).stateFor('c1')).toBe('rientro');
  });

  it('rientro (recupero): umore risalito dopo un periodo difficile', async () => {
    const prisma = base({
      dailyCheckin: { findMany: jest.fn().mockResolvedValue([{ mood: 'good', date: ago(0) }, { mood: 'hard', date: ago(1) }]) },
    });
    expect(await make(prisma).stateFor('c1')).toBe('rientro');
  });

  it('normale: umore buono senza periodi difficili recenti', async () => {
    const prisma = base({
      dailyCheckin: { findMany: jest.fn().mockResolvedValue([{ mood: 'good', date: ago(0) }, { mood: 'ok', date: ago(1) }]) },
    });
    expect(await make(prisma).stateFor('c1')).toBe('normale');
  });

  it('conforto ignorato se il check-in più recente è vecchio', async () => {
    const prisma = base({
      dailyCheckin: { findMany: jest.fn().mockResolvedValue([{ mood: 'hard', date: ago(5) }]) },
    });
    expect(await make(prisma).stateFor('c1')).toBe('normale');
  });

  // --- Modalità viaggio (piani estate) ---

  it('vacanza: la cliente è via → menu che mangerà davvero, e vince su tutto', async () => {
    // Anche con un plateau in corso: spingere l'efficacia addosso a chi è al mare produce
    // menu ignorati, non chili persi.
    const prisma = base({
      ...viaggio('in_vacanza'),
      measurement: { findMany: jest.fn().mockResolvedValue([{ weightKg: 70 }, { weightKg: 70 }, { weightKg: 69.8 }]) },
    });
    expect(await make(prisma).stateFor('c1')).toBe('vacanza');
  });

  it('in partenza: è un evento a tutti gli effetti → pre_evento', async () => {
    const prisma = base(viaggio('in_partenza'));
    expect(await make(prisma).stateFor('c1')).toBe('pre_evento');
  });

  it('una vacanza SCADUTA non conta più: si torna ai segnali normali', async () => {
    // È il caso vero: nessuno azzera `travelState` al rientro.
    const prisma = base({
      ...viaggio('in_vacanza', { start: ago(60), end: ago(40) }),
      measurement: { findMany: jest.fn().mockResolvedValue([{ weightKg: 70 }, { weightKg: 70 }, { weightKg: 69.8 }]) },
    });
    expect(await make(prisma).stateFor('c1')).toBe('plateau');
  });

  it('rientrato da poco → spinta al recupero, contata dall\'evento travel_return', async () => {
    const prisma = base({
      clientProfile: { findUnique: jest.fn().mockResolvedValue({ travelState: 'rientrato', travelStart: null, travelEnd: null }) },
      analyticsEvent: { findFirst: jest.fn().mockResolvedValue({ receivedAt: ago(2) }) },
    });
    expect(await make(prisma).stateFor('c1')).toBe('post_evento');
  });

  it('rientrato da mesi → non spinge più niente: il campo resta scritto, l\'evento no', async () => {
    const prisma = base({
      clientProfile: { findUnique: jest.fn().mockResolvedValue({ travelState: 'rientrato', travelStart: null, travelEnd: null }) },
      analyticsEvent: { findFirst: jest.fn().mockResolvedValue({ receivedAt: ago(90) }) },
    });
    expect(await make(prisma).stateFor('c1')).toBe('normale');
  });

  it('rientrato senza nessun evento registrato → nessuna spinta inventata', async () => {
    const prisma = base({
      clientProfile: { findUnique: jest.fn().mockResolvedValue({ travelState: 'rientrato', travelStart: null, travelEnd: null }) },
    });
    expect(await make(prisma).stateFor('c1')).toBe('normale');
  });
});
