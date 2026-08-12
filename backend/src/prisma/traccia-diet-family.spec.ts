import { tracciaDietFamily } from './traccia-diet-family';

/** Un delegato Prisma finto: registra come è stato chiamato. */
function delegatoFinto() {
  const chiamate: { metodo: string; arg: unknown }[] = [];
  return {
    chiamate,
    clientProfile: {
      update: (arg: unknown) => { chiamate.push({ metodo: 'update', arg }); return Promise.resolve('ok-update'); },
      upsert: (arg: unknown) => { chiamate.push({ metodo: 'upsert', arg }); return Promise.resolve('ok-upsert'); },
      updateMany: (arg: unknown) => { chiamate.push({ metodo: 'updateMany', arg }); return Promise.resolve('ok-many'); },
      findUnique: (arg: unknown) => { chiamate.push({ metodo: 'findUnique', arg }); return Promise.resolve(null); },
    },
  };
}

const loggerFinto = () => ({ warn: jest.fn() }) as unknown as { warn: jest.Mock };

describe('tracciaDietFamily', () => {
  it('segnala chi scrive dietFamily, col valore e con lo stack', async () => {
    const p = delegatoFinto();
    const log = loggerFinto();
    tracciaDietFamily(p as never, log as never);
    await (p.clientProfile as never as { update: (a: unknown) => Promise<unknown> }).update({
      where: { userId: 'u1' }, data: { dietFamily: 'Pescetariana', dietStyle: 'mediterranean' },
    });
    expect(log.warn).toHaveBeenCalledTimes(1);
    const testo = log.warn.mock.calls[0][0] as string;
    expect(testo).toContain('dietFamily="Pescetariana"');
    expect(testo).toContain('at '); // lo stack: è la parte per cui esiste
  });

  it('guarda ENTRAMBI i rami dell\'upsert', async () => {
    const p = delegatoFinto();
    const log = loggerFinto();
    tracciaDietFamily(p as never, log as never);
    await (p.clientProfile as never as { upsert: (a: unknown) => Promise<unknown> }).upsert({
      where: { userId: 'u1' }, create: { userId: 'u1' }, update: { dietFamily: 'Mediterranea' },
    });
    expect(log.warn).toHaveBeenCalledTimes(1);
  });

  it('tace su tutto il resto: non è un registro di ogni scrittura', async () => {
    const p = delegatoFinto();
    const log = loggerFinto();
    tracciaDietFamily(p as never, log as never);
    const cp = p.clientProfile as never as Record<string, (a: unknown) => Promise<unknown>>;
    await cp.update({ where: { userId: 'u1' }, data: { name: 'Anna' } });
    await cp.findUnique({ where: { userId: 'u1' } });
    expect(log.warn).not.toHaveBeenCalled();
  });

  it('NON cambia il comportamento: le chiamate arrivano identiche e il risultato torna', async () => {
    const p = delegatoFinto();
    tracciaDietFamily(p as never, loggerFinto() as never);
    const cp = p.clientProfile as never as Record<string, (a: unknown) => Promise<unknown>>;
    const arg = { where: { userId: 'u1' }, data: { dietFamily: 'X' } };
    await expect(cp.update(arg)).resolves.toBe('ok-update');
    expect(p.chiamate).toEqual([{ metodo: 'update', arg }]);
  });

  it('se la traccia esplode, la scrittura passa lo stesso', async () => {
    const p = delegatoFinto();
    const log = { warn: () => { throw new Error('logger rotto'); } };
    tracciaDietFamily(p as never, log as never);
    const cp = p.clientProfile as never as Record<string, (a: unknown) => Promise<unknown>>;
    await expect(cp.update({ where: {}, data: { dietFamily: 'X' } })).resolves.toBe('ok-update');
  });

  it('si può spegnere con TRACCIA_DIET_FAMILY=0', async () => {
    const prima = process.env.TRACCIA_DIET_FAMILY;
    process.env.TRACCIA_DIET_FAMILY = '0';
    try {
      const p = delegatoFinto();
      const log = loggerFinto();
      tracciaDietFamily(p as never, log as never);
      await (p.clientProfile as never as Record<string, (a: unknown) => Promise<unknown>>).update({ where: {}, data: { dietFamily: 'X' } });
      expect(log.warn).not.toHaveBeenCalled();
    } finally {
      if (prima === undefined) delete process.env.TRACCIA_DIET_FAMILY; else process.env.TRACCIA_DIET_FAMILY = prima;
    }
  });
});
