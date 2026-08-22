import { CoachTasksService } from './coach-tasks.service';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * UN'ATTIVITÀ APERTA ALL'UNA DI NOTTE NON NASCE GIÀ IN RITARDO.
 *
 * `coach-tasks.service.ts` calcolava «oggi» con `setHours(0, 0, 0, 0)` — il fuso del **processo**,
 * UTC su Render — in tre punti, e `avvisi-attivita.ts` in un quarto. Fra mezzanotte e le 02:00 in
 * Italia rispondevano tutti «ieri». Conseguenze, tutte visibili a una coach:
 *
 *  - un'attività aperta all'una di notte prendeva come scadenza **oggi invece di domani**, cioè
 *    nasceva con un giorno di lavoro già bruciato;
 *  - nella sua lista, un'attività scaduta ieri non risultava «in ritardo» per altre due ore;
 *  - l'escalation alla manager guardava le scadenze di ieri con il calendario sbagliato.
 *
 * ⚠️ Quello che NON è cambiato: il giorno di una data **salvata** (l'inizio di una prova, la fine
 * di un piano) si continua a leggere in UTC. Erano mescolati nella stessa funzione `day()`, che è
 * il motivo per cui il difetto non si vedeva: ora sono `oggiPiu` e `giornoPiu`, e si legge dal nome
 * quale delle due domande si sta facendo.
 */
describe('le attività della coach usano il giorno di Roma', () => {
  /** Le 00:30 del 19 agosto a Roma: per Greenwich sono ancora le 22:30 del 18. */
  const UNA_DI_NOTTE = new Date('2026-08-19T00:30:00+02:00');
  const giorno = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

  const crea = (task: unknown[] = []) => {
    const prisma = {
      coachTask: {
        findMany: jest.fn().mockResolvedValue(task),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 't1', ...data })),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        count: jest.fn().mockResolvedValue(0),
      },
      clientProfile: { findUnique: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
      user: { findUnique: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
      subscription: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), findFirst: jest.fn().mockResolvedValue(null) },
    };
    return {
      prisma,
      service: new CoachTasksService(
        prisma as unknown as PrismaService,
        { log: jest.fn() } as never,
        { getNumber: jest.fn(async (_k: string, d?: number) => d ?? 0) } as never,
        { sendToUser: jest.fn() } as never,
      ),
    };
  };

  it('l’istante di prova è quello giusto', () => {
    expect(UNA_DI_NOTTE.toISOString()).toBe('2026-08-18T22:30:00.000Z');
  });

  it('⚠️ aperta all’una di notte del 19, scade il 20 — non il 19', async () => {
    const { prisma, service } = crea();
    jest.useFakeTimers().setSystemTime(UNA_DI_NOTTE);
    try {
      await service.apriAttivita({
        clientId: 'c1', kind: 'prova', refId: 'r1',
        title: 'Sentila', description: 'Ha finito la prova',
      });
    } finally {
      jest.useRealTimers();
    }
    const scritta = prisma.coachTask.create.mock.calls[0][0].data as { dueDate: Date };
    // «Domani» per chi la deve fare, che sta in Italia.
    expect(scritta.dueDate.toISOString()).toBe('2026-08-20T00:00:00.000Z');
    // Col giorno UTC sarebbe uscito il 19: un giorno di lavoro bruciato prima di cominciare.
    const oggiUtc = Date.UTC(UNA_DI_NOTTE.getUTCFullYear(), UNA_DI_NOTTE.getUTCMonth(), UNA_DI_NOTTE.getUTCDate());
    expect(new Date(oggiUtc + 86_400_000).toISOString()).toBe('2026-08-19T00:00:00.000Z');
  });

  it('⚠️ nella lista, quella scaduta ieri è «in ritardo» già dall’una di notte', async () => {
    const { service } = crea([
      { id: 'a', clientId: 'c1', kind: 'k', title: 'ieri', description: null, dueDate: giorno('2026-08-18'), status: 'todo', client: null },
      { id: 'b', clientId: 'c2', kind: 'k', title: 'oggi', description: null, dueDate: giorno('2026-08-19'), status: 'todo', client: null },
    ]);
    jest.useFakeTimers().setSystemTime(UNA_DI_NOTTE);
    let righe: { title: string; overdue: boolean }[];
    try {
      righe = (await service.list('u1', 'coach')) as { title: string; overdue: boolean }[];
    } finally {
      jest.useRealTimers();
    }
    expect(righe.find((r) => r.title === 'ieri')?.overdue).toBe(true);
    expect(righe.find((r) => r.title === 'oggi')?.overdue).toBe(false);
  });
});
