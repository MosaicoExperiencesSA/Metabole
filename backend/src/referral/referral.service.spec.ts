import { AuditService } from '../audit/audit.service';
import { ConfigParamsService } from '../config-params/config-params.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReferralService } from './referral.service';

const makeConfig = (rewardDays = 30) =>
  ({ getNumber: jest.fn(async (_k: string, def?: number) => (rewardDays ?? def) as number) }) as unknown as ConfigParamsService;
const audit = { log: jest.fn() } as unknown as AuditService;

const make = (prisma: Record<string, unknown>, rewardDays = 30) =>
  new ReferralService(prisma as unknown as PrismaService, makeConfig(rewardDays), audit);

describe('ReferralService.ensureCode', () => {
  it('riusa il codice esistente', async () => {
    const prisma = {
      clientProfile: {
        findUnique: jest.fn().mockResolvedValue({ referralCode: 'ABCD2345' }),
        upsert: jest.fn(),
      },
    };
    const code = await make(prisma).ensureCode('c1');
    expect(code).toBe('ABCD2345');
    expect(prisma.clientProfile.upsert).not.toHaveBeenCalled();
  });

  it('genera col metodo aziendale (cognome+iniziale+01) se manca', async () => {
    const prisma = {
      clientProfile: {
        // 1a chiamata: profilo senza codice · poi check unicità → libero
        findUnique: jest.fn().mockResolvedValueOnce({ referralCode: null }).mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
      },
      user: { findUnique: jest.fn().mockResolvedValue({ firstName: 'Giulia', lastName: 'Bianchi' }) },
      staff: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const code = await make(prisma).ensureCode('c1');
    expect(code).toBe('BIANCG01');
    expect(prisma.clientProfile.upsert).toHaveBeenCalled();
  });

  it('senza nome ricade sul codice casuale (8 caratteri)', async () => {
    const prisma = {
      clientProfile: {
        findUnique: jest.fn().mockResolvedValueOnce({ referralCode: null }).mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
      },
      user: { findUnique: jest.fn().mockResolvedValue({ firstName: null, lastName: null }) },
      staff: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const code = await make(prisma).ensureCode('c1');
    expect(code).toHaveLength(8);
    expect(prisma.clientProfile.upsert).toHaveBeenCalled();
  });

  it('non usa un codice già occupato da una coach', async () => {
    const prisma = {
      clientProfile: {
        findUnique: jest.fn().mockImplementation(({ where }: any) =>
          Promise.resolve(where.userId ? { referralCode: null } : null)),
        upsert: jest.fn().mockResolvedValue({}),
      },
      user: { findUnique: jest.fn().mockResolvedValue({ firstName: 'AnnaLisa', lastName: 'Volpetti' }) },
      // VOLPEA01 è il ref code della coach → si passa a VOLPEA02
      staff: { findUnique: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve(where.refCode === 'VOLPEA01' ? { id: 'coach-staff' } : null)) },
    };
    const code = await make(prisma).ensureCode('c1');
    expect(code).toBe('VOLPEA02');
  });
});

describe('ReferralService.linkOnRegister', () => {
  it('registra l\'invito quando il codice è di un\'altra cliente', async () => {
    const prisma = {
      clientProfile: { findUnique: jest.fn().mockResolvedValue({ userId: 'referrer-1' }) },
      referral: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
    };
    const ok = await make(prisma).linkOnRegister('referred-1', 'abcd2345');
    expect(ok).toBe(true);
    expect(prisma.referral.create).toHaveBeenCalledWith({
      data: { referrerClientId: 'referrer-1', referredClientId: 'referred-1', code: 'ABCD2345' },
    });
  });

  it('non si auto-invita', async () => {
    const prisma = {
      clientProfile: { findUnique: jest.fn().mockResolvedValue({ userId: 'same' }) },
      referral: { findUnique: jest.fn(), create: jest.fn() },
    };
    expect(await make(prisma).linkOnRegister('same', 'ABCD2345')).toBe(false);
    expect(prisma.referral.create).not.toHaveBeenCalled();
  });

  it('idempotente: se già invitata non crea un secondo invito', async () => {
    const prisma = {
      clientProfile: { findUnique: jest.fn().mockResolvedValue({ userId: 'referrer-1' }) },
      referral: { findUnique: jest.fn().mockResolvedValue({ id: 'r1' }), create: jest.fn() },
    };
    expect(await make(prisma).linkOnRegister('referred-1', 'ABCD2345')).toBe(false);
    expect(prisma.referral.create).not.toHaveBeenCalled();
  });

  it('codice sconosciuto → nessun invito', async () => {
    const prisma = {
      clientProfile: { findUnique: jest.fn().mockResolvedValue(null) },
      referral: { findUnique: jest.fn(), create: jest.fn() },
    };
    expect(await make(prisma).linkOnRegister('referred-1', 'ZZZZ9999')).toBe(false);
  });
});

describe('ReferralService.onConvert', () => {
  it('converte e premia estendendo l\'abbonamento attivo della referrer', async () => {
    const end = new Date('2026-08-01T00:00:00.000Z');
    const subUpdate = jest.fn().mockResolvedValue({});
    const refUpdate = jest.fn().mockResolvedValue({});
    const prisma = {
      referral: {
        findUnique: jest.fn().mockResolvedValue({ id: 'r1', referrerClientId: 'referrer-1', convertedAt: null }),
        update: refUpdate,
      },
      subscription: {
        findFirst: jest.fn().mockResolvedValue({ id: 'sub-1', endDate: end }),
        update: subUpdate,
      },
    };
    await make(prisma, 30).onConvert('referred-1');
    // convertedAt + rewardedAt = 2 update sull'invito
    expect(refUpdate).toHaveBeenCalledTimes(2);
    const newEnd = subUpdate.mock.calls[0][0].data.endDate as Date;
    expect(newEnd.getTime()).toBe(new Date('2026-08-31T00:00:00.000Z').getTime());
  });

  it('già convertito → non fa nulla', async () => {
    const prisma = {
      referral: { findUnique: jest.fn().mockResolvedValue({ id: 'r1', referrerClientId: 'x', convertedAt: new Date() }), update: jest.fn() },
      subscription: { findFirst: jest.fn(), update: jest.fn() },
    };
    await make(prisma).onConvert('referred-1');
    expect(prisma.subscription.findFirst).not.toHaveBeenCalled();
  });

  it('nessun abbonamento attivo → converte ma non premia (ricompensa in sospeso)', async () => {
    const refUpdate = jest.fn().mockResolvedValue({});
    const prisma = {
      referral: {
        findUnique: jest.fn().mockResolvedValue({ id: 'r1', referrerClientId: 'referrer-1', convertedAt: null }),
        update: refUpdate,
      },
      subscription: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn() },
    };
    await make(prisma).onConvert('referred-1');
    expect(refUpdate).toHaveBeenCalledTimes(1); // solo convertedAt
  });

  it('nessun invito per questa cliente → nessuna azione', async () => {
    const prisma = {
      referral: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() },
      subscription: { findFirst: jest.fn(), update: jest.fn() },
    };
    await make(prisma).onConvert('referred-x');
    expect(prisma.referral.update).not.toHaveBeenCalled();
  });
});
