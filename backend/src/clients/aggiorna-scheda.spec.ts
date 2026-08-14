/**
 * «MODIFICA SCHEDA» DEVE SCRIVERE — il test che mancava.
 *
 * L'11/8 `updateClient` costruiva le operazioni Prisma in un array e **non le eseguiva mai**: le
 * operazioni di Prisma sono pigre, costruirle non le esegue. Ogni salvataggio della scheda cliente
 * — telefono, indirizzo, dieta, obiettivo — non arrivava al database.
 *
 * Il difetto è sopravvissuto perché **tutto il resto funzionava**: l'audit scriveva «cambiato da X
 * a Y» (lo calcola dai valori *richiesti*), i menu venivano rigenerati, la risposta tornava senza
 * errori. Nessun test guardava la sola cosa che conta: che la scrittura parta.
 *
 * Quindi questi test non verificano «il salvataggio funziona»: verificano che `$transaction` venga
 * **chiamata** con dentro le operazioni. È la differenza fra un test che descrive l'intenzione e uno
 * che avrebbe visto il difetto.
 */
import { ClientsService } from './clients.service';

function servizio(prismaExtra: Record<string, unknown> = {}) {
  const chiamate: { transaction: unknown[][] } = { transaction: [] };
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({ id: 'u1', role: 'client' }),
      update: jest.fn().mockReturnValue({ op: 'user.update' }),
    },
    clientProfile: {
      findUnique: jest.fn().mockResolvedValue({ dietFamily: 'Pescetariana', regime: 'omnivore', dietStyle: 'mediterranean' }),
      upsert: jest.fn().mockReturnValue({ op: 'profile.upsert' }),
    },
    rolePagePermission: { findUnique: jest.fn().mockResolvedValue({ canManage: true }) },
    $transaction: jest.fn().mockImplementation((ops: unknown[]) => { chiamate.transaction.push(ops); return Promise.resolve([]); }),
    ...prismaExtra,
  } as never;
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const menu = { redeliverFutureDays: jest.fn().mockResolvedValue({ removed: 0, delivered: [] }) };
  const s = new ClientsService(prisma, {} as never, audit as never, {} as never, menu as never);
  // Il perimetro e il permesso non sono l'oggetto di questi test.
  (s as unknown as { assertClientAccess: () => Promise<void> }).assertClientAccess = () => Promise.resolve();
  (s as unknown as { roleCanManage: () => Promise<boolean> }).roleCanManage = () => Promise.resolve(true);
  return { s, prisma: prisma as unknown as Record<string, { [k: string]: jest.Mock }> & { $transaction: jest.Mock }, chiamate, audit };
}

describe('updateClient — le scritture partono davvero', () => {
  it('cambiando la DIETA, la scrittura arriva al database', async () => {
    const { s, prisma, chiamate } = servizio();
    await s.updateClient('u1', 'admin', { dietFamily: 'Mediterranea' } as never);
    expect(prisma.clientProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ dietFamily: 'Mediterranea' }) }),
    );
    // ⚠️ Il punto del test: costruire l'operazione NON la esegue.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(chiamate.transaction[0]).toContainEqual({ op: 'profile.upsert' });
  });

  it("cambiando l'anagrafica, la scrittura sull'utente arriva al database", async () => {
    const { s, prisma, chiamate } = servizio();
    await s.updateClient('u1', 'admin', { phone: '+39 333 1112223' } as never);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(chiamate.transaction[0]).toContainEqual({ op: 'user.update' });
  });

  it('anagrafica E profilo insieme: due operazioni, una sola transazione', async () => {
    const { s, chiamate } = servizio();
    await s.updateClient('u1', 'admin', { phone: '+39 333', name: 'Simo' } as never);
    expect(chiamate.transaction).toHaveLength(1);
    expect(chiamate.transaction[0]).toHaveLength(2);
  });

  it('richiesta VUOTA: nessuna transazione a vuoto', async () => {
    const { s, prisma } = servizio();
    await s.updateClient('u1', 'admin', {} as never);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("l'audit non deve poter dire «cambiato» se la scrittura non è partita", async () => {
    const { s, prisma, audit } = servizio();
    await s.updateClient('u1', 'admin', { dietFamily: 'Mediterranea' } as never);
    const scritta = audit.log.mock.calls.map((c) => c[0]).find((a) => a.action === 'client.update');
    expect(scritta).toBeTruthy();
    // Se un domani qualcuno toglie di nuovo l'esecuzione, questo test cade insieme all'audit:
    // sono le due metà della bugia dell'11/8.
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});

describe('updateClient — «lascia i giorni già preparati» (Vera, azione 3, 14/8)', () => {
  it('di default il cambio dieta RIFÀ i giorni futuri (comportamento della scheda)', async () => {
    const { s } = servizio();
    const menu = (s as unknown as { menu: { redeliverFutureDays: jest.Mock } }).menu;
    await s.updateClient('u1', 'admin', { dietFamily: 'Mediterranea' } as never);
    expect(menu.redeliverFutureDays).toHaveBeenCalledWith('u1');
  });

  it('⚠️ col flag i giorni erogati NON si toccano: la dieta nuova entra coi prossimi menu', async () => {
    const { s } = servizio();
    const menu = (s as unknown as { menu: { redeliverFutureDays: jest.Mock } }).menu;
    await s.updateClient('u1', 'admin', { dietFamily: 'Mediterranea', dietChangeKeepDeliveredDays: true } as never);
    expect(menu.redeliverFutureDays).not.toHaveBeenCalled();
  });

  it('il flag NON finisce sul profilo: è un\'istruzione, non un dato', async () => {
    const { s, prisma } = servizio();
    await s.updateClient('u1', 'admin', { dietFamily: 'Mediterranea', dietChangeKeepDeliveredDays: true } as never);
    const upsert = prisma.clientProfile.upsert.mock.calls[0]?.[0];
    expect(JSON.stringify(upsert ?? {})).not.toContain('dietChangeKeepDeliveredDays');
  });
});
