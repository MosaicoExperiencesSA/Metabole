import { apriSegnalazione } from './apri-segnalazione';

/**
 * Il caso vero, quello che ha fatto scrivere questa funzione (9/8).
 *
 * Rosaria si iscrive il 20 luglio: dichiara una condizione clinica e un'allergia al pesce, il
 * motore non riesce a comporre un piano sicuro (pranzo 0, cena 0 ricette compatibili) e apre la
 * segnalazione «Piano bloccato». Non aveva ancora una nutrizionista assegnata, quindi la
 * segnalazione nasceva **senza destinatario**: nessuna notifica, nessuno che la vedesse se non
 * andando a cercare l'elenco. Quattro giorni di menu senza pranzo né cena, prova gratuita
 * scaduta il 30 luglio, venti giorni di silenzio. Nessun errore da nessuna parte.
 */
function harness(over: Record<string, unknown> = {}) {
  return {
    escalation: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'esc-1', ...data })),
    },
    clientProfile: { findUnique: jest.fn().mockResolvedValue({ assignedCoachId: null, assignedNutritionistId: null, name: 'Rosaria' }) },
    staff: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue({ id: 'staff-capo', userId: 'user-capo' }),
    },
    notification: { create: jest.fn().mockResolvedValue({}) },
    ...over,
  } as any;
}

describe('apriSegnalazione', () => {
  it('nessuna nutrizionista assegnata → la prende in carico il CAPO, e viene avvisato', async () => {
    const prisma = harness();
    await apriSegnalazione(prisma, { clientId: 'cli-1', category: 'diet_blocked', reason: 'pranzo 0, cena 0' });

    // Prima restava «non assegnata a nessuno»: in elenco è esattamente quella che nessuno guarda.
    expect(prisma.escalation.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ assignedToId: 'staff-capo' }) }),
    );
    expect(prisma.staff.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { user: { role: 'head_nutritionist' } } }),
    );
    const notifica = prisma.notification.create.mock.calls[0][0].data;
    expect(notifica.userId).toBe('user-capo');
    expect(notifica.type).toBe('escalation_diet_blocked');
    expect(notifica.payload.nonAssegnata).toBe(true);
    expect(notifica.payload.body).toContain('Rosaria');
  });

  it('con la nutrizionista assegnata la prende lei, e l’avviso arriva anche alla coach', async () => {
    const prisma = harness({
      clientProfile: { findUnique: jest.fn().mockResolvedValue({ assignedCoachId: 'staff-coach', assignedNutritionistId: 'staff-nutri', name: 'Anna' }) },
      staff: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'staff-coach', userId: 'user-coach' },
          { id: 'staff-nutri', userId: 'user-nutri' },
        ]),
        findFirst: jest.fn(),
      },
    });
    await apriSegnalazione(prisma, { clientId: 'cli-1', category: 'diet_blocked', reason: 'x' });

    expect(prisma.escalation.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ assignedToId: 'staff-nutri' }) }),
    );
    // Il capo non viene disturbato: c'è già chi la prende.
    expect(prisma.staff.findFirst).not.toHaveBeenCalled();
    const destinatari = prisma.notification.create.mock.calls.map((c: any) => c[0].data.userId);
    expect(destinatari.sort()).toEqual(['user-coach', 'user-nutri']);
  });

  it('una segnalazione aperta della stessa categoria non si duplica', async () => {
    const prisma = harness({ escalation: { findFirst: jest.fn().mockResolvedValue({ id: 'gia-aperta' }), create: jest.fn() } });
    const res = await apriSegnalazione(prisma, { clientId: 'cli-1', category: 'diet_blocked', reason: 'x' });
    expect(res).toEqual({ id: 'gia-aperta' });
    expect(prisma.escalation.create).not.toHaveBeenCalled();
  });

  it('se qualcosa esplode NON trascina con sé l’erogazione del menu', async () => {
    const prisma = harness({ clientProfile: { findUnique: jest.fn().mockRejectedValue(new Error('db giù')) } });
    await expect(
      apriSegnalazione(prisma, { clientId: 'cli-1', category: 'diet_blocked', reason: 'x' }),
    ).resolves.toBeNull();
  });
});
