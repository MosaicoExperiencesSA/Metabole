import { ProfileService } from './profile.service';

/**
 * ⛔ **LA SOSPENSIONE IMMEDIATA, col Prisma finto.** La decisione è di Lucia (5/9): una
 * controindicazione che emerge mentre la cliente **sta già digiunando** la riporta alla giornata
 * piena, subito. Queste prove tengono fermo che succeda davvero, che resti scritto perché, e —
 * soprattutto — che NON succeda quando non deve.
 */

function monta(profili: Record<string, unknown>[], pesate: Record<string, number | null> = {}) {
  const scritture: { userId: string; data: Record<string, unknown> }[] = [];
  const segnalazioni: unknown[] = [];
  const prisma: Record<string, unknown> = {
    clientProfile: {
      findMany: jest.fn(async (a: { where?: { pathType?: string; OR?: unknown } }) => (a?.where?.OR ? [] : profili)),
      update: jest.fn(async (a: { where: { userId: string }; data: Record<string, unknown> }) => {
        scritture.push({ userId: a.where.userId, data: a.data });
        return {};
      }),
    },
    measurement: {
      findFirst: jest.fn(async (a: { where: { clientId: string } }) => {
        const w = pesate[a.where.clientId];
        return w === undefined ? null : { weightKg: w };
      }),
    },
    escalation: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(async (a: unknown) => { segnalazioni.push(a); return { id: 'e1' }; }),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const configParams = { getNumber: jest.fn().mockResolvedValue(60), getString: jest.fn(), getBool: jest.fn() };
  const personalBase = { buildPersonalBase: jest.fn().mockResolvedValue(undefined) };
  const service = new ProfileService(
    prisma as never, configParams as never, audit as never, personalBase as never, {} as never,
  );
  return { service, scritture, segnalazioni, prisma, audit, personalBase };
}

const sana = { userId: 'u-ok', name: 'Sana', heightCm: 168, startWeightKg: 65, fastingExclusions: { dca: false, gravidanza: false, ipoglicemizzanti: false }, fastingSospesoIl: null };

describe('sospendiDigiuniControindicati', () => {
  it('⚠️ nessuna controindicazione: non scrive niente, e il caso normale non costa', async () => {
    const { service, scritture, segnalazioni } = monta([sana]);
    const out = await service.sospendiDigiuniControindicati();
    expect(out).toEqual({ guardate: 1, sospese: 0, falliti: 0, motivi: [] });
    expect(scritture).toHaveLength(0);
    expect(segnalazioni).toHaveLength(0);
  });

  it('⛔ gravidanza dichiarata: torna alla giornata piena, la finestra si azzera, e resta scritto perché', async () => {
    const { service, scritture, audit } = monta([{ ...sana, userId: 'u-grav', name: 'Anna', fastingExclusions: { gravidanza: true } }]);
    const out = await service.sospendiDigiuniControindicati();
    expect(out.sospese).toBe(1);
    expect(scritture[0].userId).toBe('u-grav');
    expect(scritture[0].data).toMatchObject({ pathType: 'classic3', fastingWindow: null });
    expect(String(scritture[0].data.fastingSospesoPerche)).toMatch(/gravidanza/);
    expect(scritture[0].data.fastingSospesoIl).toBeInstanceOf(Date);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'digiuno.sospeso_per_controindicazione' }));
  });

  it('⛔ un BMI bassissimo NON sospende: sospende solo quello che qualcuno ha dichiarato (revisione 5/9)', async () => {
    const { service, scritture } = monta([{ ...sana, userId: 'u-magra', heightCm: 175 }], { 'u-magra': 45 });
    expect((await service.sospendiDigiuniControindicati()).sospese).toBe(0);
    expect(scritture).toHaveLength(0);
  });

  it('⛔ azzera TUTTO l\'orologio, non tre colonne su sette: `fastingSceltoIl` compreso', async () => {
    const { service, scritture } = monta([{ ...sana, userId: 'u-g', fastingExclusions: { gravidanza: true } }]);
    await service.sospendiDigiuniControindicati();
    for (const c of ['fastingWindow', 'fastingProtocol', 'fastingStartMin', 'fastingTargetStartMin', 'fastingTargetProtocol', 'fastingSceltoIl', 'fastingChangedAt']) {
      expect(scritture[0].data).toHaveProperty(c, null);
    }
  });

  it('⛔ e la base personale si rifà: la giornata piena col pool del digiuno sarebbe senza colazione', async () => {
    const { service, personalBase } = monta([{ ...sana, userId: 'u-g', fastingExclusions: { dca: true } }]);
    await service.sospendiDigiuniControindicati();
    expect(personalBase.buildPersonalBase).toHaveBeenCalledWith('u-g');
  });

  it('⚠️ un errore su una cliente non ferma le altre', async () => {
    const { service, prisma } = monta([
      { ...sana, userId: 'u-1', fastingExclusions: { dca: true } },
      { ...sana, userId: 'u-2', fastingExclusions: { dca: true } },
    ]);
    (prisma.clientProfile as { update: jest.Mock }).update
      .mockRejectedValueOnce(new Error('riga sparita'));
    const out = await service.sospendiDigiuniControindicati();
    expect(out).toMatchObject({ sospese: 2, falliti: 1 });
  });

  it('⚠️ e chi non ha mai risposto alle tre domande non viene sospeso: NULL non è «sì»', async () => {
    const { service } = monta([{ ...sana, userId: 'u-mai', fastingExclusions: null }]);
    expect((await service.sospendiDigiuniControindicati()).sospese).toBe(0);
  });
});
