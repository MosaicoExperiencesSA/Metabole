import { avvisaAttivitaNuova, escalateAttivitaScadute, MAX_ESCALATION_PER_GIRO } from './avvisi-attivita';
import { PrismaService } from '../prisma/prisma.service';

/**
 * LE DUE REGOLE DI SIMONE (14/8): l'attività nuova arriva alla coach anche via PUSH, e quella
 * rimasta «da fare» il giorno dopo la scadenza va alla MANAGER delle coach — una volta sola.
 * Decisione in progetto/NOTA_Attivita_Coach_Push_Escalation.md.
 */

const push = () => ({ sendToUser: jest.fn().mockResolvedValue(undefined) });

function prismaFinto(over: Record<string, unknown> = {}) {
  return {
    user: { findUnique: jest.fn().mockResolvedValue({ id: 'u-coach', prefs: null }), findMany: jest.fn().mockResolvedValue([{ id: 'u-manager' }]) },
    clientProfile: {
      findUnique: jest.fn().mockResolvedValue({
        name: 'Giulia Rossi',
        assignedCoach: { id: 'staff-c', userId: 'u-coach', displayName: 'Sara' },
      }),
    },
    notification: { create: jest.fn().mockResolvedValue({}), findFirst: jest.fn().mockResolvedValue(null) },
    coachTask: { findMany: jest.fn().mockResolvedValue([]) },
    ...over,
  } as unknown as PrismaService;
}

describe('avvisaAttivitaNuova — la push alla creazione', () => {
  const TASK = { id: 't1', clientId: 'c1', title: 'Messaggio personale di benvenuto (G1)', description: 'È il momento che decide tutto.', dueDate: new Date('2026-08-14') };

  it('manda in-app E push alla coach della cliente', async () => {
    const prisma = prismaFinto();
    const p = push();
    await avvisaAttivitaNuova(prisma, p, TASK);
    const creata = (prisma as unknown as { notification: { create: jest.Mock } }).notification.create.mock.calls[0][0].data;
    expect(creata.userId).toBe('u-coach');
    expect(creata.type).toBe('coach_task_new');
    // ⚠️ title e body vivono dentro payload: la tabella non ha quelle colonne.
    expect(creata.payload.title).toContain('attività');
    expect(creata.payload.body).toContain('Giulia Rossi');
    expect(p.sendToUser).toHaveBeenCalledWith('u-coach', expect.any(String), expect.stringContaining('Giulia Rossi'), expect.objectContaining({ type: 'coach_task_new' }));
  });

  it('⚠️ senza coach assegnata NON manda niente (la vede il responsabile in pagina)', async () => {
    const prisma = prismaFinto({ clientProfile: { findUnique: jest.fn().mockResolvedValue({ name: 'Giulia', assignedCoach: null }) } });
    const p = push();
    await avvisaAttivitaNuova(prisma, p, TASK);
    expect(p.sendToUser).not.toHaveBeenCalled();
  });

  it('⚠️ non lancia mai: un avviso che non parte non blocca la creazione', async () => {
    const prisma = prismaFinto({ clientProfile: { findUnique: jest.fn().mockRejectedValue(new Error('db giù')) } });
    await expect(avvisaAttivitaNuova(prisma, push(), TASK)).resolves.toBeUndefined();
  });
});

describe('escalateAttivitaScadute — alla manager, il giorno dopo la scadenza, una volta sola', () => {
  const SCADUTA = {
    id: 't1', clientId: 'c1', title: 'WhatsApp di chiusura prova (G7)', dueDate: new Date('2026-08-12'),
    client: { firstName: 'Giulia', lastName: 'Rossi', clientProfile: { name: 'Giulia Rossi', assignedCoach: { displayName: 'Sara', userId: 'u-coach' } } },
  };

  it('l\'attività scaduta e ancora «da fare» va alla manager, con coach, cliente e scadenza', async () => {
    const prisma = prismaFinto({ coachTask: { findMany: jest.fn().mockResolvedValue([SCADUTA]) } });
    const p = push();
    const esito = await escalateAttivitaScadute(prisma, p);
    expect(esito.avvisate).toBe(1);
    const creata = (prisma as unknown as { notification: { create: jest.Mock } }).notification.create.mock.calls[0][0].data;
    expect(creata.userId).toBe('u-manager');
    expect(creata.type).toBe('coach_task_escalation');
    expect(creata.payload.body).toContain('Sara');
    expect(creata.payload.body).toContain('Giulia Rossi');
    expect(creata.payload.taskId).toBe('t1');
    expect(p.sendToUser).toHaveBeenCalled();
  });

  it('⚠️ UNA volta sola: se la notifica per quel task esiste già, non si rimanda', async () => {
    const prisma = prismaFinto({
      coachTask: { findMany: jest.fn().mockResolvedValue([SCADUTA]) },
      notification: { create: jest.fn(), findFirst: jest.fn().mockResolvedValue({ id: 'n1' }) },
    });
    const p = push();
    const esito = await escalateAttivitaScadute(prisma, p);
    expect(esito.avvisate).toBe(0);
    expect(p.sendToUser).not.toHaveBeenCalled();
  });

  it('⚠️ il tetto per giro si rispetta E SI DICE quante restano', async () => {
    const tante = Array.from({ length: MAX_ESCALATION_PER_GIRO + 5 }, (_, i) => ({ ...SCADUTA, id: `t${i}` }));
    const prisma = prismaFinto({ coachTask: { findMany: jest.fn().mockResolvedValue(tante) } });
    const esito = await escalateAttivitaScadute(prisma, push());
    expect(esito.avvisate).toBe(MAX_ESCALATION_PER_GIRO);
    expect(esito.rimaste).toBe(5);
  });

  it('senza manager attiva si ripiega sugli admin: un avviso senza destinatario non è un avviso', async () => {
    const findMany = jest.fn()
      .mockResolvedValueOnce([]) // nessuna sales
      .mockResolvedValueOnce([{ id: 'u-admin' }]); // admin di riserva
    const prisma = prismaFinto({
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'x', prefs: null }), findMany },
      coachTask: { findMany: jest.fn().mockResolvedValue([SCADUTA]) },
    });
    await escalateAttivitaScadute(prisma, push());
    const creata = (prisma as unknown as { notification: { create: jest.Mock } }).notification.create.mock.calls[0][0].data;
    expect(creata.userId).toBe('u-admin');
  });

  it('⚠️ non lancia mai, e una lettura rotta torna a mani vuote dicendolo', async () => {
    const prisma = prismaFinto({ coachTask: { findMany: jest.fn().mockRejectedValue(new Error('boom')) } });
    const esito = await escalateAttivitaScadute(prisma, push());
    expect(esito.avvisate).toBe(0);
  });
});
