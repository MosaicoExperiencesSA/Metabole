import { decisioneDelloStaffDaAvvisare, testoObiettivoRiscritto } from '../clients/obiettivo-dallo-staff';
import { STAFF_NOTIFICATION_TYPES } from '../notifications/staff-notifications';
import { ProfileService } from './profile.service';

/**
 * ⛔ **LA CLIENTE RISCRIVE DALL'APP L'OBIETTIVO DECISO DALLO STAFF** (Simone, 15/9: «si ok» alla
 * strada (b) — lo può fare, ma chi l'aveva deciso lo deve sapere).
 *
 * Qui si prova che `updateObjective` — la porta della cliente — **usi** la regola: avvisa coach,
 * nutrizionista e chi aveva deciso, e lascia la nota; e che non lo faccia quando sopra non c'era
 * una decisione dello staff.
 */
const STAFF = {
  at: '2026-09-15T08:00:00.000Z',
  event: 'updated_by_staff',
  byUserId: 'user-admin',
  byStaffId: 'staff-admin',
  motivo: 'ritmo irreale',
};

describe('decisioneDelloStaffDaAvvisare', () => {
  it('⛔ solo se l\'ULTIMA riga dello storico è una decisione dello staff', () => {
    expect(decisioneDelloStaffDaAvvisare([STAFF])).toEqual({ at: STAFF.at, byUserId: 'user-admin', motivo: 'ritmo irreale' });
    expect(decisioneDelloStaffDaAvvisare([{ event: 'updated_by_client' }, STAFF])).not.toBeNull();
    // Già riscritta una volta: l'avviso è partito allora.
    expect(decisioneDelloStaffDaAvvisare([STAFF, { event: 'updated_by_client' }])).toBeNull();
    expect(decisioneDelloStaffDaAvvisare([STAFF, { event: 'reconfirmed_after_visit' }])).toBeNull();
    for (const vuoto of [null, undefined, [], {}, 'x', [null]]) expect(decisioneDelloStaffDaAvvisare(vuoto)).toBeNull();
  });

  it('i campi che mancano diventano null, non stringhe vuote', () => {
    expect(decisioneDelloStaffDaAvvisare([{ event: 'updated_by_staff', motivo: '  ' }])).toEqual({ at: null, byUserId: null, motivo: null });
  });
});

describe('testoObiettivoRiscritto', () => {
  it('dice chi, da cosa a cosa (giorno di Roma), quando e perché lo staff aveva deciso', () => {
    const t = testoObiettivoRiscritto({
      nome: 'Giulia',
      prima: { targetWeightKg: 62, targetDate: new Date('2026-12-01T00:00:00.000Z') },
      // 23:30 UTC del 9/3 = 10/3 a Roma
      dopo: { targetWeightKg: 58.5, targetDate: new Date('2027-03-09T23:30:00.000Z') },
      decisa: { at: STAFF.at, byUserId: 'u', motivo: 'ritmo irreale' },
    });
    expect(t).toBe(
      "Giulia ha cambiato dall'app l'obiettivo deciso dallo staff il 15/09/2026: " +
        'da 62,0 kg entro il 01/12/2026 a 58,5 kg entro il 10/03/2027. Il motivo dello staff era: ritmo irreale',
    );
  });
});

describe('⛔ il tipo di avviso è nel catalogo dello staff (o non si potrebbe spegnere)', () => {
  it('c\'è, e lo ricevono coach, nutrizioniste, capo e admin', () => {
    const t = STAFF_NOTIFICATION_TYPES.find((x) => x.key === 'obiettivo_riscritto_dalla_cliente');
    expect(t?.roles).toEqual(expect.arrayContaining(['coach', 'nutritionist', 'head_nutritionist', 'admin']));
  });
});

function montaggio(history: unknown[]) {
  const current = {
    id: 'obj-1',
    clientId: 'cli-1',
    targetWeightKg: 62,
    targetWaistCm: null,
    targetDate: new Date('2026-12-01T00:00:00.000Z'),
    status: 'confirmed',
    history,
  };
  const prisma = {
    objective: {
      findFirst: jest.fn().mockResolvedValue(current),
      update: jest.fn().mockImplementation(({ data }: { data: object }) => Promise.resolve({ ...current, ...data })),
    },
    clientProfile: {
      findUnique: jest.fn().mockImplementation((q: { select?: Record<string, boolean> }) =>
        Promise.resolve(
          q?.select?.assignedCoachId
            ? { assignedCoachId: 'staff-coach', assignedNutritionistId: 'staff-nutri' }
            : { userId: 'cli-1', name: 'Giulia', startWeightKg: 70, startWaistCm: null },
        ),
      ),
    },
    staff: {
      findMany: jest.fn().mockResolvedValue([{ userId: 'user-coach' }, { userId: 'user-nutri' }]),
    },
    user: {
      findUnique: jest.fn().mockImplementation(({ where }: { where: { id: string } }) => Promise.resolve({ id: where.id, prefs: {} })),
      findMany: jest.fn().mockResolvedValue([]),
    },
    notification: { create: jest.fn().mockResolvedValue({}) },
    clientNote: { create: jest.fn().mockResolvedValue({}) },
  };
  const configParams = {
    getNumber: jest.fn((_k: string, d: number) => Promise.resolve(d)),
    getString: jest.fn((_k: string, d: string) => Promise.resolve(d)),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const push = { sendToUser: jest.fn().mockResolvedValue(undefined) };
  const service = new ProfileService(prisma as never, configParams as never, audit as never, {} as never, push as never);
  return { service, prisma, push };
}

describe('⛔ updateObjective (la porta della cliente) avvisa quando riscrive una decisione dello staff', () => {
  it('avvisa coach, nutrizionista e chi aveva deciso — una volta ciascuno — e lascia la nota', async () => {
    const { service, prisma } = montaggio([STAFF]);
    await service.updateObjective('cli-1', { weightToLoseKg: 5, weeks: 10 } as never);
    // Prima la scrittura della cliente, poi l'avviso.
    expect(prisma.objective.update).toHaveBeenCalledTimes(1);
    const destinatari = prisma.notification.create.mock.calls.map((c) => (c[0] as { data: { userId: string } }).data.userId).sort();
    expect(destinatari).toEqual(['user-admin', 'user-coach', 'user-nutri']);
    const riga = prisma.notification.create.mock.calls[0][0] as { data: { type: string; payload: Record<string, unknown> } };
    expect(riga.data.type).toBe('obiettivo_riscritto_dalla_cliente');
    expect(riga.data.payload.clientId).toBe('cli-1');
    expect(String(riga.data.payload.body)).toContain('Giulia ha cambiato dall\'app');
    const nota = prisma.clientNote.create.mock.calls[0][0] as { data: { clientId: string; authorId: null; body: string } };
    expect(nota.data.clientId).toBe('cli-1');
    expect(nota.data.authorId).toBeNull();
    expect(nota.data.body).toContain('da 62,0 kg entro il 01/12/2026 a 65,0 kg');
    expect(prisma.objective.update.mock.invocationCallOrder[0]).toBeLessThan(prisma.notification.create.mock.invocationCallOrder[0]);
  });

  it('chi aveva deciso ed è anche la coach riceve UN avviso, non due', async () => {
    const { service, prisma } = montaggio([{ ...STAFF, byUserId: 'user-coach' }]);
    await service.updateObjective('cli-1', { weightToLoseKg: 5, weeks: 10 } as never);
    const destinatari = prisma.notification.create.mock.calls.map((c) => (c[0] as { data: { userId: string } }).data.userId).sort();
    expect(destinatari).toEqual(['user-coach', 'user-nutri']);
  });

  it('⛔ niente avvisi né nota se sopra non c\'era una decisione dello staff', async () => {
    const { service, prisma } = montaggio([STAFF, { event: 'updated_by_client' }]);
    await service.updateObjective('cli-1', { weightToLoseKg: 5, weeks: 10 } as never);
    expect(prisma.objective.update).toHaveBeenCalledTimes(1);
    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(prisma.clientNote.create).not.toHaveBeenCalled();
  });

  it('⚠️ se l\'avviso non parte la modifica della cliente resta, e non lancia', async () => {
    const { service, prisma } = montaggio([STAFF]);
    prisma.clientNote.create.mockRejectedValue(new Error('db giù'));
    prisma.notification.create.mockRejectedValue(new Error('db giù'));
    await expect(service.updateObjective('cli-1', { weightToLoseKg: 5, weeks: 10 } as never)).resolves.toMatchObject({
      objective: expect.objectContaining({ id: 'obj-1' }),
    });
  });
});
